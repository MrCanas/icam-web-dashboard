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
): string {
  const base = actasProjectPath(projectCode);
  return tab === "operativo" ? base : `${base}?tab=${tab}`;
}

export function actasProjectHistoricoHubPath(projectCode: string): string {
  return actasProjectTabPath(projectCode, "historico");
}

/** Permalink canónico de un elemento (tab Histórico). */
export function actasProjectElementHistoricoPath(
  projectCode: string,
  elementId: string,
): string {
  const params = new URLSearchParams({
    tab: "historico",
    element: elementId,
  });
  return `${actasProjectPath(projectCode)}?${params.toString()}`;
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
