import {
  avgHoldingPeriod,
  computeKPIs,
  getHighTIRInvestment,
  getHoldingPeriodBuckets,
  getMultiploBuckets,
  getTIRBuckets,
  getTop10,
  groupByField,
  groupByVintage,
  segmentKPIs,
} from "@/modules/portfolio/logic/calculations";
import { sanitizeSort, sortProjects } from "@/modules/portfolio/logic/proyectoSort";
import type { BucketCount, HoldingBucket, VintageGroup } from "@/modules/portfolio/logic/calculations";
import type { KPIBundle, Proyecto, SegmentKPIs } from "@/modules/portfolio/types";

export interface PortfolioSearchFilters {
  situacion?: string;
  tipoProyecto?: string;
}

function toNumber(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Filtra filas ya limitadas a `es_ultima_fila` por parámetros de URL del dashboard. */
export function applyPortfolioSearchFilters(
  rows: Proyecto[],
  filters: PortfolioSearchFilters,
): Proyecto[] {
  return rows
    .filter((row) => (filters.situacion ? row.situacion === filters.situacion : true))
    .filter((row) => (filters.tipoProyecto ? row.tipo_proyecto === filters.tipoProyecto : true));
}

export interface DonutSlice {
  label: string;
  count: number;
  inversion: number;
}

export interface ExecutivePageModel {
  proyectos: Proyecto[];
  kpis: KPIBundle;
  top10: ReturnType<typeof getTop10>;
  segmented: SegmentKPIs;
  donutTipoData: DonutSlice[];
  donutSituacionData: DonutSlice[];
  distributionRows: DonutSlice[];
}

export function buildExecutivePageModel(proyectos: Proyecto[]): ExecutivePageModel {
  const kpis = computeKPIs(proyectos);
  const top10 = getTop10(proyectos);
  const groupedTipo = groupByField(proyectos, "tipo_proyecto");
  const groupedSituacion = groupByField(proyectos, "situacion");
  const segmented = segmentKPIs(proyectos);

  const donutTipoData = Object.entries(groupedTipo).map(([label, value]) => ({
    label,
    count: value.count,
    inversion: value.inversion,
  }));
  const donutSituacionData = Object.entries(groupedSituacion).map(([label, value]) => ({
    label,
    count: value.count,
    inversion: value.inversion,
  }));

  return {
    proyectos,
    kpis,
    top10,
    segmented,
    donutTipoData,
    donutSituacionData,
    distributionRows: [...donutTipoData, ...donutSituacionData],
  };
}

export interface RentabilidadPageModel {
  proyectos: Proyecto[];
  kpis: KPIBundle;
  tirBuckets: BucketCount[];
  multiploBuckets: BucketCount[];
  highTIRInvestment: number;
  highTIRPctOfTotal: number;
}

export function buildRentabilidadPageModel(proyectos: Proyecto[]): RentabilidadPageModel {
  const kpis = computeKPIs(proyectos);
  const tirBuckets = getTIRBuckets(proyectos);
  const multiploBuckets = getMultiploBuckets(proyectos);
  const highTIRInvestment = getHighTIRInvestment(proyectos, 0.15);
  const highTIRPctOfTotal = kpis.inversionTotal > 0 ? highTIRInvestment / kpis.inversionTotal : 0;

  return {
    proyectos,
    kpis,
    tirBuckets,
    multiploBuckets,
    highTIRInvestment,
    highTIRPctOfTotal,
  };
}

export interface TendenciasPageModel {
  vintageGroups: VintageGroup[];
  holdingBuckets: HoldingBucket[];
  holdingAvg: number;
  activos: Proyecto[];
  culminados: Proyecto[];
}

export function buildTendenciasPageModel(rows: Proyecto[]): TendenciasPageModel {
  const vintageGroups = Object.values(groupByVintage(rows));
  return {
    vintageGroups,
    holdingBuckets: getHoldingPeriodBuckets(rows),
    holdingAvg: avgHoldingPeriod(rows),
    activos: rows.filter((p) => p.situacion === "En Marcha"),
    culminados: rows.filter((p) => p.situacion === "Culminado"),
  };
}

export interface ProyectosActivosPageModel {
  projects: Proyecto[];
  inversionComprometida: number;
  activeCount: number;
}

export function buildProyectosActivosPageModel(
  rows: Proyecto[],
  sort: string | undefined,
): ProyectosActivosPageModel {
  const projects = sortProjects(rows, sanitizeSort(sort));
  const inversionComprometida = rows.reduce(
    (acc, row) => acc + toNumber(row.inversion_total),
    0,
  );
  return {
    projects,
    inversionComprometida,
    activeCount: rows.length,
  };
}

/** Filtrado en cliente (hook useProyectos) — misma regla que applyPortfolioSearchFilters. */
export function filterProyectosForClient(
  rows: Proyecto[],
  filters: PortfolioSearchFilters,
): Proyecto[] {
  return applyPortfolioSearchFilters(
    rows.filter((row) => row.es_ultima_fila === 1),
    filters,
  );
}
