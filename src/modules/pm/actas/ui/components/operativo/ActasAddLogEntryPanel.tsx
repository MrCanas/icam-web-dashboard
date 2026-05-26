"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";

import { createLogEntry } from "@/modules/pm/actas/actions/create-log-entry";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";
import { LOG_ENTRY_STATUS_OPTIONS } from "@/modules/pm/actas/logic/element-status";
import { toDatetimeLocalValue } from "@/modules/pm/actas/logic/log-entry-datetime";
import type { ActasLogEntryItem, ElementStatus } from "@/modules/pm/actas/types";

interface ActasAddLogEntryPanelProps {
  elementId: string;
  currentStatus: ElementStatus;
  indentPx: number;
  onCancel: () => void;
  onSaved: (payload: {
    entry: ActasLogEntryItem;
    elementStatus: ElementStatus;
  }) => void;
}

export function ActasAddLogEntryPanel({
  elementId,
  currentStatus,
  indentPx,
  onCancel,
  onSaved,
}: ActasAddLogEntryPanelProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [statusChoice, setStatusChoice] = useState<"" | ElementStatus>("");
  const [entryDateLocal, setEntryDateLocal] = useState(() =>
    toDatetimeLocalValue(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSave = content.trim().length > 0 && !pending;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  const handleSubmit = () => {
    if (!canSave) return;
    setError(null);

    const entryDateIso = new Date(entryDateLocal).toISOString();

    startTransition(async () => {
      const result = await createLogEntry({
        elementId,
        content,
        statusAfter: statusChoice === "" ? null : statusChoice,
        entryDate: entryDateIso,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onSaved({
        entry: result.entry,
        elementStatus: result.elementStatus,
      });
      router.refresh();
    });
  };

  return (
    <div
      className="border-b border-subtle/50 bg-icam-900/[0.03] py-3"
      style={{ paddingLeft: indentPx + 16, paddingRight: 16 }}
    >
      <div
        className="space-y-3 rounded-md border border-subtle/60 bg-card p-3 shadow-sm"
        style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX - indentPx - 48 }}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            resizeTextarea();
          }}
          onInput={resizeTextarea}
          rows={2}
          placeholder="Añadir actualización…"
          className="w-full resize-none rounded-md border border-subtle/80 bg-page px-3 py-2 text-sm text-text-body placeholder:text-text-muted focus:border-icam-900/40 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
          disabled={pending}
          autoFocus
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Estado
            <select
              value={statusChoice}
              onChange={(e) =>
                setStatusChoice(e.target.value as "" | ElementStatus)
              }
              disabled={pending}
              className="rounded-md border border-subtle/80 bg-page px-2 py-1.5 text-sm text-text-body min-w-[140px]"
            >
              {LOG_ENTRY_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || "none"} value={opt.value}>
                  {opt.label}
                  {opt.value && opt.value === currentStatus ? " (actual)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Fecha de la entrada
            <input
              type="datetime-local"
              value={entryDateLocal}
              onChange={(e) => setEntryDateLocal(e.target.value)}
              disabled={pending}
              className="rounded-md border border-subtle/80 bg-page px-2 py-1.5 text-sm text-text-body"
            />
          </label>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSubmit}
            className="rounded-md bg-icam-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-icam-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-subtle px-4 py-1.5 text-sm text-text-body hover:bg-page disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
