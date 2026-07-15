import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cascada de resolución del destinatario de una alerta de un elemento.
 *
 * Regla (única fuente de verdad — Bloque 3.2):
 *   1) OWNER DEL PROYECTO  → project.owner_user_id
 *   2) si el proyecto no tiene owner → OWNER DEL ELEMENTO (primer element_owner,
 *      orden estable por user_id)
 *   3) si tampoco hay → CREADOR de la notificación (element_notification.created_by)
 *
 * Siempre devuelve un userId (el createdBy es NOT NULL en BD).
 */
export interface ResolveRecipientInput {
  elementId: string;
  /** project.owner_user_id ya resuelto desde el join, o null si no tiene. */
  projectOwnerUserId: string | null;
  /** element_notification.created_by (fallback final). */
  createdBy: string;
}

export async function resolveNotificationRecipient(
  client: SupabaseClient,
  input: ResolveRecipientInput,
): Promise<string> {
  // 1) Owner del proyecto.
  if (input.projectOwnerUserId) {
    return input.projectOwnerUserId;
  }

  // 2) Primer owner del elemento.
  const { data: owners } = await client
    .from("element_owner")
    .select("user_id")
    .eq("element_id", input.elementId)
    .order("user_id", { ascending: true })
    .limit(1);

  const elementOwner = (owners as { user_id: string }[] | null)?.[0]?.user_id;
  if (elementOwner) {
    return elementOwner;
  }

  // 3) Creador de la notificación.
  return input.createdBy;
}
