import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import InformePage from "@/modules/pm/informes/ui/pages/InformePage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id).replace("_", " · ").replace("-", " ")} · Informe` };
}

// Las Server Actions del informe guardan slides y fuentes: margen para las lentas.
export const maxDuration = 60;

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRouteAccess("pm.informes");
  const { id } = await params;
  const { existia } = await searchParams;
  return <InformePage ctx={ctx} id={decodeURIComponent(id)} existia={existia === "1"} />;
}
