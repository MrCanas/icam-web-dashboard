/** Rutas de Avance de obra. Centralizadas para que nadie las escriba a mano. */

/** Hub: las 30 promociones y la bandeja de salida hacia Zoho. */
export const AVANCE_OBRA_HUB_PATH = "/dashboard/pm/avance-obra";

/**
 * Patrón de la subpágina de proyecto, para `revalidatePath(pattern, "page")`.
 * Las rutas dinámicas se revalidan por patrón, no por URL concreta — mismo
 * truco que ACTAS_PROJECT_ROUTE_PATTERN.
 */
export const AVANCE_OBRA_ROUTE_PATTERN = "/dashboard/pm/proyecto/[id]/avance-obra";

export function avanceObraProyectoPath(idActivo: string): string {
  return `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}/avance-obra`;
}

/** Descarga de los cambios aprobados. `format` es «csv» o «json». */
export function avanceObraExportPath(format: "csv" | "json"): string {
  return `/api/pm/avance-obra/export?format=${format}`;
}
