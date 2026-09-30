import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import InformesPage from "@/modules/pm/informes/ui/pages/InformesPage";

export const metadata: Metadata = { title: routeLabel("pm.informes") };

export default async function Page() {
  await requireRouteAccess("pm.informes");
  return <InformesPage />;
}
