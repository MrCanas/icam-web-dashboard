"use server";

import { getNotificationActionContext } from "../logic/notification-action-context";

export type DismissNotificationResult = { ok: true } | { ok: false; error: string };

export async function dismiss(id: string): Promise<DismissNotificationResult> {
  const notificationId = id.trim();
  if (!notificationId) {
    return { ok: false, error: "id requerido" };
  }

  const ctx = await getNotificationActionContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.client
    .from("element_notification")
    .update({ status: "dismissed" })
    .eq("id", notificationId)
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
