import type { ActasElementOwner } from "@/modules/pm/actas/types";

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeUuidFragment(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (UUID_LIKE.test(v)) return true;
  return /^[0-9a-f]{6,}$/i.test(v) && v.includes("-");
}

/** Owner cuyo user_id no resolvió en auth.users (p. ej. tras migración). */
export function isUnresolvedOwner(owner: ActasElementOwner): boolean {
  if (owner.email == null || owner.email.trim() === "") {
    return true;
  }
  if (owner.initials === "?" || owner.initials.trim() === "") {
    return true;
  }
  if (looksLikeUuidFragment(owner.label)) {
    return true;
  }
  if (looksLikeUuidFragment(owner.initials)) {
    return true;
  }
  return false;
}
