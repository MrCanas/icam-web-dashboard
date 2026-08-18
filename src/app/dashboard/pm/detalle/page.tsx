import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import PmDetallePage from "@/modules/pm/ui/pages/DetallePage";

export const metadata: Metadata = { title: routeLabel("pm.detalle") };

export default async function Page() {
  await requireRouteAccess("pm.detalle");
  return <PmDetallePage />;
}
