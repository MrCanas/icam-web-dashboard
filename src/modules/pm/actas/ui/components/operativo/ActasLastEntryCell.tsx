"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { updateLogEntry } from "@/modules/pm/actas/actions/update-log-entry";
import { truncateEntryPreview } from "@/modules/pm/actas/logic/element-display";
import {
  canManageLogEntry,
  canShowLogEntryManageActions,
} from "@/modules/pm/actas/logic/log-entry-access";
import { toDatetimeLocalValue } from "@/modules/pm/actas/logic/log-entry-datetime";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

interface ActasLastEntryCellProps {
  entryId: string | null;
  content: string | null;
  entryDate: string | null;
  authorId: string | null;
  source: string | null;
  currentAuthUserId: string | null;
  isPmAdmin: boolean;
  hasWriteAccess: boolean;
  readOnly?: boolean;
  onUpdated: (content: string, entryDate: string) => void;
}

export function ActasLastEntryCell({
  entryId,
  content,
  entryDate,
  authorId,
  source,
  currentAuthUserId,
  isPmAdmin,
  hasWriteAccess,
  readOnly = false,
  onUpdated,
}: ActasLastEntryCellProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const entryLike: Pick<
    ActasLogEntryItem,
    "authorId" | "deletedAt" | "source"
  > = {
    authorId,
    deletedAt: null,
    source,
  };

  const canEdit =
    !readOnly &&
    entryId &&
    content &&
    entryDate &&
    canShowLogEntryManageActions(entryLike, hasWriteAccess) &&
    canManageLogEntry(entryLike, currentAuthUserId, isPmAdmin);

  useEffect(() => {
    if (!editing) setDraft(content ?? "");
  }, [content, editing]);

  const preview = content ? truncateEntryPreview(content) : null;
  const full = content?.trim() ?? "";

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setDraft(content ?? "");
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditing(false);
    setDraft(content ?? "");
    setError(null);
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entryId || !entryDate || draft.trim().length === 0 || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await updateLogEntry({
        logEntryId: entryId,
        content: draft,
        entryDate: new Date(toDatetimeLocalValue(entryDate)).toISOString(),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      onUpdated(result.entry.content, result.entry.entryDate);
      router.refresh();
    });
  };

  if (readOnly && !content) {
    return (
      <span className="text-text-muted italic text-[11px]">
        Sin actividad previa
      </span>
    );
  }

  if (editing) {
    return (
      <div
        className="min-w-0 space-y-1"
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          rows={2}
          disabled={pending}
          className="w-full resize-none rounded border border-subtle/80 bg-page px-2 py-1 text-xs text-text-body focus:border-icam-900/40 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {error ? (
          <p className="text-[10px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex gap-1">
          <button
            type="button"
            disabled={pending || draft.trim().length === 0}
            onClick={saveEdit}
            className="rounded bg-icam-900 px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={cancelEdit}
            className="rounded border border-subtle px-2 py-0.5 text-[10px] text-text-body"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (!content) {
    return <span className="text-text-muted">—</span>;
  }

  return (
    <span
      className={`min-w-0 truncate text-xs text-text-body ${
        canEdit ? "cursor-text hover:underline decoration-dotted" : "cursor-default"
      }`}
      title={full.length > 0 ? full : undefined}
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
      {preview}
    </span>
  );
}
