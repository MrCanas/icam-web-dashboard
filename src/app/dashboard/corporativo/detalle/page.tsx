import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import DetallePage from "@/modules/corporativo/ui/pages/DetallePage";

export const metadata: Metadata = { title: routeLabel("corporativo.detalle") };

export default async function Page(props: ComponentProps<typeof DetallePage>) {
  await requireRouteAccess("corporativo.detalle");
  return <DetallePage {...props} />;
}
