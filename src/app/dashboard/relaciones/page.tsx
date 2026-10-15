import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import ImparCommPage from "@/modules/relaciones/ui/pages/ImparCommPage";

export const metadata: Metadata = { title: routeLabel("relaciones.imparcomm") };

export default async function Page() {
  await requireRouteAccess("relaciones.imparcomm");
  return <ImparCommPage />;
}
