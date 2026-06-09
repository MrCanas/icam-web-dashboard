"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { bulkChangeElementStatus } from "@/modules/pm/actas/actions/bulk-change-element-status";
import { changeElementStatus } from "@/modules/pm/actas/actions/change-element-status";
import {
  ELEMENT_STATUS_LABEL,
  ELEMENT_STATUS_STYLE,
} from "@/modules/pm/actas/logic/element-status";
import { ELEMENT_STATUS_PICKER_ORDER } from "@/modules/pm/actas/logic/status-change-log";
import type { ActasLogEntryItem, ElementStatus } from "@/modules/pm/actas/types";

import { useOperativoSelection } from "./ActasOperativoSelectionContext";

const DROPDOWN_WIDTH = 180;
const STATUS_CHANGE_ERROR =
  "No se pudo cambiar el estado. Intenta de nuevo.";

interface ActasStatusPickerProps {
  elementId: string;
  status: ElementStatus;
  readOnly?: boolean;
  onStatusChange: (
    status: ElementStatus,
    entry: ActasLogEntryItem | null,
  ) => void;
  onError: (message: string) => void;
}

export function ActasStatusPicker({
  elementId,
  status,
  readOnly = false,
  onStatusChange,
  onError,
}: ActasStatusPickerProps) {
  const router = useRouter();
  const selection = useOperativoSelection();
  const listId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const changeQueueRef = useRef(Promise.resolve());
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const statusStyle = ELEMENT_STATUS_STYLE[status];

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 4;
    if (left + DROPDOWN_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - DROPDOWN_WIDTH - 8;
    }
    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

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
        dropdownRef.current?.contains(target) ||
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

  const selectStatus = (newStatus: ElementStatus) => {
    if (readOnly || pending) return;
    if (newStatus === status) {
      setOpen(false);
      return;
    }

    setOpen(false);
    const previous = status;
    const targetIds = selection?.selectionActive
      ? [...selection.selectedIds]
      : [elementId];

    if (targetIds.length > 1) {
      selection?.applyStatusLive(targetIds, newStatus);
    } else {
      onStatusChange(newStatus, null);
    }

    const task = changeQueueRef.current
      .then(async () => {
        setPending(true);
        const result =
          targetIds.length > 1
            ? await bulkChangeElementStatus({
                elementIds: targetIds,
                newStatus,
              })
            : await changeElementStatus({
                elementId,
                newStatus,
              });
        setPending(false);
        if (!result.ok) {
          if (targetIds.length > 1) {
            selection?.applyStatusLive(targetIds, previous);
          } else {
            onStatusChange(previous, null);
          }
          onError(STATUS_CHANGE_ERROR);
          return;
        }
        if (targetIds.length > 1) {
          selection?.clearAll();
          router.refresh();
        } else if ("entry" in result && result.entry) {
          onStatusChange(result.elementStatus, result.entry);
        }
      })
      .catch(() => {
        setPending(false);
        if (targetIds.length > 1) {
          selection?.applyStatusLive(targetIds, previous);
        } else {
          onStatusChange(previous, null);
        }
        onError(STATUS_CHANGE_ERROR);
      });

    changeQueueRef.current = task;
  };

  if (readOnly) {
    return (
      <span
        className="justify-self-start rounded px-1.5 py-px text-[10px] font-medium whitespace-nowrap leading-tight cursor-default"
        style={{
          backgroundColor: statusStyle.bg,
          color: statusStyle.text,
        }}
      >
        {ELEMENT_STATUS_LABEL[status]}
      </span>
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={pending}
        className="justify-self-start rounded px-1.5 py-px text-[10px] font-medium whitespace-nowrap leading-tight transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/30 disabled:opacity-60"
        style={{
          backgroundColor: statusStyle.bg,
          color: statusStyle.text,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {ELEMENT_STATUS_LABEL[status]}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={dropdownRef}
              id={listId}
              role="listbox"
              aria-label="Cambiar estado"
              className="fixed z-[70] w-[180px] overflow-hidden rounded-md border border-subtle/60 bg-card py-1 shadow-lg"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {ELEMENT_STATUS_PICKER_ORDER.map((option) => {
                const style = ELEMENT_STATUS_STYLE[option];
                const selected = option === status;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-page/80"
                    onClick={() => selectStatus(option)}
                  >
                    <span
                      className="min-w-0 flex-1 truncate rounded px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: style.bg,
                        color: style.text,
                      }}
                    >
                      {ELEMENT_STATUS_LABEL[option]}
                    </span>
                    {selected ? (
                      <span
                        className="shrink-0 text-emerald-600 text-xs"
                        aria-hidden
                      >
                        ✓
                      </span>
                    ) : (
                      <span className="w-3 shrink-0" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
