"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface ToolbarPopoverProps {
  label: ReactNode;
  /** Resumen del valor activo, para leer el filtro sin abrir el menú. */
  value?: string;
  active?: boolean;
  width?: number;
  ariaLabel: string;
  children: (close: () => void) => ReactNode;
}

const MARGEN = 8;

/**
 * Menú desplegable de la barra flotante. Se abre HACIA ARRIBA porque la barra
 * vive anclada abajo. Va en un portal para que no lo recorte el `overflow` de
 * la barra ni de la página, en z-[70]: por encima de la barra (z-[65]) y por
 * debajo del modal de drill-down (z-[80]).
 */
export function ToolbarPopover({
  label,
  value,
  active = false,
  width = 220,
  ariaLabel,
  children,
}: ToolbarPopoverProps) {
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left: number } | null>(null);

  const recolocar = useCallback(() => {
    const el = botonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    if (left + width > window.innerWidth - MARGEN) {
      left = window.innerWidth - width - MARGEN;
    }
    if (left < MARGEN) left = MARGEN;
    setPos({ bottom: window.innerHeight - rect.top + 6, left });
  }, [width]);

  useEffect(() => {
    if (!open) return;
    recolocar();

    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (botonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", recolocar);
    window.addEventListener("scroll", recolocar, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", recolocar);
      window.removeEventListener("scroll", recolocar, true);
    };
  }, [open, recolocar]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`min-h-9 inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm whitespace-nowrap ${
          active
            ? "border-icam-900 bg-icam-900 text-white"
            : "border-subtle bg-white text-text-body hover:border-icam-900"
        }`}
      >
        {label}
        {value ? <span className="font-medium">· {value}</span> : null}
        <span aria-hidden className="text-[10px] leading-none">
          ▲
        </span>
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="menu"
              aria-label={ariaLabel}
              style={{ bottom: pos.bottom, left: pos.left, width }}
              className="fixed z-[70] max-h-[60vh] overflow-y-auto rounded-lg border border-subtle/60 bg-card p-2 shadow-xl"
            >
              {children(close)}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
