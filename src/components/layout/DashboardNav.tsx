"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { usePathname } from "next/navigation";
import { PLATFORM_NAV } from "@/registry/platform-nav";
import { MODULES_LIST, MODULE_TO_ZONE, NAV_HIDDEN_ZONES } from "@/registry/modules";
import type { ModuleRoute } from "@/registry/types";
import type { UserContext } from "@/lib/auth/currentUser";
import type { PmProjectNavItem } from "@/modules/pm/data/pmRepository";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { visibleRoutesForZone } from "@/lib/auth/permissions";
import { ZONE_ORDER, type ZoneKey } from "@/registry/modules";

function zoneForPath(pathname: string): ZoneKey {
  const mod = MODULES_LIST.find((m) => pathname.startsWith(m.pathPrefix));
  if (mod) {
    const zoneKey = MODULE_TO_ZONE[mod.key] as ZoneKey | undefined;
    if (zoneKey) return zoneKey;
  }
  if (pathname.startsWith(PLATFORM_NAV.pathPrefix)) return "data";
  return "financiero";
}

function isRouteActive(pathname: string, route: ModuleRoute): boolean {
  if (route.match) return route.match(pathname);
  return pathname === route.path || pathname.startsWith(`${route.path}/`);
}

interface SecondaryItem {
  key: string;
  href: string;
  label: string;
  /** Tooltip (nombre completo del proyecto). */
  title?: string;
  active: boolean;
  /** Pinta un separador antes de este item (proyectos ⇢ páginas transversales). */
  separatorBefore?: boolean;
}

/**
 * Fila secundaria de la zona actual. En la zona pm la lista de páginas se
 * sustituye por: [Todos los proyectos] + [un item por proyecto activo] +
 * [separador] + [páginas transversales (Planificación, Mapeo maestro, Actas)].
 */
function secondaryItemsForPath(
  user: UserContext,
  pathname: string,
  pmProjects: PmProjectNavItem[],
): SecondaryItem[] {
  const zone = zoneForPath(pathname);
  const routes = visibleRoutesForZone(user, zone);
  // Permisos (routes) y nav (navRoutes) van separados: una ruta oculta sigue
  // gobernando el acceso — p. ej. pm.detalle gate-a la fila de proyectos.
  const navRoutes = routes.filter((r) => !r.hiddenInNav);

  const asItem = (route: ModuleRoute, active: boolean): SecondaryItem => ({
    key: route.key,
    href: route.path,
    label: route.label,
    active,
  });

  const detalle = zone === "pm" ? routes.find((r) => r.key === "pm.detalle") : undefined;
  if (!detalle || pmProjects.length === 0) {
    return navRoutes.map((r) => asItem(r, isRouteActive(pathname, r)));
  }

  const items: SecondaryItem[] = [];
  if (!detalle.hiddenInNav) {
    // El `match` del registry es amplio (cubre proyecto/[id] para permisos);
    // visualmente "Todos los proyectos" solo se marca en el grid.
    items.push(asItem(detalle, pathname === detalle.path));
  }

  for (const p of pmProjects) {
    const href = `/dashboard/pm/proyecto/${encodeURIComponent(p.idActivo)}`;
    const active =
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (p.actasCode != null &&
        pathname.startsWith(`/dashboard/pm/actas/${encodeURIComponent(p.actasCode)}`));
    items.push({
      key: `pm.proyecto.${p.idActivo}`,
      href,
      label: p.idActivo,
      title: p.nombre ?? undefined,
      active,
    });
  }

  // Si un proyecto ya reclama el pathname (p. ej. su Planificación anidada o
  // sus Actas), las entradas transversales no se marcan también.
  const projectClaimed = items.some((i) => i.active);

  let first = true;
  for (const route of navRoutes) {
    if (route.key === "pm.detalle") continue;
    items.push({
      ...asItem(route, isRouteActive(pathname, route) && !projectClaimed),
      separatorBefore: first && items.length > 0,
    });
    first = false;
  }

  return items;
}

interface DashboardNavProps {
  layout?: "horizontal" | "vertical";
  onNavigate?: () => void;
  /** Proyectos activos (zona pm); la fila secundaria los pinta como pestañas. */
  pmProjects?: PmProjectNavItem[];
}

export function DashboardNav({
  layout = "horizontal",
  onNavigate,
  pmProjects = [],
}: DashboardNavProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const isVertical = layout === "vertical";

  const secondary = useMemo(
    () => (user ? secondaryItemsForPath(user, pathname, pmProjects) : []),
    [user, pathname, pmProjects],
  );

  const primaryTabs = useMemo(() => {
    if (!user) return [];

    const tabs: { href: string; label: string; prefix: string }[] = [];

    for (const zoneKey of ZONE_ORDER) {
      // Ocultas de la nav (p. ej. Adquisiciones): siguen accesibles por URL.
      if (NAV_HIDDEN_ZONES.includes(zoneKey)) continue;

      // Una zona con todas sus páginas denegadas no debe aparecer, y el destino
      // es la primera página VISIBLE: `defaultPath` puede estar denegado.
      const visible = visibleRoutesForZone(user, zoneKey);
      if (visible.length === 0) continue;

      if (zoneKey === "data") {
        tabs.push({
          href: visible[0]!.path,
          label: PLATFORM_NAV.label,
          prefix: PLATFORM_NAV.pathPrefix,
        });
        continue;
      }

      const mod = MODULES_LIST.find((m) => MODULE_TO_ZONE[m.key] === zoneKey);
      if (!mod) continue;

      // Proyectos aterriza en el primer proyecto: el grid (pm.detalle) está
      // oculto de la nav. Requiere pm.detalle visible, que gate-a proyecto/*.
      const firstProject =
        zoneKey === "pm" &&
        pmProjects.length > 0 &&
        visible.some((r) => r.key === "pm.detalle")
          ? `/dashboard/pm/proyecto/${encodeURIComponent(pmProjects[0]!.idActivo)}`
          : null;

      tabs.push({
        href: firstProject ?? visible.find((r) => !r.hiddenInNav)?.path ?? visible[0]!.path,
        label: mod.label,
        prefix: mod.pathPrefix,
      });
    }

    return tabs;
  }, [user, pmProjects]);

  const primaryRow = (
    <nav
      className={
        isVertical
          ? "flex flex-col gap-1 border-b border-white/10 pb-3 mb-3"
          : "flex flex-wrap items-center justify-center gap-x-5 gap-y-1"
      }
      aria-label="Áreas principales"
    >
      {primaryTabs.map((tab) => {
        const active = pathname.startsWith(tab.prefix);
        if (isVertical) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={onNavigate}
              className={`min-h-11 flex items-center px-2 py-2 text-sm font-medium rounded-md transition ${
                active ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </Link>
          );
        }
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2 text-sm font-medium transition ${
              active ? "text-white border-b-[3px] border-icam-gold" : "text-white/60 hover:text-white/90"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );

  const secondaryRow = isVertical ? (
    <nav className="flex flex-col gap-0" aria-label="Subsección">
      {secondary.map((tab) => (
        <Fragment key={tab.key}>
          {tab.separatorBefore ? (
            <div className="border-t border-white/10 my-1" aria-hidden="true" />
          ) : null}
          <Link
            href={tab.href}
            title={tab.title}
            onClick={onNavigate}
            className={`min-h-11 flex items-center px-2 py-3 text-sm border-l-[3px] transition ${
              tab.active
                ? "text-white border-icam-gold bg-white/5"
                : "text-white/70 border-transparent hover:text-white hover:bg-white/5"
            }`}
          >
            {tab.label}
          </Link>
        </Fragment>
      ))}
    </nav>
  ) : (
    // `w-max mx-auto` centra la fila cuando cabe y permite scroll cuando no
    // (justify-center + overflow dejaría inaccesibles los items del inicio).
    <div className="overflow-x-auto">
      <nav
        className="flex w-max mx-auto flex-nowrap items-center gap-x-5"
        aria-label="Subsección"
      >
        {secondary.map((tab) => (
          <Fragment key={tab.key}>
            {tab.separatorBefore ? (
              <span className="h-4 w-px bg-white/20 shrink-0" aria-hidden="true" />
            ) : null}
            <Link
              href={tab.href}
              title={tab.title}
              className={`pb-2 text-sm whitespace-nowrap transition ${
                tab.active
                  ? "text-white border-b-[3px] border-icam-gold"
                  : "text-white/60 hover:text-white/90"
              }`}
            >
              {tab.label}
            </Link>
          </Fragment>
        ))}
      </nav>
    </div>
  );

  if (isVertical) {
    return (
      <div className="flex flex-col gap-1">
        {primaryRow}
        {secondaryRow}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full">
      {primaryRow}
      <div className="border-t border-white/10 pt-2">{secondaryRow}</div>
    </div>
  );
}
