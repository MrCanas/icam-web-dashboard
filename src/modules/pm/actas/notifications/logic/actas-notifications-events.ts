export const ACTAS_NOTIFICATIONS_CHANGED_EVENT = "actas-notifications-changed";

export function notifyActasNotificationsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTAS_NOTIFICATIONS_CHANGED_EVENT));
}
