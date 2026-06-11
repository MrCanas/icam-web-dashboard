import { createServiceRoleClient } from "@/lib/db/admin";
import type { UserContext } from "@/lib/auth/currentUser";

export interface AuditMeta {
  resourceType?: string;
  resourceId?: string;
  payload?: unknown;
}

function mutationFailed(result: unknown): boolean {
  if (result == null || typeof result !== "object") return false;
  if ("error" in result && (result as { error: unknown }).error != null) return true;
  return false;
}

/**
 * Envuelve una mutación y registra en audit_log si tiene éxito.
 * Si la mutación falla (error en respuesta o excepción), NO se escribe entrada.
 *
 * Usa service role para insertar en audit_log (mismo contexto que las mutaciones en servidor).
 */
export async function withAudit<T>(
  ctx: UserContext,
  action: string,
  meta: AuditMeta,
  fn: () => Promise<T>,
): Promise<T> {
  const result = await fn();
  if (mutationFailed(result)) {
    return result;
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("audit_log").insert({
      user_id: ctx.id,
      user_email: ctx.email,
      action,
      resource_type: meta.resourceType ?? null,
      resource_id: meta.resourceId ?? null,
      metadata: meta.payload ?? null,
    });
    if (error) {
      console.error("[audit] failed to write audit_log entry", { action, error });
    }
  } catch (err) {
    console.error("[audit] failed to write audit_log entry", { action, err });
  }

  return result;
}
