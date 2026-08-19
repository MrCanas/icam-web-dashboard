"use server";

import { getNotificationActionContext } from "../logic/notification-action-context";

export type MarkSeenResult = { ok: true } | { ok: false; error: string };

export async function markSeen(id: string): Promise<MarkSeenResult> {
  const notificationId = id.trim();
  if (!notificationId) {
    return { ok: false, error: "id requerido" };
  }

  const ctx = await getNotificationActionContext();
  if (!ctx.ok) return ctx;

  const now = new Date().toISOString();

  const { data, error } = await ctx.client
    .from("element_notification")
    .update({
      status: "seen",
      seen_at: now,
    })
    .eq("id", notificationId)
    // Solo el destinatario puede tocar su notificación (evita IDOR):
    .eq("recipient_user_id", ctx.authUserId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Notificación no encontrada o sin acceso" };
  }

  return { ok: true };
}
