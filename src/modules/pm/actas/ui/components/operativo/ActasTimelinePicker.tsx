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

import { updateElementTimeline } from "@/modules/pm/actas/actions/update-element-timeline";
import { formatTimelineCell, timelineUrgencyClass } from "@/modules/pm/actas/logic/timeline-display";
import type { ElementStatus } from "@/modules/pm/actas/types";

const POPOVER_WIDTH = 296;
const TIMELINE_ERROR = "No se pudo actualizar el plazo.";

interface ActasTimelinePickerProps {
  elementId: string;
  timelineStart: string | null;
  timelineEnd: string | null;
  status: ElementStatus;
  readOnly?: boolean;
  onTimelineChange: (timelineStart: string | null, timelineEnd: string | null) => void;
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
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [pending, setPending] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [singleDate, setSingleDate] = useState<Date | undefined>();

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
    updatePosition();
  }, [open, timelineStart, timelineEnd, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
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

  if (readOnly) {
    return (
      <span className={`text-xs truncate ${urgencyClass}`}>
        {timelineLabel ?? <span className="text-text-muted">—</span>}
      </span>
    );
  }

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
          <span className="hidden text-icam-900 group-hover/row:inline">+ Plazo</span>
        ) : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              id={listId}
              role="dialog"
              aria-label="Editar plazo"
              className="fixed z-[70] w-[296px] rounded-md border border-subtle/60 bg-card p-2 shadow-lg"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DayPicker
                mode="range"
                numberOfMonths={1}
                selected={draftRange}
                onSelect={(range) => {
                  setDraftRange(range);
                  if (range?.from && !range.to) {
                    setSingleDate(range.from);
                  } else if (range?.from && range.to && toIso(range.from) === toIso(range.to)) {
                    setSingleDate(range.from);
                  } else {
                    setSingleDate(undefined);
                  }
                }}
                className="text-xs"
              />
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-subtle/40 pt-2">
                <button
                  type="button"
                  className="rounded border border-subtle px-2 py-1 text-[11px] text-text-body hover:bg-page"
                  onClick={() => void applyTimeline(derived.start, derived.end)}
                >
                  Aplicar
                </button>
                <button
                  type="button"
                  className="rounded border border-subtle px-2 py-1 text-[11px] text-text-body hover:bg-page"
                  onClick={() => void applyTimeline(null, null)}
                >
                  Quitar plazo
                </button>
                <button
                  type="button"
                  className="rounded border border-subtle px-2 py-1 text-[11px] text-text-body hover:bg-page"
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="rounded border border-icam-900/30 bg-icam-900/5 px-2 py-1 text-[11px] text-icam-900 hover:bg-icam-900/10"
                  onClick={() => {
                    const end = derived.end ?? (singleDate ? toIso(singleDate) : null);
                    void applyTimeline(null, end);
                  }}
                >
                  Aplicar como deadline
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
