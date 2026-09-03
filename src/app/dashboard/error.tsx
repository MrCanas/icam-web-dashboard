"use client";

import Link from "next/link";

/**
 * Error boundary del dashboard. Antes no había ninguno en toda la app: cualquier
 * fallo de render llegaba a la pantalla de error por defecto de Next, sin chrome
 * ni forma de recuperarse. Este conserva el marco y ofrece reintentar.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="rounded-lg border border-red-200 bg-card p-6">
      <h2 className="text-lg font-semibold text-text-primary">Algo ha fallado al cargar esta página</h2>
      <p className="mt-1 text-sm text-text-muted">
        Ha ocurrido un error inesperado. Puedes reintentar; si persiste, avisa a
        soporte con el código de abajo.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-text-muted">ref: {error.digest}</p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-icam-900 bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-icam-800"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard"
          className="rounded border border-subtle px-3 py-1.5 text-sm text-text-body hover:bg-page"
        >
          Ir al inicio
        </Link>
      </div>
    </section>
  );
}
