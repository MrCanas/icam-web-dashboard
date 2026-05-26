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
