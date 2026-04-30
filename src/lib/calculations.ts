import { GroupedMetric, KPIBundle, Proyecto, SegmentKPIs } from "@/lib/types";

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
