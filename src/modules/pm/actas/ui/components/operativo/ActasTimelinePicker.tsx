"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { DayPicker, type DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";

import { updateElementTimeline } from "@/modules/pm/actas/actions/update-element-timeline";
import {
  formatTimelineCell,
  timelineUrgencyClass,
} from "@/modules/pm/actas/logic/timeline-display";
import type { ElementStatus } from "@/modules/pm/actas/types";

import "./actas-timeline-daypicker.css";

const POPOVER_WIDTH = 312;
const TIMELINE_ERROR = "No se pudo actualizar el plazo.";

const MONTH_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});
const FULL_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

interface ActasTimelinePickerProps {
  elementId: string;
  timelineStart: string | null;
  timelineEnd: string | null;
  status: ElementStatus;
  readOnly?: boolean;
  onTimelineChange: (
    timelineStart: string | null,
    timelineEnd: string | null,
  ) => void;
  onError: (message: string) => void;
}

function toDate(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function noonUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysInclusive(from: Date, to: Date): number {
  const diff = Math.abs(noonUtc(to) - noonUtc(from));
  return Math.floor(diff / 86400000) + 1;
}

function isBetweenDates(date: Date, a: Date, b: Date): boolean {
  const t = noonUtc(date);
  const min = Math.min(noonUtc(a), noonUtc(b));
  const max = Math.max(noonUtc(a), noonUtc(b));
  return t >= min && t <= max;
}

export function ActasTimelinePicker({
  elementId,
  timelineStart,
  timelineEnd,
  status,
  readOnly = false,
  onTimelineChange,
  onError,
}: ActasTimelinePickerProps) {
  const listId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [singleDate, setSingleDate] = useState<Date | undefined>();
  const [hoverDate, setHoverDate] = useState<Date | undefined>();

  const hasExistingPlazo = Boolean(timelineStart || timelineEnd);
  const timelineLabel = formatTimelineCell(timelineStart, timelineEnd);
  const urgencyClass = timelineUrgencyClass(timelineEnd, status);

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
    const start = toDate(timelineStart);
    const end = toDate(timelineEnd);
    setDraftRange(start && end ? { from: start, to: end } : undefined);
    setSingleDate(end ?? start);
    setHoverDate(undefined);
    updatePosition();
  }, [open, timelineStart, timelineEnd, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popRef.current?.contains(target) ||
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

  const derived = useMemo(() => {
    const from = draftRange?.from;
    const to = draftRange?.to;
    if (from && to) {
      const a = toIso(from);
      const b = toIso(to);
      if (a === b) return { start: null as string | null, end: a };
      return a < b ? { start: a, end: b } : { start: b, end: a };
    }
    if (singleDate) {
      return { start: null as string | null, end: toIso(singleDate) };
    }
    return { start: null as string | null, end: null as string | null };
  }, [draftRange, singleDate]);

  const selectionKind = useMemo(() => {
    const from = draftRange?.from;
    const to = draftRange?.to;
    if (from && to && toIso(from) !== toIso(to)) return "duration" as const;
    if (singleDate || from) return "deadline" as const;
    return "none" as const;
  }, [draftRange, singleDate]);

  const selectionHint = useMemo(() => {
    const from = draftRange?.from;
    const to = draftRange?.to;
    if (from && to && toIso(from) !== toIso(to)) {
      const start = from < to ? from : to;
      const end = from < to ? to : from;
      const count = daysInclusive(start, end);
      return `Duración: ${MONTH_FMT.format(start)} – ${FULL_FMT.format(end)} (${count} días)`;
    }
    const deadline = singleDate ?? from;
    if (deadline) {
      return `Deadline: ${FULL_FMT.format(deadline)}`;
    }
    return "Selecciona una fecha (deadline) o dos (duración)";
  }, [draftRange, singleDate]);

  const rangePreviewModifiers = useMemo(() => {
    const from = draftRange?.from;
    const to = draftRange?.to;
    if (!from || to || !hoverDate || toIso(from) === toIso(hoverDate)) {
      return {};
    }
    return {
      range_preview: (date: Date) =>
        isBetweenDates(date, from, hoverDate) &&
        toIso(date) !== toIso(from) &&
        toIso(date) !== toIso(hoverDate),
      range_preview_end: (date: Date) => toIso(date) === toIso(hoverDate),
    };
  }, [draftRange, hoverDate]);

  const applyTimeline = async (start: string | null, end: string | null) => {
    const prev = { start: timelineStart, end: timelineEnd };
    setOpen(false);
    onTimelineChange(start, end);
    setPending(true);
    const result = await updateElementTimeline({
      elementId,
      timelineStart: start,
      timelineEnd: end,
    });
    setPending(false);
    if (!result.ok) {
      onTimelineChange(prev.start, prev.end);
      onError(TIMELINE_ERROR);
      return;
    }
    onTimelineChange(result.timelineStart, result.timelineEnd);
  };

  const handlePrimaryApply = () => {
    if (selectionKind === "duration") {
      void applyTimeline(derived.start, derived.end);
      return;
    }
    if (selectionKind === "deadline") {
      const end =
        derived.end ?? (singleDate ? toIso(singleDate) : null);
      void applyTimeline(null, end);
    }
  };

  if (readOnly) {
    return (
      <span className={`text-xs truncate ${urgencyClass}`}>
        {timelineLabel ?? <span className="text-text-muted">—</span>}
      </span>
    );
  }

  const primaryLabel =
    selectionKind === "duration"
      ? "Aplicar duración"
      : "Aplicar como deadline";
  const primaryDisabled = selectionKind === "none" || pending;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={pending}
        className={`group/timeline min-w-0 text-left text-xs truncate rounded px-1 py-0.5 hover:bg-page disabled:opacity-60 ${urgencyClass}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {timelineLabel ? (
          timelineLabel
        ) : (
          <span className="text-text-muted group-hover/row:hidden">—</span>
        )}
        {!timelineLabel ? (
          <span className="hidden text-icam-900 group-hover/row:inline">
            + Plazo
          </span>
        ) : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              id={listId}
              role="dialog"
      aria-modal="true"
              aria-label="Editar plazo"
              className="fixed z-[70] w-[312px] rounded-lg border border-subtle/60 bg-card p-3 shadow-lg"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[11px] leading-snug text-text-muted">
                {selectionHint}
              </p>
              <div className="actas-timeline-picker">
                <DayPicker
                  mode="range"
                  locale={es}
                  navLayout="around"
                  numberOfMonths={1}
                  selected={draftRange}
                  modifiers={rangePreviewModifiers}
                  modifiersClassNames={{
                    range_preview: "rdp-range_preview",
                    range_preview_end: "rdp-range_preview_end",
                  }}
                  onDayMouseEnter={(date) => {
                    if (draftRange?.from && !draftRange.to) {
                      setHoverDate(date);
                    }
                  }}
                  onDayMouseLeave={() => setHoverDate(undefined)}
                  onSelect={(range) => {
                    setDraftRange(range);
                    setHoverDate(undefined);
                    if (range?.from && !range.to) {
                      setSingleDate(range.from);
                    } else if (
                      range?.from &&
                      range.to &&
                      toIso(range.from) === toIso(range.to)
                    ) {
                      setSingleDate(range.from);
                    } else {
                      setSingleDate(undefined);
                    }
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-subtle/40 pt-3">
                <button
                  type="button"
                  disabled={primaryDisabled}
                  className="rounded-md bg-icam-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handlePrimaryApply}
                >
                  {primaryLabel}
                </button>
                {hasExistingPlazo ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-body hover:bg-page disabled:opacity-50"
                    onClick={() => void applyTimeline(null, null)}
                  >
                    Quitar plazo
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-body hover:bg-page"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
