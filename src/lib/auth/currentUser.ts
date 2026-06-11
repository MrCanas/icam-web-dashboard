import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { verifySessionToken } from "@/lib/auth/jwt";

export interface UserZoneRole {
  zone_key: string;
  role: string;
}

export interface UserContext {
  id: string;
  email: string;
  name: string;
  zones: UserZoneRole[];
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
  } catch {
    return null;
  }
}

async function loadUserContext(userId: string): Promise<UserContext | null> {
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

  const { data: zoneRows, error: zoneError } = await admin
    .from("app_user_zone_role")
    .select("zone_key, role")
    .eq("user_id", userId)
    .order("zone_key", { ascending: true });

  if (zoneError) {
    throw new Error(`app_user_zone_role: ${zoneError.message}`);
  }

  return {
    id: userId,
    email,
    name: displayNameFromAuthUser(
      email,
      authUser.user_metadata as Record<string, unknown> | undefined,
    ),
    zones: (zoneRows ?? []).map((row) => ({
      zone_key: row.zone_key as string,
      role: row.role as string,
    })),
  };
}

/** SERVER: Server Components, route handlers, server actions. */
export async function getCurrentUser(): Promise<UserContext | null> {
  const userId = await verifiedUserIdFromServerCookies();
  if (!userId) {
    return null;
  }

  try {
    return await loadUserContext(userId);
  } catch {
    return null;
  }
}

/** SERVER: same identity as getCurrentUser but requires an active session. */
export async function requireCurrentUser(): Promise<UserContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("No autorizado");
  }
  return user;
}
