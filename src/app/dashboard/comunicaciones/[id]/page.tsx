import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import DetallePage from "@/modules/comunicaciones/ui/pages/DetallePage";

export const metadata: Metadata = { title: "Comunicación" };

// La lista de plantillas y la vista previa leen de Zoho en vivo, y el ensayo
// general lee de Zoho el registro de cada destinatario para montar su correo.
export const maxDuration = 300;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string | string[]; clasica?: string | string[] }>;
}) {
  const ctx = await requireRouteAccess("comunicaciones.historial");
  const [{ id }, { paso, clasica }] = await Promise.all([params, searchParams]);
  return (
    <DetallePage
      ctx={ctx}
      id={decodeURIComponent(id)}
      paso={typeof paso === "string" ? paso : undefined}
      clasica={clasica !== undefined}
    />
  );
}
