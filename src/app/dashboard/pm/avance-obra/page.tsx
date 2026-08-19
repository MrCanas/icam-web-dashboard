import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import AvanceObraHubPage from "@/modules/pm/avance/ui/pages/AvanceObraHubPage";

export const metadata: Metadata = { title: routeLabel("pm.avance_obra") };

export default async function Page() {
  await requireRouteAccess("pm.avance_obra");
  return <AvanceObraHubPage />;
}
