import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import AvanceObraProyectoPage from "@/modules/pm/avance/ui/pages/AvanceObraProyectoPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Avance de obra` };
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRouteAccess("pm.avance_obra");
  const { id } = await params;
  return <AvanceObraProyectoPage idActivo={decodeURIComponent(id)} />;
}
