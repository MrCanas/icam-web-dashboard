import { GroupedMetric, KPIBundle, Proyecto, SegmentKPIs } from "@/modules/portfolio/types";

function toNumber(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, current) => acc + current, 0) / values.length;
}

export function computeKPIs(data: Proyecto[]): KPIBundle {
  const nProyectos = data.length;
  const nActivos = data.filter((item) => item.situacion === "En Marcha").length;
  const nCulminados = data.filter((item) => item.situacion === "Culminado").length;

  const inversionValues = data
    .map((item) => toNumber(item.inversion_total))
    .filter((value) => value > 0);
  const beneficioValues = data
    .map((item) => toNumber(item.beneficios))
    .filter((value) => value > 0);
  const tirValues = data
    .map((item) => toNumber(item.tir_desp_is))
    .filter((value) => value > 0);
  const roeValues = data
    .map((item) => toNumber(item.roe_desp_is))
    .filter((value) => value > 0);
  const multiploValues = data
    .map((item) => toNumber(item.multiplo))
    .filter((value) => value > 0);
  const pirrValues = data
    .map((item) => toNumber(item.project_irr))
    .filter((value) => value > 0);
  const unidadesValues = data
    .map((item) => toNumber(item.unidades_totales))
    .filter((value) => value > 0);

  const activos = data.filter((item) => item.situacion === "En Marcha");
  const equityActivosValues = activos
    .map((item) => toNumber(item.equity))
    .filter((value) => value > 0);
  const fondosPropiosTotales = activos.reduce((acc, item) => acc + toNumber(item.equity), 0);

  const inversionTotal = data.reduce((acc, item) => acc + toNumber(item.inversion_total), 0);
  const gdvTotal = data.reduce((acc, item) => acc + toNumber(item.total_ingresos_venta), 0);
  const beneficioTotal = data.reduce((acc, item) => acc + toNumber(item.beneficios), 0);
  const unidadesTotales = data.reduce((acc, item) => acc + toNumber(item.unidades_totales), 0);

  const weightedRows = data
    .map((item) => ({
      tir: toNumber(item.tir_desp_is),
      inversion: toNumber(item.inversion_total),
    }))
    .filter((item) => item.tir > 0 && item.inversion > 0);

  const weightedDividend = weightedRows.reduce(
    (acc, item) => acc + item.tir * item.inversion,
    0,
  );
  const weightedDivisor = weightedRows.reduce((acc, item) => acc + item.inversion, 0);

  const tirSup15 = tirValues.filter((value) => value >= 0.15).length;
  const tirValidCount = tirValues.length;

  return {
    nProyectos,
    nActivos,
    nCulminados,
    inversionTotal,
    fondosPropiosTotales,
    fondosPropiosMedia: mean(equityActivosValues),
    gdvTotal,
    beneficioTotal,
    margenPct: inversionTotal > 0 ? beneficioTotal / inversionTotal : 0,
    tirPonderada: weightedDivisor > 0 ? weightedDividend / weightedDivisor : 0,
    tirMedia: mean(tirValues),
    roeMedia: mean(roeValues),
    multiploMedio: mean(multiploValues),
    pirrMedio: mean(pirrValues),
    inversionMedia: mean(inversionValues),
    beneficioMedio: mean(beneficioValues),
    unidadesTotales,
    unidadesMedia: mean(unidadesValues),
    tirSup15,
    tirValidCount,
  };
}

export function getTop10(data: Proyecto[]): Proyecto[] {
  return [...data]
    .sort((a, b) => toNumber(b.inversion_total) - toNumber(a.inversion_total))
    .slice(0, 10);
}

export function groupByField(
  data: Proyecto[],
  field: "tipo_proyecto" | "situacion",
): Record<string, GroupedMetric> {
  return data.reduce<Record<string, GroupedMetric>>((acc, item) => {
    const key = item[field] ?? "Sin dato";
    const previous = acc[key] ?? { count: 0, inversion: 0 };
    acc[key] = {
      count: previous.count + 1,
      inversion: previous.inversion + toNumber(item.inversion_total),
    };
    return acc;
  }, {});
}

export function segmentKPIs(data: Proyecto[]): SegmentKPIs {
  const enMarcha = data.filter((item) => item.situacion === "En Marcha");
  const culminado = data.filter((item) => item.situacion === "Culminado");

  return {
    portfolio: computeKPIs(data),
    enMarcha: computeKPIs(enMarcha),
    culminado: computeKPIs(culminado),
  };
}

export interface BucketCount {
  label: string;
  count: number;
}

export const TIR_BUCKET_LABEL_ORDER = ["<5%", "5-10%", "10-15%", "15-20%", "≥20%"] as const;

export type TirBucketLabel = (typeof TIR_BUCKET_LABEL_ORDER)[number];

export function tirBucketLabelForValue(tir: number): TirBucketLabel | null {
  if (tir <= 0) return null;
  if (tir < 0.05) return "<5%";
  if (tir < 0.1) return "5-10%";
  if (tir < 0.15) return "10-15%";
  if (tir < 0.2) return "15-20%";
  return "≥20%";
}

export function getTIRBuckets(data: Proyecto[]): BucketCount[] {
  const counts = new Map<string, number>();
  TIR_BUCKET_LABEL_ORDER.forEach((label) => counts.set(label, 0));

  data.forEach((item) => {
    const label = tirBucketLabelForValue(toNumber(item.tir_desp_is));
    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  });

  return TIR_BUCKET_LABEL_ORDER.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));
}

export function listProjectsInTIRBucket(
  proyectos: Proyecto[],
  label: string,
): { proyecto: string; value: number }[] {
  if (!TIR_BUCKET_LABEL_ORDER.includes(label as TirBucketLabel)) {
    return [];
  }
  return proyectos
    .filter((p) => tirBucketLabelForValue(toNumber(p.tir_desp_is)) === label)
    .map((p) => ({ proyecto: p.proyecto, value: toNumber(p.tir_desp_is) }))
    .sort((a, b) => b.value - a.value);
}

export const MULTIPLO_BUCKET_LABEL_ORDER = ["<1.3x", "1.3-1.5x", "1.5-1.7x", "≥1.7x"] as const;

export type MultiploBucketLabel = (typeof MULTIPLO_BUCKET_LABEL_ORDER)[number];

export function multiploBucketLabelForValue(multiplo: number): MultiploBucketLabel | null {
  if (multiplo <= 0) return null;
  if (multiplo < 1.3) return "<1.3x";
  if (multiplo < 1.5) return "1.3-1.5x";
  if (multiplo < 1.7) return "1.5-1.7x";
  return "≥1.7x";
}

export function getMultiploBuckets(data: Proyecto[]): BucketCount[] {
  const counts = new Map<string, number>();
  MULTIPLO_BUCKET_LABEL_ORDER.forEach((label) => counts.set(label, 0));

  data.forEach((item) => {
    const label = multiploBucketLabelForValue(toNumber(item.multiplo));
    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  });

  return MULTIPLO_BUCKET_LABEL_ORDER.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
  }));
}

export function listProjectsInMultiploBucket(
  proyectos: Proyecto[],
  label: string,
): { proyecto: string; value: number }[] {
  if (!MULTIPLO_BUCKET_LABEL_ORDER.includes(label as MultiploBucketLabel)) {
    return [];
  }
  return proyectos
    .filter((p) => multiploBucketLabelForValue(toNumber(p.multiplo)) === label)
    .map((p) => ({ proyecto: p.proyecto, value: toNumber(p.multiplo) }))
    .sort((a, b) => b.value - a.value);
}

export function getHighTIRInvestment(data: Proyecto[], threshold = 0.15): number {
  return data.reduce((acc, item) => {
    const tir = toNumber(item.tir_desp_is);
    const inversion = toNumber(item.inversion_total);
    if (tir >= threshold && inversion > 0) {
      return acc + inversion;
    }
    return acc;
  }, 0);
}

export function getTIRColorClass(tir: number): string {
  if (tir >= 0.2) return "bg-[#2D8B4E]";
  if (tir >= 0.15) return "bg-icam-900";
  if (tir >= 0.1) return "bg-icam-gold";
  return "bg-text-muted";
}

function getProjectYear(project: Proyecto): string | null {
  if (project.fecha_inicio) {
    const parsed = new Date(project.fecha_inicio);
    if (!Number.isNaN(parsed.getTime())) {
      return String(parsed.getFullYear());
    }
  }

  if (project.created_at) {
    const parsed = new Date(project.created_at);
    if (!Number.isNaN(parsed.getTime())) {
      return String(parsed.getFullYear());
    }
  }

  return null;
}

export interface VintageGroup {
  year: string;
  count: number;
  invActivos: number;
  invCulminados: number;
  invTotal: number;
  tirPonderada: number;
  proyectos: Proyecto[];
}

export function groupByVintage(data: Proyecto[]): Record<string, VintageGroup> {
  const grouped = data.reduce<Record<string, VintageGroup>>((acc, project) => {
    const year = getProjectYear(project);
    if (!year) return acc;

    const inversion = toNumber(project.inversion_total);
    const key = year;
    const current = acc[key] ?? {
      year,
      count: 0,
      invActivos: 0,
      invCulminados: 0,
      invTotal: 0,
      tirPonderada: 0,
      proyectos: [],
    };

    current.count += 1;
    current.invTotal += inversion;
    if (project.situacion === "En Marcha") current.invActivos += inversion;
    if (project.situacion === "Culminado") current.invCulminados += inversion;
    current.proyectos.push(project);

    acc[key] = current;
    return acc;
  }, {});

  Object.values(grouped).forEach((item) => {
    const weightedRows = item.proyectos
      .map((project) => ({
        tir: toNumber(project.tir_desp_is),
        inversion: toNumber(project.inversion_total),
      }))
      .filter((row) => row.tir > 0 && row.inversion > 0);

    const weightedDividend = weightedRows.reduce((acc, row) => acc + row.tir * row.inversion, 0);
    const weightedDivisor = weightedRows.reduce((acc, row) => acc + row.inversion, 0);
    item.tirPonderada = weightedDivisor > 0 ? weightedDividend / weightedDivisor : 0;
  });

  return grouped;
}

export function avgHoldingPeriod(data: Proyecto[]): number {
  const values = data.map((item) => toNumber(item.holding_period)).filter((value) => value > 0);
  return mean(values);
}

export interface HoldingBucket {
  label: string;
  activos: number;
  culminados: number;
}

export function getHoldingPeriodBuckets(data: Proyecto[]): HoldingBucket[] {
  const buckets: HoldingBucket[] = [
    { label: "<24m", activos: 0, culminados: 0 },
    { label: "24-36m", activos: 0, culminados: 0 },
    { label: "36-48m", activos: 0, culminados: 0 },
    { label: "48-60m", activos: 0, culminados: 0 },
    { label: ">60m", activos: 0, culminados: 0 },
  ];

  data.forEach((project) => {
    const months = toNumber(project.holding_period);
    if (months <= 0) return;

    let bucket: HoldingBucket;
    if (months < 24) bucket = buckets[0];
    else if (months <= 36) bucket = buckets[1];
    else if (months <= 48) bucket = buckets[2];
    else if (months <= 60) bucket = buckets[3];
    else bucket = buckets[4];

    if (project.situacion === "En Marcha") bucket.activos += 1;
    if (project.situacion === "Culminado") bucket.culminados += 1;
  });

  return buckets;
}
