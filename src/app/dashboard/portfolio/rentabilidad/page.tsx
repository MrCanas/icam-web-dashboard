import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import RentabilidadPage from "@/modules/portfolio/ui/pages/RentabilidadPage";

export const metadata: Metadata = { title: routeLabel("portfolio.rentabilidad") };

export default async function Page(
  props: ComponentProps<typeof RentabilidadPage>,
) {
  await requireRouteAccess("portfolio.rentabilidad");
  return <RentabilidadPage {...props} />;
}
