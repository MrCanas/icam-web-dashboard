import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import TendenciasPage from "@/modules/portfolio/ui/pages/TendenciasPage";

export const metadata: Metadata = { title: routeLabel("portfolio.tendencias") };

export default async function Page() {
  await requireRouteAccess("portfolio.tendencias");
  return <TendenciasPage />;
}
