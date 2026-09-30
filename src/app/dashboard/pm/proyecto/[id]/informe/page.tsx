import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import InformesPage from "@/modules/pm/informes/ui/pages/InformesPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Informe trimestral` };
}

/** Subpestaña «Informe trimestral» del proyecto: la app con el activo ya elegido. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireRouteAccess("pm.informes");
  const { id } = await params;
  return <InformesPage idActivo={decodeURIComponent(id)} />;
}
