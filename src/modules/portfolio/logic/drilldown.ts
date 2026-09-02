/**
 * Resolutores del drill-down de las gráficas: dada una marca pinchada (un
 * sector, una barra, un punto), devuelven los proyectos que hay detrás.
 *
 * Lógica pura y testeable: no toca React ni Supabase. Todas las funciones
 * reciben filas YA filtradas por `es_ultima_fila` y por los filtros de la URL,
 * de modo que el modal siempre enseña lo mismo que la gráfica.
 */
import {
  getProjectYear,
  holdingBucketLabelForValue,
  multiploBucketLabelForValue,
  tirBucketLabelForValue,
} from "@/modules/portfolio/logic/calculations";
import type { Proyecto, SituacionProyecto } from "@/modules/portfolio/types";

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Serie de una gráfica apilada: acota el drill-down a una de las dos mitades. */
export type SerieSituacion = "activos" | "culminados";

const SITUACION_DE_SERIE: Record<SerieSituacion, SituacionProyecto> = {
  activos: "En Marcha",
  culminados: "Culminado",
};

function porSerie(rows: Proyecto[], serie?: SerieSituacion): Proyecto[] {
  if (!serie) return rows;
  return rows.filter((p) => p.situacion === SITUACION_DE_SERIE[serie]);
}

/** Proyectos de un valor concreto de `tipo_proyecto` o `situacion` (los donuts). */
export function projectsByField(
  rows: Proyecto[],
  field: "tipo_proyecto" | "situacion",
  label: string,
): Proyecto[] {
  return rows.filter((p) => String(p[field]) === label);
}

export function projectsInTirBucket(rows: Proyecto[], label: string): Proyecto[] {
  return rows.filter((p) => tirBucketLabelForValue(toNumber(p.tir_desp_is)) === label);
}

export function projectsInMultiploBucket(rows: Proyecto[], label: string): Proyecto[] {
  return rows.filter((p) => multiploBucketLabelForValue(toNumber(p.multiplo)) === label);
}

export function projectsInHoldingBucket(
  rows: Proyecto[],
  label: string,
  serie?: SerieSituacion,
): Proyecto[] {
  const enTramo = rows.filter(
    (p) => holdingBucketLabelForValue(toNumber(p.holding_period)) === label,
  );
  return porSerie(enTramo, serie);
}

/** Proyectos de una añada. `year` llega como string desde el eje de la gráfica. */
export function projectsInVintage(
  rows: Proyecto[],
  year: string,
  serie?: SerieSituacion,
): Proyecto[] {
  const delAnio = rows.filter((p) => getProjectYear(p) === String(year));
  return porSerie(delAnio, serie);
}

/** Un proyecto por su nombre, que es la clave de negocio del maestro. */
export function projectByName(rows: Proyecto[], name: string): Proyecto[] {
  return rows.filter((p) => p.proyecto === name);
}

export interface DrilldownSummary {
  count: number;
  inversion: number;
  beneficio: number;
  /** TIR media ponderada por inversión, coherente con computeKPIs. */
  tirPonderada: number;
}

export function drilldownSummary(rows: Proyecto[]): DrilldownSummary {
  const inversion = rows.reduce((acc, p) => acc + toNumber(p.inversion_total), 0);
  const beneficio = rows.reduce((acc, p) => acc + toNumber(p.beneficios), 0);
  const pesoTir = rows.reduce(
    (acc, p) => acc + toNumber(p.tir_desp_is) * toNumber(p.inversion_total),
    0,
  );

  return {
    count: rows.length,
    inversion,
    beneficio,
    tirPonderada: inversion > 0 ? pesoTir / inversion : 0,
  };
}
