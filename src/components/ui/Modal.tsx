"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalWidth = "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Bloquea el cierre (Escape / click en overlay) mientras hay una acción en curso. */
  busy?: boolean;
  width?: ModalWidth;
  /**
   * `true` monta el diálogo en un portal a `document.body` con z-index por
   * encima de la barra flotante de portfolio (z-[65]). Sin esto, un modal
   * `z-50` abierto desde una gráfica quedaría *debajo* de la barra.
   */
  elevated?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const WIDTH_CLASS: Record<ModalWidth, string> = {
  md: "max-w-md",
  lg: "max-w-xl",
  xl: "max-w-3xl",
};

/**
 * Esqueleto común de diálogo (overlay + caja). Nació como AdminModal y se
 * promovió a compartido para que el drill-down de las gráficas de portfolio no
 * duplicase el mismo overlay por tercera vez.
 */
export function Modal({
  open,
  title,
  subtitle,
  busy = false,
  width = "lg",
  elevated = false,
  onClose,
  children,
  footer,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  const titleId = useId();

  if (!open) return null;

  const dialog = (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/50 p-4 sm:p-6 ${
        elevated ? "z-[80]" : "z-50"
      }`}
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`flex max-h-[min(92vh,900px)] w-full ${WIDTH_CLASS[width]} flex-col overflow-hidden rounded-xl border border-subtle/60 bg-card shadow-xl`}
      >
        <header className="shrink-0 border-b border-subtle/40 px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-subtle/40 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );

  if (!elevated) return dialog;
  return mounted ? createPortal(dialog, document.body) : null;
}
