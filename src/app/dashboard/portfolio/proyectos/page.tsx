import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import ProyectosPage from "@/modules/portfolio/ui/pages/ProyectosPage";

export const metadata: Metadata = { title: routeLabel("portfolio.proyectos") };

export default async function Page(props: ComponentProps<typeof ProyectosPage>) {
  await requireRouteAccess("portfolio.proyectos");
  return <ProyectosPage {...props} />;
}
