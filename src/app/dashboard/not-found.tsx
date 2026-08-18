import Link from "next/link";

/** notFound() dentro del dashboard: mensaje con el chrome (Header/nav) intacto. */
export default function DashboardNotFound() {
  return (
    <section className="mx-auto max-w-md rounded-lg border border-subtle/50 bg-card p-8 text-center space-y-3">
      <p className="text-sm font-medium text-text-muted">Error 404</p>
      <h1 className="text-xl font-semibold text-text-primary">
        No encontrado
      </h1>
      <p className="text-sm text-text-muted">
        El proyecto o la página que buscas no existe o ha sido movida.
      </p>
      <div className="flex items-center justify-center gap-4 text-sm">
        <Link href="/dashboard/pm/detalle" className="text-icam-900 underline">
          Todos los proyectos
        </Link>
        <Link href="/dashboard/portfolio" className="text-icam-900 underline">
          Dashboard
        </Link>
      </div>
    </section>
  );
}
