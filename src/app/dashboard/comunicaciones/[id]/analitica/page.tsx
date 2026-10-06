import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import AnaliticaPage from "@/modules/comunicaciones/ui/pages/AnaliticaPage";

export const metadata: Metadata = { title: "Analítica de la comunicación" };

// «Consultar entrega en Zoho» pregunta por cada correo, de cuatro en cuatro.
export const maxDuration = 300;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Es parte del detalle de una comunicación: se gobierna con su misma clave.
  const ctx = await requireRouteAccess("comunicaciones.historial");
  const { id } = await params;
  return <AnaliticaPage ctx={ctx} id={decodeURIComponent(id)} />;
}
