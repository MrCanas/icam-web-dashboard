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

/**
 * Lista usuarios asignables como owner. Devuelve TODOS los usuarios de la app
 * (auth.users), no solo los de la zona pm: el owner se puede asignar a cualquier
 * usuario. Pagina la API admin para no perder usuarios.
 */
export async function searchPmZoneUsers(
  query: string,
  limit = 25,
): Promise<
  | { ok: true; users: PmZoneUserOption[] }
  | { ok: false; error: string }
> {
  const admin = createServiceRoleClient();
  const q = query.trim().toLowerCase();
  const users: PmZoneUserOption[] = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { ok: false, error: error.message };
    }
    const batch = data?.users ?? [];

    for (const user of batch) {
      const email = user.email?.trim() ?? "";
      if (!email) continue;

      const metadata = user.user_metadata as Record<string, unknown> | undefined;
      const displayName = displayNameFromAuthMetadata(email, metadata);
      const owner = ownerFromAuthUser(user.id, email, metadata);

      if (q) {
        const haystack =
          `${email} ${displayName} ${owner.label} ${owner.initials}`.toLowerCase();
        if (!haystack.includes(q)) continue;
      }

      users.push({
        userId: user.id,
        email,
        label: owner.label,
        initials: owner.initials,
        displayName,
      });
    }

    if (batch.length < perPage) break;
  }

  users.sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  return { ok: true, users: users.slice(0, limit) };
}
