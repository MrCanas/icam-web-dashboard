import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import NuevaPage from "@/modules/comunicaciones/ui/pages/NuevaPage";

export const metadata: Metadata = { title: "Nueva comunicación" };

// «Actualizar datos de Zoho» lanza la sincronización de Inversores desde una
// Server Action de esta página: el mismo margen que su cron.
export const maxDuration = 300;

export default async function Page() {
  await requireRouteAccess("comunicaciones.nueva");
  return <NuevaPage />;
}
