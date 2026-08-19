import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import OverviewPage from "@/modules/portfolio/ui/pages/OverviewPage";

export const metadata: Metadata = { title: routeLabel("portfolio.overview") };

export default async function Page(props: ComponentProps<typeof OverviewPage>) {
  await requireRouteAccess("portfolio.overview");
  return <OverviewPage {...props} />;
}
