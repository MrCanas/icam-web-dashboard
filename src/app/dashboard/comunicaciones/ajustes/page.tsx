import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import AjustesPage from "@/modules/comunicaciones/ui/pages/AjustesPage";

export const metadata: Metadata = { title: "Ajustes de envío" };

export default async function Page() {
  await requireRouteAccess("comunicaciones.ajustes");
  return <AjustesPage />;
}
