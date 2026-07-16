"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { PLATFORM_NAV } from "@/registry/platform-nav";
import { MODULES_LIST, MODULE_TO_ZONE } from "@/registry/modules";
import type { ModuleRoute } from "@/registry/types";
import type { UserContext } from "@/lib/auth/currentUser";
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

/** Subsección de la zona actual, ya filtrada por los permisos del usuario. */
function secondaryForPath(user: UserContext, pathname: string): ModuleRoute[] {
  return visibleRoutesForZone(user, zoneForPath(pathname));
}

function isRouteActive(pathname: string, route: ModuleRoute): boolean {
  if (route.match) return route.match(pathname);
  return pathname === route.path || pathname.startsWith(`${route.path}/`);
}

interface DashboardNavProps {
  layout?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

export function DashboardNav({ layout = "horizontal", onNavigate }: DashboardNavProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const secondary = user ? secondaryForPath(user, pathname) : [];
  const isVertical = layout === "vertical";

  const primaryTabs = useMemo(() => {
    if (!user) return [];

    const tabs: { href: string; label: string; prefix: string }[] = [];

    for (const zoneKey of ZONE_ORDER) {
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
      tabs.push({
        href: visible[0]!.path,
        label: mod.label,
        prefix: mod.pathPrefix,
      });
    }

    return tabs;
  }, [user]);

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

  const secondaryRow = (
    <nav
      className={
        isVertical ? "flex flex-col gap-0" : "flex flex-wrap items-center justify-center gap-x-5 gap-y-1"
      }
      aria-label="Subsección"
    >
      {secondary.map((tab) => {
        const active = isRouteActive(pathname, tab);
        if (isVertical) {
          return (
            <Link
              key={tab.path}
              href={tab.path}
              onClick={onNavigate}
              className={`min-h-11 flex items-center px-2 py-3 text-sm border-l-[3px] transition ${
                active
                  ? "text-white border-icam-gold bg-white/5"
                  : "text-white/70 border-transparent hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </Link>
          );
        }
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`pb-2 text-sm transition ${
              active
                ? "text-white border-b-[3px] border-icam-gold"
                : "text-white/60 hover:text-white/90"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
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
