import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import RentabilidadPage from "@/modules/portfolio/ui/pages/RentabilidadPage";

export default async function Page(
  props: ComponentProps<typeof RentabilidadPage>,
) {
  await requireRouteAccess("portfolio.rentabilidad");
  return <RentabilidadPage {...props} />;
}
