import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import DetallePage from "@/modules/comunicaciones/ui/pages/DetallePage";

export const metadata: Metadata = { title: "Comunicación" };

// La lista de plantillas y la vista previa leen de Zoho en vivo.
export const maxDuration = 60;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRouteAccess("comunicaciones.historial");
  const { id } = await params;
  return <DetallePage ctx={ctx} id={decodeURIComponent(id)} />;
}
