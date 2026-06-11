import type { UserContext } from "@/lib/auth/currentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";

const PM_ACCESS_DENIED = "Sin acceso a la zona PM";

export function assertPmNotificationAccess(
  user: UserContext,
): { ok: true } | { ok: false; error: string } {
  if (!hasZoneAccess(user, "pm")) {
    return { ok: false, error: PM_ACCESS_DENIED };
  }
  return { ok: true };
}
