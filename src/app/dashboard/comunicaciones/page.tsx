import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import HistorialPage from "@/modules/comunicaciones/ui/pages/HistorialPage";

export const metadata: Metadata = { title: "Comunicaciones" };

export default async function Page() {
  await requireRouteAccess("comunicaciones.historial");
  return <HistorialPage />;
}
