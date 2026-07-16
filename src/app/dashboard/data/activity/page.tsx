import ActivityPage from "@/components/data/pages/ActivityPage";
import { requireRouteAccess } from "@/lib/auth/require-route-access";

export default async function Page() {
  await requireRouteAccess("data.activity");
  return <ActivityPage />;
}
