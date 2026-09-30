import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { obtenerInforme } from "@/modules/pm/informes/data/informesRepository";
import { nombrePdf } from "@/modules/pm/informes/logic/paths";
import ImpresionPage from "@/modules/pm/informes/ui/pages/ImpresionPage";

/** El título es el nombre del PDF: el navegador lo propone al «Guardar como PDF». */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getCurrentUser();
  const r = ctx ? await obtenerInforme(ctx, decodeURIComponent(id)) : null;
  const i = r?.data;
  return { title: i ? { absolute: nombrePdf(i) } : "Informe trimestral · PDF" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRouteAccess("pm.informes");
  const { id } = await params;
  return <ImpresionPage ctx={ctx} id={decodeURIComponent(id)} />;
}
