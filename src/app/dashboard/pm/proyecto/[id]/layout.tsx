import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import { PmProjectTabs } from "@/modules/pm/ui/PmProjectTabs";

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idActivo = decodeURIComponent(id);
  const user = await getCurrentUser();

  // Las actas del proyecto viven en su propia URL, /proyecto/<id>/actas: ya no
  // hace falta resolver el código de actas aquí para construir el enlace (ni
  // pagar esa consulta en cada navegación dentro del proyecto).
  return (
    <div className="space-y-4 min-w-0">
      <PmProjectTabs
        idActivo={idActivo}
        showPlanificacion={user ? canAccessRouteKey(user, "pm.planificacion") : true}
        showActas={user ? canAccessRouteKey(user, "pm.actas") : true}
      />
      {children}
    </div>
  );
}
