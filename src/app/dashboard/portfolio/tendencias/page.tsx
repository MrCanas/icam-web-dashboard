import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import TendenciasPage from "@/modules/portfolio/ui/pages/TendenciasPage";

export const metadata: Metadata = { title: routeLabel("portfolio.tendencias") };

export default async function Page(props: ComponentProps<typeof TendenciasPage>) {
  await requireRouteAccess("portfolio.tendencias");
  return <TendenciasPage {...props} />;
}
