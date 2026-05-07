import type { MondayColumn, MondayItem } from "@/lib/monday/types";
import type {
  MondayAsset,
  MondayFunnelMetric,
  MondayKpiBundle,
  MondayStage,
  MondayStageMetric,
  MondayStatusGroup,
  MondayUseMetric,
} from "@/lib/monday/dashboard-types";

const STAGE_ORDER: MondayStage[] = [
  "recibido",
  "info_solicitada",
  "servilleta",
  "pre_comite",
  "comite",
  "segundo_analisis",
  "loi",
  "adquirido",
  "stand_by",
  "rechazado",
];

function toKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseNumber(text: string | null): number | null {
  if (!text) return null;
  const normalized = text.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStage(raw: string | null): MondayStage {
  const key = toKey(raw ?? "");
  if (!key) return "unknown";
  if (key.includes("recib")) return "recibido";
  if (key.includes("info")) return "info_solicitada";
  if (key.includes("servilleta")) return "servilleta";
  if (key.includes("pre")) return "pre_comite";
  if (key.includes("comite")) return "comite";
  if (key.includes("segundo")) return "segundo_analisis";
  if (key.includes("loi")) return "loi";
  if (key.includes("adquir")) return "adquirido";
  if (key.includes("stand")) return "stand_by";
  if (key.includes("rechaz")) return "rechazado";
  return "unknown";
}

function toStatusGroup(stage: MondayStage): MondayStatusGroup {
  if (stage === "stand_by") return "stand_by";
  if (stage === "rechazado") return "rechazado";
  if (stage === "adquirido") return "adquirido";
  return "en_analisis";
}

function getColumnTextByTitle(
  item: MondayItem,
  columnsById: Map<string, MondayColumn>,
  hints: string[],
): string | null {
  const hintKeys = hints.map(toKey);
  const candidate = item.column_values.find((value) => {
    const columnTitle = columnsById.get(value.id)?.title ?? value.id;
    const key = toKey(columnTitle);
    return hintKeys.some((hint) => key.includes(hint));
  });
  return candidate?.text ?? null;
}

function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return null;
}

export function buildMondayAssets(items: MondayItem[], columns: MondayColumn[]): MondayAsset[] {
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  return items.map((item) => {
    const stageText = getColumnTextByTitle(item, columnsById, ["etapa", "fase", "status"]);
    const useTypeText = getColumnTextByTitle(item, columnsById, ["uso", "use", "tipologia"]);
    const locationText = getColumnTextByTitle(item, columnsById, ["ubicacion", "localizacion", "location"]);
    const askingText = getColumnTextByTitle(item, columnsById, ["precio", "asking", "importe"]);
    const surfaceText = getColumnTextByTitle(item, columnsById, ["superficie", "m2", "sqm"]);
    const receivedText = getColumnTextByTitle(item, columnsById, ["fecha", "received"]);

    const stage = normalizeStage(stageText);

    return {
      id: item.id,
      name: item.name,
      location: locationText,
      useType: useTypeText || "Sin dato",
      stage,
      statusGroup: toStatusGroup(stage),
      receivedAt: parseDate(receivedText),
      askingPriceEur: parseNumber(askingText),
      surfaceSqm: parseNumber(surfaceText),
    };
  });
}

export function applyFilters(
  assets: MondayAsset[],
  options: {
    from?: string;
    to?: string;
    groups: MondayStatusGroup[];
  },
): MondayAsset[] {
  const fromTs = options.from ? new Date(options.from).getTime() : null;
  const toTs = options.to ? new Date(options.to).getTime() : null;

  return assets.filter((asset) => {
    if (!options.groups.includes(asset.statusGroup)) return false;
    if (!asset.receivedAt) return false;
    const ts = new Date(asset.receivedAt).getTime();
    if (fromTs && ts < fromTs) return false;
    if (toTs && ts > toTs) return false;
    return true;
  });
}

export function computeMondayKpis(assets: MondayAsset[]): MondayKpiBundle {
  const analyzed = assets.filter((asset) =>
    ["servilleta", "pre_comite", "comite", "segundo_analisis", "loi", "adquirido"].includes(asset.stage),
  );
  const receivedCount = assets.filter((asset) => asset.stage !== "unknown").length;
  const rejectedCount = assets.filter((asset) => asset.statusGroup === "rechazado").length;
  const standbyCount = assets.filter((asset) => asset.statusGroup === "stand_by").length;
  const inProgressCount = assets.filter((asset) =>
    ["en_analisis", "stand_by"].includes(asset.statusGroup),
  ).length;

  const analyzedWithPrice = analyzed.filter((asset) => (asset.askingPriceEur ?? 0) > 0);
  const analyzedWithSurface = analyzed.filter(
    (asset) => (asset.askingPriceEur ?? 0) > 0 && (asset.surfaceSqm ?? 0) > 0,
  );
  const analyzedSurfaceRows = analyzed.filter((asset) => (asset.surfaceSqm ?? 0) > 0);

  const analyzedVolume = analyzedWithPrice.reduce((acc, item) => acc + (item.askingPriceEur ?? 0), 0);
  const analyzedSurface = analyzedSurfaceRows.reduce((acc, item) => acc + (item.surfaceSqm ?? 0), 0);
  const avgTicket = analyzedWithPrice.length ? analyzedVolume / analyzedWithPrice.length : 0;
  const avgPricePerSqm = analyzedWithSurface.length
    ? analyzedWithSurface.reduce(
        (acc, item) => acc + (item.askingPriceEur ?? 0) / (item.surfaceSqm ?? 1),
        0,
      ) / analyzedWithSurface.length
    : 0;

  const discardRate = receivedCount > 0 ? (rejectedCount + standbyCount) / receivedCount : 0;

  return {
    analyzedCount: analyzed.length,
    inProgressCount,
    rejectedCount,
    receivedCount,
    analyzedVolume,
    analyzedWithPriceCount: analyzedWithPrice.length,
    avgTicket,
    avgPricePerSqm,
    pricePerSqmCount: analyzedWithSurface.length,
    analyzedSurface,
    analyzedWithSurfaceCount: analyzedSurfaceRows.length,
    discardRate,
  };
}

export function buildStageMetrics(assets: MondayAsset[]): MondayStageMetric[] {
  const base = new Map<string, MondayStageMetric>();
  STAGE_ORDER.forEach((stage) => base.set(stage, { stage, count: 0, volume: 0 }));
  assets.forEach((asset) => {
    const key = STAGE_ORDER.includes(asset.stage) ? asset.stage : "unknown";
    if (!base.has(key)) base.set(key, { stage: key, count: 0, volume: 0 });
    const row = base.get(key)!;
    row.count += 1;
    row.volume += asset.askingPriceEur ?? 0;
  });
  return Array.from(base.values()).filter((row) => row.stage !== "unknown");
}

export function buildUseMetrics(assets: MondayAsset[]): MondayUseMetric[] {
  const grouped = new Map<string, MondayUseMetric>();
  assets.forEach((asset) => {
    const key = asset.useType || "Sin dato";
    const current = grouped.get(key) ?? { label: key, count: 0, volume: 0 };
    current.count += 1;
    current.volume += asset.askingPriceEur ?? 0;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
}

export function buildFunnelMetrics(assets: MondayAsset[]): MondayFunnelMetric[] {
  const receivedCount = assets.length;
  const stageCountMap = buildStageMetrics(assets).reduce<Map<string, number>>((acc, item) => {
    acc.set(item.stage, item.count);
    return acc;
  }, new Map());

  return STAGE_ORDER.filter((stage) => !["stand_by"].includes(stage)).map((stage) => {
    const count = stageCountMap.get(stage) ?? 0;
    return {
      stage,
      count,
      percent: receivedCount > 0 ? count / receivedCount : 0,
    };
  });
}

export function getAssetsInProgress(assets: MondayAsset[]): MondayAsset[] {
  return assets
    .filter((asset) => ["en_analisis", "stand_by"].includes(asset.statusGroup))
    .sort((a, b) => {
      const ia = STAGE_ORDER.indexOf(a.stage);
      const ib = STAGE_ORDER.indexOf(b.stage);
      if (ia !== ib) return ia - ib;
      return (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "");
    })
    .slice(0, 50);
}

