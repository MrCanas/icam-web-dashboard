/** Rutas y claves del módulo, en un solo sitio para acciones y páginas. */
export const COMUNICACIONES_PATH = "/dashboard/comunicaciones";
export const COMUNICACIONES_NUEVA_PATH = "/dashboard/comunicaciones/nueva";
export const COMUNICACIONES_AJUSTES_PATH = "/dashboard/comunicaciones/ajustes";
export const HISTORIAL_ROUTE_KEY = "comunicaciones.historial";
export const NUEVA_ROUTE_KEY = "comunicaciones.nueva";
export const AJUSTES_ROUTE_KEY = "comunicaciones.ajustes";
export const ZONA_COMUNICACIONES = "comunicaciones" as const;

export function comunicacionPath(id: string): string {
  return `${COMUNICACIONES_PATH}/${encodeURIComponent(id)}`;
}
