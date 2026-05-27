"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { softDeleteLogEntry } from "@/modules/pm/actas/actions/soft-delete-log-entry";
import { updateLogEntry } from "@/modules/pm/actas/actions/update-log-entry";
import { canManageLogEntry } from "@/modules/pm/actas/logic/log-entry-access";
import { toDatetimeLocalValue } from "@/modules/pm/actas/logic/log-entry-datetime";
import {
  formatEditedAgo,
  formatLogEntryDate,
} from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

import { ActasLogEntryStatusChip } from "./ActasLogEntryStatusChip";

interface ActasHistoryEntryItemProps {
  entry: ActasLogEntryItem;
  currentAuthUserId: string | null;
  readOnly?: boolean;
  onUpdated: (entry: ActasLogEntryItem) => void;
  onDeleted: (entry: ActasLogEntryItem) => void;
}

export function ActasHistoryEntryItem({
  entry: initialEntry,
  currentAuthUserId,
  readOnly = false,
  onUpdated,
  onDeleted,
}: ActasHistoryEntryItemProps) {
  const router = useRouter();
  const [entry, setEntry] = useState(initialEntry);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [content, setContent] = useState(initialEntry.content);
  const [entryDateLocal, setEntryDateLocal] = useState(() =>
    toDatetimeLocalValue(initialEntry.entryDate),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setEntry(initialEntry);
    if (!editing && !confirmingDelete) {
      setContent(initialEntry.content);
      setEntryDateLocal(toDatetimeLocalValue(initialEntry.entryDate));
    }
  }, [initialEntry, editing, confirmingDelete]);

  const isDeleted = entry.deletedAt != null;
  const hasStatusChange =
    entry.statusBefore != null && entry.statusAfter != null;
  const manageable = canManageLogEntry(entry, currentAuthUserId);
  const canSave = content.trim().length > 0 && !pending;
  const editedLabel = formatEditedAgo(entry.editedAt);
  const editedTooltip = editedLabel ?? undefined;

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  const startEdit = () => {
    setConfirmingDelete(false);
    setContent(entry.content);
    setEntryDateLocal(toDatetimeLocalValue(entry.entryDate));
    setError(null);
    setEditing(true);
    requestAnimationFrame(resizeTextarea);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
    setContent(entry.content);
    setEntryDateLocal(toDatetimeLocalValue(entry.entryDate));
  };

  const handleSave = () => {
    if (!canSave) return;
    setError(null);

    startTransition(async () => {
      const result = await updateLogEntry({
        logEntryId: entry.id,
        content,
        entryDate: new Date(entryDateLocal).toISOString(),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEntry(result.entry);
      setEditing(false);
      onUpdated(result.entry);
      router.refresh();
    });
  };

  const handleConfirmDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await softDeleteLogEntry({ logEntryId: entry.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntry(result.entry);
      setConfirmingDelete(false);
      onDeleted(result.entry);
      router.refresh();
    });
  };

  if (confirmingDelete && !isDeleted) {
    return (
      <li className="rounded-md border border-amber-200/80 bg-amber-50/90 p-3">
        <p className="text-sm text-amber-950">
          ¿Borrar esta entrada? Esta acción se puede deshacer durante 30 segundos.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Borrando…" : "Borrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(false);
              setError(null);
            }}
            disabled={pending}
            className="rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:bg-page"
          >
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`group rounded-md border border-subtle/60 bg-card p-3 ${
        isDeleted ? "opacity-60" : ""
      }`}
    >
      {editing ? (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              resizeTextarea();
            }}
            onInput={resizeTextarea}
            rows={2}
            className="w-full resize-none rounded-md border border-subtle/80 bg-page px-3 py-2 text-sm text-text-body focus:border-icam-900/40 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
            disabled={pending}
            autoFocus
          />

          {hasStatusChange ? (
            <div className="space-y-1.5">
              <ActasLogEntryStatusChip
                statusBefore={entry.statusBefore!}
                statusAfter={entry.statusAfter!}
              />
              <p className="text-[11px] text-text-muted leading-snug">
                El cambio de estado registrado no se puede editar. Si necesitas
                corregirlo, borra esta entrada y crea una nueva.
              </p>
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-xs text-text-muted">
            Fecha de la entrada
            <input
              type="datetime-local"
              value={entryDateLocal}
              onChange={(e) => setEntryDateLocal(e.target.value)}
              disabled={pending}
              className="rounded-md border border-subtle/80 bg-page px-2 py-1.5 text-sm text-text-body max-w-xs"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className="rounded-md bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-icam-800 disabled:opacity-40"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={pending}
              className="rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:bg-page"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="font-medium text-text-primary">
              {entry.author?.email ?? entry.author?.label ?? "Sin autor"}
            </span>
            <span className="text-text-muted inline-flex items-center gap-1">
              {formatLogEntryDate(entry.entryDate)}
              {entry.editedAt ? (
                <span
                  className="text-[10px] italic text-text-muted/90"
                  title={editedTooltip}
                >
                  (editada)
                </span>
              ) : null}
            </span>
            {isDeleted ? (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                Borrada
              </span>
            ) : null}
            {hasStatusChange ? (
              <ActasLogEntryStatusChip
                statusBefore={entry.statusBefore!}
                statusAfter={entry.statusAfter!}
              />
            ) : null}
            {manageable && !isDeleted && !readOnly ? (
              <span className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={startEdit}
                  className="text-icam-900 hover:text-icam-gold text-[11px] font-medium"
                >
                  ✎ Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                    setConfirmingDelete(true);
                  }}
                  className="text-red-700/80 hover:text-red-600 text-[11px] font-medium"
                >
                  🗑 Borrar
                </button>
              </span>
            ) : null}
          </div>
          <p
            className={`mt-2 text-sm text-text-body whitespace-pre-wrap break-words ${
              isDeleted ? "line-through" : ""
            }`}
          >
            {entry.content}
          </p>
        </>
      )}
    </li>
  );
}
