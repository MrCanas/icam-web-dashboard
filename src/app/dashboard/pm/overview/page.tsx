import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import PmOverviewPage from "@/modules/pm/ui/pages/OverviewPage";

export default async function Page(
  props: ComponentProps<typeof PmOverviewPage>,
) {
  await requireRouteAccess("pm.overview");
  return <PmOverviewPage {...props} />;
}
