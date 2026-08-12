import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  fetchPmActivoIdForActasProject,
  resolveActasProjectRoute,
} from "@/modules/pm/actas/data/actasRepository";
import { actasHubPath, actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import { ActasNotFound } from "@/modules/pm/actas/ui/components/ActasNotFound";
import { ActasProjectArchivedScreen } from "@/modules/pm/actas/ui/components/ActasProjectArchivedScreen";
import { ActasProjectPage } from "@/modules/pm/actas/ui/pages/ActasProjectPage";
import type { ActasProjectTab } from "@/modules/pm/actas/types";
import { ACTAS_PROJECT_TABS } from "@/modules/pm/actas/types";
import { PmProjectTabs } from "@/modules/pm/ui/PmProjectTabs";

/** Server Actions del tablero (crear grupo, drag-drop, etc.) pueden ser lentas en preview. */
export const maxDuration = 30;

interface PageProps {
  params: Promise<{ projectCode: string }>;
  searchParams: Promise<{ tab?: string; asOf?: string }>;
}

export default async function ActasProjectRoutePage({
  params,
  searchParams,
}: PageProps) {
  const ctx = await getCurrentUser();
  if (!ctx) return null;

  const { projectCode } = await params;
  const { tab, asOf } = await searchParams;
  const decoded = decodeURIComponent(projectCode).trim();

  const activeTab: ActasProjectTab =
    ACTAS_PROJECT_TABS.some((t) => t.key === tab)
      ? (tab as ActasProjectTab)
      : "operativo";

  const { resolution, error } = await resolveActasProjectRoute(ctx, decoded);

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-4 text-sm text-red-700">
        Error cargando proyecto: {error}
      </section>
    );
  }

  if (resolution.kind === "not_found") {
    return <ActasNotFound projectCode={decoded} />;
  }

  if (resolution.kind === "archived") {
    return <ActasProjectArchivedScreen project={resolution.project} />;
  }

  // Chrome del proyecto: si el proyecto de actas está vinculado a un activo
  // PM, las subpestañas del proyecto (Resumen/Planificación/Actas); si no,
  // un breadcrumb al hub (que conserva sidebar, alta y archivo de proyectos).
  const idActivo = await fetchPmActivoIdForActasProject(ctx, decoded);

  return (
    <div className="space-y-4 min-w-0">
      {idActivo ? (
        <PmProjectTabs idActivo={idActivo} actasHref={actasProjectPath(decoded)} />
      ) : (
        <Link
          href={actasHubPath()}
          className="inline-block text-sm text-icam-900 underline"
        >
          ← Todos los proyectos de actas
        </Link>
      )}
      <ActasProjectPage
        ctx={ctx}
        project={resolution.project}
        activeTab={activeTab}
        asOfParam={asOf}
      />
    </div>
  );
}
