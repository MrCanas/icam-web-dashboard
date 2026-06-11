import type { ActasProjectTab } from "../types";

const ACTAS_BASE = "/dashboard/pm/actas";

export function actasHubPath(): string {
  return ACTAS_BASE;
}

export function actasArchivedProjectsPath(): string {
  return `${ACTAS_BASE}/archivados`;
}

export function actasProjectPath(projectCode: string): string {
  return `${ACTAS_BASE}/${encodeURIComponent(projectCode.trim())}`;
}

export function actasProjectTabPath(
  projectCode: string,
  tab: ActasProjectTab,
  options?: { asOf?: string },
): string {
  const base = actasProjectPath(projectCode);
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
  asOf?: string,
): string {
  return actasProjectTabPath(projectCode, "operativo", asOf ? { asOf } : undefined);
}

export function actasProjectHistoricoHubPath(projectCode: string): string {
  return actasProjectTabPath(projectCode, "historico");
}

/** Permalink canónico de un elemento (tab Histórico). */
export function actasProjectElementHistoricoPath(
  projectCode: string,
  elementId: string,
  logEntryId?: string,
): string {
  const params = new URLSearchParams({
    tab: "historico",
    element: elementId,
  });
  const base = `${actasProjectPath(projectCode)}?${params.toString()}`;
  if (logEntryId) {
    return `${base}#entry-${logEntryId}`;
  }
  return base;
}

export function actasElementPermalinkUrl(
  projectCode: string,
  elementId: string,
  origin?: string,
): string {
  const path = actasProjectElementHistoricoPath(projectCode, elementId);
  if (!origin) return path;
  return `${origin.replace(/\/$/, "")}${path}`;
}
