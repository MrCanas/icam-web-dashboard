import type { ZoneRole } from "@/lib/auth/permissions";
import { ZONE_ORDER, type ZoneKey } from "@/registry/modules";
import { isKnownRouteKey, zoneForRouteKey } from "@/registry/routes";
import type { ZoneRoleAssignment } from "@/modules/admin/types";

/** Consistente con /api/account/password. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_NAME_LENGTH = 120;

const ZONE_ROLES: readonly ZoneRole[] = ["admin", "editor", "lector"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Devuelve el mensaje de error, o null si es válido. */
export function validateEmail(email: string): string | null {
  if (!email) return "El email es obligatorio.";
  if (!EMAIL_RE.test(email)) return "El email no tiene un formato válido.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return "La contraseña es obligatoria.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "El nombre es obligatorio.";
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`;
  }
  return null;
}

function isZoneKey(value: string): value is ZoneKey {
  return (ZONE_ORDER as readonly string[]).includes(value);
}

function isZoneRole(value: unknown): value is ZoneRole {
  return typeof value === "string" && (ZONE_ROLES as readonly string[]).includes(value);
}

/** Normaliza la asignación que llega del cliente; null si el formato es inválido. */
export function validateZoneAssignment(
  zones: unknown,
): ZoneRoleAssignment | null {
  if (!zones || typeof zones !== "object" || Array.isArray(zones)) return null;

  const result: ZoneRoleAssignment = {};
  for (const [key, value] of Object.entries(zones as Record<string, unknown>)) {
    if (!isZoneKey(key)) return null;
    if (value === null) {
      result[key] = null;
      continue;
    }
    if (!isZoneRole(value)) return null;
    result[key] = value;
  }
  return result;
}

/**
 * Depura la denylist: descarta claves que no existen en el registry y denies de
 * zonas a las que el usuario no tendrá acceso (serían ruido inaccesible).
 */
export function sanitizeRouteDenies(
  keys: unknown,
  zones: ZoneRoleAssignment,
): string[] {
  if (!Array.isArray(keys)) return [];

  const granted = new Set(
    Object.entries(zones)
      .filter(([, role]) => role != null)
      .map(([zoneKey]) => zoneKey),
  );

  const result = new Set<string>();
  for (const key of keys) {
    if (typeof key !== "string") continue;
    if (!isKnownRouteKey(key)) continue;
    const zoneKey = zoneForRouteKey(key);
    if (!zoneKey || !granted.has(zoneKey)) continue;
    result.add(key);
  }
  return [...result];
}
