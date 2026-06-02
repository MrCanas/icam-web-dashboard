import { requireCurrentUser } from "@/lib/auth/currentUser";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

import { assertPmNotificationAccess } from "./assert-pm-notification-access";

export type NotificationActionContext =
  | {
      ok: true;
      client: NonNullable<
        Awaited<ReturnType<typeof getActasAuthenticatedSupabase>>["client"]
      >;
      authUserId: string;
    }
  | { ok: false; error: string };

export async function getNotificationActionContext(): Promise<NotificationActionContext> {
  const user = await requireCurrentUser();
  const access = assertPmNotificationAccess(user);
  if (!access.ok) return access;

  const authUserId = await resolveAuthUserIdByEmail(user.email);
  if (!authUserId) {
    return {
      ok: false,
      error: `Usuario ${user.email} no provisionado en Supabase Auth.`,
    };
  }

  const { client, error } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error };
  }

  return { ok: true, client, authUserId };
}
