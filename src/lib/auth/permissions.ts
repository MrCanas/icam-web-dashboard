import type { UserContext } from "@/lib/auth/currentUser";
import type { ZoneKey } from "@/registry/modules";
import { routesForZone, zoneForRouteKey } from "@/registry/routes";
import type { ModuleRoute } from "@/registry/types";

export type ZoneRole = "admin" | "editor" | "lector";

export const WRITE_DENIED_MESSAGE = "Sin permiso de escritura";
export const PLATFORM_ADMIN_DENIED_MESSAGE =
  "Solo los administradores de plataforma pueden gestionar usuarios";

export class WriteAccessDeniedError extends Error {
  constructor(message = WRITE_DENIED_MESSAGE) {
    super(message);
    this.name = "WriteAccessDeniedError";
  }
}

export class PlatformAdminRequiredError extends Error {
  constructor(message = PLATFORM_ADMIN_DENIED_MESSAGE) {
    super(message);
    this.name = "PlatformAdminRequiredError";
  }
}

export function getUserRole(
  user: UserContext,
  zoneKey: ZoneKey,
): ZoneRole | null {
  const row = user.zones.find((z) => z.zone_key === zoneKey);
  if (!row) return null;
  const role = row.role;
  if (role === "admin" || role === "editor" || role === "lector") {
    return role;
  }
  return null;
}

export function hasZoneAccess(user: UserContext, zoneKey: ZoneKey): boolean {
  return getUserRole(user, zoneKey) !== null;
}

export function requireWriteAccess(user: UserContext, zoneKey: ZoneKey): void {
  const role = getUserRole(user, zoneKey);
  if (!role || role === "lector") {
    throw new WriteAccessDeniedError();
  }
}

export function checkWriteAccess(
  user: UserContext,
  zoneKey: ZoneKey,
): string | null {
  try {
    requireWriteAccess(user, zoneKey);
    return null;
  } catch (err) {
    if (err instanceof WriteAccessDeniedError) {
      return err.message;
    }
    throw err;
  }
}

/**
 * Admin de plataforma: gestiona usuarios en cualquier zona.
 *
 * Deliberadamente NO concede acceso a zonas ni salta denies de página: poder
 * dar de alta usuarios no debe implicar ver todos los datos. Un admin sin
 * `app_user_zone_role` no ve Financiero — puede auto-asignárselo desde la UI.
 */
export function isPlatformAdmin(user: UserContext): boolean {
  return user.isPlatformAdmin === true;
}

export function requirePlatformAdmin(user: UserContext): void {
  if (!isPlatformAdmin(user)) {
    throw new PlatformAdminRequiredError();
  }
}

export function checkPlatformAdmin(user: UserContext): string | null {
  try {
    requirePlatformAdmin(user);
    return null;
  } catch (err) {
    if (err instanceof PlatformAdminRequiredError) {
      return err.message;
    }
    throw err;
  }
}

/** Acceso a una página: requiere la zona y que no esté denegada. */
export function canAccessRouteKey(user: UserContext, routeKey: string): boolean {
  const zoneKey = zoneForRouteKey(routeKey);
  if (!zoneKey) return true;
  if (!hasZoneAccess(user, zoneKey)) return false;
  return !user.deniedRouteKeys.includes(routeKey);
}

/** Páginas visibles de una zona; [] si no tiene acceso a la zona. */
export function visibleRoutesForZone(
  user: UserContext,
  zoneKey: ZoneKey,
): ModuleRoute[] {
  if (!hasZoneAccess(user, zoneKey)) return [];
  return routesForZone(zoneKey).filter(
    (route) => !user.deniedRouteKeys.includes(route.key),
  );
}
