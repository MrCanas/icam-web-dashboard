import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

export function getMondayWriteSupabase(_ctx: UserContext) {
  void _ctx;
  return createServiceRoleClient();
}
