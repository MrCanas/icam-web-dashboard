"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { getActaView } from "@/modules/pm/actas/actions/get-acta-view";
import {
  ACTA_AUTHOR_NONE,
  authorKeysToIds,
  buildActaShareUrl,
  parseActaUrlState,
  resolveActaRangeBounds,
  type ActasActaUrlState,
} from "@/modules/pm/actas/logic/acta-url-state";
import { actaPdfFilename } from "@/modules/pm/actas/pdf/acta-pdf-types";
import { useActasBasePath } from "@/modules/pm/actas/ui/ActasBasePathContext";
import { formatActaRangeDate } from "@/modules/pm/actas/logic/actas-time";
import type {
  ActasActaRangePreset,
  ActasActaViewData,
} from "@/modules/pm/actas/types";

import { ActasActaCategoryBlock } from "./ActasActaCategoryBlock";

interface ActasActaTabProps {
  projectId: string;
  projectCode: string;
}

const RANGE_OPTIONS: { value: ActasActaRangePreset; label: string }[] = [
  { value: "week", label: "Última semana" },
  { value: "month", label: "Último mes" },
  { value: "quarter", label: "Último trimestre" },
  { value: "custom", label: "Personalizado" },
];

export function ActasActaTab({ projectId, projectCode }: ActasActaTabProps) {
  const basePath = useActasBasePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewData, setViewData] = useState<ActasActaViewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const urlState = useMemo(
    () => parseActaUrlState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const syncUrl = useCallback(
    (next: ActasActaUrlState) => {
      router.replace(buildActaShareUrl(projectCode, next, basePath), {
        scroll: false,
      });
    },
    [basePath, projectCode, router],
  );

  const loadView = useCallback(
    (state: ActasActaUrlState) => {
      const bounds = resolveActaRangeBounds(
        state.range,
        state.dateFrom,
        state.dateTo,
      );
      startTransition(async () => {
        setLoadError(null);
        const res = await getActaView({
          projectId,
          dateFrom: bounds.dateFrom,
          dateTo: bounds.dateTo,
          categoryIds:
            state.categoryIds.length > 0 ? state.categoryIds : undefined,
          authorIds: authorKeysToIds(state.authorKeys),
          onlyWithStatusChange: state.onlyWithStatusChange,
        });
        if (!res.ok) {
          setLoadError(res.error);
          setViewData(null);
          return;
        }
        setViewData(res.data);
      });
    },
    [projectId],
  );

  useEffect(() => {
    loadView(urlState);
  }, [urlState, loadView]);

  const updateState = (patch: Partial<ActasActaUrlState>) => {
    const next: ActasActaUrlState = { ...urlState, ...patch };
    if (patch.range && patch.range !== "custom") {
      const bounds = resolveActaRangeBounds(
        patch.range,
        next.dateFrom,
        next.dateTo,
      );
      next.dateFrom = bounds.dateFrom;
      next.dateTo = bounds.dateTo;
    }
    syncUrl(next);
  };

  const bounds = resolveActaRangeBounds(
    urlState.range,
    urlState.dateFrom,
    urlState.dateTo,
  );

  const helperText = `Mostrando entradas del ${formatActaRangeDate(bounds.dateFrom)} al ${formatActaRangeDate(bounds.dateTo)} (${viewData?.totalEntryCount ?? "…"} entradas)`;

  const toggleCategory = (id: string) => {
    const allIds = viewData?.availableCategories.map((c) => c.id) ?? [];
    const current =
      urlState.categoryIds.length > 0 ? urlState.categoryIds : allIds;
    const next = current.includes(id)
      ? current.filter((c) => c !== id)
      : [...current, id];
    updateState({
      categoryIds:
        next.length === allIds.length || next.length === 0 ? [] : next,
    });
  };

  const toggleAuthor = (key: string) => {
    const allKeys =
      viewData?.availableAuthors.map((a) =>
        a.id == null ? ACTA_AUTHOR_NONE : a.id,
      ) ?? [];
    const current =
      urlState.authorKeys.length > 0 ? urlState.authorKeys : allKeys;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    updateState({
      authorKeys:
        next.length === allKeys.length || next.length === 0 ? [] : next,
    });
  };

  const selectedCategoryIds =
    urlState.categoryIds.length > 0
      ? urlState.categoryIds
      : (viewData?.availableCategories.map((c) => c.id) ?? []);

  const selectedAuthorKeys =
    urlState.authorKeys.length > 0
      ? urlState.authorKeys
      : (viewData?.availableAuthors.map((a) =>
          a.id == null ? ACTA_AUTHOR_NONE : a.id,
        ) ?? []);

  const handleExportPdf = async () => {
    setExportError(null);
    setExportingPdf(true);
    try {
      const bounds = resolveActaRangeBounds(
        urlState.range,
        urlState.dateFrom,
        urlState.dateTo,
      );
      const res = await fetch(
        `/api/actas/projects/${encodeURIComponent(projectId)}/export-pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dateFrom: bounds.dateFrom,
            dateTo: bounds.dateTo,
            categoryIds:
              urlState.categoryIds.length > 0
                ? urlState.categoryIds
                : undefined,
            authorIds: authorKeysToIds(urlState.authorKeys),
            onlyWithStatusChange: urlState.onlyWithStatusChange,
          }),
        },
      );

      if (!res.ok) {
        let message = "No se pudo generar el PDF";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* respuesta no JSON */
        }
        setExportError(message);
        return;
      }

      const blob = await res.blob();
      const filename =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        actaPdfFilename(projectCode, bounds.dateFrom, bounds.dateTo);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Error de red al exportar el PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleShareLink = async () => {
    setCopyError(null);
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${buildActaShareUrl(projectCode, urlState, basePath)}`
        : buildActaShareUrl(projectCode, urlState, basePath);
    try {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      window.setTimeout(() => setShareToast(false), 3000);
    } catch {
      setCopyError("No se pudo copiar el enlace");
    }
  };

  return (
    <section
      className="bg-card rounded-b-lg border border-t-0 border-subtle/50 min-h-[320px]"
      aria-label="Vista de acta"
    >
      <header className="border-b border-subtle/40 p-4 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="acta-range" className="sr-only">
                  Rango de fechas
                </label>
                <select
                  id="acta-range"
                  value={urlState.range}
                  disabled={pending}
                  onChange={(e) =>
                    updateState({
                      range: e.target.value as ActasActaRangePreset,
                    })
                  }
                  className="min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30"
                >
                  {RANGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {urlState.range === "custom" ? (
                <>
                  <div>
                    <label
                      htmlFor="acta-from"
                      className="block text-xs text-text-muted mb-1"
                    >
                      Desde
                    </label>
                    <input
                      id="acta-from"
                      type="date"
                      value={urlState.dateFrom}
                      disabled={pending}
                      onChange={(e) =>
                        updateState({ dateFrom: e.target.value, range: "custom" })
                      }
                      className="min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="acta-to"
                      className="block text-xs text-text-muted mb-1"
                    >
                      Hasta
                    </label>
                    <input
                      id="acta-to"
                      type="date"
                      value={urlState.dateTo}
                      disabled={pending}
                      onChange={(e) =>
                        updateState({ dateTo: e.target.value, range: "custom" })
                      }
                      className="min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm"
                    />
                  </div>
                </>
              ) : null}
            </div>
            <p className="text-sm text-text-muted">{helperText}</p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={exportingPdf || pending}
              onClick={() => void handleExportPdf()}
              className="min-h-10 rounded-md border border-subtle/60 px-3 text-sm font-medium text-text-primary hover:bg-page disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingPdf ? "Generando…" : "Exportar PDF"}
            </button>
            <button
              type="button"
              onClick={() => void handleShareLink()}
              className="min-h-10 rounded-md border border-icam-900/30 bg-icam-900/5 px-3 text-sm font-medium text-icam-900 hover:bg-icam-900/10"
            >
              Compartir link
            </button>
          </div>
        </div>

        {copyError ? (
          <p className="text-xs text-red-600">{copyError}</p>
        ) : null}
        {exportError ? (
          <p className="text-xs text-red-600">{exportError}</p>
        ) : null}

        <div>
          <button
            type="button"
            className="text-sm font-medium text-icam-900 hover:underline"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen ? "▾" : "▸"} Filtros secundarios
          </button>

          {filtersOpen ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-text-muted">
                  Categorías
                </legend>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-subtle/40 p-2">
                  {(viewData?.availableCategories ?? []).map((cat) => (
                    <label
                      key={cat.id}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(cat.id)}
                        disabled={pending}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      <span className="line-clamp-2">{cat.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-text-muted">
                  Autor
                </legend>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border border-subtle/40 p-2">
                  {(viewData?.availableAuthors ?? []).length === 0 ? (
                    <p className="text-xs text-text-muted">
                      Sin autores en este rango
                    </p>
                  ) : (
                    viewData?.availableAuthors.map((author) => {
                      const key =
                        author.id == null ? ACTA_AUTHOR_NONE : author.id;
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedAuthorKeys.includes(key)}
                            disabled={pending}
                            onChange={() => toggleAuthor(key)}
                          />
                          <span>{author.label}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </fieldset>

              <fieldset className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={urlState.onlyWithStatusChange}
                    disabled={pending}
                    onChange={(e) =>
                      updateState({ onlyWithStatusChange: e.target.checked })
                    }
                  />
                  Solo entradas con cambio de estado
                </label>
              </fieldset>
            </div>
          ) : null}
        </div>
      </header>

      <div className="p-4 relative">
        {pending ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-card/60"
            aria-hidden
          >
            <span className="text-sm text-text-muted">Cargando acta…</span>
          </div>
        ) : null}

        {loadError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </p>
        ) : null}

        {!loadError && viewData && viewData.categories.length === 0 ? (
          <p className="rounded-md border border-dashed border-subtle/60 bg-page px-4 py-10 text-center text-sm text-text-muted">
            No hay actividad en este rango de fechas. Prueba con un rango más
            amplio.
          </p>
        ) : null}

        {viewData && viewData.categories.length > 0 ? (
          <div className="space-y-4">
            {viewData.categories.map((category) => (
              <ActasActaCategoryBlock
                key={category.id}
                category={category}
                projectCode={projectCode}
              />
            ))}
          </div>
        ) : null}
      </div>

      {shareToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm font-medium text-icam-900 shadow-lg"
          role="status"
        >
          Link copiado
        </div>
      ) : null}
    </section>
  );
}
