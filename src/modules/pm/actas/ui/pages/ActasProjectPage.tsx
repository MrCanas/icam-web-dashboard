import { Suspense } from "react";

import type { UserContext } from "@/lib/auth/currentUser";
import type { ActasProjectDetail, ActasProjectTab } from "@/modules/pm/actas/types";
import { ACTAS_PROJECT_TABS } from "@/modules/pm/actas/types";

import { ActasOperativoTab } from "../components/operativo/ActasOperativoTab";
import { ActasProjectHeader } from "../components/ActasProjectHeader";
import { ActasProjectTabs } from "../components/ActasProjectTabs";
import { ActasTabContent } from "../components/ActasTabContent";

interface ActasProjectPageProps {
  ctx: UserContext;
  project: ActasProjectDetail;
  /** Active tab resolved from ?tab= query param. Defaults to "operativo". */
  activeTab: ActasProjectTab;
}

export function ActasProjectPage({
  ctx,
  project,
  activeTab,
}: ActasProjectPageProps) {
  const validTab = ACTAS_PROJECT_TABS.some((t) => t.key === activeTab)
    ? activeTab
    : "operativo";

  return (
    <div className="flex flex-col gap-0">
      <ActasProjectHeader project={project} />

      <div className="mt-4 flex flex-col">
        <Suspense fallback={null}>
          <ActasProjectTabs projectCode={project.code} />
        </Suspense>
        {validTab === "operativo" ? (
          <ActasOperativoTab
            ctx={ctx}
            projectId={project.id}
            projectCode={project.code}
          />
        ) : (
          <ActasTabContent tab={validTab} projectCode={project.code} />
        )}
      </div>
    </div>
  );
}
