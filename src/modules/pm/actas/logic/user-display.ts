import { createServiceRoleClient } from "@/lib/db/admin";

import type { ActasElementOwner } from "@/modules/pm/actas/types";

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function ownerFromAuthUser(
  id: string,
  email: string | undefined,
): ActasElementOwner {
  const mail = email?.trim() ?? "";
  const label = mail ? mail.split("@")[0]! : id.slice(0, 8);
  return {
    userId: id,
    email: mail || null,
    label,
    initials: mail ? initialsFromEmail(mail) : id.slice(0, 2).toUpperCase(),
  };
}

/** Resuelve etiquetas/iniciales para avatares (service role, pagina auth.users). */
export async function resolveUserDisplayMap(
  userIds: string[],
): Promise<Map<string, ActasElementOwner>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, ActasElementOwner>();
  if (unique.length === 0) return result;

  const needed = new Set(unique);
  const admin = createServiceRoleClient();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);

    for (const user of data.users) {
      if (needed.has(user.id)) {
        result.set(user.id, ownerFromAuthUser(user.id, user.email));
      }
    }

    if (result.size >= needed.size || data.users.length < perPage) break;
    page += 1;
  }

  for (const id of unique) {
    if (!result.has(id)) {
      result.set(id, ownerFromAuthUser(id, undefined));
    }
  }

  return result;
}
