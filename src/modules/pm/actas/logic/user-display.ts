import { createServiceRoleClient } from "@/lib/db/admin";

import type { ActasElementOwner } from "@/modules/pm/actas/types";

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return "?";
}

export function displayNameFromAuthMetadata(
  email: string,
  metadata: Record<string, unknown> | undefined,
): string {
  if (metadata) {
    if (typeof metadata.name === "string" && metadata.name.trim()) {
      return metadata.name.trim();
    }
    if (typeof metadata.full_name === "string" && metadata.full_name.trim()) {
      return metadata.full_name.trim();
    }
  }
  const local = email.split("@")[0]?.trim();
  return local || email;
}

export function ownerFromAuthUser(
  id: string,
  email: string | undefined,
  metadata?: Record<string, unknown>,
): ActasElementOwner {
  const mail = email?.trim() ?? "";
  const displayName = mail
    ? displayNameFromAuthMetadata(mail, metadata)
    : "";
  const label = displayName || (mail ? mail.split("@")[0]! : "");
  const initials = mail
    ? initialsFromEmail(mail)
    : displayName
      ? initialsFromDisplayName(displayName)
      : "?";

  return {
    userId: id,
    email: mail || null,
    label: label && !UUID_LIKE.test(label) ? label : "",
    initials: initials === "?" || UUID_LIKE.test(initials) ? "?" : initials,
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
        result.set(
          user.id,
          ownerFromAuthUser(
            user.id,
            user.email,
            user.user_metadata as Record<string, unknown> | undefined,
          ),
        );
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
