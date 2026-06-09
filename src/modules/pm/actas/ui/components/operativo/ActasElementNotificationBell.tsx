"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";
import { toDatetimeLocalValue } from "@/modules/pm/actas/logic/log-entry-datetime";
import {
  createNotification,
  deleteNotification,
  listNotificationsForElement,
} from "@/modules/pm/actas/notifications/actions";
import { addRemindMonths } from "@/modules/pm/actas/notifications/logic/add-remind-months";
import { notifyActasNotificationsChanged } from "@/modules/pm/actas/notifications/logic/actas-notifications-events";
import { formatRemindAt } from "@/modules/pm/actas/notifications/logic/format-remind-at";
import type { ElementNotificationItem } from "@/modules/pm/actas/notifications/types";

const POPOVER_WIDTH = 300;

function RowBellIcon() {
  return (
    <svg
      width="14"
      height="14"
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

interface ActasElementNotificationBellProps {
  elementId: string;
  readOnly?: boolean;
  onError?: (message: string) => void;
}

export function ActasElementNotificationBell({
  elementId,
  readOnly = false,
  onError,
}: ActasElementNotificationBellProps) {
  const { user, loading: userLoading } = useCurrentUser();
  const customInputId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [items, setItems] = useState<ElementNotificationItem[]>([]);
  const [customLocal, setCustomLocal] = useState(() => toDatetimeLocalValue());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canUse =
    !userLoading && !readOnly && user != null && hasZoneAccess(user, "pm");

  const pendingCount = items.filter((n) => n.status === "pending").length;

  const loadList = useCallback(async () => {
    const res = await listNotificationsForElement(elementId);
    if (!res.ok) {
      setError(res.error);
      onError?.(res.error);
      return;
    }
    setError(null);
    setItems(res.notifications);
  }, [elementId, onError]);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 4;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadList();
    updatePosition();
  }, [open, loadList, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const afterMutation = useCallback(async () => {
    await loadList();
    notifyActasNotificationsChanged();
  }, [loadList]);

  const createQuick = (months: number) => {
    const label =
      months === 1 ? "En 1 mes" : `En ${months} meses`;
    const remindAt = addRemindMonths(new Date(), months).toISOString();

    startTransition(async () => {
      const result = await createNotification({
        elementId,
        remindAt,
        label,
      });
      if (!result.ok) {
        setError(result.error);
        onError?.(result.error);
        return;
      }
      await afterMutation();
    });
  };

  const createCustom = () => {
    const remindDate = new Date(customLocal);
    if (Number.isNaN(remindDate.getTime())) {
      setError("Fecha no válida");
      return;
    }
    const label = `Custom: ${formatRemindAt(remindDate.toISOString())}`;

    startTransition(async () => {
      const result = await createNotification({
        elementId,
        remindAt: remindDate.toISOString(),
        label,
      });
      if (!result.ok) {
        setError(result.error);
        onError?.(result.error);
        return;
      }
      await afterMutation();
    });
  };

  const removeNotification = (id: string) => {
    startTransition(async () => {
      const result = await deleteNotification(id);
      if (!result.ok) {
        setError(result.error);
        onError?.(result.error);
        return;
      }
      await afterMutation();
    });
  };

  if (!canUse) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-icam-900/10 hover:text-icam-900"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          pendingCount > 0
            ? `Recordatorios (${pendingCount} pendiente${pendingCount === 1 ? "" : "s"})`
            : "Recordatorios"
        }
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setError(null);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <RowBellIcon />
        {pendingCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-bold text-white tabular-nums">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        ) : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Recordatorios del elemento"
              className="fixed z-[70] w-[300px] rounded-lg border border-subtle/60 bg-card shadow-xl"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="border-b border-subtle/40 px-3 py-2">
                <p className="text-xs font-semibold text-text-primary">
                  Recordatorios
                </p>
              </div>

              <div className="border-b border-subtle/40 px-3 py-2 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Acciones rápidas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-subtle/60 bg-page px-2 py-1 text-[11px] font-medium text-text-body hover:bg-icam-900/5 disabled:opacity-50"
                    onClick={() => createQuick(1)}
                  >
                    En 1 mes
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-subtle/60 bg-page px-2 py-1 text-[11px] font-medium text-text-body hover:bg-icam-900/5 disabled:opacity-50"
                    onClick={() => createQuick(2)}
                  >
                    En 2 meses
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-subtle/60 bg-page px-2 py-1 text-[11px] font-medium text-text-body hover:bg-icam-900/5 disabled:opacity-50"
                    onClick={() => createQuick(3)}
                  >
                    En 3 meses
                  </button>
                </div>
              </div>

              <div className="border-b border-subtle/40 px-3 py-2 space-y-2">
                <label
                  htmlFor={customInputId}
                  className="text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                >
                  Fecha custom
                </label>
                <input
                  id={customInputId}
                  type="datetime-local"
                  value={customLocal}
                  disabled={pending}
                  className="w-full rounded-md border border-subtle/60 bg-page px-2 py-1.5 text-xs text-text-primary"
                  onChange={(e) => setCustomLocal(e.target.value)}
                />
                <button
                  type="button"
                  disabled={pending}
                  className="w-full rounded-md bg-icam-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-icam-800 disabled:opacity-50"
                  onClick={createCustom}
                >
                  Crear recordatorio
                </button>
              </div>

              {error ? (
                <p className="px-3 py-2 text-xs text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
                  Programados
                </p>
                {items.length === 0 ? (
                  <p className="text-xs text-text-muted py-1">
                    Sin recordatorios en este elemento.
                  </p>
                ) : (
                  <ul className="max-h-40 overflow-y-auto space-y-1.5">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-2 rounded-md border border-subtle/40 bg-page/50 px-2 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-text-primary truncate">
                            {item.label ?? "Recordatorio"}
                          </p>
                          <p className="text-[10px] text-text-muted tabular-nums">
                            {formatRemindAt(item.remindAt)}
                          </p>
                          {item.status !== "pending" ? (
                            <p className="text-[10px] text-text-muted capitalize">
                              {item.status}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          className="shrink-0 text-[10px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          aria-label="Eliminar recordatorio"
                          onClick={() => removeNotification(item.id)}
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
