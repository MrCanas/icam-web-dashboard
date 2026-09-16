import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import InversoresPage from "@/modules/portfolio/inversores/ui/pages/InversoresPage";

export const metadata: Metadata = { title: routeLabel("portfolio.inversores") };

export default async function Page() {
  // El único corte que no se salta por URL. La ruta está marcada
  // `deniedByDefault`, así que aquí no llega nadie a quien no se le haya
  // concedido a mano desde /dashboard/admin/usuarios.
  await requireRouteAccess("portfolio.inversores");
  return <InversoresPage />;
}
