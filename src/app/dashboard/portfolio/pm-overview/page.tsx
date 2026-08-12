import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import PmOverviewPage from "@/modules/pm/ui/pages/OverviewPage";

/**
 * «Overview PM» en la zona Dashboard. Antes vivía en /dashboard/pm/overview
 * (key `pm.overview`); la migración 027 copió aquellos denies a esta key.
 */
export default async function Page(
  props: ComponentProps<typeof PmOverviewPage>,
) {
  await requireRouteAccess("portfolio.pm_overview");
  return <PmOverviewPage {...props} />;
}
