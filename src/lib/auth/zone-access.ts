import type { UserContext } from "@/lib/auth/currentUser";
import {
  canAccessRouteKey,
  hasZoneAccess,
  isPlatformAdmin,
  visibleRoutesForZone,
} from "@/lib/auth/permissions";
import {
  MODULE_TO_ZONE,
  ZONE_ORDER,
  ZONE_TO_MODULE,
  type ZoneKey,
} from "@/registry/modules";
import { routeKeyForPathname } from "@/registry/routes";

export { MODULE_TO_ZONE, ZONE_TO_MODULE, type ZoneKey };
export { hasZoneAccess };

/** Gestión de usuarios: fuera del RBAC por zona, solo admins de plataforma. */
export const ADMIN_PATH_PREFIX = "/dashboard/admin";

/**
 * Primera página realmente visible (orden app_zone).
 *
 * Devuelve la primera ruta VISIBLE de la zona, no su `defaultPath`: si el
 * usuario tiene denegada la página por defecto de la zona, devolverla crearía
 * un bucle de redirect con DashboardZoneGuard. Prefiere páginas que están en
 * la nav (`!hiddenInNav`): aterrizar en una oculta deja la nav sin resaltado.
 */
export function firstAccessiblePath(user: UserContext): string | null {
  for (const zoneKey of ZONE_ORDER) {
    const visible = visibleRoutesForZone(user, zoneKey);
    if (visible.length === 0) continue;
    return (visible.find((r) => !r.hiddenInNav) ?? visible[0]!).path;
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
  if (pathname.startsWith(ADMIN_PATH_PREFIX)) {
    return isPlatformAdmin(user);
  }

  const zone = pathnameToZone(pathname);
  if (!zone) return true;
  if (!hasZoneAccess(user, zone)) return false;

  // Rutas fuera del registry (p. ej. /dashboard/mapa) heredan el permiso de zona.
  const routeKey = routeKeyForPathname(pathname);
  return routeKey ? canAccessRouteKey(user, routeKey) : true;
}

export function moduleKeyForZone(zoneKey: ZoneKey): string | null {
  return ZONE_TO_MODULE[zoneKey];
}

export function zoneKeyForModuleKey(moduleKey: string): ZoneKey | undefined {
  return MODULE_TO_ZONE[moduleKey];
}
