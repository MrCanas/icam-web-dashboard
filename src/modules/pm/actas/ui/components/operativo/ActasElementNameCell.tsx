"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { updateElementName } from "@/modules/pm/actas/actions/update-element-name";

import { useInlineCreate } from "./ActasInlineCreateContext";

interface ActasElementNameCellProps {
  elementId: string;
  name: string;
  isSubElement?: boolean;
  hasWriteAccess: boolean;
  readOnly?: boolean;
  onNameChange: (name: string) => void;
  onError: (message: string) => void;
}

export function ActasElementNameCell({
  elementId,
  name,
  isSubElement = false,
  hasWriteAccess,
  readOnly = false,
  onNameChange,
  onError,
}: ActasElementNameCellProps) {
  const router = useRouter();
  const inlineCreate = useInlineCreate();
  const autoEditId = inlineCreate?.autoEditId ?? null;
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canEdit = hasWriteAccess && !readOnly;

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  // Auto-edición tras creación inline: la fila recién creada abre su nombre en
  // modo edición con el texto seleccionado. Solo es estado de UI (no escribe).
  useEffect(() => {
    if (!canEdit || autoEditId !== elementId) return;
    inlineCreate?.consumeAutoEdit(elementId);
    setDraft(name);
    setError(null);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [autoEditId, elementId, canEdit, name, inlineCreate]);

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
      const result = await updateElementName({
        elementId,
        name: trimmed,
      });
      if (!result.ok) {
        setError(result.error);
        onError(result.error);
        return;
      }
      setEditing(false);
      onNameChange(result.name);
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
          className={`w-full min-w-0 rounded border border-icam-900/30 bg-page px-1.5 py-0.5 text-text-body focus:border-icam-900/50 focus:outline-none focus:ring-1 focus:ring-icam-900/20 ${
            isSubElement ? "text-xs" : "text-sm font-medium"
          }`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Aísla el input del onKeyDown de la fila (role=button) que hace
            // preventDefault en " " — si no, no se puede escribir el espacio.
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
          <p className="mt-0.5 text-[10px] text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span
      className={`min-w-0 truncate text-text-body ${
        isSubElement ? "text-xs" : "text-sm font-medium"
      } ${canEdit ? "cursor-text hover:underline decoration-dotted underline-offset-2" : ""}`}
      title={name}
      onClick={canEdit ? startEdit : undefined}
      onMouseDown={canEdit ? (e) => e.stopPropagation() : undefined}
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
      {name}
    </span>
  );
}
