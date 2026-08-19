import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { fetchPromocionesYMapeo } from "@/modules/pm/avance/data/avanceRepository";
import {
  fetchHitoCatalogo,
  fetchProyectosPageData,
} from "@/modules/pm/planificacion/data/planificacionRepository";
import { CatalogoHitosTable } from "@/modules/pm/planificacion/ui/components/CatalogoHitosTable";
import { ProyectosTable } from "@/modules/pm/planificacion/ui/components/ProyectosTable";

export default async function ProyectosPage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  // La lectura de promociones se compone aquí, no dentro de
  // planificacionRepository: así Planificación no depende de Avance de obra.
  const [
    { rows, proyectosFinancieros, mapeo, error },
    { catalogo, error: eCat },
    { promociones, mapeo: mapeoPromociones, error: ePromo },
  ] = await Promise.all([
    fetchProyectosPageData(ctx),
    fetchHitoCatalogo(ctx),
    fetchPromocionesYMapeo(ctx),
  ]);

  const err = error ?? eCat ?? ePromo;
  if (err) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        Error cargando Proyectos: {err}
      </section>
    );
  }

  const role = getUserRole(ctx, "pm");
  const hasWriteAccess = role === "admin" || role === "editor";

  return (
    <div className="min-w-0 space-y-6">
      <header className="rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-text-primary">Mapeo maestro</h1>
        <p className="mt-1 text-sm text-text-muted">
          Alta y baja de proyectos, y equivalencia de nombres entre PM y el
          maestro financiero.
        </p>
        {!hasWriteAccess ? (
          <p className="mt-2 text-xs text-amber-700">
            Tienes acceso de solo lectura.
          </p>
        ) : null}
      </header>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Proyectos y mapeo</h2>
          <p className="mt-0.5 text-xs leading-snug text-text-muted">
            PM y la Tabla madre tienen los mismos proyectos con nombres distintos,
            así que el emparejamiento no se puede deducir del código: hay que
            hacerlo aquí. Dos activos pueden apuntar al mismo proyecto financiero
            —PM separa PC25 por uso y el maestro lo mantiene unido—; se marcan con ×2.
          </p>
          <p className="mt-1 text-xs leading-snug text-text-muted">
            Con Zoho pasa lo mismo, y además hay más promociones que proyectos: Zoho llama
            «DC15» a lo que PM llama «DC-15», y «SA31» a «SA-33-31». Solo 4 activos se
            emparejaron solos en la carga —desde una lista escrita a mano, no por una regla—;
            el resto se elige en «Promoción (Zoho)».
          </p>
        </div>
        <ProyectosTable
          rows={rows}
          proyectosFinancieros={proyectosFinancieros}
          mapeo={mapeo}
          promociones={promociones}
          mapeoPromociones={mapeoPromociones}
          hasWriteAccess={hasWriteAccess}
        />
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Hitos y Tabla madre</h2>
          <p className="mt-0.5 text-xs leading-snug text-text-muted">
            Qué hitos de PM existen ya en la Tabla madre y a qué columna
            corresponderían los que no.
          </p>
        </div>
        <CatalogoHitosTable catalogo={catalogo} hasWriteAccess={hasWriteAccess} />
      </section>
    </div>
  );
}
