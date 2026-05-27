import { NextResponse } from "next/server";

import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import type { ZoneKey } from "@/registry/modules";

/** Devuelve respuesta 403 si el usuario es lector o no tiene la zona; si null, OK. */
export function writeAccessResponse(
  user: UserContext,
  zoneKey: ZoneKey,
): NextResponse | null {
  const message = checkWriteAccess(user, zoneKey);
  if (message) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  return null;
}
