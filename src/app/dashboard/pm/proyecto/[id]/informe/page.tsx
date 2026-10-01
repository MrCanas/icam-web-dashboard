import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import InformesListaPage from "@/modules/pm/informes/ui/pages/InformesListaPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Informe trimestral` };
}

/** Subpestaña «Informes» del proyecto: sus informes y «Nuevo informe» con el proyecto ya elegido. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRouteAccess("pm.informes");
  const { id } = await params;
  return <InformesListaPage ctx={ctx} idActivo={decodeURIComponent(id)} />;
}
