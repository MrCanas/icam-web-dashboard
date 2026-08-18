import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import PlanificacionProyectoPage from "@/modules/pm/planificacion/ui/pages/PlanificacionProyectoPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Planificación` };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("pm.planificacion");
  const { id } = await params;
  return <PlanificacionProyectoPage idActivo={decodeURIComponent(id)} />;
}
