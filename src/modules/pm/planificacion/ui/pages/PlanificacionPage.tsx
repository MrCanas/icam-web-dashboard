import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { fetchPlanificacionBoard } from "@/modules/pm/planificacion/data/planificacionRepository";
import { PlanificacionBoard } from "@/modules/pm/planificacion/ui/components/PlanificacionBoard";

export default async function PlanificacionPage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { rows, catalogo, snapshots, retirados, error } = await fetchPlanificacionBoard(ctx);

  if (error) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        Error cargando Planificación: {error}
        <p className="mt-2 text-xs">
          ¿Aplicaste las migraciones 020 y 021 y ejecutaste{" "}
          <code className="text-xs">npm run pm:backfill-planificacion</code>?
        </p>
      </section>
    );
  }

  const role = getUserRole(ctx, "pm");
  const hasWriteAccess = role === "admin" || role === "editor";
  const sinMapear = catalogo.filter((c) => !c.tabla_madre_columna).length;

  return (
    <div className="min-w-0 space-y-4">
      <header className="rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-text-primary">PM — Planificación</h1>
        <p className="mt-1 text-sm text-text-muted">
          Edita la previsión de cada hito y congela el trimestre que reportas. Lo
          que guardes aquí es lo que muestra el Overview.
        </p>
        {!hasWriteAccess ? (
          <p className="mt-2 text-xs text-amber-700">
            Tienes acceso de solo lectura: puedes consultar la planificación pero no editarla.
          </p>
        ) : null}
        {sinMapear > 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            {sinMapear} de {catalogo.length} hitos sin mapear a la Tabla madre.{" "}
            <Link href="/dashboard/pm/proyectos" className="text-icam-900 underline">
              Mapearlos
            </Link>
          </p>
        ) : null}
      </header>

      <PlanificacionBoard
        rows={rows}
        catalogo={catalogo}
        snapshots={snapshots}
        retirados={retirados}
        hasWriteAccess={hasWriteAccess}
      />
    </div>
  );
}
