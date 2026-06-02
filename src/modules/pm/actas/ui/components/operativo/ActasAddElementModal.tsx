"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createElement } from "@/modules/pm/actas/actions/create-element";
import type { ActasRootElementOption } from "@/modules/pm/actas/logic/collect-root-elements";
import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

interface ActasAddElementModalProps {
  open: boolean;
  defaultCategoryId: string;
  categories: ActasOperativoCategory[];
  parentOptions: ActasRootElementOption[];
  onClose: () => void;
}

const inputClass =
  "w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30";

export function ActasAddElementModal({
  open,
  defaultCategoryId,
  categories,
  parentOptions,
  onClose,
}: ActasAddElementModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [asSubelement, setAsSubelement] = useState(false);
  const [parentQuery, setParentQuery] = useState("");
  const [parentElementId, setParentElementId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategoryId(defaultCategoryId);
    setAsSubelement(false);
    setParentQuery("");
    setParentElementId(null);
    setError(null);
  }, [open, defaultCategoryId]);

  const filteredParents = useMemo(() => {
    const q = parentQuery.trim().toLowerCase();
    const inCategory = parentOptions.filter((p) => p.categoryId === categoryId);
    if (!q) return inCategory.slice(0, 12);
    return inCategory
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [parentOptions, categoryId, parentQuery]);

  const selectedParent = parentOptions.find((p) => p.id === parentElementId);

  const canSubmit =
    name.trim().length > 0 &&
    !pending &&
    (!asSubelement || parentElementId != null);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await createElement({
        categoryId,
        name,
        parentElementId: asSubelement ? parentElementId : null,
      });
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
      aria-labelledby="add-element-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-subtle/60 bg-card p-5 shadow-xl">
        <h2
          id="add-element-title"
          className="text-lg font-semibold text-text-primary"
        >
          Añadir elemento
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-text-primary">
            Nombre del elemento
            <input
              type="text"
              maxLength={200}
              value={name}
              autoFocus
              disabled={pending}
              className={`mt-1 ${inputClass}`}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </label>

          <label className="block text-sm font-medium text-text-primary">
            Categoría
            <select
              value={categoryId}
              disabled={pending || asSubelement}
              className={`mt-1 ${inputClass}`}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setParentElementId(null);
                setParentQuery("");
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-2 text-sm text-text-body cursor-pointer select-none">
            <input
              type="checkbox"
              checked={asSubelement}
              disabled={pending || parentOptions.length === 0}
              className="mt-1 rounded border-subtle"
              onChange={(e) => {
                const checked = e.target.checked;
                setAsSubelement(checked);
                if (!checked) {
                  setParentElementId(null);
                  setParentQuery("");
                } else if (selectedParent) {
                  setCategoryId(selectedParent.categoryId);
                }
              }}
            />
            <span>Es sub-elemento de…</span>
          </label>

          {asSubelement ? (
            <div className="space-y-2">
              <input
                type="text"
                value={parentQuery}
                disabled={pending}
                placeholder="Buscar elemento padre…"
                className={inputClass}
                onChange={(e) => {
                  setParentQuery(e.target.value);
                  setParentElementId(null);
                }}
              />
              {selectedParent ? (
                <p className="text-xs text-icam-900">
                  Padre: <strong>{selectedParent.name}</strong> (
                  {selectedParent.categoryName})
                </p>
              ) : null}
              {parentQuery.trim() && !selectedParent && filteredParents.length > 0 ? (
                <ul className="max-h-36 overflow-y-auto rounded-md border border-subtle/60 bg-page text-sm">
                  {filteredParents.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-icam-900/5"
                        onClick={() => {
                          setParentElementId(p.id);
                          setParentQuery(p.name);
                          setCategoryId(p.categoryId);
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-text-muted">
                          {p.categoryName}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>

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
            {pending ? "Creando…" : "Crear elemento"}
          </button>
        </div>
      </div>
    </div>
  );
}
