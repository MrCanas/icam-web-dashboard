import { requireRouteAccess } from "@/lib/auth/require-route-access";
import PmDetallePage from "@/modules/pm/ui/pages/DetallePage";

export default async function Page() {
  await requireRouteAccess("pm.detalle");
  return <PmDetallePage />;
}
