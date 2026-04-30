"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Executive" },
  { href: "/dashboard/rentabilidad", label: "Rentabilidad" },
  { href: "/dashboard/proyectos", label: "Proyectos" },
  { href: "/dashboard/tendencias", label: "Tendencias" },
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
