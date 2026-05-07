"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryTabs = [
  { href: "/dashboard/portfolio", label: "Portfolio", prefix: "/dashboard/portfolio" },
  { href: "/dashboard/pm/overview", label: "PM", prefix: "/dashboard/pm" },
  { href: "/dashboard/monday", label: "Monday", prefix: "/dashboard/monday" },
  { href: "/dashboard/data/upload", label: "Data", prefix: "/dashboard/data" },
] as const;

const portfolioSecondary = [
  { href: "/dashboard/portfolio", label: "Executive", match: (p: string) => p === "/dashboard/portfolio" },
  {
    href: "/dashboard/portfolio/rentabilidad",
    label: "Rentabilidad",
    match: (p: string) => p.startsWith("/dashboard/portfolio/rentabilidad"),
  },
  {
    href: "/dashboard/portfolio/proyectos",
    label: "Proyectos",
    match: (p: string) => p.startsWith("/dashboard/portfolio/proyectos"),
  },
  {
    href: "/dashboard/portfolio/tendencias",
    label: "Tendencias",
    match: (p: string) => p.startsWith("/dashboard/portfolio/tendencias"),
  },
] as const;

const pmSecondary = [
  {
    href: "/dashboard/pm/overview",
    label: "Overview",
    match: (p: string) => p === "/dashboard/pm/overview",
  },
  {
    href: "/dashboard/pm/detalle",
    label: "Detalle proyecto",
    match: (p: string) =>
      p === "/dashboard/pm/detalle" || p.startsWith("/dashboard/pm/proyecto/"),
  },
] as const;

const dataSecondary = [
  {
    href: "/dashboard/data/upload",
    label: "Subir datos",
    match: (p: string) => p.startsWith("/dashboard/data/upload"),
  },
  {
    href: "/dashboard/data/activity",
    label: "Actividad",
    match: (p: string) => p.startsWith("/dashboard/data/activity"),
  },
] as const;

const mondaySecondary = [
  {
    href: "/dashboard/monday",
    label: "Dashboard",
    match: (p: string) => p === "/dashboard/monday",
  },
] as const;

function secondaryForPath(pathname: string) {
  if (pathname.startsWith("/dashboard/pm")) return pmSecondary;
  if (pathname.startsWith("/dashboard/monday")) return mondaySecondary;
  if (pathname.startsWith("/dashboard/data")) return dataSecondary;
  return portfolioSecondary;
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
        const active = tab.match(pathname);
        if (isVertical) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
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
            key={tab.href}
            href={tab.href}
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
