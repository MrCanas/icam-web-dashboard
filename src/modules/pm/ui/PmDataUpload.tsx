"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface PreviewStats {
  filasLeidas: number;
  filasValidas: number;
  activosDistintos: number;
  columnasSnapshot: number;
}

interface PreviewMuestraRow {
  id_activo: string;
  hito: string;
  orden_hito: number;
  fecha_actual: string | null;
  snapshots: Record<string, string | null>;
}

interface PreviewBody {
  archivoNombre: string;
  stats: PreviewStats;
  warnings: string[];
  activos: string[];
  muestraHitos: PreviewMuestraRow[];
}

export function PmDataUpload() {
  const router = useRouter();
  const [rpcReady, setRpcReady] = useState<boolean | null>(null);
  const [rpcStatusError, setRpcStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkRpc() {
      try {
        const res = await fetch("/api/replace-pm-portfolio-status", { credentials: "same-origin" });
        const json = (await res.json()) as {
          replace_pm_portfolio_visible?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setRpcReady(false);
          setRpcStatusError(json.error ?? "No se pudo comprobar el estado del RPC.");
          return;
        }
        setRpcReady(Boolean(json.replace_pm_portfolio_visible));
        setRpcStatusError(null);
      } catch {
        if (!cancelled) {
          setRpcReady(false);
          setRpcStatusError("No se pudo comprobar el estado del RPC.");
        }
      }
    }
    void checkRpc();
    return () => {
      cancelled = true;
    };
  }, []);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewBody | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);

  const resetFlow = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSuccessMsg(null);
    setUnderstood(false);
  }, []);

  const runPreview = async (f: File) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await fetch("/api/upload-pm-excel", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        preview?: PreviewBody;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Error al procesar el archivo");
        return;
      }
      if (json.preview) setPreview(json.preview);
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const onFileChosen = (f: File | undefined) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsb") && !lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
      setError("Solo se admiten .xlsb, .xlsx o .xlsm");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("El archivo supera 50 MB.");
      return;
    }
    setFile(f);
    setPreview(null);
    setError(null);
    setSuccessMsg(null);
  };

  const runConfirm = async () => {
    if (!file || !preview) return;
    setConfirming(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-pm-excel?confirm=true", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        duracion_ms?: number;
      };
      if (!res.ok) {
        setError(json.error ?? "Error al guardar");
        return;
      }
      const ms = json.duracion_ms ?? 0;
      setSuccessMsg(`Datos PM actualizados (${(ms / 1000).toFixed(1)} s).`);
      setPreview(null);
      setFile(null);
      setUnderstood(false);
      router.refresh();
    } catch {
      setError("No se pudo completar la actualización.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-5">
      {rpcReady === false ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Función replace_pm_portfolio no detectada en Supabase</p>
          <p className="mt-1 text-amber-900/90">
            Ejecuta{" "}
            <code className="rounded bg-amber-100/80 px-1">scripts/supabase/pm_schema.sql</code> y{" "}
            <code className="rounded bg-amber-100/80 px-1">scripts/supabase/replace_pm_portfolio.sql</code>{" "}
            en el SQL Editor. Luego pulsa «Reintentar comprobación».
          </p>
          {rpcStatusError ? <p className="mt-2 text-xs text-amber-900/80">{rpcStatusError}</p> : null}
          <button
            type="button"
            className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100"
            onClick={() => {
              setRpcReady(null);
              setRpcStatusError(null);
              void fetch("/api/replace-pm-portfolio-status", { credentials: "same-origin" })
                .then(async (res) => {
                  const json = (await res.json()) as {
                    replace_pm_portfolio_visible?: boolean;
                    error?: string;
                  };
                  if (!res.ok) {
                    setRpcReady(false);
                    setRpcStatusError(json.error ?? "Error");
                    return;
                  }
                  setRpcReady(Boolean(json.replace_pm_portfolio_visible));
                  setRpcStatusError(null);
                })
                .catch(() => {
                  setRpcReady(false);
                  setRpcStatusError("Error de red");
                });
            }}
          >
            Reintentar comprobación
          </button>
        </div>
      ) : null}
      {rpcReady === true ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900" role="status">
          RPC <code className="rounded bg-green-100/80 px-1">replace_pm_portfolio</code> visible para PostgREST.
        </p>
      ) : null}

      <div className="bg-card rounded-lg border border-subtle p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-icam-900">Importar seguimiento PM</h2>
        <p className="mt-1 text-sm text-text-muted">
          Archivo Excel con hoja <strong>OVERVIEW</strong> (.xlsb recomendado). Sustituye todo el portfolio PM en
          Supabase al confirmar.
        </p>

        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          <p className="font-medium">Vía de rescate — ya no es la forma normal de actualizar PM</p>
          <p className="mt-1 leading-snug text-red-900/90">
            Los hitos se editan en{" "}
            <a href="/dashboard/pm/planificacion" className="underline">
              PM → Planificación
            </a>
            . Esta importación <strong>borra las tres tablas</strong> y se lleva por
            delante todo lo editado ahí y <strong>el histórico completo de
            trimestres congelados</strong>, no solo lo que traiga el Excel.
          </p>
          <p className="mt-1 leading-snug text-red-900/90">
            Después hay que reejecutar <code className="text-xs">npm run pm:backfill-planificacion</code>:
            el reemplazo no conoce el catálogo de hitos ni el orden de proyectos y
            los deja sin asignar.
          </p>
        </div>

        <div
          className={`mt-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition ${
            dragOver ? "border-icam-gold bg-icam-gold/5" : "border-subtle hover:border-icam-gold/60"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFileChosen(e.dataTransfer.files?.[0]);
          }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsb,.xlsx,.xlsm";
            input.onchange = () => onFileChosen(input.files?.[0]);
            input.click();
          }}
        >
          <p className="text-center text-sm text-text-body">Arrastra aquí o haz clic para seleccionar</p>
          <p className="mt-1 text-xs text-text-muted">.xlsb / .xlsx / .xlsm · máx. 50 MB</p>
        </div>

        {file ? (
          <p className="mt-3 text-sm text-text-body">
            <span className="font-medium">{file.name}</span> · {(file.size / 1024).toFixed(1)} KB
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!file || loading}
            onClick={() => file && runPreview(file)}
            className="rounded-md bg-icam-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-icam-800 disabled:opacity-50"
          >
            {loading ? "Analizando…" : "Analizar archivo"}
          </button>
          <button
            type="button"
            onClick={resetFlow}
            className="rounded-md border border-subtle px-4 py-2 text-sm text-icam-900 hover:bg-subtle/80"
          >
            Reiniciar
          </button>
        </div>

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {successMsg ? (
          <p className="mt-4 text-sm text-green-600" role="status">
            {successMsg}
          </p>
        ) : null}
      </div>

      {preview ? (
        <div className="bg-card rounded-lg border border-subtle p-5 shadow-sm">
          <h3 className="text-base font-semibold text-icam-900">Vista previa</h3>
          <p className="mt-1 text-sm text-text-muted">{preview.archivoNombre}</p>
          <ul className="mt-3 grid gap-2 text-sm text-text-body sm:grid-cols-2">
            <li>Filas leídas / válidas: {preview.stats.filasLeidas} / {preview.stats.filasValidas}</li>
            <li>Activos distintos: {preview.stats.activosDistintos}</li>
            <li>Columnas snapshot detectadas: {preview.stats.columnasSnapshot}</li>
          </ul>

          {preview.warnings.length > 0 ? (
            <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Avisos</p>
              <ul className="mt-1 list-inside list-disc max-h-40 overflow-auto">
                {preview.warnings.map((w, i) => (
                  <li key={`${i}-${w.slice(0, 48)}`}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-text-muted">
            Activos: {preview.activos.length ? preview.activos.join(", ") : "—"}
          </p>

          <div className="mt-4 max-h-64 overflow-auto rounded border border-subtle text-xs">
            <table className="min-w-full border-collapse text-left">
              <thead className="sticky top-0 bg-subtle/80 text-[10px] uppercase text-text-muted">
                <tr>
                  <th className="px-2 py-1">Activo</th>
                  <th className="px-2 py-1">Hito</th>
                  <th className="px-2 py-1">Orden</th>
                  <th className="px-2 py-1">Fecha actual</th>
                  <th className="px-2 py-1">Snapshots (keys)</th>
                </tr>
              </thead>
              <tbody>
                {preview.muestraHitos.map((r, idx) => (
                  <tr key={`${r.id_activo}-${r.orden_hito}-${idx}`} className="border-t border-subtle">
                    <td className="px-2 py-1 font-medium">{r.id_activo}</td>
                    <td className="px-2 py-1">{r.hito}</td>
                    <td className="px-2 py-1">{r.orden_hito}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.fecha_actual ?? "—"}</td>
                    <td className="px-2 py-1">{Object.keys(r.snapshots).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-text-body">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-1"
            />
            <span>
              Entiendo que esto borrará todos los datos PM de Supabase, incluidos
              los trimestres congelados y lo editado en Planificación, y que tendré
              que reejecutar el backfill después.
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!understood || confirming || preview.stats.filasValidas === 0}
              onClick={runConfirm}
              className="rounded-md bg-icam-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-icam-800 disabled:opacity-50"
            >
              {confirming ? "Guardando…" : "Confirmar y actualizar"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
