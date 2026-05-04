"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Executive" },
  { href: "/dashboard/rentabilidad", label: "Rentabilidad" },
  { href: "/dashboard/proyectos", label: "Proyectos" },
  { href: "/dashboard/tendencias", label: "Tendencias" },
  { href: "/dashboard/data", label: "Data" },
];

interface NavTabsProps {
  layout?: "horizontal" | "vertical";
  onNavigate?: () => void;
}

export function NavTabs({ layout = "horizontal", onNavigate }: NavTabsProps) {
  const pathname = usePathname();
  const isVertical = layout === "vertical";

  return (
    <nav
      className={
        isVertical
          ? "flex flex-col gap-0"
          : "flex flex-wrap items-center justify-center gap-x-6 gap-y-1"
      }
      aria-label="Secciones del dashboard"
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        if (isVertical) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={onNavigate}
              className={`min-h-11 flex items-center px-2 py-3 text-sm border-l-[3px] transition ${
                isActive
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
            className={`pb-3 text-sm transition ${
              isActive
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
}
