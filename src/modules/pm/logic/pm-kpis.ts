import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";

export type TrafficLight = "green" | "yellow" | "red";

/** Equivalentes a 60 y 180 días con redondeo estándar PM (días/30). */
const GREEN_MAX_MONTHS = 2;
const YELLOW_MAX_MONTHS = 6;

/**
 * Media de |desviación vs levantamiento| entre hitos con valor.
 *
 * Usa la desviación derivada de las fechas, que rellena fetchPmPortfolio; solo
 * cae a la columna del Excel si nadie la calculó (`undefined`). Distinguir
 * `undefined` de `null` es deliberado: si el repositorio la calculó y dio null
 * —porque el hito no tiene plan vigente— hay que respetar ese null. Con `??` se
 * recaería en el valor del Excel, que queda rancio en cuanto la PMO edita.
 */
export function meanAbsLevantamiento(row: PmPortfolioRow): number | null {
  const vals = row.hitos
    .map((h) =>
      h.desviacion_lev_derivada !== undefined
        ? h.desviacion_lev_derivada
        : h.desviacion_vs_levantamiento_dias,
    )
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

/**
 * Fin del día de `today`, para comparar contra fechas de hito.
 *
 * parsePmDate ancla las fechas a las 12:00, así que compararlas contra la
 * medianoche de hoy dejaba un hito que vence HOY fuera de «cumplido», pese a que
 * el KPI se anuncia como «con fecha ≤ hoy». Solo fallaba el día exacto del
 * vencimiento, de ahí que pasara desapercibido.
 */
function endOfDay(today: Date): Date {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Último hito con fecha_actual <= hoy (cumplido); si ninguno, primer hito pendiente sin fecha. */
export function hitoActualYPendiente(row: PmPortfolioRow, today = new Date()) {
  const limite = endOfDay(today);
  let ultimoCumplido: (typeof row.hitos)[0] | null = null;
  let proximo: (typeof row.hitos)[0] | null = null;

  for (const h of row.hitos) {
    const fd = parsePmDate(h.fecha_actual);
    if (fd && fd <= limite) {
      ultimoCumplido = h;
    }
  }

  for (const h of row.hitos) {
    const fd = parsePmDate(h.fecha_actual);
    if (!fd || fd > limite) {
      proximo = h;
      break;
    }
  }

  return { ultimoCumplido, proximo };
}

/** `today` es inyectable para poder testear; en la app se omite. */
export function portfolioPmKpis(rows: PmPortfolioRow[], today = new Date()) {
  let totalHitos = 0;
  let hitosConFecha = 0;
  const limite = endOfDay(today);

  const means: number[] = [];
  let worst: { id_activo: string; mean: number } | null = null;

  for (const row of rows) {
    totalHitos += row.hitos.length;
    for (const h of row.hitos) {
      const fd = parsePmDate(h.fecha_actual);
      if (fd && fd <= limite) hitosConFecha += 1;
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
