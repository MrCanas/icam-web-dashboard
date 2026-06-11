"use server";

import {
  mapNotificationRow,
  notificationSelectQuery,
  type ElementNotificationRow,
} from "../logic/map-notification-row";
import { getNotificationActionContext } from "../logic/notification-action-context";
import type { ElementNotificationItem } from "../types";

export type CreateNotificationInput = {
  elementId: string;
  remindAt: string;
  label?: string | null;
};

export type CreateNotificationResult =
  | { ok: true; notification: ElementNotificationItem }
  | { ok: false; error: string };

export async function createNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const elementId = input.elementId.trim();
  const remindAt = input.remindAt.trim();
  const label = input.label?.trim() || null;

  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
  }
  if (!remindAt) {
    return { ok: false, error: "remindAt requerido" };
  }

  const remindDate = new Date(remindAt);
  if (Number.isNaN(remindDate.getTime())) {
    return { ok: false, error: "remindAt no es una fecha válida" };
  }

  const ctx = await getNotificationActionContext();
  if (!ctx.ok) return ctx;

  const { data: inserted, error } = await ctx.client
    .from("element_notification")
    .insert({
      element_id: elementId,
      created_by: ctx.authUserId,
      recipient_user_id: ctx.authUserId,
      remind_at: remindDate.toISOString(),
      label,
      channels: ["in_app"],
      status: "pending",
    })
    .select(notificationSelectQuery())
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  const notification = mapNotificationRow(
    inserted as unknown as ElementNotificationRow,
  );
  if (!notification) {
    return { ok: false, error: "No se pudo mapear la notificación creada" };
  }

  return { ok: true, notification };
}
