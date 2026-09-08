import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import ExecutivePage from "@/modules/corporativo/ui/pages/ExecutivePage";

export const metadata: Metadata = { title: routeLabel("corporativo.executive") };

export default async function Page(props: ComponentProps<typeof ExecutivePage>) {
  await requireRouteAccess("corporativo.executive");
  return <ExecutivePage {...props} />;
}
