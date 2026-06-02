export type ElementNotificationStatus =
  | "pending"
  | "seen"
  | "dismissed"
  | "sent";

/** Canales de entrega; `email` se procesará en notification-dispatcher + cron. */
export type NotificationChannel = "in_app" | "email";

export interface ElementNotificationItem {
  id: string;
  elementId: string;
  elementName: string;
  projectCode: string;
  label: string | null;
  remindAt: string;
  status: ElementNotificationStatus;
  channels: NotificationChannel[];
  seenAt: string | null;
  createdAt: string;
}
