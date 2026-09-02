/**
 * Proyecciones de vencimiento y captación del portfolio.
 *
 * Lógica pura y testeable: no toca React ni Supabase, y la fecha "hoy" es
 * inyectable para que los tests no dependan del calendario.
 *
 * La fecha de fin de un proyecto sale de `fecha_fin` (columna EndQuarter del
 * maestro). Cuando falta —hay filas históricas sin ella— se estima sumando el
 * holding period, en meses, a la fecha de inicio.
 */
import { addCalendarMonths } from "@/modules/pm/logic/pm-viz";
import type { Proyecto } from "@/modules/portfolio/types";

/** Crecimiento anual por defecto de la captación objetivo (tanto por uno). */
export const CRECIMIENTO_DEFAULT = 0.1;
export const CRECIMIENTO_MAX = 1;

/** Años hacia delante que se proyectan cuando no se indica otra cosa. */
const HORIZONTE_ANIOS = 6;

function toNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseFecha(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Crecimiento anual desde la URL. Admite tanto «10» (por ciento) como «0.1»
 * (tanto por uno) y acota a [0, CRECIMIENTO_MAX].
 */
export function sanitizeCrecimiento(raw?: string): number {
  if (raw === undefined || raw === null || raw.trim() === "") return CRECIMIENTO_DEFAULT;

  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return CRECIMIENTO_DEFAULT;

  // Por encima de 1 se entiende que viene en porcentaje.
  const fraccion = n > 1 ? n / 100 : n;
  return Math.min(fraccion, CRECIMIENTO_MAX);
}

/**
 * Fin efectivo del proyecto: el del maestro si está, y si no la estimación por
 * holding period. Null si no hay forma de saberlo.
 */
export function fechaFinEfectiva(project: Proyecto): Date | null {
  const real = parseFecha(project.fecha_fin);
  if (real) return real;

  const inicio = parseFecha(project.fecha_inicio);
  if (!inicio) return null;

  const meses = toNumber(project.holding_period);
  if (meses <= 0) return null;

  return addCalendarMonths(inicio, Math.round(meses));
}

/** Indica si el fin del proyecto es real o estimado; se muestra en la UI. */
export function finEsEstimado(project: Proyecto): boolean {
  return parseFecha(project.fecha_fin) === null;
}

export function anioVencimiento(project: Proyecto): number | null {
  const fin = fechaFinEfectiva(project);
  return fin ? fin.getFullYear() : null;
}

export interface PipelineYear {
  year: number;
  count: number;
  inversion: number;
  /** Equity comprometido que se libera ese año. */
  equity: number;
  proyectos: Proyecto[];
  /** Cuántos de esos vencimientos son estimados y no dato del maestro. */
  estimados: number;
}

export interface PipelineOptions {
  hoy?: Date;
  horizonteAnios?: number;
}

/**
 * Vencimiento del pipeline: los proyectos En Marcha agrupados por el año en que
 * terminan. Solo mira hacia delante — un proyecto vivo cuyo fin ya pasó cuenta
 * en el año en curso, porque sigue pendiente de desinvertir.
 *
 * Devuelve un rango de años CONTIGUO, rellenando a cero los años sin
 * vencimientos, para que la gráfica no dé saltos en el eje.
 */
export function pipelineVencimientos(
  rows: Proyecto[],
  options: PipelineOptions = {},
): PipelineYear[] {
  const hoy = options.hoy ?? new Date();
  const anioActual = hoy.getFullYear();
  const horizonte = options.horizonteAnios ?? HORIZONTE_ANIOS;

  const enMarcha = rows.filter((p) => p.situacion === "En Marcha");
  const porAnio = new Map<number, PipelineYear>();

  for (const proyecto of enMarcha) {
    const anio = anioVencimiento(proyecto);
    if (anio === null) continue;

    // Lo ya vencido pero aún vivo se acumula en el año en curso.
    const destino = Math.max(anio, anioActual);
    if (destino > anioActual + horizonte) continue;

    const acc = porAnio.get(destino) ?? {
      year: destino,
      count: 0,
      inversion: 0,
      equity: 0,
      proyectos: [],
      estimados: 0,
    };
    acc.count += 1;
    acc.inversion += toNumber(proyecto.inversion_total);
    acc.equity += toNumber(proyecto.equity);
    acc.proyectos.push(proyecto);
    if (finEsEstimado(proyecto)) acc.estimados += 1;
    porAnio.set(destino, acc);
  }

  if (porAnio.size === 0) return [];

  const ultimo = Math.max(...porAnio.keys());
  const serie: PipelineYear[] = [];
  for (let year = anioActual; year <= ultimo; year += 1) {
    serie.push(
      porAnio.get(year) ?? {
        year,
        count: 0,
        inversion: 0,
        equity: 0,
        proyectos: [],
        estimados: 0,
      },
    );
  }
  return serie;
}

export interface CaptacionYear {
  year: number;
  /** Inversión que vence ese año: lo que hay que reponer para no decrecer. */
  vence: number;
  /** Objetivo de captación = vence × (1 + crecimiento). */
  objetivo: number;
  /** Diferencia entre objetivo y vencimiento: el crecimiento en euros. */
  crecimientoAbsoluto: number;
  count: number;
}

/**
 * Captación objetivo año a año. La base es lo que vence (reponerlo mantiene el
 * capital comprometido plano) y encima se aplica el crecimiento pedido.
 */
export function captacionObjetivo(
  pipeline: PipelineYear[],
  crecimiento: number,
): CaptacionYear[] {
  const factor = 1 + Math.max(0, crecimiento);

  return pipeline.map((anio) => {
    const objetivo = anio.inversion * factor;
    return {
      year: anio.year,
      vence: anio.inversion,
      objetivo,
      crecimientoAbsoluto: objetivo - anio.inversion,
      count: anio.count,
    };
  });
}
