import type { Metadata } from "next";

import Link from "next/link";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import {
  fetchActasLinkForPmActivo,
  resolveActasProjectRoute,
} from "@/modules/pm/actas/data/actasRepository";
import {
  actasArchivedProjectsPath,
  actasHubPath,
  actasProjectBasePathForPmActivo,
  actasProjectPath,
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
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Actas` };
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; asOf?: string }>;
}

/**
 * Actas del proyecto, en su URL canónica: /dashboard/pm/proyecto/<id>/actas.
 * Antes esto era un resolver que redirigía a /dashboard/pm/actas/<code>; ahora
 * renderiza el acta aquí mismo, porque la navegación se organiza por proyecto
 * y no por sección. El hub por código sigue existiendo (proyectos de actas sin
 * activo PM detrás) y redirige aquí cuando el vínculo existe.
 */
export default async function Page({ params, searchParams }: PageProps) {
  const ctx = await requireRouteAccess("pm.actas");
  const { id } = await params;
  const { tab, asOf } = await searchParams;
  const idActivo = decodeURIComponent(id);

  const activeTab: ActasProjectTab = ACTAS_PROJECT_TABS.some((t) => t.key === tab)
    ? (tab as ActasProjectTab)
    : "operativo";

  const link = await fetchActasLinkForPmActivo(ctx, idActivo);

  if (!link) {
    return (
      <section className="rounded-lg border border-subtle/50 bg-card p-6 text-sm text-text-muted">
        <h2 className="text-base font-semibold text-text-primary">
          {idActivo} todavía no tiene actas
        </h2>
        <p className="mt-2">
          Crea su proyecto de actas desde el hub con «+ Nuevo proyecto» y
          vincúlalo a este activo PM.
        </p>
        <Link
          href={actasHubPath()}
          className="mt-3 inline-block text-icam-900 underline"
        >
          Ir al hub de Actas
        </Link>
      </section>
    );
  }

  const { resolution, error } = await resolveActasProjectRoute(ctx, link.code);
  // Las subpestañas del proyecto ya las pinta proyecto/[id]/layout.tsx: aquí
  // solo va el contenido, en cualquiera de los estados.

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-4 text-sm text-red-700">
        Error cargando el proyecto de actas {link.code}: {error}
      </section>
    );
  }

  if (resolution.kind === "not_found") {
    return <ActasNotFound projectCode={link.code} />;
  }

  if (resolution.kind === "archived") {
    return (
      <div className="space-y-4 min-w-0">
        <ActasProjectArchivedScreen
          project={resolution.project}
          backToProjectHref={`/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}`}
        />
        <p className="text-sm text-text-muted">
          También puedes consultarlo desde{" "}
          <Link href={actasArchivedProjectsPath()} className="text-icam-900 underline">
            proyectos archivados
          </Link>{" "}
          o abrir{" "}
          <Link href={actasProjectPath(link.code)} className="text-icam-900 underline">
            {link.code}
          </Link>{" "}
          por su código.
        </p>
      </div>
    );
  }

  return (
    <ActasProjectPage
      ctx={ctx}
      project={resolution.project}
      activeTab={activeTab}
      asOfParam={asOf}
      basePath={actasProjectBasePathForPmActivo(idActivo)}
    />
  );
}
