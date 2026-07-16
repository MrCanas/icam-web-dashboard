import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import OverviewPage from "@/modules/portfolio/ui/pages/OverviewPage";

export default async function Page(props: ComponentProps<typeof OverviewPage>) {
  await requireRouteAccess("portfolio.overview");
  return <OverviewPage {...props} />;
}
