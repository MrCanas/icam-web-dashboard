"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { checkActasProjectCode } from "@/modules/pm/actas/actions/check-actas-project-code";
import { duplicateProject } from "@/modules/pm/actas/actions/duplicate-project";
import { normalizeProjectCodeInput } from "@/modules/pm/actas/logic/project-wizard-options";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

export type DuplicateProjectSuccess = {
  newCode: string;
  sourceCode: string;
  structureEmpty: boolean;
};

interface ActasDuplicateProjectModalProps {
  source: ActasProjectListItem | null;
  open: boolean;
  onClose: () => void;
  onDuplicated: (result: DuplicateProjectSuccess) => void;
}

const inputClass =
  "w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30";
const labelClass = "block text-sm font-medium text-text-primary";

function suggestCopyCode(originalCode: string): string {
  const base = `${originalCode}_COPY`;
  return normalizeProjectCodeInput(base).slice(0, 10);
}

export function ActasDuplicateProjectModal({
  source,
  open,
  onClose,
  onDuplicated,
}: ActasDuplicateProjectModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !source) return;
    const suggested = suggestCopyCode(source.code);
    setCode(suggested);
    setName(`${source.name} (copia)`.slice(0, 120));
    setCodeError(null);
    setSubmitError(null);
    setCodeTouched(false);

    let cancelled = false;
    void (async () => {
      if (!suggested) return;
      setCodeChecking(true);
      const res = await checkActasProjectCode(suggested);
      if (cancelled) return;
      setCodeChecking(false);
      setCodeTouched(true);
      if (!res.ok) {
        setCodeError(res.error);
        return;
      }
      if (!res.available) {
        setCodeError("Ya existe un proyecto con este código");
        return;
      }
      setCodeError(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, source]);

  const validateCodeOnBlur = useCallback(async () => {
    setCodeTouched(true);
    const normalized = normalizeProjectCodeInput(code);
    if (normalized !== code) setCode(normalized);
    if (!normalized) {
      setCodeError("El código es obligatorio.");
      return;
    }
    setCodeChecking(true);
    const res = await checkActasProjectCode(normalized);
    setCodeChecking(false);
    if (!res.ok) {
      setCodeError(res.error);
      return;
    }
    if (!res.available) {
      setCodeError("Ya existe un proyecto con este código");
      return;
    }
    setCodeError(null);
  }, [code]);

  const nameError = useMemo(() => {
    const n = name.trim();
    if (!n) return "El nombre es obligatorio.";
    if (n.length > 120) return "Máximo 120 caracteres.";
    return null;
  }, [name]);

  const canSubmit =
    !!source &&
    codeTouched &&
    !codeError &&
    !codeChecking &&
    !nameError &&
    name.trim().length > 0 &&
    code.trim().length >= 2 &&
    !pending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !canSubmit) return;
    setSubmitError(null);

    startTransition(async () => {
      const res = await duplicateProject({
        sourceProjectId: source.id,
        newCode: normalizeProjectCodeInput(code),
        newName: name.trim(),
      });
      if (!res.ok) {
        setSubmitError(res.error);
        if (res.status === 409) {
          setCodeError("Ya existe un proyecto con este código");
        }
        return;
      }
      onDuplicated({
        newCode: res.projectCode,
        sourceCode: res.sourceCode,
        structureEmpty: res.structureEmpty,
      });
    });
  };

  if (!open || !source) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="actas-duplicate-project-title"
        className="w-full max-w-md rounded-xl border border-subtle/60 bg-card shadow-xl"
      >
        <header className="border-b border-subtle/40 px-5 py-4">
          <h2
            id="actas-duplicate-project-title"
            className="text-lg font-semibold text-text-primary"
          >
            Duplicar {source.code}
          </h2>
        </header>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            Se copiará la estructura completa (categorías, elementos,
            sub-elementos, módulos activos) pero{" "}
            <strong className="font-medium text-text-primary">no</strong> se
            copiarán las entradas de log ni los owners. El nuevo proyecto nace
            vacío de actividad.
          </p>

          {submitError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <div>
            <label htmlFor="actas-dup-code" className={labelClass}>
              Código del nuevo proyecto
            </label>
            <input
              id="actas-dup-code"
              className={`${inputClass} mt-1 font-mono uppercase ${
                codeError ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""
              }`}
              value={code}
              maxLength={10}
              autoComplete="off"
              disabled={pending}
              onChange={(e) => {
                setCode(normalizeProjectCodeInput(e.target.value));
                if (codeTouched) setCodeError(null);
              }}
              onBlur={() => void validateCodeOnBlur()}
            />
            {codeChecking ? (
              <p className="mt-1 text-xs text-text-muted">Comprobando código…</p>
            ) : null}
            {codeError ? (
              <p className="mt-1 text-xs text-red-600">{codeError}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="actas-dup-name" className={labelClass}>
              Nombre
            </label>
            <input
              id="actas-dup-name"
              className={`${inputClass} mt-1 ${
                nameError && name.trim() ? "border-red-400" : ""
              }`}
              value={name}
              maxLength={120}
              disabled={pending}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError && name.length > 0 ? (
              <p className="mt-1 text-xs text-red-600">{nameError}</p>
            ) : null}
          </div>

          <footer className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="min-h-10 rounded-md border border-subtle/60 px-4 text-sm font-medium text-text-primary hover:bg-page disabled:opacity-50"
              disabled={pending}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-10 rounded-md bg-icam-900 px-5 text-sm font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!canSubmit}
            >
              {pending ? "Duplicando…" : "Duplicar"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
