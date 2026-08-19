import Link from "next/link";

/**
 * 404 global (fuera del layout del dashboard: aquí no hay sesión ni nav).
 * Los notFound() lanzados dentro del dashboard los captura
 * src/app/dashboard/not-found.tsx, que sí conserva el chrome.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-page p-6">
      <section className="w-full max-w-md rounded-lg border border-subtle/50 bg-card p-8 text-center space-y-3">
        <p className="text-sm font-medium text-text-muted">Error 404</p>
        <h1 className="text-xl font-semibold text-text-primary">
          Página no encontrada
        </h1>
        <p className="text-sm text-text-muted">
          La dirección no existe o ha cambiado con la nueva estructura del
          aplicativo.
        </p>
        <Link
          href="/dashboard/portfolio"
          className="inline-block text-sm text-icam-900 underline"
        >
          Ir al dashboard
        </Link>
      </section>
    </main>
  );
}
