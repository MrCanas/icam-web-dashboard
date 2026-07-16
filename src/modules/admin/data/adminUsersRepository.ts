import bcrypt from "bcrypt";

import type { ZoneRole } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/db/admin";
import { initialsForUser } from "@/lib/user-initials";
import type { ZoneKey } from "@/registry/modules";
import { isKnownRouteKey } from "@/registry/routes";
import type { AdminUserRow, ZoneRoleAssignment } from "@/modules/admin/types";
import { displayNameFromAuthMetadata } from "@/modules/pm/actas/logic/user-display";

const BCRYPT_ROUNDS = 10;
const PER_PAGE = 200;
const MAX_PAGES = 50;

/**
 * Todas las lecturas/escrituras usan service role: las tablas `app_*` tienen RLS
 * con políticas solo para service_role. El gate de autorización vive en las
 * actions (`checkPlatformAdmin`), no aquí.
 */

interface AuthUserLite {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  createdAt: string;
  lastSignInAt: string | null;
}

async function listAuthUsers(): Promise<AuthUserLite[]> {
  const admin = createServiceRoleClient();
  const users: AuthUserLite[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw new Error(`listUsers: ${error.message}`);

    const batch = data?.users ?? [];
    for (const user of batch) {
      const email = user.email?.trim() ?? "";
      if (!email) continue;

      const metadata = user.user_metadata as Record<string, unknown> | undefined;
      const displayName = displayNameFromAuthMetadata(email, metadata);

      users.push({
        id: user.id,
        email,
        displayName,
        initials: initialsForUser(displayName, email),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      });
    }

    if (batch.length < PER_PAGE) break;
  }

  return users;
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const admin = createServiceRoleClient();

  const [authUsers, zonesResult, accountsResult, deniesResult] =
    await Promise.all([
      listAuthUsers(),
      admin.from("app_user_zone_role").select("user_id, zone_key, role"),
      admin.from("app_user_account").select("user_id, is_platform_admin, is_active"),
      admin.from("app_user_route_deny").select("user_id, route_key"),
    ]);

  if (zonesResult.error) {
    throw new Error(`app_user_zone_role: ${zonesResult.error.message}`);
  }
  if (accountsResult.error) {
    throw new Error(`app_user_account: ${accountsResult.error.message}`);
  }
  if (deniesResult.error) {
    throw new Error(`app_user_route_deny: ${deniesResult.error.message}`);
  }

  const zonesByUser = new Map<string, Partial<Record<ZoneKey, ZoneRole>>>();
  for (const row of zonesResult.data ?? []) {
    const current = zonesByUser.get(row.user_id) ?? {};
    current[row.zone_key as ZoneKey] = row.role as ZoneRole;
    zonesByUser.set(row.user_id, current);
  }

  const accountByUser = new Map(
    (accountsResult.data ?? []).map((row) => [row.user_id, row]),
  );

  const deniesByUser = new Map<string, string[]>();
  for (const row of deniesResult.data ?? []) {
    if (!isKnownRouteKey(row.route_key)) continue;
    const current = deniesByUser.get(row.user_id) ?? [];
    current.push(row.route_key);
    deniesByUser.set(row.user_id, current);
  }

  const rows: AdminUserRow[] = authUsers.map((user) => {
    const account = accountByUser.get(user.id);
    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      initials: user.initials,
      // Fila ausente = cuenta normal activa.
      isPlatformAdmin: account?.is_platform_admin === true,
      isActive: account?.is_active !== false,
      zones: zonesByUser.get(user.id) ?? {},
      deniedRouteKeys: deniesByUser.get(user.id) ?? [],
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
    };
  });

  rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "es"));
  return rows;
}

export async function setUserZoneRoles(
  userId: string,
  zones: ZoneRoleAssignment,
): Promise<void> {
  const admin = createServiceRoleClient();

  const toUpsert = Object.entries(zones)
    .filter(([, role]) => role != null)
    .map(([zoneKey, role]) => ({
      user_id: userId,
      zone_key: zoneKey,
      role: role as ZoneRole,
    }));

  const toRevoke = Object.entries(zones)
    .filter(([, role]) => role == null)
    .map(([zoneKey]) => zoneKey);

  if (toUpsert.length > 0) {
    const { error } = await admin
      .from("app_user_zone_role")
      .upsert(toUpsert, { onConflict: "user_id,zone_key" });
    if (error) throw new Error(`app_user_zone_role upsert: ${error.message}`);
  }

  if (toRevoke.length > 0) {
    const { error } = await admin
      .from("app_user_zone_role")
      .delete()
      .eq("user_id", userId)
      .in("zone_key", toRevoke);
    if (error) throw new Error(`app_user_zone_role delete: ${error.message}`);
  }
}

/** `routeKeys` es el set completo de denies del usuario, no un delta. */
export async function setUserRouteDenies(
  userId: string,
  routeKeys: string[],
): Promise<void> {
  const admin = createServiceRoleClient();

  const { error: deleteError } = await admin
    .from("app_user_route_deny")
    .delete()
    .eq("user_id", userId);
  if (deleteError) {
    throw new Error(`app_user_route_deny delete: ${deleteError.message}`);
  }

  if (routeKeys.length === 0) return;

  const { error: insertError } = await admin
    .from("app_user_route_deny")
    .insert(routeKeys.map((key) => ({ user_id: userId, route_key: key })));
  if (insertError) {
    throw new Error(`app_user_route_deny insert: ${insertError.message}`);
  }
}

export async function setUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const admin = createServiceRoleClient();
  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const { error } = await admin.from("app_user_password").upsert(
    {
      user_id: userId,
      password_hash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`app_user_password upsert: ${error.message}`);
}

async function upsertAccountFlags(
  userId: string,
  patch: { is_platform_admin?: boolean; is_active?: boolean; created_by?: string },
): Promise<void> {
  const admin = createServiceRoleClient();
  // Upsert y no update: la fila puede no existir (usuarios previos al deploy).
  const { error } = await admin.from("app_user_account").upsert(
    {
      user_id: userId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`app_user_account upsert: ${error.message}`);
}

export async function setUserPlatformAdmin(
  userId: string,
  value: boolean,
): Promise<void> {
  await upsertAccountFlags(userId, { is_platform_admin: value });
}

export async function setUserActive(
  userId: string,
  value: boolean,
): Promise<void> {
  await upsertAccountFlags(userId, { is_active: value });
}

/** Flags de la cuenta. Fila ausente = cuenta normal activa. */
export async function getUserAccountFlags(
  userId: string,
): Promise<{ isPlatformAdmin: boolean; isActive: boolean }> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("app_user_account")
    .select("is_platform_admin, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`app_user_account: ${error.message}`);
  return {
    isPlatformAdmin: data?.is_platform_admin === true,
    isActive: data?.is_active !== false,
  };
}

export async function countActivePlatformAdmins(): Promise<number> {
  const admin = createServiceRoleClient();
  const { count, error } = await admin
    .from("app_user_account")
    .select("user_id", { count: "exact", head: true })
    .eq("is_platform_admin", true)
    .eq("is_active", true);
  if (error) throw new Error(`app_user_account count: ${error.message}`);
  return count ?? 0;
}

/**
 * Rastro de actividad que impide el borrado. Estas FK son ON DELETE RESTRICT,
 * así que Postgres rechazaría el DELETE igualmente: esto solo permite avisar
 * antes y con un mensaje claro en vez de un error de clave ajena en crudo.
 */
export async function countUserReferences(userId: string): Promise<number> {
  const admin = createServiceRoleClient();

  const countIn = async (table: string, column: string): Promise<number> => {
    const { count, error } = await admin
      .from(table)
      .select(column, { count: "exact", head: true })
      .eq(column, userId);
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  };

  const counts = await Promise.all([
    countIn("log_entry", "author_id"),
    countIn("element_owner", "user_id"),
    countIn("actas_attachment", "uploaded_by"),
    countIn("element_notification", "created_by"),
    countIn("element_notification", "recipient_user_id"),
  ]);

  return counts.reduce((acc, n) => acc + n, 0);
}

/**
 * Borrado duro e irreversible. Las tablas app_user_* y org_member caen por
 * CASCADE; project.created_by/owner_user_id quedan a NULL.
 */
export async function deleteAdminUser(userId: string): Promise<void> {
  const admin = createServiceRoleClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  zones: ZoneRoleAssignment;
  deniedRouteKeys: string[];
  createdBy: string;
}): Promise<{ userId: string }> {
  const admin = createServiceRoleClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "No se pudo crear el usuario");
  }

  const userId = data.user.id;

  // La Admin API y las tablas app_* no comparten transacción. Si algo falla
  // después del createUser, hay que deshacerlo: un usuario sin fila en
  // app_user_password existe pero nunca podría iniciar sesión.
  try {
    await setUserPassword(userId, input.password);
    await upsertAccountFlags(userId, {
      is_platform_admin: false,
      is_active: true,
      created_by: input.createdBy,
    });
    await setUserZoneRoles(userId, input.zones);
    await setUserRouteDenies(userId, input.deniedRouteKeys);
  } catch (err) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (cleanupErr) {
      console.error("[createAdminUser] rollback deleteUser failed", cleanupErr);
    }
    throw err;
  }

  return { userId };
}
