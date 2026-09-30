import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import InformesListaPage from "@/modules/pm/informes/ui/pages/InformesListaPage";

export const metadata: Metadata = { title: routeLabel("pm.informes") };

export default async function Page() {
  const ctx = await requireRouteAccess("pm.informes");
  return <InformesListaPage ctx={ctx} />;
}
