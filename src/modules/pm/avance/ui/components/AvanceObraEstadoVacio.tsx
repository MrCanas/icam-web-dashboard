import Link from "next/link";

const CAJA = "rounded-lg border border-subtle/50 bg-card p-6 text-sm text-text-muted";

interface AvanceObraEstadoVacioProps {
  idActivo: string;
  sinPromocion: boolean;
  migracionPendiente: boolean;
  error: string | null;
}

/**
 * Los tres estados en los que no hay avance que pintar. Compartido entre la
 * pestaña antigua de Avance de obra y la sección del acta.
 * Devuelve null si ninguno aplica.
 */
export function AvanceObraEstadoVacio({
  idActivo,
  sinPromocion,
  migracionPendiente,
  error,
}: AvanceObraEstadoVacioProps) {
  if (migracionPendiente) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Avance de obra necesita la migración 028, que aún no está aplicada en este entorno.
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        No se pudo cargar el avance de obra: {error}
      </section>
    );
  }

  if (sinPromocion) {
    return (
      <section className={CAJA}>
        <p>
          <span className="font-medium text-text-body">{idActivo}</span> todavía no está
          emparejado con una promoción de Zoho.
        </p>
        <p className="mt-2 leading-snug">
          Los códigos de PM y los de Zoho no coinciden por diseño (PM llama{" "}
          <span className="font-mono text-xs">DC-15</span> a lo que Zoho llama{" "}
          <span className="font-mono text-xs">DC15</span>), así que el emparejamiento se hace a
          mano en{" "}
          <Link href="/dashboard/pm/proyectos" className="font-medium text-icam-900 underline">
            Mapeo maestro
          </Link>
          , columna «Promoción (Zoho)».
        </p>
      </section>
    );
  }

  return null;
}
