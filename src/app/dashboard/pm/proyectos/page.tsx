import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import ProyectosPage from "@/modules/pm/planificacion/ui/pages/ProyectosPage";

export const metadata: Metadata = { title: routeLabel("pm.proyectos") };

export default async function Page() {
  await requireRouteAccess("pm.proyectos");
  return <ProyectosPage />;
}
