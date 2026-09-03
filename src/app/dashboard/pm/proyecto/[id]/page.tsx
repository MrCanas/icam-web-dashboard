import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import ProyectoDetailPage from "@/modules/pm/ui/pages/ProyectoDetailPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `${decodeURIComponent(id)} · Resumen` };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}) {
  await requireRouteAccess("pm.detalle");
  return <ProyectoDetailPage params={params} searchParams={searchParams} />;
}
