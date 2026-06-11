import type { SupabaseClient } from "@supabase/supabase-js";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { getPmWriteSupabase } from "@/modules/pm/data/readClient";

import { assertPmNotificationAccess } from "./assert-pm-notification-access";

export type NotificationActionContext =
  | {
      ok: true;
      client: SupabaseClient;
      authUserId: string;
    }
  | { ok: false; error: string };

export async function getNotificationActionContext(): Promise<NotificationActionContext> {
  const user = await requireCurrentUser();
  const access = assertPmNotificationAccess(user);
  if (!access.ok) return access;

  return {
    ok: true,
    client: getPmWriteSupabase(user),
    authUserId: user.id,
  };
}
