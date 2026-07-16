"use client";

import { useEffect, useId, type ReactNode } from "react";

interface AdminModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/** Esqueleto común de los modales de administración (overlay + diálogo). */
export function AdminModal({
  open,
  title,
  subtitle,
  busy = false,
  onClose,
  children,
  footer,
}: AdminModalProps) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(92vh,900px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-subtle/60 bg-card shadow-xl"
      >
        <header className="shrink-0 border-b border-subtle/40 px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-subtle/40 px-6 py-4">
          {footer}
        </footer>
      </div>
    </div>
  );
}
