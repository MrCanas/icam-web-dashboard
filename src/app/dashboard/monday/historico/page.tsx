import type { ComponentProps } from "react";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import MondayHistoricoPage from "@/modules/monday/ui/pages/HistoricoPage";

export default async function Page(
  props: ComponentProps<typeof MondayHistoricoPage>,
) {
  await requireRouteAccess("monday.historico");
  return <MondayHistoricoPage {...props} />;
}
