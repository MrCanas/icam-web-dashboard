"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { checkActasProjectCode } from "@/modules/pm/actas/actions/check-actas-project-code";
import { createProjectFromTemplate } from "@/modules/pm/actas/actions/create-project-from-template";
import {
  getProjectWizardCatalog,
  getProjectWizardPreview,
} from "@/modules/pm/actas/actions/get-project-wizard-catalog";
import { searchPmActivosAction } from "@/modules/pm/actas/actions/search-pm-activos";
import type { MasterModuleOption } from "@/modules/pm/actas/data/projectTemplateRepository";
import {
  normalizeProjectCodeInput,
  WIZARD_ASSET_TYPES,
  WIZARD_PROJECT_PHASES,
} from "@/modules/pm/actas/logic/project-wizard-options";
import type { ProjectPhase } from "@/modules/pm/actas/types";

interface ActasCreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (projectCode: string) => void;
}

const inputClass =
  "w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30";
const labelClass = "block text-sm font-medium text-text-primary";
const helperClass = "mt-1 text-xs text-text-muted";

export function ActasCreateProjectModal({
  open,
  onClose,
  onCreated,
}: ActasCreateProjectModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<ProjectPhase>("desarrollo");
  const [assetType, setAssetType] = useState("residencial");
  const [pmActivoId, setPmActivoId] = useState<string | null>(null);
  const [pmSearch, setPmSearch] = useState("");
  const [pmOptions, setPmOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(
    new Set(),
  );
  const [modules, setModules] = useState<MasterModuleOption[]>([]);
  const [coreElementCount, setCoreElementCount] = useState(0);
  const [coreCategoryCount, setCoreCategoryCount] = useState(6);
  const [previewCategories, setPreviewCategories] = useState(6);
  const [previewElements, setPreviewElements] = useState(0);

  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadPmOptions = useCallback(async (q: string) => {
    const res = await searchPmActivosAction(q);
    if (res.ok) {
      setPmOptions(res.items.map((i) => ({ id: i.id, label: i.label })));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setName("");
    setPhase("desarrollo");
    setAssetType("residencial");
    setPmActivoId(null);
    setPmSearch("");
    setSelectedModuleIds(new Set());
    setCodeError(null);
    setCodeTouched(false);
    setSubmitError(null);
    setCatalogError(null);

    setLoadingCatalog(true);
    void getProjectWizardCatalog().then((res) => {
      setLoadingCatalog(false);
      if (!res.ok) {
        setCatalogError(res.error);
        return;
      }
      setModules(res.modules);
      setCoreElementCount(res.corePreview.coreElementCount);
      setCoreCategoryCount(res.corePreview.categoryCount);
      setPreviewCategories(res.corePreview.categoryCount);
      setPreviewElements(res.corePreview.elementCount);
    });
    void loadPmOptions("");
  }, [open, loadPmOptions]);

  useEffect(() => {
    if (!open) return;
    const ids = [...selectedModuleIds];
    void getProjectWizardPreview(ids).then((res) => {
      if (res.ok) {
        setPreviewCategories(res.preview.categoryCount);
        setPreviewElements(res.preview.elementCount);
      }
    });
  }, [open, selectedModuleIds]);

  useEffect(() => {
    if (!open || !pmSearch.trim()) return;
    const t = window.setTimeout(() => {
      void loadPmOptions(pmSearch);
    }, 300);
    return () => window.clearTimeout(t);
  }, [open, pmSearch, loadPmOptions]);

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
    !catalogError &&
    !loadingCatalog &&
    codeTouched &&
    !codeError &&
    !codeChecking &&
    !nameError &&
    name.trim().length > 0 &&
    code.trim().length >= 2 &&
    !pending;

  const toggleModule = (id: string) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!canSubmit) return;

    startTransition(async () => {
      const res = await createProjectFromTemplate({
        code: normalizeProjectCodeInput(code),
        name: name.trim(),
        phase,
        assetType,
        pmActivoId,
        selectedModuleIds: [...selectedModuleIds],
      });
      if (!res.ok) {
        setSubmitError(res.error);
        if (res.status === 409) {
          setCodeError("Ya existe un proyecto con este código");
        }
        return;
      }
      onCreated(res.projectCode);
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="actas-create-project-title"
        className="flex max-h-[min(92vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-subtle/60 bg-card shadow-xl"
      >
        <header className="shrink-0 border-b border-subtle/40 px-6 py-4">
          <h2
            id="actas-create-project-title"
            className="text-lg font-semibold text-text-primary"
          >
            Nuevo proyecto
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Alta desde el catálogo maestro
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="space-y-8 px-6 py-5">
            {catalogError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {catalogError}
              </p>
            ) : null}

            {submitError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </p>
            ) : null}

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Información del proyecto
              </h3>

              <div>
                <label htmlFor="actas-new-code" className={labelClass}>
                  Código
                </label>
                <input
                  id="actas-new-code"
                  className={`${inputClass} mt-1 font-mono uppercase ${
                    codeError ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""
                  }`}
                  value={code}
                  maxLength={10}
                  autoComplete="off"
                  disabled={!!catalogError || loadingCatalog}
                  onChange={(e) => {
                    setCode(normalizeProjectCodeInput(e.target.value));
                    if (codeTouched) setCodeError(null);
                  }}
                  onBlur={() => void validateCodeOnBlur()}
                />
                <p className={helperClass}>
                  Identificador corto, ej. CASA77, VBARE2
                </p>
                {codeChecking ? (
                  <p className="mt-1 text-xs text-text-muted">Comprobando código…</p>
                ) : null}
                {codeError ? (
                  <p className="mt-1 text-xs text-red-600">{codeError}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="actas-new-name" className={labelClass}>
                  Nombre
                </label>
                <input
                  id="actas-new-name"
                  className={`${inputClass} mt-1 ${
                    nameError && name.trim() ? "border-red-400" : ""
                  }`}
                  value={name}
                  maxLength={120}
                  disabled={!!catalogError || loadingCatalog}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className={helperClass}>
                  Nombre completo, ej. Calle Goya 8 - Edificio Norte
                </p>
                {nameError && name.length > 0 ? (
                  <p className="mt-1 text-xs text-red-600">{nameError}</p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="actas-new-phase" className={labelClass}>
                    Fase
                  </label>
                  <select
                    id="actas-new-phase"
                    className={`${inputClass} mt-1`}
                    value={phase}
                    disabled={!!catalogError || loadingCatalog}
                    onChange={(e) => setPhase(e.target.value as ProjectPhase)}
                  >
                    {WIZARD_PROJECT_PHASES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="actas-new-asset" className={labelClass}>
                    Tipo de activo
                  </label>
                  <select
                    id="actas-new-asset"
                    className={`${inputClass} mt-1`}
                    value={assetType}
                    disabled={!!catalogError || loadingCatalog}
                    onChange={(e) => setAssetType(e.target.value)}
                  >
                    {WIZARD_ASSET_TYPES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="actas-new-pm" className={labelClass}>
                  Activo PM (opcional)
                </label>
                <input
                  id="actas-new-pm"
                  type="search"
                  className={`${inputClass} mt-1`}
                  placeholder="Buscar por código o nombre…"
                  value={pmSearch}
                  disabled={!!catalogError || loadingCatalog}
                  onChange={(e) => setPmSearch(e.target.value)}
                />
                <p className={helperClass}>
                  Vincula este proyecto a un activo de Portfolio Management si
                  aplica. Opcional.
                </p>
                {pmActivoId ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-text-primary">
                      {pmOptions.find((o) => o.id === pmActivoId)?.label ??
                        "Activo seleccionado"}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => {
                        setPmActivoId(null);
                        setPmSearch("");
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : null}
                {pmOptions.length > 0 && !pmActivoId ? (
                  <ul className="mt-2 max-h-32 overflow-y-auto rounded-md border border-subtle/50 bg-page text-sm">
                    {pmOptions.map((opt) => (
                      <li key={opt.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-icam-900/5"
                          onClick={() => {
                            setPmActivoId(opt.id);
                            setPmSearch(opt.label);
                            setPmOptions([]);
                          }}
                        >
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Estructura del proyecto
              </h3>
              <p className="text-sm text-text-muted">
                Se creará la estructura básica con las {coreCategoryCount}{" "}
                categorías principales y ~{coreElementCount} elementos del
                catálogo maestro.
              </p>

              <fieldset className="space-y-2" disabled={!!catalogError}>
                <legend className="text-sm font-medium text-text-primary">
                  Módulos opcionales a activar
                </legend>
                {modules.map((mod) => (
                  <label
                    key={mod.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-subtle/40 px-3 py-2.5 hover:bg-page"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedModuleIds.has(mod.id)}
                      onChange={() => toggleModule(mod.id)}
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-medium text-text-primary">
                        {mod.name}
                      </span>
                      <span className="ml-2 text-xs text-text-muted">
                        (+{mod.elementCount} elementos)
                      </span>
                      {mod.description ? (
                        <span className="mt-0.5 block text-xs text-text-muted">
                          {mod.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </fieldset>
            </section>

            <section className="rounded-md border border-icam-900/15 bg-icam-900/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-icam-900">Resumen</h3>
              <p className="mt-1 text-sm text-text-primary">
                Se crearán{" "}
                <strong>{previewCategories}</strong> categorías,{" "}
                <strong>{previewElements}</strong> elementos.
              </p>
            </section>
          </div>

          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-subtle/40 px-6 py-4">
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
              {pending ? "Creando…" : "Crear proyecto"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
