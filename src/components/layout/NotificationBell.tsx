"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";
import {
  listMyDueNotifications,
  listMyUpcomingNotifications,
  markSeen,
} from "@/modules/pm/actas/notifications/actions";
import { ACTAS_NOTIFICATIONS_CHANGED_EVENT } from "@/modules/pm/actas/notifications/logic/actas-notifications-events";
import { formatRemindAt } from "@/modules/pm/actas/notifications/logic/format-remind-at";
import { actasProjectElementHistoricoPath } from "@/modules/pm/actas/logic/actas-paths";
import type { ElementNotificationItem } from "@/modules/pm/actas/notifications/types";

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function NotificationSection({
  title,
  items,
  emptyMessage,
  onMarkSeen,
  pending,
}: {
  title: string;
  items: ElementNotificationItem[];
  emptyMessage: string;
  onMarkSeen: (id: string) => void;
  pending: boolean;
}) {
  return (
    <section className="border-b border-subtle/40 last:border-b-0">
      <h3 className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted bg-page/60">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-xs text-text-muted">{emptyMessage}</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto">
          {items.map((item) => {
            const href = actasProjectElementHistoricoPath(
              item.projectCode,
              item.elementId,
            );
            const titleText = item.label?.trim() || item.elementName;
            return (
              <li
                key={item.id}
                className="border-t border-subtle/30 px-3 py-2.5 first:border-t-0"
              >
                <p className="text-xs font-medium text-text-primary line-clamp-2">
                  {titleText}
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted">
                  {item.projectCode} · {item.elementName}
                </p>
                <p className="mt-0.5 text-[10px] text-text-muted tabular-nums">
                  {formatRemindAt(item.remindAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded border border-subtle/60 px-2 py-0.5 text-[10px] font-medium text-text-body hover:bg-page disabled:opacity-50"
                    onClick={() => onMarkSeen(item.id)}
                  >
                    Visto
                  </button>
                  <Link
                    href={href}
                    className="rounded bg-icam-900 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-icam-800"
                  >
                    Ir al elemento
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function NotificationBell() {
  const { user, loading: userLoading } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState<ElementNotificationItem[]>([]);
  const [upcoming, setUpcoming] = useState<ElementNotificationItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const showBell = !userLoading && user != null && hasZoneAccess(user, "pm");

  const refresh = useCallback(async () => {
    const [dueRes, upcomingRes] = await Promise.all([
      listMyDueNotifications(),
      listMyUpcomingNotifications(),
    ]);

    if (!dueRes.ok) {
      setLoadError(dueRes.error);
      return;
    }
    if (!upcomingRes.ok) {
      setLoadError(upcomingRes.error);
      return;
    }

    setLoadError(null);
    setDue(dueRes.notifications);
    setUpcoming(upcomingRes.notifications);
  }, []);

  useEffect(() => {
    if (!showBell) return;
    void refresh();
  }, [showBell, refresh]);

  useEffect(() => {
    if (!showBell) return;
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(ACTAS_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(ACTAS_NOTIFICATIONS_CHANGED_EVENT, onChanged);
    };
  }, [showBell, refresh]);

  useEffect(() => {
    if (!open || !showBell) return;
    void refresh();
  }, [open, showBell, refresh]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleMarkSeen = (id: string) => {
    startTransition(async () => {
      const result = await markSeen(id);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setDue((prev) => prev.filter((n) => n.id !== id));
      setUpcoming((prev) => prev.filter((n) => n.id !== id));
    });
  };

  if (!showBell) return null;

  const dueCount = due.length;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white transition"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          dueCount > 0
            ? `Notificaciones: ${dueCount} vencida${dueCount === 1 ? "" : "s"}`
            : "Notificaciones"
        }
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {dueCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-icam-900 tabular-nums">
            {dueCount > 99 ? "99+" : dueCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notificaciones Actas"
          className="absolute right-0 top-full z-[80] mt-2 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-lg border border-subtle/60 bg-card shadow-xl"
        >
          <div className="border-b border-subtle/40 px-3 py-2.5">
            <p className="text-sm font-semibold text-text-primary">
              Recordatorios Actas
            </p>
          </div>

          {loadError ? (
            <p className="px-3 py-2 text-xs text-red-600" role="alert">
              {loadError}
            </p>
          ) : null}

          <NotificationSection
            title="Vencidas"
            items={due}
            emptyMessage="No hay recordatorios vencidos."
            onMarkSeen={handleMarkSeen}
            pending={pending}
          />
          <NotificationSection
            title="Próximas"
            items={upcoming}
            emptyMessage="No hay recordatorios programados."
            onMarkSeen={handleMarkSeen}
            pending={pending}
          />
        </div>
      ) : null}
    </div>
  );
}
