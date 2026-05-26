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

  return (
    <nav
      className="flex items-center gap-0 border-b border-subtle/50 bg-card rounded-t-lg overflow-x-auto"
      aria-label="Secciones del proyecto"
    >
      {ACTAS_PROJECT_TABS.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Link
            key={tab.key}
            href={actasProjectTabPath(projectCode, tab.key)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-[3px] transition ${
              active
                ? "border-icam-900 text-icam-900 bg-icam-900/5"
                : "border-transparent text-text-muted hover:text-text-primary hover:bg-page"
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
