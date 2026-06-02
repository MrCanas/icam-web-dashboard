"use server";

import {
  mapNotificationRows,
  notificationSelectQuery,
  type ElementNotificationRow,
} from "../logic/map-notification-row";
import { getNotificationActionContext } from "../logic/notification-action-context";
import type { ElementNotificationItem } from "../types";

export type ListMyDueNotificationsResult =
  | { ok: true; notifications: ElementNotificationItem[] }
  | { ok: false; error: string };

export async function listMyDueNotifications(): Promise<ListMyDueNotificationsResult> {
  const ctx = await getNotificationActionContext();
  if (!ctx.ok) return ctx;

  const now = new Date().toISOString();

  const { data, error } = await ctx.client
    .from("element_notification")
    .select(notificationSelectQuery())
    .eq("status", "pending")
    .lte("remind_at", now)
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
