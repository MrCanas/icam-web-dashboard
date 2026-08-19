import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import PmOverviewPage from "@/modules/pm/ui/pages/OverviewPage";

export const metadata: Metadata = { title: routeLabel("portfolio.pm_overview") };

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
