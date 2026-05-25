"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PLATFORM_NAV } from "@/registry/platform-nav";
import { MODULES, MODULES_LIST } from "@/registry/modules";
import type { ModuleRoute } from "@/registry/types";

const primaryTabs = [
  ...MODULES_LIST.map((mod) => ({
    href: mod.defaultPath,
    label: mod.label,
    prefix: mod.pathPrefix,
  })),
  {
    href: PLATFORM_NAV.defaultPath,
    label: PLATFORM_NAV.label,
    prefix: PLATFORM_NAV.pathPrefix,
  },
];

function secondaryForPath(pathname: string): ModuleRoute[] {
  const module = MODULES_LIST.find((mod) => pathname.startsWith(mod.pathPrefix));
  if (module) return module.routes;
  if (pathname.startsWith(PLATFORM_NAV.pathPrefix)) return PLATFORM_NAV.routes;
  return MODULES.portfolio.routes;
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
  const secondary = secondaryForPath(pathname);
  const isVertical = layout === "vertical";

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
