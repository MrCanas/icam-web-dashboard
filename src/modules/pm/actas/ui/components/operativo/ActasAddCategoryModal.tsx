"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createCategory } from "@/modules/pm/actas/actions/create-category";

interface ActasAddCategoryModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
}

const inputClass =
  "w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30";

export function ActasAddCategoryModal({
  open,
  projectId,
  onClose,
}: ActasAddCategoryModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
  }, [open]);

  const canSubmit = name.trim().length > 0 && !pending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await createCategory({ projectId, name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-category-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-subtle/60 bg-card p-5 shadow-xl">
        <h2
          id="add-category-title"
          className="text-lg font-semibold text-text-primary"
        >
          Nuevo grupo
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          El grupo se creará vacío; podrás añadir elementos después.
        </p>

        <label className="mt-4 block text-sm font-medium text-text-primary">
          Nombre del grupo
          <input
            type="text"
            maxLength={200}
            value={name}
            autoFocus
            disabled={pending}
            className={`mt-1 ${inputClass}`}
            placeholder="Ej. Infraestructura"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </label>

        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-md border border-subtle px-4 py-2 text-sm text-text-body hover:bg-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-md bg-icam-900 px-4 py-2 text-sm font-medium text-white hover:bg-icam-800 disabled:opacity-40"
          >
            {pending ? "Creando…" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}
