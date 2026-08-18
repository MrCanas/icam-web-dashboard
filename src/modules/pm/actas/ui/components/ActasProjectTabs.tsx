"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { actasProjectTabPath } from "@/modules/pm/actas/logic/actas-paths";
import { ACTAS_PROJECT_TABS, type ActasProjectTab } from "@/modules/pm/actas/types";

interface ActasProjectTabsProps {
  projectCode: string;
}

export function ActasProjectTabs({ projectCode }: ActasProjectTabsProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ActasProjectTab | null;
  const activeTab: ActasProjectTab =
    tabParam && ACTAS_PROJECT_TABS.some((t) => t.key === tabParam)
      ? tabParam
      : "operativo";

  // Estilo pill secundario, deliberadamente más discreto que PmProjectTabs:
  // en /dashboard/pm/actas/<code> conviven ambas barras y deben leerse como
  // dos niveles distintos (proyecto ⟶ secciones de actas).
  return (
    <nav
      className="flex items-center gap-1 overflow-x-auto"
      aria-label="Secciones de actas"
    >
      {ACTAS_PROJECT_TABS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={actasProjectTabPath(projectCode, tab.key)}
            className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full transition ${
              active
                ? "bg-icam-900/10 text-icam-900"
                : "text-text-muted hover:text-text-primary hover:bg-page"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
