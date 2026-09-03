import { NextResponse } from "next/server";

import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess, hasZoneAccess } from "@/lib/auth/permissions";
import type { ZoneKey } from "@/registry/modules";

/**
 * Devuelve 403 si el usuario no tiene acceso (de cualquier rol) a la zona.
 * Para rutas de LECTURA que hasta ahora solo comprobaban sesión: como leen con
 * service role (salta RLS), sin esto cualquier usuario del portal las veía.
 */
export function readAccessResponse(
  user: UserContext,
  zoneKey: ZoneKey,
): NextResponse | null {
  if (!hasZoneAccess(user, zoneKey)) {
    return NextResponse.json({ error: `Sin acceso a la zona ${zoneKey}` }, { status: 403 });
  }
  return null;
}

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
