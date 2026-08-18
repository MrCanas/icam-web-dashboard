"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PLATFORM_NAV } from "@/registry/platform-nav";
import { MODULES_LIST, MODULE_TO_ZONE, NAV_HIDDEN_ZONES } from "@/registry/modules";
import type { ModuleRoute } from "@/registry/types";
import type { UserContext } from "@/lib/auth/currentUser";
import type { PmProjectNavItem } from "@/modules/pm/data/pmRepository";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { visibleRoutesForZone } from "@/lib/auth/permissions";
import { pmLandingPath } from "@/modules/pm/logic/pm-landing";
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
  /** Los items de proyecto reciben tratamiento especial en el drawer móvil. */
  kind?: "project";
}

/**
 * Páginas de la zona pm que se abren desde el menú de Configuración (rueda al
 * final de la fila secundaria) en vez de ocupar una pestaña. El orden es el de
 * este array, no el del registry.
 */
const PM_CONFIG_ROUTE_KEYS = ["pm.actas", "pm.planificacion", "pm.proyectos"];

/**
 * Items del menú de Configuración para la zona actual. Vacío fuera de pm y para
 * quien no tenga permiso sobre ninguna de esas rutas (entonces no se pinta la
 * rueda). `projectClaimed` evita marcar activa la entrada del hub cuando quien
 * reclama el pathname es la subpágina de un proyecto.
 */
function configItemsForPath(
  routes: ModuleRoute[],
  zone: ZoneKey,
  pathname: string,
  projectClaimed: boolean,
): SecondaryItem[] {
  if (zone !== "pm") return [];

  const items: SecondaryItem[] = [];
  for (const key of PM_CONFIG_ROUTE_KEYS) {
    const route = routes.find((r) => r.key === key);
    if (!route) continue;
    items.push({
      key: route.key,
      href: route.path,
      label: route.label,
      // A propósito no usamos route.match: el suyo abarca también las
      // subpáginas de proyecto, que ya se marcan en su propia pestaña.
      active:
        !projectClaimed &&
        (pathname === route.path || pathname.startsWith(`${route.path}/`)),
    });
  }
  return items;
}

/**
 * Fila secundaria de la zona actual. En la zona pm la lista de páginas se
 * sustituye por: [Todos los proyectos] + [un item por proyecto activo]; las
 * páginas transversales (Actas, Planificación, Mapeo maestro) se sirven aparte
 * en `config`.
 */
function secondaryItemsForPath(
  user: UserContext,
  pathname: string,
  pmProjects: PmProjectNavItem[],
): { items: SecondaryItem[]; config: SecondaryItem[] } {
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
    return {
      items: navRoutes.map((r) => asItem(r, isRouteActive(pathname, r))),
      config: configItemsForPath(routes, zone, pathname, false),
    };
  }

  const items: SecondaryItem[] = [];
  if (!detalle.hiddenInNav) {
    // El `match` del registry es amplio (cubre proyecto/[id] para permisos);
    // visualmente "Todos los proyectos" solo se marca en el grid.
    items.push(asItem(detalle, pathname === detalle.path));
  }

  for (const p of pmProjects) {
    const href = `/dashboard/pm/proyecto/${encodeURIComponent(p.idActivo)}`;
    // Las actas del proyecto cuelgan ya de `href` (…/proyecto/<id>/actas); la
    // rama por código cubre la URL heredada /dashboard/pm/actas/<code>.
    // Igualdad o límite de segmento: con startsWith a secas, CASA7 se
    // marcaría activo estando en /actas/CASA77.
    const actasBase =
      p.actasCode != null
        ? `/dashboard/pm/actas/${encodeURIComponent(p.actasCode)}`
        : null;
    const active =
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (actasBase != null &&
        (pathname === actasBase || pathname.startsWith(`${actasBase}/`)));
    items.push({
      key: `pm.proyecto.${p.idActivo}`,
      href,
      label: p.idActivo,
      title: p.nombre ?? undefined,
      active,
      kind: "project",
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

  return {
    items,
    config: configItemsForPath(routes, zone, pathname, projectClaimed),
  };
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008.6 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 8.6a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

/**
 * Rueda al final de la fila secundaria: popover con las páginas transversales.
 * El popover se monta fuera del contenedor con `overflow-x-auto` de la fila —
 * dentro quedaría recortado.
 */
function ConfigMenu({ items }: { items: SecondaryItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  const anyActive = items.some((i) => i.active);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Configuración"
        title="Configuración"
        className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
          open || anyActive
            ? "text-white bg-white/10"
            : "text-white/60 hover:text-white/90 hover:bg-white/5"
        }`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <GearIcon />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border border-subtle/50 bg-card py-1 shadow-lg"
        >
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              role="menuitem"
              aria-current={item.active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={`block w-full min-h-11 px-3 py-2 text-sm transition hover:bg-page ${
                item.active
                  ? "text-text-primary font-medium"
                  : "text-text-body"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
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

  const { items: secondary, config } = useMemo(
    () =>
      user
        ? secondaryItemsForPath(user, pathname, pmProjects)
        : { items: [] as SecondaryItem[], config: [] as SecondaryItem[] },
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

      // Proyectos aterriza en el primer proyecto (el grid pm.detalle está
      // oculto). Misma lógica que el redirect de /dashboard/pm: pmLandingPath.
      const href =
        zoneKey === "pm"
          ? pmLandingPath(user, pmProjects)
          : visible.find((r) => !r.hiddenInNav)?.path;

      tabs.push({
        href: href ?? visible[0]!.path,
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
              aria-current={active ? "page" : undefined}
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
            aria-current={active ? "page" : undefined}
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
      {secondary.map((tab, i) => (
        <Fragment key={tab.key}>
          {tab.kind === "project" && secondary[i - 1]?.kind !== "project" ? (
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
              Proyectos
            </p>
          ) : null}
          {tab.separatorBefore ? (
            <>
              <div className="mt-2 border-t border-white/10" aria-hidden="true" />
              <p className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
                Páginas
              </p>
            </>
          ) : null}
          <Link
            href={tab.href}
            title={tab.title}
            onClick={onNavigate}
            aria-current={tab.active ? "page" : undefined}
            className={`min-h-11 min-w-0 flex items-center px-2 py-3 text-sm border-l-[3px] transition ${
              tab.active
                ? "text-white border-icam-gold bg-white/5"
                : "text-white/70 border-transparent hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="truncate">
              {/* En táctil no hay tooltip: el nombre va en el propio label. */}
              {tab.kind === "project" && tab.title
                ? `${tab.label} — ${tab.title}`
                : tab.label}
            </span>
          </Link>
        </Fragment>
      ))}
      {config.length > 0 ? (
        <>
          <div className="mt-2 border-t border-white/10" aria-hidden="true" />
          <p className="px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
            Configuración
          </p>
          {config.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              onClick={onNavigate}
              aria-current={tab.active ? "page" : undefined}
              className={`min-h-11 min-w-0 flex items-center px-2 py-3 text-sm border-l-[3px] transition ${
                tab.active
                  ? "text-white border-icam-gold bg-white/5"
                  : "text-white/70 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="truncate">{tab.label}</span>
            </Link>
          ))}
        </>
      ) : null}
    </nav>
  ) : (
    // `w-max mx-auto` centra la fila cuando cabe y permite scroll cuando no
    // (justify-center + overflow dejaría inaccesibles los items del inicio).
    // La rueda va fuera del contenedor scrollable: siempre visible y sin recorte.
    <div className="flex items-center justify-center gap-x-4 min-w-0">
      <div className="overflow-x-auto min-w-0">
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
                aria-current={tab.active ? "page" : undefined}
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
      <ConfigMenu items={config} />
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
