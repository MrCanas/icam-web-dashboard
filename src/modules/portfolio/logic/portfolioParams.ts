/**
 * Saneado y construcción de los parámetros de URL del dashboard de portfolio.
 *
 * Los filtros del portfolio viven en la query string, no en estado de cliente:
 * las páginas son Server Components y filtran en servidor, así que la URL es la
 * única fuente de verdad. Aquí se centraliza qué valores son admisibles y cómo
 * se serializan, para que la barra flotante y las páginas no diverjan.
 */
import { sanitizeSort, type SortKey } from "@/modules/portfolio/logic/proyectoSort";
import type { Proyecto, SituacionProyecto, TipoProyecto } from "@/modules/portfolio/types";

export const SITUACIONES: SituacionProyecto[] = ["En Marcha", "Culminado"];
export const TIPOS: TipoProyecto[] = ["Promoción", "Fondo"];

/** Modos de visualización del tab de Proyectos. */
export type ProyectosView = "tabla" | "cols2" | "cols3" | "cols4";

export const VIEW_DEFAULT: ProyectosView = "cols2";

const VIEWS: ProyectosView[] = ["tabla", "cols2", "cols3", "cols4"];

/** Tope de longitud del buscador: evita URLs absurdas y consultas inútiles. */
const MAX_QUERY = 80;

export function sanitizeSituacion(raw?: string): SituacionProyecto | undefined {
  return SITUACIONES.find((s) => s === raw);
}

export function sanitizeTipo(raw?: string): TipoProyecto | undefined {
  return TIPOS.find((t) => t === raw);
}

export function sanitizeView(raw?: string): ProyectosView {
  return VIEWS.find((v) => v === raw) ?? VIEW_DEFAULT;
}

export function sanitizeQuery(raw?: string): string {
  return (raw ?? "").trim().slice(0, MAX_QUERY);
}

/**
 * Clases de rejilla por modo. Literales estáticos a propósito: Tailwind v4
 * escanea el código fuente, y una clase construida por interpolación no llega
 * a generarse nunca.
 */
export function gridClassForView(view: ProyectosView): string {
  switch (view) {
    case "cols3":
      return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4";
    case "cols4":
      return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4";
    case "cols2":
    default:
      return "grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4";
  }
}

export interface PortfolioUrlParams {
  situacion?: string;
  tipo?: string;
  sort?: SortKey;
  q?: string;
  view?: ProyectosView;
  /** Crecimiento anual de las proyecciones de Tendencias, en tanto por uno. */
  crecimiento?: number;
}

/**
 * Href con solo los parámetros que aportan algo: los valores por defecto no se
 * escriben, para que la URL limpia sea la del estado sin filtrar.
 */
export function buildPortfolioHref(basePath: string, params: PortfolioUrlParams): string {
  const search = new URLSearchParams();

  if (params.situacion) search.set("situacion", params.situacion);
  if (params.tipo) search.set("tipo", params.tipo);
  if (params.sort && params.sort !== sanitizeSort(undefined)) search.set("sort", params.sort);
  if (params.q) search.set("q", params.q);
  if (params.view && params.view !== VIEW_DEFAULT) search.set("view", params.view);
  if (typeof params.crecimiento === "number") {
    search.set("crecimiento", String(Math.round(params.crecimiento * 100)));
  }

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Normaliza para comparar: minúsculas y sin diacríticos. */
function normalizar(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** ¿Coincide el proyecto con el texto buscado? Busca en nombre y ubicación. */
export function matchesQuery(project: Proyecto, query: string): boolean {
  const q = normalizar(query.trim());
  if (!q) return true;

  const campos = [project.proyecto, project.ubicacion ?? ""];
  return campos.some((campo) => normalizar(campo).includes(q));
}
