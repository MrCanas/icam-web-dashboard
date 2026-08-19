import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import PlanificacionPage from "@/modules/pm/planificacion/ui/pages/PlanificacionPage";

export const metadata: Metadata = { title: routeLabel("pm.planificacion") };

export default async function Page() {
  await requireRouteAccess("pm.planificacion");
  return <PlanificacionPage />;
}
