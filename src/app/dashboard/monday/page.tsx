import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import MondayDashboardPage from "@/modules/monday/ui/pages/DashboardPage";

export default async function Page(
  props: ComponentProps<typeof MondayDashboardPage>,
) {
  await requireRouteAccess("monday.dashboard");
  return <MondayDashboardPage {...props} />;
}
