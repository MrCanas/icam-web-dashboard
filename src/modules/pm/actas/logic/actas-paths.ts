import type { ActasProjectTab } from "../types";

const ACTAS_BASE = "/dashboard/pm/actas";

/**
 * Base de las URLs de actas de un proyecto. Navegamos por proyecto, no por la
 * sección Actas: dentro de un activo PM la base canónica es
 * /dashboard/pm/proyecto/<idActivo>/actas. La base por código
 * (/dashboard/pm/actas/<code>) queda para los proyectos de actas sin vínculo
 * PM y como URL heredada, que redirige a la canónica cuando el vínculo existe.
 *
 * Todos los helpers de abajo aceptan `basePath` para heredar esa base; los
 * componentes cliente la reciben de `useActasBasePath()`.
 */
export function actasProjectBasePathForPmActivo(idActivo: string): string {
  return `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}/actas`;
}

/**
 * Patrón de la ruta anidada, para revalidatePath(pattern, "page"): las actas de
 * un proyecto se sirven desde ahí, así que toda mutación que revalide
 * /dashboard/pm/actas/<code> debe revalidar también este patrón.
 */
export const ACTAS_PROJECT_ROUTE_PATTERN = "/dashboard/pm/proyecto/[id]/actas";

export function actasHubPath(): string {
  return ACTAS_BASE;
}

export function actasArchivedProjectsPath(): string {
  return `${ACTAS_BASE}/archivados`;
}

export function actasProjectPath(
  projectCode: string,
  basePath?: string,
): string {
  return basePath ?? `${ACTAS_BASE}/${encodeURIComponent(projectCode.trim())}`;
}

export function actasProjectTabPath(
  projectCode: string,
  tab: ActasProjectTab,
  options?: { asOf?: string; basePath?: string },
): string {
  const base = actasProjectPath(projectCode, options?.basePath);
  if (tab !== "operativo") {
    const params = new URLSearchParams({ tab });
    return `${base}?${params.toString()}`;
  }
  if (options?.asOf) {
    const params = new URLSearchParams({ asOf: options.asOf });
    return `${base}?${params.toString()}`;
  }
  return base;
}

export function actasProjectOperativoPath(
  projectCode: string,
  options?: { asOf?: string; basePath?: string },
): string {
  return actasProjectTabPath(projectCode, "operativo", options);
}

export function actasProjectHistoricoHubPath(
  projectCode: string,
  basePath?: string,
): string {
  return actasProjectTabPath(projectCode, "historico", { basePath });
}

/** Permalink canónico de un elemento (tab Histórico). */
export function actasProjectElementHistoricoPath(
  projectCode: string,
  elementId: string,
  options?: { logEntryId?: string; basePath?: string },
): string {
  const params = new URLSearchParams({
    tab: "historico",
    element: elementId,
  });
  const base = `${actasProjectPath(projectCode, options?.basePath)}?${params.toString()}`;
  if (options?.logEntryId) {
    return `${base}#entry-${options.logEntryId}`;
  }
  return base;
}

export function actasElementPermalinkUrl(
  projectCode: string,
  elementId: string,
  options?: { origin?: string; basePath?: string },
): string {
  const path = actasProjectElementHistoricoPath(projectCode, elementId, {
    basePath: options?.basePath,
  });
  if (!options?.origin) return path;
  return `${options.origin.replace(/\/$/, "")}${path}`;
}
