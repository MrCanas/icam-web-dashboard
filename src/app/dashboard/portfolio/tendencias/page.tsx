import { requireRouteAccess } from "@/lib/auth/require-route-access";
import TendenciasPage from "@/modules/portfolio/ui/pages/TendenciasPage";

export default async function Page() {
  await requireRouteAccess("portfolio.tendencias");
  return <TendenciasPage />;
}
