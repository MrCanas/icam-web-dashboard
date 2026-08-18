import type { Metadata } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import {
  fetchPmActivoIdForActasProject,
  resolveActasProjectRoute,
} from "@/modules/pm/actas/data/actasRepository";
import {
  actasHubPath,
  actasProjectBasePathForPmActivo,
} from "@/modules/pm/actas/logic/actas-paths";
import { ActasNotFound } from "@/modules/pm/actas/ui/components/ActasNotFound";
import { ActasProjectArchivedScreen } from "@/modules/pm/actas/ui/components/ActasProjectArchivedScreen";
import { ActasProjectPage } from "@/modules/pm/actas/ui/pages/ActasProjectPage";
import type { ActasProjectTab } from "@/modules/pm/actas/types";
import { ACTAS_PROJECT_TABS } from "@/modules/pm/actas/types";

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
  // Se leen tab/asOf, pero el resto (element, etc.) se reenvía tal cual al
  // redirigir: los permalinks del histórico dependen de ello.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ActasProjectRoutePage({
  params,
  searchParams,
}: PageProps) {
  // Antes: getCurrentUser + return null (pantalla en blanco sin sesión y sin
  // corte por deny de pm.actas, que el resto de la zona sí aplicaba).
  const ctx = await requireRouteAccess("pm.actas");

  const { projectCode } = await params;
  const query = await searchParams;
  const decoded = decodeURIComponent(projectCode).trim();

  // Navegamos por proyecto, no por sección: si el proyecto de actas cuelga de
  // un activo PM, su acta se sirve en /dashboard/pm/proyecto/<id>/actas. Esta
  // ruta queda como alias (enlaces antiguos, permalinks, selector del hub) y
  // reenvía la query entera para no perder tab/asOf/element por el camino.
  const idActivo = await fetchPmActivoIdForActasProject(ctx, decoded);
  if (idActivo) {
    const forwarded = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") forwarded.set(key, value);
      else if (Array.isArray(value)) for (const v of value) forwarded.append(key, v);
    }
    const qs = forwarded.toString();
    redirect(`${actasProjectBasePathForPmActivo(idActivo)}${qs ? `?${qs}` : ""}`);
  }

  const tabParam = typeof query.tab === "string" ? query.tab : undefined;
  const asOf = typeof query.asOf === "string" ? query.asOf : undefined;
  const activeTab: ActasProjectTab =
    ACTAS_PROJECT_TABS.some((t) => t.key === tabParam)
      ? (tabParam as ActasProjectTab)
      : "operativo";

  const { resolution, error } = await resolveActasProjectRoute(ctx, decoded);

  // Sin activo PM vinculado: proyecto de actas suelto. Breadcrumb al hub, que
  // conserva sidebar, alta y archivo de proyectos.
  const tabs = (
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
        <ActasProjectArchivedScreen project={resolution.project} />
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
