import { MODULES_LIST, MODULE_TO_ZONE, ZONE_ORDER, type ZoneKey } from "@/registry/modules";
import { PLATFORM_NAV } from "@/registry/platform-nav";
import type { ModuleRoute } from "@/registry/types";

/**
 * Catálogo plano de rutas navegables, derivado de MODULES + PLATFORM_NAV.
 *
 * `ModuleRoute.key` es el identificador de los permisos por página
 * (`app_user_route_deny.route_key`). Por eso el registry es la fuente de verdad
 * y la tabla no tiene FK: renombrar una key deja huérfanos sus denies — ver el
 * contrato "Stable slug — never rename after release" en `types.ts`.
 */

export interface RegistryRoute {
  zoneKey: ZoneKey;
  /** Clave en MODULES, o null para la sección `data` (PLATFORM_NAV). */
  moduleKey: string | null;
  route: ModuleRoute;
}

function buildAllRoutes(): RegistryRoute[] {
  const byZone = new Map<ZoneKey, RegistryRoute[]>();

  for (const mod of MODULES_LIST) {
    const zoneKey = MODULE_TO_ZONE[mod.key];
    if (!zoneKey) continue;
    byZone.set(
      zoneKey,
      mod.routes.map((route) => ({ zoneKey, moduleKey: mod.key, route })),
    );
  }

  byZone.set(
    "data",
    PLATFORM_NAV.routes.map((route) => ({
      zoneKey: "data" as const,
      moduleKey: null,
      route,
    })),
  );

  return ZONE_ORDER.flatMap((zoneKey) => byZone.get(zoneKey) ?? []);
}

export const ALL_ROUTES: RegistryRoute[] = buildAllRoutes();

export const ALL_ROUTE_KEYS: readonly string[] = ALL_ROUTES.map(
  (entry) => entry.route.key,
);

const ROUTES_BY_KEY = new Map(
  ALL_ROUTES.map((entry) => [entry.route.key, entry]),
);

export function routesForZone(zoneKey: ZoneKey): ModuleRoute[] {
  return ALL_ROUTES.filter((entry) => entry.zoneKey === zoneKey).map(
    (entry) => entry.route,
  );
}

export function zoneForRouteKey(routeKey: string): ZoneKey | null {
  return ROUTES_BY_KEY.get(routeKey)?.zoneKey ?? null;
}

export function isKnownRouteKey(routeKey: string): boolean {
  return ROUTES_BY_KEY.has(routeKey);
}

export function routeLabel(routeKey: string): string | null {
  return ROUTES_BY_KEY.get(routeKey)?.route.label ?? null;
}

function matchesRoute(pathname: string, route: ModuleRoute): boolean {
  if (route.match) return route.match(pathname);
  return pathname === route.path || pathname.startsWith(`${route.path}/`);
}

/**
 * pathname → ModuleRoute.key. Devuelve null para rutas fuera del registry
 * (/dashboard/mapa, /dashboard/perfil, /dashboard/admin/*), que quedan
 * gobernadas solo por el rol de zona.
 */
export function routeKeyForPathname(pathname: string): string | null {
  for (const entry of ALL_ROUTES) {
    if (matchesRoute(pathname, entry.route)) return entry.route.key;
  }
  return null;
}
