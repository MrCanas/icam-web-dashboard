import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import ExecutivePage from "@/modules/portfolio/ui/pages/ExecutivePage";

export default async function Page(props: ComponentProps<typeof ExecutivePage>) {
  await requireRouteAccess("portfolio.executive");
  return <ExecutivePage {...props} />;
}
