"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "1 · Executive" },
  { href: "/dashboard/mapa", label: "2 · Mapa" },
  { href: "/dashboard/rentabilidad", label: "3 · Rentabilidad" },
  { href: "/dashboard/proyectos", label: "4 · Proyectos" },
  { href: "/dashboard/tendencias", label: "5 · Tendencias" },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

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
