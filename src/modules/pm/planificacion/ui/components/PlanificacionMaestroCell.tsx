"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { resolverDiscrepancia } from "@/modules/pm/planificacion/actions/resolver-discrepancia";
import type { EstadoDiscrepancia } from "@/modules/pm/planificacion/logic/discrepancias";
import { formatFechaCorta } from "@/modules/pm/planificacion/logic/planificacion-display";

const POPOVER_WIDTH = 280;

interface PlanificacionMaestroCellProps {
  hitoId: string;
  snapshotCode: string;
  /** Etiqueta del trimestre («Q4 2025»), para los textos. */
  label: string;
  /** Fecha del maestro; undefined = hito sin columna en la línea. */
  fechaMaestro: string | null | undefined;
  /** Fecha oficial de PM en ese trimestre (para el botón «Mantener PM»). */
  fechaOficial: string | null;
  estado: EstadoDiscrepancia;
  readOnly?: boolean;
  /** La fecha oficial cambió (se eligió el maestro): actualizar la fila. */
  onFechaOficial: (fecha: string | null) => void;
  onToast: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

const ICONO: Record<EstadoDiscrepancia, { simbolo: string; clase: string; titulo: string }> = {
  sin_dato_maestro: { simbolo: "—", clase: "text-text-muted/50", titulo: "El maestro no reporta este hito" },
  coincide: { simbolo: "=", clase: "text-text-muted", titulo: "Coincide con Planificación" },
  pendiente: { simbolo: "≠", clase: "text-amber-600 font-semibold", titulo: "Discrepancia con Planificación: haz clic para resolver" },
  resuelta: { simbolo: "✓", clase: "text-emerald-600", titulo: "Discrepancia resuelta" },
};

/**
 * Celda de la columna «Maestro»: la fecha que el Financiero reportó para este
 * hito en ese trimestre, con su estado frente a la de Planificación. En
 * «pendiente» abre un popover para elegir cuál es la buena; la elegida pasa a
 * ser la oficial y, si era la última pendiente, el trimestre se publica solo.
 */
export function PlanificacionMaestroCell({
  hitoId,
  snapshotCode,
  label,
  fechaMaestro,
  fechaOficial,
  estado,
  readOnly = false,
  onFechaOficial,
  onToast,
  onError,
}: PlanificacionMaestroCellProps) {
  const router = useRouter();
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

  const resolver = async (eleccion: "pm" | "maestro") => {
    setOpen(false);
    setPending(true);
    const r = await resolverDiscrepancia({ hitoId, snapshotCode, eleccion });
    setPending(false);
    if (!r.ok) {
      onError(r.error);
      return;
    }
    onFechaOficial(r.fecha);
    onToast(
      r.publicadoAuto
        ? `Resuelto. Sin discrepancias en ${label}: el trimestre se ha publicado automáticamente.`
        : r.pendientes > 0
          ? `Resuelto. Quedan ${r.pendientes} ${r.pendientes === 1 ? "discrepancia" : "discrepancias"} en ${label}.`
          : "Resuelto.",
    );
    router.refresh();
  };

  const icono = ICONO[estado];
  const txt = formatFechaCorta(fechaMaestro ?? null);
  const clicable = estado === "pendiente" && !readOnly;

  const contenido = (
    <>
      <span className={icono.clase} aria-hidden>
        {icono.simbolo}
      </span>{" "}
      {estado === "sin_dato_maestro" ? null : (
        <span className="tabular-nums">{txt ?? "—"}</span>
      )}
    </>
  );

  if (!clicable) {
    return (
      <span
        className={`truncate text-xs ${estado === "pendiente" ? "text-amber-700" : "text-text-muted"}`}
        title={icono.titulo}
      >
        {contenido}
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
        title={icono.titulo}
        className="min-w-0 truncate rounded px-1 py-0.5 text-left text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-60"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {contenido}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popRef}
              id={dialogId}
              role="dialog"
      aria-modal="true"
              aria-label="Resolver discrepancia con el maestro"
              className="fixed z-[70] w-[280px] rounded-lg border border-subtle/60 bg-card p-3 shadow-lg"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[11px] leading-snug text-text-muted">
                El maestro financiero y Planificación reportan fechas distintas
                para {label}. ¿Cuál es la buena? La elegida será la oficial del
                Overview.
              </p>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={pending || fechaMaestro == null}
                  className="rounded-md border border-subtle px-2.5 py-1.5 text-left text-[11px] text-text-body hover:bg-page disabled:opacity-50"
                  onClick={() => void resolver("maestro")}
                >
                  Usar la del maestro{" "}
                  <span className="font-medium tabular-nums">
                    ({formatFechaCorta(fechaMaestro ?? null) ?? "sin fecha"})
                  </span>
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-subtle px-2.5 py-1.5 text-left text-[11px] text-text-body hover:bg-page disabled:opacity-50"
                  onClick={() => void resolver("pm")}
                >
                  Mantener la de PM{" "}
                  <span className="font-medium tabular-nums">
                    ({formatFechaCorta(fechaOficial) ?? "sin fecha"})
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-muted hover:bg-page"
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
