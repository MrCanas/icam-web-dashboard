import type { PmPortfolioRow } from "@/lib/pm-queries";

export type TrafficLight = "green" | "yellow" | "red";

/** Equivalentes a 60 y 180 días con redondeo estándar PM (días/30). */
const GREEN_MAX_MONTHS = 2;
const YELLOW_MAX_MONTHS = 6;

/** Media de |desviacion_vs_levantamiento_dias| entre hitos con valor. */
export function meanAbsLevantamiento(row: PmPortfolioRow): number | null {
  const vals = row.hitos
    .map((h) => h.desviacion_vs_levantamiento_dias)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    .map((v) => Math.abs(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function trafficLightForActiv(meanDays: number | null): TrafficLight {
  if (meanDays === null) return "green";
  const m = Math.round(meanDays / 30);
  if (m < GREEN_MAX_MONTHS) return "green";
  if (m <= YELLOW_MAX_MONTHS) return "yellow";
  return "red";
}

export function fechaForSnapshot(
  hito: PmPortfolioRow["hitos"][0],
  snapshot: string,
): string | null {
  if (snapshot === "fecha_actual") return hito.fecha_actual;
  return hito.snapshots[snapshot] ?? null;
}

export function parsePmDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Último hito con fecha_actual <= hoy (cumplido); si ninguno, primer hito pendiente sin fecha. */
export function hitoActualYPendiente(row: PmPortfolioRow, today = new Date()) {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let ultimoCumplido: (typeof row.hitos)[0] | null = null;
  let proximo: (typeof row.hitos)[0] | null = null;

  for (const h of row.hitos) {
    const fd = parsePmDate(h.fecha_actual);
    if (fd && fd <= todayStart) {
      ultimoCumplido = h;
    }
  }

  for (const h of row.hitos) {
    const fd = parsePmDate(h.fecha_actual);
    if (!fd || fd > todayStart) {
      proximo = h;
      break;
    }
  }

  return { ultimoCumplido, proximo };
}

export function portfolioPmKpis(rows: PmPortfolioRow[]) {
  let totalHitos = 0;
  let hitosConFecha = 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const means: number[] = [];
  let worst: { id_activo: string; mean: number } | null = null;

  for (const row of rows) {
    totalHitos += row.hitos.length;
    for (const h of row.hitos) {
      const fd = parsePmDate(h.fecha_actual);
      if (fd && fd <= todayStart) hitosConFecha += 1;
    }
    const m = meanAbsLevantamiento(row);
    if (m !== null) {
      means.push(m);
      if (!worst || m > worst.mean) worst = { id_activo: row.activo.id_activo, mean: m };
    }
  }

  const meanPortfolio =
    means.length > 0 ? Math.round(means.reduce((a, b) => a + b, 0) / means.length) : null;

  return {
    nProyectos: rows.length,
    totalHitos,
    hitosCompletados: hitosConFecha,
    desviacionMediaPortfolio: meanPortfolio,
    proyectoMayorRetraso: worst?.id_activo ?? null,
  };
}
