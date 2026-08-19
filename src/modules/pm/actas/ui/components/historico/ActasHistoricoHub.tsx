"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getHistoricoElementOptions } from "@/modules/pm/actas/actions/get-historico-element";
import { actasProjectElementHistoricoPath } from "@/modules/pm/actas/logic/actas-paths";
import type { ActasHistoricoElementOption } from "@/modules/pm/actas/types";
import { useActasBasePath } from "@/modules/pm/actas/ui/ActasBasePathContext";

interface ActasHistoricoHubProps {
  projectId: string;
  projectCode: string;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function ActasHistoricoHub({
  projectId,
  projectCode,
}: ActasHistoricoHubProps) {
  const basePath = useActasBasePath();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ActasHistoricoElementOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getHistoricoElementOptions(projectId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOptions(res.options);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options.slice(0, 50);
    return options
      .filter((opt) => {
        const haystack = `${opt.name} ${opt.categoryLabel}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 50);
  }, [options, query]);

  const selectElement = (id: string) => {
    setOpen(false);
    router.push(actasProjectElementHistoricoPath(projectCode, id, { basePath }));
  };

  return (
    <section className="bg-card rounded-b-lg border border-t-0 border-subtle/50 p-6 min-h-[320px]">
      <h2 className="text-lg font-semibold text-text-primary">
        Histórico de elemento
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Selecciona un elemento para ver su evolución completa.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="relative mt-6 max-w-xl">
        <label htmlFor="historico-element-search" className="sr-only">
          Buscar elemento
        </label>
        <input
          id="historico-element-search"
          type="search"
          value={query}
          disabled={loading}
          placeholder={
            loading ? "Cargando elementos…" : "Buscar por nombre de elemento…"
          }
          className="w-full min-h-11 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />

        {open && !loading && filtered.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-subtle/60 bg-card py-1 shadow-lg"
            role="listbox"
          >
            {filtered.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full px-3 py-2.5 text-left hover:bg-page"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectElement(opt.id)}
                >
                  <span className="block text-sm font-medium text-text-primary">
                    {opt.name}
                    {opt.archived ? (
                      <span className="ml-2 text-xs font-normal text-amber-800">
                        (archivado)
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-text-muted mt-0.5">
                    {opt.categoryLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {open && !loading && query && filtered.length === 0 ? (
          <p className="absolute z-20 mt-1 w-full rounded-md border border-subtle/60 bg-card px-3 py-2 text-sm text-text-muted shadow-lg">
            Ningún elemento coincide con la búsqueda.
          </p>
        ) : null}
      </div>

      {!loading && options.length === 0 && !error ? (
        <p className="mt-6 text-sm text-text-muted">
          Este proyecto no tiene elementos todavía.
        </p>
      ) : null}

      <p className="mt-8 text-xs text-text-muted">
        También puedes abrir el histórico desde el tab Operativo con{" "}
        <span className="font-medium">Ver histórico completo →</span> en cada
        elemento.
      </p>
    </section>
  );
}
