import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { fetchActasCodeForPmActivo } from "@/modules/pm/actas/data/actasRepository";
import { actasHubPath, actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";

/**
 * Resolver de la subpestaña Actas de un proyecto PM: redirige a la URL
 * canónica del proyecto de actas vinculado (/dashboard/pm/actas/<code>).
 * Si el activo no tiene actas, muestra el fallback para crearlas desde el hub.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireRouteAccess("pm.actas");
  const { id } = await params;
  const idActivo = decodeURIComponent(id);

  const code = await fetchActasCodeForPmActivo(ctx, idActivo);
  if (code) {
    redirect(actasProjectPath(code));
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
