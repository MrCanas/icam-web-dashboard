import type { UserContext } from "@/lib/auth/currentUser";
import type { ZoneKey } from "@/registry/modules";

export type ZoneRole = "admin" | "editor" | "lector";

export const WRITE_DENIED_MESSAGE = "Sin permiso de escritura";

export class WriteAccessDeniedError extends Error {
  constructor(message = WRITE_DENIED_MESSAGE) {
    super(message);
    this.name = "WriteAccessDeniedError";
  }
}

export function getUserRole(
  user: UserContext,
  zoneKey: ZoneKey,
): ZoneRole | null {
  const row = user.zones.find((z) => z.zone_key === zoneKey);
  if (!row) return null;
  const role = row.role;
  if (role === "admin" || role === "editor" || role === "lector") {
    return role;
  }
  return null;
}

export function hasZoneAccess(user: UserContext, zoneKey: ZoneKey): boolean {
  return getUserRole(user, zoneKey) !== null;
}

export function requireWriteAccess(user: UserContext, zoneKey: ZoneKey): void {
  const role = getUserRole(user, zoneKey);
  if (!role || role === "lector") {
    throw new WriteAccessDeniedError();
  }
}

export function checkWriteAccess(
  user: UserContext,
  zoneKey: ZoneKey,
): string | null {
  try {
    requireWriteAccess(user, zoneKey);
    return null;
  } catch (err) {
    if (err instanceof WriteAccessDeniedError) {
      return err.message;
    }
    throw err;
  }
}
