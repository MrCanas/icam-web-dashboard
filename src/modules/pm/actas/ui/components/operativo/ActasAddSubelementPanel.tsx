"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createSubelement } from "@/modules/pm/actas/actions/create-subelement";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";

interface ActasAddSubelementPanelProps {
  parentElementId: string;
  indentPx: number;
  onCancel: () => void;
  onCreated: () => void;
}

export function ActasAddSubelementPanel({
  parentElementId,
  indentPx,
  onCancel,
  onCreated,
}: ActasAddSubelementPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSave = name.trim().length > 0 && !pending;

  const handleSubmit = () => {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      const result = await createSubelement({
        parentElementId,
        name,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated();
      router.refresh();
    });
  };

  return (
    <div
      className="border-b border-subtle/50 bg-icam-900/[0.03] py-2"
      style={{ paddingLeft: indentPx + 16, paddingRight: 16 }}
    >
      <div
        className="flex flex-wrap items-end gap-2"
        style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX - indentPx - 32 }}
      >
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs text-text-muted">
          Nombre del sub-elemento
          <input
            ref={inputRef}
            type="text"
            maxLength={200}
            value={name}
            autoFocus
            disabled={pending}
            placeholder="Ej. Wifi"
            className="rounded-md border border-subtle/80 bg-page px-3 py-1.5 text-sm text-text-body focus:border-icam-900/40 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
          />
        </label>
        <div className="flex gap-2 pb-0.5">
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSubmit}
            className="rounded-md bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-icam-800 disabled:opacity-40"
          >
            {pending ? "Creando…" : "Crear"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:bg-page"
          >
            Cancelar
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
