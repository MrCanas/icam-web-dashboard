import type {
  ElementNotificationItem,
  ElementNotificationStatus,
  NotificationChannel,
} from "../types";

type ElementJoin = {
  name: string;
  category: {
    project: {
      code: string;
    };
  };
};

export type ElementNotificationRow = {
  id: string;
  element_id: string;
  remind_at: string;
  label: string | null;
  channels: string[] | null;
  status: string;
  seen_at: string | null;
  created_at: string;
  element: ElementJoin | ElementJoin[] | null;
};

const NOTIFICATION_SELECT = `
  id,
  element_id,
  remind_at,
  label,
  channels,
  status,
  seen_at,
  created_at,
  element!inner (
    name,
    category!inner (
      project!inner ( code )
    )
  )
`;

export function notificationSelectQuery(): string {
  return NOTIFICATION_SELECT;
}

function resolveElementJoin(
  element: ElementNotificationRow["element"],
): ElementJoin | null {
  if (!element) return null;
  if (Array.isArray(element)) return element[0] ?? null;
  return element;
}

export function mapNotificationRow(
  row: ElementNotificationRow,
): ElementNotificationItem | null {
  const el = resolveElementJoin(row.element);
  if (!el) return null;

  return {
    id: row.id,
    elementId: row.element_id,
    elementName: el.name,
    projectCode: el.category.project.code,
    label: row.label,
    remindAt: row.remind_at,
    status: row.status as ElementNotificationStatus,
    channels: (row.channels ?? ["in_app"]) as NotificationChannel[],
    seenAt: row.seen_at,
    createdAt: row.created_at,
  };
}

export function mapNotificationRows(
  rows: ElementNotificationRow[] | null,
): ElementNotificationItem[] {
  return (rows ?? [])
    .map((row) => mapNotificationRow(row))
    .filter((item): item is ElementNotificationItem => item != null);
}
