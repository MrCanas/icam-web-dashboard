import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import type { PmAvanceProyecto } from "@/modules/pm/avance/types";
import { compareQuarterCodes, formatSnapshotLabel, normalizePmDate, parseQuarterCode } from "@/modules/pm/logic/pm-viz";

import { fechaEs } from "./fuentes-actas";
import { codigoSnapshot, textoTrimestre, trimestreAnterior, type Trimestre } from "./trimestre";

/**
 * Planificación del proyecto → texto para Claude: los hitos con su plan
 * vigente, lo que se preveía hace un trimestre, el plan original
 * (levantamiento) y el avance de obra al cierre de los dos trimestres.
 *
 * Es la base de los slides de calendario y timeline y de los KPIs: por eso se
 * da en tabla y con las desviaciones ya calculadas, para que Claude no haga
 * aritmética de fechas.
 */

export interface EntradaFuentesPlanificacion {
  row: PmPortfolioRow;
  trimestre: Trimestre;
  hasta: string;
  avanceCierre: PmAvanceProyecto | null;
  avanceCierreAnterior: PmAvanceProyecto | null;
}

/**
 * La foto con la que comparar: el snapshot del trimestre anterior o, si no se
 * tomó, el último anterior a él. Sin esto, un trimestre sin snapshot dejaba la
 * columna vacía y Claude sin forma de saber qué ha cambiado.
 */
export function snapshotDeComparacion(row: PmPortfolioRow, codigoAnterior: string): string | null {
  const codigos = new Set<string>();
  for (const h of row.hitos) {
    for (const [c, v] of Object.entries(h.snapshots)) if (v && parseQuarterCode(c)) codigos.add(c);
  }
  const previos = [...codigos].filter((c) => compareQuarterCodes(c, codigoAnterior) <= 0);
  previos.sort(compareQuarterCodes);
  return previos.at(-1) ?? null;
}

function ymd(d: Date | null): string | null {
  if (!d) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dias(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function conSigno(n: number | null, unidad = "d"): string {
  if (n == null) return "—";
  if (n === 0) return `0 ${unidad}`;
  return `${n > 0 ? "+" : ""}${n} ${unidad}`;
}

function f(d: Date | null): string {
  const s = ymd(d);
  return s ? fechaEs(s) : "—";
}

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v * 10) / 10} %`;
}

export function formatearPlanificacion(e: EntradaFuentesPlanificacion): string {
  const anterior = trimestreAnterior(e.trimestre);
  const codAct = codigoSnapshot(e.trimestre);
  const codPrevio = snapshotDeComparacion(e.row, codigoSnapshot(anterior));
  const etiquetaPrevio = codPrevio ? formatSnapshotLabel(codPrevio) : textoTrimestre(anterior);
  const cierre = normalizePmDate(e.hasta);
  const nombre = e.row.activo.nombre_display?.trim() || e.row.activo.id_activo;

  const lineas: string[] = [
    `### PLANIFICACIÓN DEL PROYECTO ${e.row.activo.id_activo} (${nombre}) · cierre del ${textoTrimestre(e.trimestre)}`,
    `Origen: Planificación (hitos) del portal ICAM. «Plan vigente» es la fecha prevista hoy; «Levantamiento», el plan original. Desviación en días: positivo = retraso. «Cambio en el trimestre» compara el plan vigente con la previsión de la última foto trimestral anterior (${etiquetaPrevio}).`,
  ];

  const hitos = [...e.row.hitos].sort((a, b) => a.orden_hito - b.orden_hito);
  if (!hitos.length) {
    lineas.push("(El proyecto no tiene hitos en Planificación.)");
  } else {
    lineas.push(
      "",
      `| Hito | Plan vigente | Previsto en ${etiquetaPrevio} | Levantamiento | Desviación vs levantamiento | Cambio en el trimestre | Fecha respecto al cierre del ${textoTrimestre(e.trimestre)} |`,
      "|---|---|---|---|---|---|---|",
    );
    let retrasados = 0;
    let adelantados = 0;
    for (const h of hitos) {
      // El snapshot del trimestre que se informa, si ya se ha tomado, manda
      // sobre fecha_actual: es la foto oficial al cierre.
      const vigente = normalizePmDate(h.snapshots[codAct] ?? h.fecha_actual);
      const previo = codPrevio ? normalizePmDate(h.snapshots[codPrevio] ?? null) : null;
      const lev = normalizePmDate(h.snapshots["levantamiento"] ?? null);
      const cambio = dias(vigente, previo);
      if (cambio != null && cambio > 0) retrasados++;
      if (cambio != null && cambio < 0) adelantados++;
      const respecto =
        vigente && cierre ? (vigente.getTime() <= cierre.getTime() ? "hasta el cierre" : "después del cierre") : "—";
      lineas.push(
        `| ${h.hito} | ${f(vigente)} | ${f(previo)} | ${f(lev)} | ${conSigno(dias(vigente, lev))} | ${conSigno(cambio)} | ${respecto} |`,
      );
    }
    lineas.push(
      "",
      `En el trimestre: ${retrasados} hitos se retrasan y ${adelantados} se adelantan respecto a lo previsto en ${etiquetaPrevio}.`,
    );
  }

  const general = (a: PmAvanceProyecto | null) => a?.general?.porcentaje ?? null;
  if (e.avanceCierre || e.avanceCierreAnterior) {
    lineas.push(
      "",
      "### AVANCE DE OBRA",
      `Avance general: ${pct(general(e.avanceCierreAnterior))} al cierre del ${textoTrimestre(anterior)} → ${pct(general(e.avanceCierre))} al cierre del ${textoTrimestre(e.trimestre)}.`,
    );
    const antes = new Map(
      (e.avanceCierreAnterior?.fases ?? []).map((x) => [x.fase.id, x.porcentaje]),
    );
    const fases = (e.avanceCierre?.fases ?? []).filter((x) => x.porcentaje != null || antes.get(x.fase.id) != null);
    if (fases.length) {
      lineas.push("| Fase | Cierre trimestre anterior | Cierre trimestre |", "|---|---|---|");
      for (const x of fases) {
        lineas.push(`| ${x.fase.nombre} | ${pct(antes.get(x.fase.id))} | ${pct(x.porcentaje)} |`);
      }
    }
  }

  return lineas.join("\n");
}
