import type { ActasProjectTab } from "../types";

const ACTAS_BASE = "/dashboard/pm/actas";

export function actasHubPath(): string {
  return ACTAS_BASE;
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

/** FASE 8 — histórico dedicado por elemento (stub: tab Histórico + query). */
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
