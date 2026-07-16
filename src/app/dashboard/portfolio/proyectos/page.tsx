import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import ProyectosPage from "@/modules/portfolio/ui/pages/ProyectosPage";

export default async function Page(props: ComponentProps<typeof ProyectosPage>) {
  await requireRouteAccess("portfolio.proyectos");
  return <ProyectosPage {...props} />;
}
