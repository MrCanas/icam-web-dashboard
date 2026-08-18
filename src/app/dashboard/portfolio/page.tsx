import type { Metadata } from "next";
import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import ExecutivePage from "@/modules/portfolio/ui/pages/ExecutivePage";

export const metadata: Metadata = { title: routeLabel("portfolio.executive") };

export default async function Page(props: ComponentProps<typeof ExecutivePage>) {
  await requireRouteAccess("portfolio.executive");
  return <ExecutivePage {...props} />;
}
