import { requireRouteAccess } from "@/lib/auth/require-route-access";
import PlanificacionProyectoPage from "@/modules/pm/planificacion/ui/pages/PlanificacionProyectoPage";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("pm.planificacion");
  const { id } = await params;
  return <PlanificacionProyectoPage idActivo={decodeURIComponent(id)} />;
}
