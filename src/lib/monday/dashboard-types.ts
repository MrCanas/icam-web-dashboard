export type MondayStage =
  | "recibido"
  | "info_solicitada"
  | "servilleta"
  | "pre_comite"
  | "comite"
  | "segundo_analisis"
  | "loi"
  | "adquirido"
  | "stand_by"
  | "rechazado"
  | "unknown";

export type MondayStatusGroup = "en_analisis" | "stand_by" | "rechazado" | "adquirido";

export interface MondayAsset {
  id: string;
  name: string;
  location: string | null;
  useType: string;
  stage: MondayStage;
  statusGroup: MondayStatusGroup;
  receivedAt: string | null;
  askingPriceEur: number | null;
  surfaceSqm: number | null;
}

export interface MondayKpiBundle {
  analyzedCount: number;
  inProgressCount: number;
  rejectedCount: number;
  receivedCount: number;
  analyzedVolume: number;
  analyzedWithPriceCount: number;
  avgTicket: number;
  avgPricePerSqm: number;
  pricePerSqmCount: number;
  analyzedSurface: number;
  analyzedWithSurfaceCount: number;
  discardRate: number;
}

export interface MondayStageMetric {
  stage: string;
  count: number;
  volume: number;
}

export interface MondayUseMetric {
  label: string;
  count: number;
  volume: number;
}

export interface MondayFunnelMetric {
  stage: string;
  count: number;
  percent: number;
}

