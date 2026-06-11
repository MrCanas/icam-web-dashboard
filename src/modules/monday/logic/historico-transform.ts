import { toKey } from "@/modules/monday/logic/dashboard-transform";
import type { MondayAsset, MondayStage } from "@/modules/monday/data/dashboard-types";

/** Etapas del embudo principal (orden de profundidad). */
export const FUNNEL_PIPELINE_STAGES: readonly MondayStage[] = [
  "recibido",
  "info_solicitada",
  "servilleta",
  "pre_comite",
  "comite",
  "segundo_analisis",
  "loi",
  "adquirido",
] as const;

export type HistoricoActivityMode = "activity_logs" | "heuristic";

export interface HistoricoFunnelRow {
  stage: MondayStage;
  label: string;
  count: number;
  volumeEur: number;
  percentOfTop: number;
  conversionToNext: number | null;
}

export interface HistoricoStageDurationRow {
  stage: MondayStage;
  label: string;
  meanDays: number;
  medianDays: number;
  maxDays: number;
  sampleCount: number;
  exceedsThreshold: boolean;
}

export interface HistoricoResolutionStats {
  meanDaysAll: number;
  medianDaysAll: number;
  meanDaysAcquired: number;
  medianDaysAcquired: number;
  meanDaysRejected: number;
  medianDaysRejected: number;
  countAcquired: number;
  countRejected: number;
}

export interface HistoricoEvolutionPoint {
  period: string;
  received: number;
  resolved: number;
}

export interface HistoricoSuccessRatio {
  acquired: number;
  rejected: number;
  acquiredPct: number;
  rejectedPct: number;
}

export function pickStageColumnId(columns: Array<{ id: string; title: string }>): string | null {
  const hints = ["etapa", "fase", "status"];
  for (const col of columns) {
    const key = toKey(col.title);
    if (hints.some((hint) => key.includes(hint))) return col.id;
  }
  return null;
}

export function funnelStageIndex(stage: MondayStage): number | null {
  const i = (FUNNEL_PIPELINE_STAGES as readonly MondayStage[]).indexOf(stage);
  return i >= 0 ? i : null;
}

function stageDisplayLabel(stage: MondayStage): string {
  const map: Partial<Record<MondayStage, string>> = {
    recibido: "Recibido",
    info_solicitada: "Info solicitada",
    servilleta: "Servilleta",
    pre_comite: "Pre-Comité",
    comite: "Comité",
    segundo_analisis: "Segundo análisis",
    loi: "LOI",
    adquirido: "Adquirido",
  };
  return map[stage] ?? stage.replaceAll("_", " ");
}

export function collectBoardGroupTitles(assets: MondayAsset[]): string[] {
  const set = new Set<string>();
  for (const a of assets) set.add(a.boardGroupTitle ?? "Sin grupo");
  return Array.from(set).sort((x, y) => x.localeCompare(y, "es"));
}

export function filterHistoricoAssets(
  assets: MondayAsset[],
  selectedGroupTitles: string[],
  range: { from: number | null; to: number | null } | null,
): MondayAsset[] {
  const groupSet = new Set(selectedGroupTitles);
  return assets.filter((a) => {
    const g = a.boardGroupTitle ?? "Sin grupo";
    if (!groupSet.has(g)) return false;
    if (!range) return true;
    const refRaw = a.receivedAt ?? a.createdAt;
    if (!refRaw) return false;
    const ref = new Date(refRaw).getTime();
    if (Number.isNaN(ref)) return false;
    if (range.from !== null && ref < range.from) return false;
    if (range.to !== null && ref > range.to) return false;
    return true;
  });
}

export function buildLogEventsByItem(
  parsed: Map<string, Array<{ at: string; label: string; stage: MondayStage }>>,
): Map<string, Array<{ at: string; stage: MondayStage }>> {
  const out = new Map<string, Array<{ at: string; stage: MondayStage }>>();
  for (const [id, rows] of parsed) {
    out.set(
      id,
      rows.map((r) => ({ at: r.at, stage: r.stage })),
    );
  }
  return out;
}

/** Timeline fusionada: creación → eventos de log → estado final. */
export function buildMergedTimeline(
  asset: MondayAsset,
  logStages: Array<{ at: string; stage: MondayStage }> | undefined,
): Array<{ at: string; stage: MondayStage }> {
  const rows: Array<{ at: string; stage: MondayStage }> = [];
  if (asset.createdAt) rows.push({ at: asset.createdAt, stage: "recibido" });
  for (const e of logStages ?? []) rows.push({ at: e.at, stage: e.stage });
  const endAt = asset.updatedAt ?? asset.receivedAt ?? asset.createdAt;
  if (endAt) rows.push({ at: endAt, stage: asset.stage });
  rows.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const dedup: typeof rows = [];
  for (const r of rows) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.stage === r.stage && prev.at === r.at) continue;
    dedup.push(r);
  }
  return dedup;
}

export function maxFunnelIndexReached(
  asset: MondayAsset,
  timeline: Array<{ at: string; stage: MondayStage }>,
  useActivityForItem: boolean,
): number {
  if (!useActivityForItem) {
    const cur = funnelStageIndex(asset.stage);
    if (cur !== null) return cur;
    return 0;
  }
  let maxV = -1;
  for (const row of timeline) {
    const fi = funnelStageIndex(row.stage);
    if (fi !== null) maxV = Math.max(maxV, fi);
  }
  const curFi = funnelStageIndex(asset.stage);
  if (curFi !== null) maxV = Math.max(maxV, curFi);
  if (maxV < 0) maxV = 0;
  return maxV;
}

export function buildCumulativeFunnelRows(
  assets: MondayAsset[],
  timelines: Map<string, Array<{ at: string; stage: MondayStage }>>,
  useActivityByItemId: Map<string, boolean>,
): HistoricoFunnelRow[] {
  const n = FUNNEL_PIPELINE_STAGES.length;
  const counts = new Array(n).fill(0);
  const volumes = new Array(n).fill(0);
  for (const a of assets) {
    const useAct = useActivityByItemId.get(a.id) ?? false;
    const tl = timelines.get(a.id) ?? [];
    const maxIdx = maxFunnelIndexReached(a, tl, useAct);
    for (let i = 0; i <= maxIdx; i++) {
      counts[i] += 1;
      volumes[i] += a.askingPriceEur ?? 0;
    }
  }
  const top = counts[0] || 1;
  return FUNNEL_PIPELINE_STAGES.map((stage, i) => {
    const nextCount = i < n - 1 ? counts[i + 1] : null;
    const conversionToNext =
      nextCount !== null && counts[i] > 0 ? nextCount / counts[i] : null;
    return {
      stage,
      label: stageDisplayLabel(stage),
      count: counts[i],
      volumeEur: volumes[i],
      percentOfTop: top > 0 ? counts[i] / top : 0,
      conversionToNext,
    };
  });
}

function firstEnterTimes(timeline: Array<{ at: string; stage: MondayStage }>): Map<MondayStage, number> {
  const m = new Map<MondayStage, number>();
  for (const row of timeline) {
    if (!m.has(row.stage)) m.set(row.stage, new Date(row.at).getTime());
  }
  return m;
}

export function buildStageDurationRows(
  assets: MondayAsset[],
  timelines: Map<string, Array<{ at: string; stage: MondayStage }>>,
  useActivityByItemId: Map<string, boolean>,
  thresholdDays = 30,
): HistoricoStageDurationRow[] {
  const transitions: Array<[MondayStage, MondayStage]> = [];
  for (let i = 0; i < FUNNEL_PIPELINE_STAGES.length - 1; i++) {
    transitions.push([FUNNEL_PIPELINE_STAGES[i]!, FUNNEL_PIPELINE_STAGES[i + 1]!]);
  }
  const samples: number[][] = transitions.map(() => []);

  for (const a of assets) {
    const useAct = useActivityByItemId.get(a.id) ?? false;
    if (!useAct) continue;
    const tl = timelines.get(a.id) ?? [];
    const first = firstEnterTimes(tl);
    for (let i = 0; i < transitions.length; i++) {
      const [s1, s2] = transitions[i];
      const t1 = first.get(s1);
      const t2 = first.get(s2);
      if (t1 === undefined || t2 === undefined) continue;
      if (t2 <= t1) continue;
      samples[i].push((t2 - t1) / 86_400_000);
    }
  }

  return FUNNEL_PIPELINE_STAGES.slice(0, -1).map((stage, i) => {
    const arr = samples[i];
    const sorted = [...arr].sort((x, y) => x - y);
    const meanDays = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
    const medianDays =
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[(sorted.length - 1) / 2]!
          : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
    const maxDays = sorted.length ? sorted[sorted.length - 1]! : 0;
    return {
      stage,
      label: `${stageDisplayLabel(stage)} → ${stageDisplayLabel(FUNNEL_PIPELINE_STAGES[i + 1]!)}`,
      meanDays,
      medianDays,
      maxDays,
      sampleCount: arr.length,
      exceedsThreshold: meanDays > thresholdDays,
    };
  });
}

function medianSorted(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor((sorted.length - 1) / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid]! + sorted[mid + 1]!) / 2;
}

export function buildResolutionStats(
  assets: MondayAsset[],
  timelines: Map<string, Array<{ at: string; stage: MondayStage }>>,
  useActivityByItemId: Map<string, boolean>,
): HistoricoResolutionStats {
  const acquiredDays: number[] = [];
  const rejectedDays: number[] = [];
  const allDays: number[] = [];

  for (const a of assets) {
    if (a.stage !== "adquirido" && a.stage !== "rechazado") continue;
    const useAct = useActivityByItemId.get(a.id) ?? false;
    let days: number | null = null;
    if (useAct) {
      const tl = timelines.get(a.id) ?? [];
      const first = firstEnterTimes(tl);
      const start =
        first.get("recibido") ??
        (a.receivedAt ? new Date(a.receivedAt).getTime() : null) ??
        (a.createdAt ? new Date(a.createdAt).getTime() : null);
      const end = first.get(a.stage);
      if (start !== undefined && start !== null && end !== undefined && end > start) {
        days = (end - start) / 86_400_000;
      }
    }
    if (days === null) {
      const startRaw = a.receivedAt ?? a.createdAt;
      const endRaw = a.updatedAt;
      if (startRaw && endRaw) {
        const start = new Date(startRaw).getTime();
        const end = new Date(endRaw).getTime();
        if (end > start) days = (end - start) / 86_400_000;
      }
    }
    if (days === null) continue;
    allDays.push(days);
    if (a.stage === "adquirido") acquiredDays.push(days);
    if (a.stage === "rechazado") rejectedDays.push(days);
  }

  const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const med = (arr: number[]) => medianSorted([...arr].sort((x, y) => x - y));

  return {
    meanDaysAll: mean(allDays),
    medianDaysAll: med(allDays),
    meanDaysAcquired: mean(acquiredDays),
    medianDaysAcquired: med(acquiredDays),
    meanDaysRejected: mean(rejectedDays),
    medianDaysRejected: med(rejectedDays),
    countAcquired: acquiredDays.length,
    countRejected: rejectedDays.length,
  };
}

export function buildSuccessRatio(assets: MondayAsset[]): HistoricoSuccessRatio {
  const resolved = assets.filter((a) => a.stage === "adquirido" || a.stage === "rechazado");
  const acquired = resolved.filter((a) => a.stage === "adquirido").length;
  const rejected = resolved.filter((a) => a.stage === "rechazado").length;
  const total = acquired + rejected;
  return {
    acquired,
    rejected,
    acquiredPct: total > 0 ? acquired / total : 0,
    rejectedPct: total > 0 ? rejected / total : 0,
  };
}

export function buildEvolutionSeries(
  assets: MondayAsset[],
  timelines: Map<string, Array<{ at: string; stage: MondayStage }>>,
  useActivityByItemId: Map<string, boolean>,
  granularity: "month" | "quarter",
): HistoricoEvolutionPoint[] {
  const receivedMap = new Map<string, number>();
  const resolvedMap = new Map<string, number>();

  const periodKey = (d: Date) => {
    if (granularity === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()}-Q${q}`;
  };

  for (const a of assets) {
    const ref = a.receivedAt ?? a.createdAt;
    if (!ref) continue;
    const d = new Date(ref);
    if (Number.isNaN(d.getTime())) continue;
    const pk = periodKey(d);
    receivedMap.set(pk, (receivedMap.get(pk) ?? 0) + 1);
  }

  for (const a of assets) {
    if (a.stage !== "adquirido" && a.stage !== "rechazado") continue;
    const useAct = useActivityByItemId.get(a.id) ?? false;
    let endMs: number | null = null;
    if (useAct) {
      const tl = timelines.get(a.id) ?? [];
      const first = firstEnterTimes(tl);
      const end = first.get(a.stage);
      if (end !== undefined) endMs = end;
    }
    if (endMs === null && a.updatedAt) endMs = new Date(a.updatedAt).getTime();
    if (endMs === null) continue;
    const d = new Date(endMs);
    if (Number.isNaN(d.getTime())) continue;
    const pk = periodKey(d);
    resolvedMap.set(pk, (resolvedMap.get(pk) ?? 0) + 1);
  }

  const keys = new Set([...receivedMap.keys(), ...resolvedMap.keys()]);
  return Array.from(keys)
    .sort()
    .map((period) => ({
      period,
      received: receivedMap.get(period) ?? 0,
      resolved: resolvedMap.get(period) ?? 0,
    }));
}

export function buildTimelinesForAssets(
  assets: MondayAsset[],
  logEventsByItem: Map<string, Array<{ at: string; stage: MondayStage }>>,
): Map<string, Array<{ at: string; stage: MondayStage }>> {
  const map = new Map<string, Array<{ at: string; stage: MondayStage }>>();
  for (const a of assets) {
    map.set(a.id, buildMergedTimeline(a, logEventsByItem.get(a.id)));
  }
  return map;
}

export function buildUseActivityByItem(
  assets: MondayAsset[],
  logEventsByItem: Map<string, Array<{ at: string; stage: MondayStage }>>,
  globalMode: HistoricoActivityMode,
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const a of assets) {
    const hasRows = (logEventsByItem.get(a.id)?.length ?? 0) > 0;
    map.set(a.id, globalMode === "activity_logs" && hasRows);
  }
  return map;
}
