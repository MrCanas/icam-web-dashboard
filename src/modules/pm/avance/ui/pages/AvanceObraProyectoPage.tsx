import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { fetchAvanceObraProyecto } from "@/modules/pm/avance/data/avanceRepository";
import { AvanceHistoricoTable } from "@/modules/pm/avance/ui/components/AvanceHistoricoTable";
import { AvanceObraPanel } from "@/modules/pm/avance/ui/components/AvanceObraPanel";

interface AvanceObraProyectoPageProps {
  idActivo: string;
}

const CAJA = "rounded-lg border border-subtle/50 bg-card p-6 text-sm text-text-muted";

export default async function AvanceObraProyectoPage({
  idActivo,
}: AvanceObraProyectoPageProps) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { data, sinPromocion, migracionPendiente, error } = await fetchAvanceObraProyecto(
    ctx,
    idActivo,
  );

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

  if (sinPromocion || !data) {
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

  const rol = getUserRole(ctx, "pm");
  const hasWriteAccess = rol === "admin" || rol === "editor";

  return (
    <div className="min-w-0 space-y-6">
      {!hasWriteAccess ? (
        <p className="text-xs text-amber-700">Tienes acceso de solo lectura.</p>
      ) : null}

      <AvanceObraPanel data={data} hasWriteAccess={hasWriteAccess} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-icam-900">Histórico de cambios</h2>
        <p className="text-xs leading-snug text-text-muted">
          Cada cambio queda registrado con su fecha. Es la serie con la que se pintará la
          evolución del avance cuando haya varias lecturas.
        </p>
        <AvanceHistoricoTable filas={data.historico} />
      </section>
    </div>
  );
}
