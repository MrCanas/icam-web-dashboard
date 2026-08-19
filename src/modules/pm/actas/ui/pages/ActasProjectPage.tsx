import { Suspense } from "react";

import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import type { ActasProjectDetail, ActasProjectTab } from "@/modules/pm/actas/types";
import { ACTAS_PROJECT_TABS } from "@/modules/pm/actas/types";

import { ActasActaTab } from "../components/acta/ActasActaTab";
import { ActasHistoricoTabServer } from "../components/historico/ActasHistoricoTabServer";
import { ActasCompletadosTab } from "../components/completados/ActasCompletadosTab";
import { ActasOperativoAsOfPicker } from "../components/operativo/ActasOperativoAsOfPicker";
import { ActasOperativoShowCompletedToggle } from "../components/operativo/ActasOperativoShowCompletedToggle";
import { ActasOperativoTab } from "../components/operativo/ActasOperativoTab";
import { ActasProjectHeader } from "../components/ActasProjectHeader";
import { ActasProjectSearch } from "../components/ActasProjectSearch";
import { ActasProjectTabs } from "../components/ActasProjectTabs";
import { ActasTabContent } from "../components/ActasTabContent";
import { ActasBasePathProvider } from "../ActasBasePathContext";

interface ActasProjectPageProps {
  ctx: UserContext;
  project: ActasProjectDetail;
  /** Active tab resolved from ?tab= query param. Defaults to "operativo". */
  activeTab: ActasProjectTab;
  /** ISO date YYYY-MM-DD for snapshot histórico (tab operativo). */
  asOfParam?: string;
  /**
   * Base de las URLs de actas de este proyecto. La sirve la ruta anidada
   * /dashboard/pm/proyecto/<id>/actas para que toda la navegación interna
   * (pestañas, permalinks, as-of) se quede dentro del proyecto. Sin ella se
   * cae a la base por código, /dashboard/pm/actas/<code>.
   */
  basePath?: string;
}

export function ActasProjectPage({
  ctx,
  project,
  activeTab,
  asOfParam,
  basePath,
}: ActasProjectPageProps) {
  const validTab = ACTAS_PROJECT_TABS.some((t) => t.key === activeTab)
    ? activeTab
    : "operativo";
  // Puede cambiar el responsable quien tenga rol editor (o admin) de la zona pm.
  const canEditOwner = checkWriteAccess(ctx, "pm") === null;

  return (
    <ActasBasePathProvider basePath={basePath}>
      <div className="flex flex-col gap-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <ActasProjectHeader project={project} canEditOwner={canEditOwner} />
          </div>
          {validTab === "operativo" ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Suspense fallback={null}>
                <ActasOperativoShowCompletedToggle />
              </Suspense>
              <Suspense fallback={null}>
                <ActasOperativoAsOfPicker projectCode={project.code} />
              </Suspense>
            </div>
          ) : null}
        </div>
        <ActasProjectSearch projectId={project.id} projectCode={project.code} />

        <div className="mt-4 flex flex-col">
          <Suspense fallback={null}>
            <ActasProjectTabs projectCode={project.code} />
          </Suspense>
          {validTab === "operativo" ? (
            <Suspense
              fallback={
                <section className="rounded-b-lg border border-t-0 border-subtle/50 bg-card p-6 text-sm text-text-muted">
                  Cargando operativo…
                </section>
              }
            >
              <ActasOperativoTab
                ctx={ctx}
                projectId={project.id}
                projectCode={project.code}
                asOfParam={asOfParam}
              />
            </Suspense>
          ) : validTab === "completados" ? (
            <ActasCompletadosTab
              ctx={ctx}
              projectId={project.id}
              projectCode={project.code}
            />
          ) : validTab === "acta" ? (
            <Suspense
              fallback={
                <section className="bg-card rounded-b-lg border border-t-0 border-subtle/50 p-6 text-sm text-text-muted">
                  Cargando acta…
                </section>
              }
            >
              <ActasActaTab projectId={project.id} projectCode={project.code} />
            </Suspense>
          ) : validTab === "historico" ? (
            <ActasHistoricoTabServer
              ctx={ctx}
              projectId={project.id}
              projectCode={project.code}
            />
          ) : (
            <ActasTabContent tab={validTab} projectCode={project.code} />
          )}
        </div>
      </div>
    </ActasBasePathProvider>
  );
}
