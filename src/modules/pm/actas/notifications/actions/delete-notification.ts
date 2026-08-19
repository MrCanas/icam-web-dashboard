"use server";

import { getNotificationActionContext } from "../logic/notification-action-context";

export type DeleteNotificationResult = { ok: true } | { ok: false; error: string };

export async function deleteNotification(
  id: string,
): Promise<DeleteNotificationResult> {
  const notificationId = id.trim();
  if (!notificationId) {
    return { ok: false, error: "id requerido" };
  }

  const ctx = await getNotificationActionContext();
  if (!ctx.ok) return ctx;

  const { error, count } = await ctx.client
    .from("element_notification")
    .delete({ count: "exact" })
    .eq("id", notificationId)
    // Solo el destinatario puede borrar su notificación (evita IDOR):
    .eq("recipient_user_id", ctx.authUserId);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!count) {
    return { ok: false, error: "Notificación no encontrada o sin acceso" };
  }

  return { ok: true };
}
