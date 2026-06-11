import { computeKPIs } from "@/modules/portfolio/logic/calculations";
import type { ProyectoInsert } from "@/modules/portfolio/data/excel-parser";
import type { Proyecto } from "@/modules/portfolio/types";

export const COMPARE_NUMERIC_TOLERANCE = 1e-3;

const COMPARE_FIELDS = [
  "inversion_total",
  "total_ingresos_venta",
  "beneficios",
  "unidades_totales",
  "tir_desp_is",
  "roe_desp_is",
  "multiplo",
  "project_irr",
  "bcr",
  "situacion",
  "tipo_proyecto",
  "equity",
  "holding_period",
] as const;

export type CompareField = (typeof COMPARE_FIELDS)[number];

export interface KpiSnapshot {
  proyectos: number;
  inversion: number;
  gdv: number;
  beneficio: number;
  tirPond: number;
}

export interface FieldChange<T = number | string | null> {
  antes: T;
  despues: T;
}

export interface ModifiedProjectDiff {
  proyecto: string;
  cambios: Partial<Record<CompareField, FieldChange>>;
}

export interface PortfolioDiffResult {
  resumen: {
    antes: KpiSnapshot;
    despues: KpiSnapshot;
    deltas: {
      proyectos: number;
      inversion: number;
      gdv: number;
      beneficio: number;
      tirPond: number;
    };
  };
  nuevos: string[];
  eliminados: string[];
  modificados: ModifiedProjectDiff[];
  sinCambios: string[];
}

/** Convierte filas del Excel a `Proyecto` ficticio solo para KPIs (ids temporales). */
export function incomingToProyectosForKpi(rows: ProyectoInsert[]): Proyecto[] {
  return rows.map((r, i) => ({
    ...r,
    id: i + 1,
    created_at: null,
  }));
}

export function toKpiSnapshot(proyectos: Proyecto[]): KpiSnapshot {
  const k = computeKPIs(proyectos);
  return {
    proyectos: k.nProyectos,
    inversion: k.inversionTotal,
    gdv: k.gdvTotal,
    beneficio: k.beneficioTotal,
    tirPond: k.tirPonderada,
  };
}

function numClose(a: number | null | undefined, b: number | null | undefined): boolean {
  const na = typeof a === "number" && Number.isFinite(a) ? a : null;
  const nb = typeof b === "number" && Number.isFinite(b) ? b : null;
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) <= COMPARE_NUMERIC_TOLERANCE;
}

function projectForCompare(p: Proyecto | ProyectoInsert): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of COMPARE_FIELDS) {
    o[k] = (p as Record<string, unknown>)[k];
  }
  return o;
}

function diffProject(
  cur: Proyecto,
  inc: ProyectoInsert,
): Partial<Record<CompareField, FieldChange>> | null {
  const cambios: Partial<Record<CompareField, FieldChange>> = {};
  for (const key of COMPARE_FIELDS) {
    const a = projectForCompare(cur)[key];
    const b = projectForCompare(inc)[key];
    let equal = false;
    if (key === "situacion" || key === "tipo_proyecto") {
      equal = String(a ?? "") === String(b ?? "");
    } else if (
      key === "holding_period" ||
      key === "unidades_totales" ||
      [
        "inversion_total",
        "total_ingresos_venta",
        "beneficios",
        "tir_desp_is",
        "roe_desp_is",
        "multiplo",
        "project_irr",
        "bcr",
        "equity",
      ].includes(key)
    ) {
      equal = numClose(
        typeof a === "number" ? a : a == null ? null : Number(a),
        typeof b === "number" ? b : b == null ? null : Number(b),
      );
    } else {
      equal = a === b;
    }
    if (!equal) {
      cambios[key] = {
        antes: (a ?? null) as number | string | null,
        despues: (b ?? null) as number | string | null,
      };
    }
  }
  return Object.keys(cambios).length > 0 ? cambios : null;
}

export function comparePortfolios(
  current: Proyecto[],
  incoming: ProyectoInsert[],
): PortfolioDiffResult {
  const curMap = new Map(current.map((p) => [p.proyecto.trim(), p]));
  const incMap = new Map(incoming.map((p) => [p.proyecto.trim(), p]));

  const curKeys = new Set(curMap.keys());
  const incKeys = new Set(incMap.keys());

  const nuevos = [...incKeys].filter((k) => !curKeys.has(k)).sort();
  const eliminados = [...curKeys].filter((k) => !incKeys.has(k)).sort();

  const modificados: ModifiedProjectDiff[] = [];
  const sinCambios: string[] = [];

  for (const key of incKeys) {
    if (!curKeys.has(key)) continue;
    const cur = curMap.get(key)!;
    const inc = incMap.get(key)!;
    const d = diffProject(cur, inc);
    if (d) {
      modificados.push({ proyecto: key, cambios: d });
    } else {
      sinCambios.push(key);
    }
  }
  modificados.sort((a, b) => a.proyecto.localeCompare(b.proyecto));
  sinCambios.sort((a, b) => a.localeCompare(b));

  const antes = toKpiSnapshot(current);
  const despues = toKpiSnapshot(incomingToProyectosForKpi(incoming));

  return {
    resumen: {
      antes,
      despues,
      deltas: {
        proyectos: despues.proyectos - antes.proyectos,
        inversion: despues.inversion - antes.inversion,
        gdv: despues.gdv - antes.gdv,
        beneficio: despues.beneficio - antes.beneficio,
        tirPond: despues.tirPond - antes.tirPond,
      },
    },
    nuevos,
    eliminados,
    modificados,
    sinCambios,
  };
}

/** Objeto para `upload_logs.detalle` (JSONB). */
export function buildUploadLogDetalle(
  diff: PortfolioDiffResult,
  extras?: { warnings?: string[]; stats?: unknown },
): Record<string, unknown> {
  return {
    resumen: {
      antes: diff.resumen.antes,
      despues: diff.resumen.despues,
      deltas: diff.resumen.deltas,
    },
    nuevos: diff.nuevos,
    eliminados: diff.eliminados,
    modificados: diff.modificados,
    sinCambios: diff.sinCambios,
    ...extras,
  };
}
