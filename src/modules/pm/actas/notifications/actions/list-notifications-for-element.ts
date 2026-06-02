"use server";

import {
  mapNotificationRows,
  notificationSelectQuery,
  type ElementNotificationRow,
} from "../logic/map-notification-row";
import { getNotificationActionContext } from "../logic/notification-action-context";
import type { ElementNotificationItem } from "../types";

export type ListNotificationsForElementResult =
  | { ok: true; notifications: ElementNotificationItem[] }
  | { ok: false; error: string };

export async function listNotificationsForElement(
  elementId: string,
): Promise<ListNotificationsForElementResult> {
  const id = elementId.trim();
  if (!id) {
    return { ok: false, error: "elementId requerido" };
  }

  const ctx = await getNotificationActionContext();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.client
    .from("element_notification")
    .select(notificationSelectQuery())
    .eq("element_id", id)
    .order("remind_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    notifications: mapNotificationRows(
      data as unknown as ElementNotificationRow[],
    ),
  };
}
