"use client";

import { useRef, useState, useTransition } from "react";

import { updateElementProgress } from "@/modules/pm/actas/actions/update-element-progress";

interface ActasProgressCellProps {
  elementId: string;
  /** Valor controlado (estado optimista lo gestiona la fila). */
  progress: number;
  readOnly?: boolean;
  hasWriteAccess?: boolean;
  onProgressChange?: (value: number) => void;
  onError?: (message: string) => void;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ActasProgressCell({
  elementId,
  progress,
  readOnly = false,
  hasWriteAccess = true,
  onProgressChange,
  onError,
}: ActasProgressCellProps) {
  const canEdit = hasWriteAccess && !readOnly;
  // Valor en vivo durante el arrastre del slider (no se persiste hasta soltar).
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const shown = dragValue ?? progress;

  const persist = (next: number) => {
    setDragValue(null);
    const clamped = clamp(next);
    const prev = progress;
    if (clamped === prev) return;
    onProgressChange?.(clamped); // optimista
    startTransition(async () => {
      const result = await updateElementProgress({ elementId, progress: clamped });
      if (!result.ok) {
        onError?.(result.error || "No se pudo guardar el avance");
        onProgressChange?.(prev); // rollback
      }
    });
  };

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setDraft(String(progress));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    setEditing(false);
    if (Number.isNaN(parsed)) return;
    persist(parsed);
  };

  const isFull = shown >= 100;
  const numberClass = `shrink-0 w-9 text-right text-xs tabular-nums ${
    isFull ? "font-semibold text-emerald-600" : "text-text-muted"
  }`;

  return (
    <div
      className="flex min-w-0 items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={shown}
        disabled={!canEdit || pending}
        aria-label="Avance (%)"
        className={`h-1.5 min-w-0 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-60 ${
          isFull ? "accent-emerald-600" : "accent-icam-900"
        }`}
        onChange={(e) => setDragValue(Number(e.target.value))}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onPointerUp={() => {
          if (dragValue != null) persist(dragValue);
        }}
        onKeyUp={() => {
          if (dragValue != null) persist(dragValue);
        }}
        onBlur={() => {
          if (dragValue != null) persist(dragValue);
        }}
      />

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min={0}
          max={100}
          value={draft}
          disabled={pending}
          className="w-11 shrink-0 rounded border border-icam-900/30 bg-page px-1 py-0.5 text-right text-xs tabular-nums focus:border-icam-900/50 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
          }}
          onBlur={commitDraft}
        />
      ) : (
        <span
          className={`${numberClass} ${
            canEdit ? "cursor-text hover:underline decoration-dotted" : ""
          }`}
          onClick={canEdit ? startEdit : undefined}
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onKeyDown={
            canEdit
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEdit(e as unknown as React.MouseEvent);
                  }
                }
              : undefined
          }
        >
          {shown}%
        </span>
      )}
    </div>
  );
}
