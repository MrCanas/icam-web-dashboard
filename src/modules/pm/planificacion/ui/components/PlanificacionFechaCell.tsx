"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";

import { updateHitoFecha } from "@/modules/pm/planificacion/actions/update-hito-fecha";
import { formatFechaCorta } from "@/modules/pm/planificacion/logic/planificacion-display";

import "@/modules/pm/actas/ui/components/operativo/actas-timeline-daypicker.css";

const POPOVER_WIDTH = 300;

interface PlanificacionFechaCellProps {
  hitoId: string;
  fecha: string | null;
  readOnly?: boolean;
  onFechaChange: (fecha: string | null) => void;
  onError: (message: string) => void;
}

function toDate(iso: string | null): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Celda de previsión vigente (`fecha_actual`), editable con calendario en portal.
 *
 * Controlada: el estado optimista vive en la fila padre y aquí solo se notifica,
 * igual que ActasProgressCell. El rollback lo hace esta celda al fallar la acción.
 */
export function PlanificacionFechaCell({
  hitoId,
  fecha,
  readOnly = false,
  onFechaChange,
  onError,
}: PlanificacionFechaCellProps) {
  const dialogId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [pending, setPending] = useState(false);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }
    setPosition({ top: rect.bottom + 4, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  const persist = async (nueva: string | null) => {
    const previa = fecha;
    setOpen(false);
    onFechaChange(nueva); // optimista
    setPending(true);
    const result = await updateHitoFecha({ hitoId, fecha: nueva });
    setPending(false);
    if (!result.ok) {
      onFechaChange(previa); // rollback
      onError(result.error);
      return;
    }
    onFechaChange(result.fecha);
  };

  const etiqueta = formatFechaCorta(fecha);

  if (readOnly) {
    return (
      <span className="truncate text-xs tabular-nums text-text-body">
        {etiqueta ?? <span className="text-text-muted">—</span>}
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
        disabled={pending}
        className="group/fecha min-w-0 truncate rounded px-1 py-0.5 text-left text-xs tabular-nums text-text-body hover:bg-page disabled:opacity-60"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {etiqueta ?? (
          <>
            <span className="text-text-muted group-hover/row:hidden">—</span>
            <span className="hidden text-icam-900 group-hover/row:inline">+ Fecha</span>
          </>
        )}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              id={dialogId}
              role="dialog"
              aria-label="Editar previsión"
              className="fixed z-[70] w-[300px] rounded-lg border border-subtle/60 bg-card p-3 shadow-lg"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[11px] leading-snug text-text-muted">
                Previsión vigente del hito
              </p>
              <div className="actas-timeline-picker">
                <DayPicker
                  mode="single"
                  locale={es}
                  navLayout="around"
                  numberOfMonths={1}
                  defaultMonth={toDate(fecha)}
                  selected={toDate(fecha)}
                  onSelect={(d) => {
                    if (d) void persist(toIso(d));
                  }}
                />
              </div>
              <div className="mt-3 flex items-center gap-1.5 border-t border-subtle/40 pt-3">
                {fecha ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-body hover:bg-page disabled:opacity-50"
                    onClick={() => void persist(null)}
                  >
                    Quitar fecha
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
