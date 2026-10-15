import { requireRouteAccess } from "@/lib/auth/require-route-access";
import MondayDashboardPage from "@/modules/monday/ui/pages/DashboardPage";

export default async function Page() {
  await requireRouteAccess("monday.dashboard");
  return <MondayDashboardPage />;
}
