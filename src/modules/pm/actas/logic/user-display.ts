import { unstable_cache } from "next/cache";

import { createServiceRoleClient } from "@/lib/db/admin";
import {
  initialsFromDisplayName,
  initialsFromEmail,
} from "@/lib/user-initials";

import type { ActasElementOwner } from "@/modules/pm/actas/types";

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reexportadas por compatibilidad: viven en @/lib/user-initials porque este
// módulo importa el cliente service role y no puede llegar al bundle cliente.
export { initialsFromDisplayName, initialsFromEmail };

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

type AuthUserDisplayRow = {
  id: string;
  email: string | null;
  meta: Record<string, unknown> | null;
};

/**
 * Filas de `auth_users_display` para un conjunto de ids (ordenado, para que el
 * mismo conjunto dé la misma clave). Nombres y emails casi no cambian y se
 * piden en cada carga de un tablero: se cachean una hora entre peticiones.
 * `null` = la RPC no existe (migración 033 sin aplicar): se usa la paginación.
 */
const readAuthUsersDisplay = unstable_cache(
  async (sortedIds: string[]): Promise<AuthUserDisplayRow[] | null> => {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.rpc("auth_users_display", {
      p_ids: sortedIds,
    });
    if (!error && Array.isArray(data)) return data as AuthUserDisplayRow[];
    if (error && !/could not find|does not exist|PGRST202|42883/i.test(error.message ?? "")) {
      throw new Error(`auth_users_display: ${error.message}`);
    }
    return null;
  },
  ["actas-auth-users-display"],
  { revalidate: 3600 },
);

/**
 * Resuelve etiquetas/iniciales para avatares (service role).
 *
 * Usa la RPC `auth_users_display` (migración 033): trae SOLO los usuarios
 * pedidos en una consulta, en vez de paginar auth.users entero en cada render.
 * Si la RPC no está aplicada, cae a la paginación antigua.
 */
export async function resolveUserDisplayMap(
  userIds: string[],
): Promise<Map<string, ActasElementOwner>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, ActasElementOwner>();
  if (unique.length === 0) return result;

  const rows = await readAuthUsersDisplay([...unique].sort());

  if (rows) {
    for (const row of rows) {
      result.set(row.id, ownerFromAuthUser(row.id, row.email ?? undefined, row.meta ?? undefined));
    }
  } else {
    const admin = createServiceRoleClient();
    // RPC sin aplicar todavía: fallback a la paginación.
    await paginarAuthUsers(admin, new Set(unique), result);
  }

  for (const id of unique) {
    if (!result.has(id)) {
      result.set(id, ownerFromAuthUser(id, undefined));
    }
  }
  return result;
}

async function paginarAuthUsers(
  admin: ReturnType<typeof createServiceRoleClient>,
  needed: Set<string>,
  result: Map<string, ActasElementOwner>,
): Promise<void> {
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
}
