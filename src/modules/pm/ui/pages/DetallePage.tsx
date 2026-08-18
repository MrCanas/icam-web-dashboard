import Link from "next/link";
import { fetchPmPortfolio } from "@/modules/pm/data/pmRepository";
import { getCurrentUser } from "@/lib/auth/currentUser";

export default async function PmDetalleIndexPage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        No autorizado
      </section>
    );
  }
  const { rows, error } = await fetchPmPortfolio(ctx);

  if (error) {
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error: {error}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <header className="bg-card rounded-lg border border-subtle/50 p-4">
        <h1 className="text-xl font-semibold text-text-primary">Todos los proyectos</h1>
        <p className="mt-1 text-sm text-text-muted">Elige un activo para ver timeline y snapshots</p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((r) => (
          <Link
            key={r.activo.id}
            href={`/dashboard/pm/proyecto/${encodeURIComponent(r.activo.id_activo)}`}
            className="rounded-lg border border-subtle/50 bg-card p-4 hover:border-icam-900 transition shadow-sm"
          >
            <p className="font-semibold text-icam-900">{r.activo.id_activo}</p>
            <p className="text-xs text-text-muted mt-1">{r.activo.tipo_uso_activo}</p>
            <p className="text-xs text-icam-900 mt-3 underline">Abrir detalle</p>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No hay activos PM cargados.</p>
      ) : null}
    </div>
  );
}
