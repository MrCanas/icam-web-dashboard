import type { Metadata } from "next";

import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { fetchActasLinkForPmActivo } from "@/modules/pm/actas/data/actasRepository";
import {
  actasArchivedProjectsPath,
  actasHubPath,
  actasProjectPath,
} from "@/modules/pm/actas/logic/actas-paths";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Actas` };
}

/**
 * Resolver de la subpestaña Actas de un proyecto PM: con actas vivas redirige
 * a su URL canónica (/dashboard/pm/actas/<code>); con actas archivadas o sin
 * actas explica el estado sin sacar del panel.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireRouteAccess("pm.actas");
  const { id } = await params;
  const idActivo = decodeURIComponent(id);

  const link = await fetchActasLinkForPmActivo(ctx, idActivo);
  if (link && !link.archived) {
    redirect(actasProjectPath(link.code));
  }

  if (link?.archived) {
    return (
      <section className="rounded-lg border border-subtle/50 bg-card p-6 text-sm text-text-muted">
        <h2 className="text-base font-semibold text-text-primary">
          Las actas de {idActivo} están archivadas
        </h2>
        <p className="mt-2">
          El proyecto de actas <span className="font-medium">{link.code}</span>{" "}
          existe pero fue archivado; puedes consultarlo o restaurarlo desde los
          archivados.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href={actasArchivedProjectsPath()}
            className="text-icam-900 underline"
          >
            Ver proyectos archivados
          </Link>
          <Link
            href={actasProjectPath(link.code)}
            className="text-icam-900 underline"
          >
            Abrir {link.code}
          </Link>
        </div>
      </section>
    );
  }

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
