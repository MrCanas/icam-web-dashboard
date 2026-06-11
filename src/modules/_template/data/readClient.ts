import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

/** Lecturas/escrituras del módulo — service role en servidor (mismo patrón que Portfolio). */
export function getTemplateWriteSupabase(_ctx: UserContext) {
  void _ctx;
  return createServiceRoleClient();
}
