import { cache } from "react";

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { verifySessionToken } from "@/lib/auth/jwt";
import { isKnownRouteKey } from "@/registry/routes";

export interface UserZoneRole {
  zone_key: string;
  role: string;
}

export interface UserContext {
  id: string;
  email: string;
  name: string;
  zones: UserZoneRole[];
  /** Superadmin del portal: única vía para gestionar usuarios. No concede zonas. */
  isPlatformAdmin: boolean;
  /** Denylist de páginas (ModuleRoute.key). Ver src/registry/routes.ts. */
  deniedRouteKeys: string[];
}

const AUTH_COOKIE = "icam-auth";

function displayNameFromAuthUser(
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

async function verifiedUserIdFromToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const verified = await verifySessionToken(token);
  return verified?.user_id ?? null;
}

export async function isSessionAuthenticated(
  request: NextRequest,
): Promise<boolean> {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  const userId = await verifiedUserIdFromToken(token);
  return userId !== null;
}

async function verifiedUserIdFromServerCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifiedUserIdFromToken(cookieStore.get(AUTH_COOKIE)?.value);
}

export async function getCurrentUserFromRequest(
  request: NextRequest,
): Promise<UserContext | null> {
  const userId = await verifiedUserIdFromToken(
    request.cookies.get(AUTH_COOKIE)?.value,
  );
  if (!userId) {
    return null;
  }

  try {
    return await loadUserContext(userId);
  } catch (err) {
    console.error("[auth] loadUserContext failed", err);
    return null;
  }
}

export async function loadUserContext(
  userId: string,
): Promise<UserContext | null> {
  const admin = createServiceRoleClient();

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(userId);

  if (authError || !authData.user) {
    return null;
  }

  const authUser = authData.user;
  const email = authUser.email?.trim() ?? "";
  if (!email) {
    return null;
  }

  const [zoneResult, accountResult, denyResult] = await Promise.all([
    admin
      .from("app_user_zone_role")
      .select("zone_key, role")
      .eq("user_id", userId)
      .order("zone_key", { ascending: true }),
    admin
      .from("app_user_account")
      .select("is_platform_admin, is_active")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("app_user_route_deny")
      .select("route_key")
      .eq("user_id", userId),
  ]);

  if (zoneResult.error) {
    throw new Error(`app_user_zone_role: ${zoneResult.error.message}`);
  }
  if (accountResult.error) {
    throw new Error(`app_user_account: ${accountResult.error.message}`);
  }
  if (denyResult.error) {
    throw new Error(`app_user_route_deny: ${denyResult.error.message}`);
  }

  // Fila ausente = cuenta normal activa (usuarios anteriores a la gestión de usuarios).
  const account = accountResult.data;
  if (account && account.is_active === false) {
    return null;
  }

  return {
    id: userId,
    email,
    name: displayNameFromAuthUser(
      email,
      authUser.user_metadata as Record<string, unknown> | undefined,
    ),
    zones: (zoneResult.data ?? []).map((row) => ({
      zone_key: row.zone_key as string,
      role: row.role as string,
    })),
    isPlatformAdmin: account?.is_platform_admin === true,
    deniedRouteKeys: (denyResult.data ?? [])
      .map((row) => row.route_key as string)
      .filter(isKnownRouteKey),
  };
}

/**
 * SERVER: Server Components, route handlers, server actions.
 *
 * Memoizado por request con React cache(): un render de página lo invoca
 * desde varios layouts/páginas y sin memo cada invocación repetía las 4
 * consultas de identidad. Los llamadores comparten instancia de UserContext,
 * que es de solo lectura por contrato — no mutar.
 */
export const getCurrentUser = cache(
  async (): Promise<UserContext | null> => {
    const userId = await verifiedUserIdFromServerCookies();
    if (!userId) {
      return null;
    }

    try {
      return await loadUserContext(userId);
    } catch (err) {
      console.error("[auth] loadUserContext failed", err);
      return null;
    }
  },
);

/** SERVER: same identity as getCurrentUser but requires an active session. */
export async function requireCurrentUser(): Promise<UserContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("No autorizado");
  }
  return user;
}
