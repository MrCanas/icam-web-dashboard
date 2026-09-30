import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import ImpresionPage from "@/modules/pm/informes/ui/pages/ImpresionPage";

export const metadata: Metadata = { title: "Informe trimestral · PDF" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRouteAccess("pm.informes");
  const { id } = await params;
  return <ImpresionPage ctx={ctx} id={decodeURIComponent(id)} />;
}
