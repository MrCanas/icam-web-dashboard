import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { fetchAvanceObraProyecto } from "@/modules/pm/avance/data/avanceRepository";
import { AvanceHistoricoTable } from "@/modules/pm/avance/ui/components/AvanceHistoricoTable";
import { AvanceObraEstadoVacio } from "@/modules/pm/avance/ui/components/AvanceObraEstadoVacio";
import { AvanceObraPanel } from "@/modules/pm/avance/ui/components/AvanceObraPanel";

interface AvanceObraProyectoPageProps {
  idActivo: string;
}

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

  if (migracionPendiente || error || sinPromocion || !data) {
    return (
      <AvanceObraEstadoVacio
        idActivo={idActivo}
        sinPromocion={sinPromocion || (!data && !migracionPendiente && !error)}
        migracionPendiente={migracionPendiente}
        error={error}
      />
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
