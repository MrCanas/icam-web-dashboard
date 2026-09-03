import type { Metadata } from "next";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import { routeLabel } from "@/registry/routes";
import LogsPage from "@/modules/monday/ui/pages/LogsPage";

export const metadata: Metadata = { title: routeLabel("monday.logs") };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ boardId?: string; limit?: string }>;
}) {
  await requireRouteAccess("monday.logs");
  return <LogsPage searchParams={searchParams} />;
}
