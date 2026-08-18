import type { Metadata } from "next";

import Link from "next/link";

import { canAccessRouteKey } from "@/lib/auth/permissions";
import { requireRouteAccess } from "@/lib/auth/require-route-access";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectCode: string }>;
}): Promise<Metadata> {
  const { projectCode } = await params;
  return { title: `${decodeURIComponent(projectCode)} · Actas` };
}

interface PageProps {
  params: Promise<{ projectCode: string }>;
  searchParams: Promise<{ tab?: string; asOf?: string }>;
}

export default async function ActasProjectRoutePage({
  params,
  searchParams,
}: PageProps) {
  // Antes: getCurrentUser + return null (pantalla en blanco sin sesión y sin
  // corte por deny de pm.actas, que el resto de la zona sí aplicaba).
  const ctx = await requireRouteAccess("pm.actas");

  const { projectCode } = await params;
  const { tab, asOf } = await searchParams;
  const decoded = decodeURIComponent(projectCode).trim();

  const activeTab: ActasProjectTab =
    ACTAS_PROJECT_TABS.some((t) => t.key === tab)
      ? (tab as ActasProjectTab)
      : "operativo";

  // idActivo se resuelve SIEMPRE (también para archivados/inexistentes): las
  // subpestañas del proyecto deben seguir presentes en esos estados para no
  // expulsar al usuario del panel.
  const [{ resolution, error }, idActivo] = await Promise.all([
    resolveActasProjectRoute(ctx, decoded),
    fetchPmActivoIdForActasProject(ctx, decoded),
  ]);

  // Chrome del proyecto: si el proyecto de actas está vinculado a un activo
  // PM, las subpestañas del proyecto (Resumen/Planificación/Actas); si no,
  // un breadcrumb al hub (que conserva sidebar, alta y archivo de proyectos).
  const tabs = idActivo ? (
    <PmProjectTabs
      idActivo={idActivo}
      actasHref={actasProjectPath(decoded)}
      showPlanificacion={canAccessRouteKey(ctx, "pm.planificacion")}
    />
  ) : (
    <Link
      href={actasHubPath()}
      className="inline-block text-sm text-icam-900 underline"
    >
      ← Todos los proyectos de actas
    </Link>
  );

  if (error) {
    return (
      <div className="space-y-4 min-w-0">
        {tabs}
        <section className="bg-card rounded-lg border border-red-200 p-4 text-sm text-red-700">
          Error cargando proyecto: {error}
        </section>
      </div>
    );
  }

  if (resolution.kind === "not_found") {
    return (
      <div className="space-y-4 min-w-0">
        {tabs}
        <ActasNotFound projectCode={decoded} />
      </div>
    );
  }

  if (resolution.kind === "archived") {
    return (
      <div className="space-y-4 min-w-0">
        {tabs}
        <ActasProjectArchivedScreen
          project={resolution.project}
          backToProjectHref={
            idActivo
              ? `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}`
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      {tabs}
      <ActasProjectPage
        ctx={ctx}
        project={resolution.project}
        activeTab={activeTab}
        asOfParam={asOf}
      />
    </div>
  );
}
