import { createServiceRoleClient } from "@/lib/db/admin";

import {
  displayNameFromAuthMetadata,
  ownerFromAuthUser,
} from "@/modules/pm/actas/logic/user-display";

export type PmZoneUserOption = {
  userId: string;
  email: string;
  label: string;
  initials: string;
  displayName: string;
};

export async function searchPmZoneUsers(
  query: string,
  limit = 25,
): Promise<
  | { ok: true; users: PmZoneUserOption[] }
  | { ok: false; error: string }
> {
  const admin = createServiceRoleClient();
  const { data: zoneRows, error: zoneError } = await admin
    .from("app_user_zone_role")
    .select("user_id")
    .eq("zone_key", "pm");

  if (zoneError) {
    return { ok: false, error: zoneError.message };
  }

  const userIds = [
    ...new Set((zoneRows ?? []).map((row) => row.user_id as string)),
  ];
  if (userIds.length === 0) {
    return { ok: true, users: [] };
  }

  const q = query.trim().toLowerCase();
  const users: PmZoneUserOption[] = [];

  for (const userId of userIds) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data.user) continue;

    const email = data.user.email?.trim() ?? "";
    if (!email) continue;

    const displayName = displayNameFromAuthMetadata(
      email,
      data.user.user_metadata as Record<string, unknown> | undefined,
    );
    const owner = ownerFromAuthUser(
      userId,
      email,
      data.user.user_metadata as Record<string, unknown> | undefined,
    );

    if (q) {
      const haystack =
        `${email} ${displayName} ${owner.label} ${owner.initials}`.toLowerCase();
      if (!haystack.includes(q)) continue;
    }

    users.push({
      userId,
      email,
      label: owner.label,
      initials: owner.initials,
      displayName,
    });
  }

  users.sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  return { ok: true, users: users.slice(0, limit) };
}
