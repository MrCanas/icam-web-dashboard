/**
 * Avance de obra visto desde un acta: qué porcentaje tenía cada fase al
 * empezar y al terminar el periodo del acta.
 *
 * Solo se guarda el valor vigente (`pm_avance_obra`) y un histórico append-only
 * de cambios (`pm_avance_obra_historico`), así que el valor a una fecha se
 * reconstruye desde el histórico. Puro: sin Supabase, para poder testearlo.
 */

import type { PmAvanceFaseValor, PmAvanceProyecto } from "@/modules/pm/avance/types";

/** Lo mínimo de una fila del histórico para reconstruir un valor. */
export interface CambioAvance {
  fase_id: string;
  porcentaje_anterior: number | null;
  porcentaje_nuevo: number | null;
  cambiado_at: string;
}

/**
 * Porcentaje de una fase en el instante `corte` (ms epoch, inclusive).
 *
 * - Hay cambios hasta el corte: manda el `porcentaje_nuevo` del último.
 * - Solo hay cambios posteriores: el `porcentaje_anterior` del primero, que es
 *   lo que había antes de tocarlo.
 * - La fase nunca ha cambiado: el valor vigente.
 *
 * NULL se conserva como «sin dato»; nunca se convierte en 0.
 */
export function porcentajeAFecha(
  cambios: readonly CambioAvance[],
  faseId: string,
  corte: number,
  actual: number | null,
): number | null {
  const deLaFase = cambios
    .filter((c) => c.fase_id === faseId)
    .map((c) => ({ c, t: new Date(c.cambiado_at).getTime() }))
    .filter(({ t }) => !Number.isNaN(t))
    .sort((a, b) => a.t - b.t);

  if (deLaFase.length === 0) return actual;

  let ultimoHastaCorte: CambioAvance | null = null;
  for (const { c, t } of deLaFase) {
    if (t <= corte) ultimoHastaCorte = c;
    else break;
  }
  if (ultimoHastaCorte) return ultimoHastaCorte.porcentaje_nuevo;
  return deLaFase[0]!.c.porcentaje_anterior;
}

/**
 * Instantes de corte de un acta `YYYY-MM-DD`–`YYYY-MM-DD`: justo antes de que
 * empiece el primer día y al final del último. Misma convención de hora local
 * que `toIsoRangeBounds` de actas, para que avance y entradas corten igual.
 */
export function cortesDelActa(
  dateFrom: string,
  dateTo: string,
): { desde: number; hasta: number } {
  return {
    desde: new Date(`${dateFrom}T00:00:00`).getTime() - 1,
    hasta: new Date(`${dateTo}T23:59:59.999`).getTime(),
  };
}

export interface AvanceActaFila {
  faseId: string;
  nombre: string;
  /** Valor al empezar el periodo. */
  desde: number | null;
  /** Valor al terminar el periodo. */
  hasta: number | null;
  /** hasta − desde; null si falta cualquiera de los dos. */
  delta: number | null;
}

export interface AvanceActa {
  general: AvanceActaFila | null;
  fases: AvanceActaFila[];
}

function redondea(v: number): number {
  return Math.round(v * 100) / 100;
}

function fila(
  valor: PmAvanceFaseValor,
  cambios: readonly CambioAvance[],
  cortes: { desde: number; hasta: number },
): AvanceActaFila {
  const desde = porcentajeAFecha(cambios, valor.fase.id, cortes.desde, valor.porcentaje);
  const hasta = porcentajeAFecha(cambios, valor.fase.id, cortes.hasta, valor.porcentaje);
  return {
    faseId: valor.fase.id,
    nombre: valor.fase.nombre,
    desde,
    hasta,
    delta: desde === null || hasta === null ? null : redondea(hasta - desde),
  };
}

export function construirAvanceActa(
  data: Pick<PmAvanceProyecto, "general" | "fases">,
  cambios: readonly CambioAvance[],
  cortes: { desde: number; hasta: number },
): AvanceActa {
  return {
    general: data.general ? fila(data.general, cambios, cortes) : null,
    fases: data.fases.map((f) => fila(f, cambios, cortes)),
  };
}

/** Texto del delta: «+12,5 pp», «−3 pp», «=» o «—». */
export function fmtDelta(v: number | null): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "=";
  const abs = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(Math.abs(v));
  return `${v > 0 ? "+" : "−"}${abs} pp`;
}
