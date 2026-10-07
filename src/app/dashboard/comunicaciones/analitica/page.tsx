import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import AnaliticaGlobalPage from "@/modules/comunicaciones/ui/pages/AnaliticaGlobalPage";

export const metadata: Metadata = { title: "Analítica de los correos" };

export default async function Page({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireRouteAccess("comunicaciones.analitica");
  const { periodo } = await searchParams;
  return <AnaliticaGlobalPage periodo={periodo} />;
}
