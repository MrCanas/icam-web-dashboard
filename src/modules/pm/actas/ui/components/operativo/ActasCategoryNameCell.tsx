"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { updateCategoryName } from "@/modules/pm/actas/actions/update-category-name";

import { useInlineCreate } from "./ActasInlineCreateContext";

interface ActasCategoryNameCellProps {
  categoryId: string;
  /** Nombre base en BD (sin sufijo de sub-lote). */
  name: string;
  /** Título visible (puede incluir sufijo). */
  displayName: string;
  hasWriteAccess: boolean;
  readOnly?: boolean;
  headerTextColor?: string;
  onRenamed: (name: string, displayName: string) => void;
  onError: (message: string) => void;
}

export function ActasCategoryNameCell({
  categoryId,
  name,
  displayName,
  hasWriteAccess,
  readOnly = false,
  headerTextColor,
  onRenamed,
  onError,
}: ActasCategoryNameCellProps) {
  const router = useRouter();
  const inlineCreate = useInlineCreate();
  const autoEditId = inlineCreate?.autoEditId ?? null;
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = hasWriteAccess && !readOnly;
  const shownLabel = displayName;

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  // Auto-edición tras crear el grupo inline: abre el título en edición con el
  // texto seleccionado. Solo estado de UI (no escribe).
  useEffect(() => {
    if (!canEdit || autoEditId !== categoryId) return;
    inlineCreate?.consumeAutoEdit(categoryId);
    setDraft(name);
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [autoEditId, categoryId, canEdit, name, inlineCreate]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    setDraft(name);
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(name);
    setError(null);
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || pending) return;
    if (trimmed === name.trim()) {
      cancelEdit();
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateCategoryName({
        categoryId,
        name: trimmed,
      });
      if (!result.ok) {
        setError(result.error);
        onError(result.error);
        return;
      }
      setEditing(false);
      onRenamed(result.name, result.displayName);
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div
        className="min-w-0 flex-1"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          maxLength={200}
          value={draft}
          disabled={pending}
          autoFocus
          className="w-full min-w-0 rounded border border-white/40 bg-white/90 px-2 py-0.5 text-sm font-semibold uppercase tracking-wide text-text-body focus:border-icam-900/40 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Aísla el input de los handlers de fila/tablero (espacio, etc.).
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              saveEdit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
          onBlur={() => {
            if (!pending) saveEdit();
          }}
        />
        {error ? (
          <p className="mt-0.5 text-[10px] text-red-100 normal-case" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span
      className={`flex-1 min-w-0 font-semibold text-sm uppercase tracking-wide truncate ${
        canEdit ? "cursor-text hover:underline decoration-dotted underline-offset-2" : ""
      }`}
      style={headerTextColor ? { color: headerTextColor } : undefined}
      title={shownLabel}
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
      {shownLabel}
    </span>
  );
}
