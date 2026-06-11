import type { UserContext } from "@/lib/auth/currentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";
import {
  MODULE_TO_ZONE,
  MODULES,
  ZONE_ORDER,
  ZONE_TO_MODULE,
  type ZoneKey,
} from "@/registry/modules";
import { PLATFORM_NAV } from "@/registry/platform-nav";

export { MODULE_TO_ZONE, ZONE_TO_MODULE, type ZoneKey };
export { hasZoneAccess };

/** Ruta por defecto de la primera zona accesible (orden app_zone). */
export function firstAccessiblePath(user: UserContext): string | null {
  for (const zoneKey of ZONE_ORDER) {
    if (!hasZoneAccess(user, zoneKey)) continue;
    if (zoneKey === "financiero") return MODULES.portfolio.defaultPath;
    if (zoneKey === "pm") return MODULES.pm.defaultPath;
    if (zoneKey === "adquisiciones") return MODULES.monday.defaultPath;
    if (zoneKey === "data") return PLATFORM_NAV.defaultPath;
  }
  return null;
}

/** Zona requerida para la ruta, o null si no aplica guard (perfil, sin-acceso). */
export function pathnameToZone(pathname: string): ZoneKey | null {
  if (pathname.startsWith("/dashboard/portfolio")) return "financiero";
  if (pathname.startsWith("/dashboard/pm")) return "pm";
  if (pathname.startsWith("/dashboard/monday")) return "adquisiciones";
  if (pathname.startsWith("/dashboard/data")) return "data";
  return null;
}

export function userCanAccessPath(user: UserContext, pathname: string): boolean {
  const zone = pathnameToZone(pathname);
  if (!zone) return true;
  return hasZoneAccess(user, zone);
}

export function moduleKeyForZone(zoneKey: ZoneKey): string | null {
  return ZONE_TO_MODULE[zoneKey];
}

export function zoneKeyForModuleKey(moduleKey: string): ZoneKey | undefined {
  return MODULE_TO_ZONE[moduleKey];
}
