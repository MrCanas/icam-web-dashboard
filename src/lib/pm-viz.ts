import { fechaForSnapshot, parsePmDate } from "@/lib/pm-kpis";
import type { PmHitoEnriched, PmPortfolioRow } from "@/lib/pm-queries";

export const PM_DOMAIN_START = new Date(2020, 0, 1);
export const PM_DOMAIN_END = new Date(2035, 11, 31);

const SENTINEL_PREFIXES = ["1899-12-30", "1899-12-31"];

/** Fecha válida para gráficos o null (Excel vacío / epoch / fuera de rango útil). */
export function normalizePmDate(iso: string | null | undefined): Date | null {
  if (iso == null || String(iso).trim() === "") return null;
  const s = String(iso).trim().slice(0, 10);
  if (SENTINEL_PREFIXES.some((p) => s.startsWith(p))) return null;
  const d = parsePmDate(s);
  if (!d) return null;
  if (d.getFullYear() < 1900) return null;
  return d;
}

/** Fecha dentro del dominio fijo del eje (para dibujo); fuera → null (no estira escala). */
export function dateInChartDomain(d: Date | null): Date | null {
  if (!d) return null;
  const t = d.getTime();
  if (t < PM_DOMAIN_START.getTime() || t > PM_DOMAIN_END.getTime()) return null;
  return d;
}

export function clipRangeToDomain(start: Date, end: Date): { start: Date; end: Date } | null {
  const ds = Math.max(start.getTime(), PM_DOMAIN_START.getTime());
  const de = Math.min(end.getTime(), PM_DOMAIN_END.getTime());
  if (de <= ds) return null;
  return { start: new Date(ds), end: new Date(de) };
}

export function clipToVisibleWindow(
  start: Date,
  end: Date,
  winStart: Date,
  winEnd: Date,
): { start: Date; end: Date } | null {
  const ds = Math.max(start.getTime(), winStart.getTime(), PM_DOMAIN_START.getTime());
  const de = Math.min(end.getTime(), winEnd.getTime(), PM_DOMAIN_END.getTime());
  if (de <= ds) return null;
  return { start: new Date(ds), end: new Date(de) };
}

/** Fecha del hito para el snapshot (solo normalización; sin clip a dominio legacy). */
export function fechaForSnapshotNormalized(
  hito: PmHitoEnriched,
  snapshot: string,
): Date | null {
  const iso = fechaForSnapshot(hito, snapshot);
  return normalizePmDate(iso);
}

export function addCalendarMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  x.setMonth(x.getMonth() + months);
  return x;
}

export function extentWithQuarterMargin(min: Date, max: Date): [Date, Date] {
  return [addCalendarMonths(min, -3), addCalendarMonths(max, 3)];
}

function extentFromDateCollection(dates: Date[]): [Date, Date] {
  if (dates.length === 0) {
    const now = new Date();
    const y = now.getFullYear();
    return extentWithQuarterMargin(new Date(y - 2, 0, 1), new Date(y + 2, 11, 31));
  }
  let minT = Infinity;
  let maxT = -Infinity;
  for (const d of dates) {
    const t = d.getTime();
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  return extentWithQuarterMargin(new Date(minT), new Date(maxT));
}

export function computeGanttExtentForPortfolio(
  rows: PmPortfolioRow[],
  snapshot: string,
): [Date, Date] {
  const dates: Date[] = [];
  for (const row of rows) {
    for (const h of row.hitos) {
      const d = fechaForSnapshotNormalized(h, snapshot);
      if (d) dates.push(d);
    }
  }
  return extentFromDateCollection(dates);
}

export function computeGanttExtentFromHitos(hitos: PmHitoEnriched[], snapshot: string): [Date, Date] {
  const dates: Date[] = [];
  for (const h of hitos) {
    const d = fechaForSnapshotNormalized(h, snapshot);
    if (d) dates.push(d);
  }
  return extentFromDateCollection(dates);
}

export function computeGanttExtentForProject(row: PmPortfolioRow, snapshot: string): [Date, Date] {
  return computeGanttExtentFromHitos(row.hitos, snapshot);
}

export function computeEvolutionExtent(hitos: PmHitoEnriched[], codes: string[]): [Date, Date] {
  const dates: Date[] = [];
  for (const h of hitos) {
    for (const code of codes) {
      const iso = code === "fecha_actual" ? h.fecha_actual : h.snapshots[code];
      const d = normalizePmDate(iso ?? null);
      if (d) dates.push(d);
    }
  }
  return extentFromDateCollection(dates);
}

/** Hitos puntuales: siempre barra de exactamente un trimestre. */
export function isPmPuntoHito(hitoName: string): boolean {
  const n = hitoName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
  if (n === "arras") return true;
  if (n.includes("obtencion licencia")) return true;
  if (n.includes("salida del vehiculo")) return true;
  if (n.includes("entrega llaves operador")) return true;
  return false;
}

export function clipToVisibleWindowOnly(
  start: Date,
  end: Date,
  winStart: Date,
  winEnd: Date,
): { start: Date; end: Date } | null {
  const ds = Math.max(start.getTime(), winStart.getTime());
  const de = Math.min(end.getTime(), winEnd.getTime());
  if (de <= ds) return null;
  return { start: new Date(ds), end: new Date(de) };
}

/** Redondeo estándar PM: días → meses para UI. */
export function deviationDaysToMonths(days: number | null | undefined): number | null {
  if (days == null || !Number.isFinite(days)) return null;
  return Math.round(days / 30);
}

export function formatDeviationMonths(days: number | null | undefined): string {
  const m = deviationDaysToMonths(days);
  if (m == null) return "N/A";
  const sign = m > 0 ? "+" : "";
  return `${sign}${m} m`;
}

/** Baseline plan original (levantamiento) solo para tooltips / desviaciones. */
export function levantamientoDate(hito: PmHitoEnriched): Date | null {
  return normalizePmDate(hito.snapshots["levantamiento"] ?? null);
}

export interface GanttSegmentModel {
  hitoId: string;
  hitoName: string;
  ordenHito: number;
  start: Date;
  end: Date;
  baseline: Date | null;
  deviationVsBaselineDays: number | null;
}

/**
 * Segmentos por hito ordenado: duración real hasta el siguiente hito con fecha,
 * con mínimo visual de un trimestre; hitos puntuales siempre un trimestre exacto.
 */
export function buildGanttSegmentsForProject(
  hitos: PmHitoEnriched[],
  snapshot: string,
  visibleStart: Date,
  visibleEnd: Date,
): GanttSegmentModel[] {
  const sorted = [...hitos].sort((a, b) => a.orden_hito - b.orden_hito);
  const dates: { hito: PmHitoEnriched; start: Date | null }[] = sorted.map((h) => ({
    hito: h,
    start: fechaForSnapshotNormalized(h, snapshot),
  }));

  const segments: GanttSegmentModel[] = [];

  for (let i = 0; i < dates.length; i++) {
    const { hito, start } = dates[i];
    if (!start) continue;

    const puntual = isPmPuntoHito(hito.hito);
    let end: Date;

    if (puntual) {
      end = addCalendarMonths(start, 3);
    } else {
      let next: Date | null = null;
      for (let j = i + 1; j < dates.length; j++) {
        if (dates[j].start) {
          next = dates[j].start!;
          break;
        }
      }
      const rawEnd = next ?? visibleEnd;
      end = rawEnd;
      const minEnd = addCalendarMonths(start, 3);
      if (end.getTime() < minEnd.getTime()) end = minEnd;
    }

    const clipped = clipToVisibleWindowOnly(start, end, visibleStart, visibleEnd);
    if (!clipped) continue;

    const baseline = levantamientoDate(hito);
    let deviationVsBaselineDays: number | null = null;
    if (baseline) {
      deviationVsBaselineDays = Math.round(
        (start.getTime() - baseline.getTime()) / 86400000,
      );
    }

    segments.push({
      hitoId: hito.id,
      hitoName: hito.hito,
      ordenHito: hito.orden_hito,
      start: clipped.start,
      end: clipped.end,
      baseline,
      deviationVsBaselineDays,
    });
  }

  return segments;
}

/** Orden cronológico de códigos YYYY_Qn (menor = más antiguo). */
export function compareQuarterCodes(a: string, b: string): number {
  const pa = parseQuarterCode(a);
  const pb = parseQuarterCode(b);
  if (pa && pb) {
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.q - pb.q;
  }
  if (pa) return -1;
  if (pb) return 1;
  return a.localeCompare(b);
}

export function parseQuarterCode(code: string): { y: number; q: number } | null {
  const m = /^(\d{4})_Q([1-4])$/i.exec(code.trim());
  if (!m) return null;
  return { y: Number(m[1]), q: Number(m[2]) };
}

/** Trimestres presentes en datos + conocidos, sin levantamiento; orden desc reciente primero. */
export function quarterCodesFromSnapshotList(codes: string[]): string[] {
  const quarters = codes.filter((c) => parseQuarterCode(c) !== null);
  const uniq = [...new Set(quarters)];
  uniq.sort((a, b) => -compareQuarterCodes(a, b));
  return uniq;
}

/** Trimestre más reciente entre lista de códigos. */
export function latestQuarterCode(codes: string[]): string | null {
  const q = quarterCodesFromSnapshotList(codes);
  return q[0] ?? null;
}

export function formatSnapshotLabel(code: string): string {
  if (code === "fecha_actual") return "Fecha actual";
  const p = parseQuarterCode(code);
  if (p) return `Q${p.q} ${p.y}`;
  return code;
}

/** Snapshots presentes en datos: trimestres cronológicos + fecha_actual al final. */
export function defaultEvolutionSnapshotOrder(
  row: PmPortfolioRow,
  allQuarterCodes: string[],
): string[] {
  const fromRow = new Set<string>();
  for (const h of row.hitos) {
    if (normalizePmDate(h.fecha_actual)) fromRow.add("fecha_actual");
    for (const [k, v] of Object.entries(h.snapshots)) {
      if (parseQuarterCode(k) && normalizePmDate(v)) fromRow.add(k);
    }
  }
  const quarters = allQuarterCodes.filter((c) => fromRow.has(c));
  quarters.sort(compareQuarterCodes);
  const ordered: string[] = [...quarters];
  if (fromRow.has("fecha_actual")) ordered.push("fecha_actual");
  return ordered;
}

export type PmDeviationTrend = "worse" | "stable" | "better";

export interface PmDeviationTableRow {
  hito: string;
  ordenHito: number;
  fechaActual: string | null;
  fechaLevantamiento: string | null;
  deviationDays: number | null;
  trend: PmDeviationTrend | null;
}

function fmtEs(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function deviationVsLev(hitoDate: Date | null, lev: Date | null): number | null {
  if (!hitoDate || !lev) return null;
  return Math.round((hitoDate.getTime() - lev.getTime()) / 86400000);
}

/** Tabla desviación vs levantamiento; tendencia entre último snapshot con fecha y el anterior. */
export function buildPmDeviationRows(
  hitos: PmHitoEnriched[],
  allQuarterCodes: string[],
): PmDeviationTableRow[] {
  const sorted = [...hitos].sort((a, b) => a.orden_hito - b.orden_hito);
  const quarters = [...allQuarterCodes].filter((c) => parseQuarterCode(c)).sort(compareQuarterCodes);
  const sequence = [...quarters, "fecha_actual"];

  return sorted.map((h) => {
    const fLev = normalizePmDate(h.snapshots["levantamiento"] ?? null);
    const fechaAct = normalizePmDate(h.fecha_actual);

    const datesRev: Date[] = [];
    for (let i = sequence.length - 1; i >= 0 && datesRev.length < 2; i--) {
      const code = sequence[i];
      const iso = code === "fecha_actual" ? h.fecha_actual : h.snapshots[code];
      const d = normalizePmDate(iso ?? null);
      if (d) datesRev.push(d);
    }
    const latestDate = datesRev[0] ?? null;
    const prevDate = datesRev[1] ?? null;

    const deviationDays = deviationVsLev(latestDate, fLev);
    const dPrev = deviationVsLev(prevDate, fLev);

    let trend: PmDeviationTrend | null = null;
    if (deviationDays != null && dPrev != null) {
      const curM = deviationDaysToMonths(deviationDays)!;
      const prevM = deviationDaysToMonths(dPrev)!;
      const delta = curM - prevM;
      if (delta > 1) trend = "worse";
      else if (delta < -1) trend = "better";
      else trend = "stable";
    }

    return {
      hito: h.hito,
      ordenHito: h.orden_hito,
      fechaActual: fmtEs(fechaAct),
      fechaLevantamiento: fmtEs(fLev),
      deviationDays,
      trend,
    };
  });
}
