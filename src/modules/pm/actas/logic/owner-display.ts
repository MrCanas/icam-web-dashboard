import type { ActasElementOwner } from "@/modules/pm/actas/types";

/** Owner cuyo user_id no resolvió en auth.users (p. ej. tras migración). */
export function isUnresolvedOwner(owner: ActasElementOwner): boolean {
  return owner.email == null || owner.email.trim() === "";
}
