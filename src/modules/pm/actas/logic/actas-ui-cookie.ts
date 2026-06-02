/** Preferencia UI del panel lateral Actas (cookie, no localStorage). */

export const ACTAS_SIDEBAR_COLLAPSED_COOKIE = "actas-sidebar-collapsed";

const COOKIE_PATH = "/dashboard/pm/actas";
const MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function readActasSidebarCollapsed(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACTAS_SIDEBAR_COLLAPSED_COOKIE}=`));
  if (!match) return false;
  const value = match.split("=")[1]?.trim();
  return value === "1" || value === "true";
}

export function writeActasSidebarCollapsed(collapsed: boolean): void {
  if (typeof document === "undefined") return;
  const value = collapsed ? "1" : "0";
  document.cookie = `${ACTAS_SIDEBAR_COLLAPSED_COOKIE}=${value};path=${COOKIE_PATH};max-age=${MAX_AGE_SEC};SameSite=Lax`;
}
