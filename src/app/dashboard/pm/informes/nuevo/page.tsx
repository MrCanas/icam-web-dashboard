import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import NuevoInformePage from "@/modules/pm/informes/ui/pages/NuevoInformePage";

export const metadata: Metadata = { title: "Nuevo informe trimestral" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireRouteAccess("pm.informes");
  const { activo } = await searchParams;
  return <NuevoInformePage ctx={ctx} activo={typeof activo === "string" ? activo : null} />;
}
