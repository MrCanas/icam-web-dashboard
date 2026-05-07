"use client";

import { DataComparisonPanel } from "@/components/data/DataComparisonPanel";
import type { PortfolioDiffResult } from "@/lib/portfolio-diff";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface PreviewStats {
  totalProyectos: number;
  activos: number;
  culminados: number;
  inversionTotal: number;
  gdvTotal: number;
}

interface PreviewProject {
  proyecto: string;
  situacion: string;
  tipo_proyecto: string;
  inversion_total: number | null;
}

interface PreviewBody {
  archivoNombre: string;
  stats: PreviewStats;
  warnings: string[];
  proyectos: PreviewProject[];
}

export function DataUpload() {
  const router = useRouter();
  const [rpcReady, setRpcReady] = useState<boolean | null>(null);
  const [rpcStatusError, setRpcStatusError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function checkRpc() {
      try {
        const res = await fetch("/api/replace-proyectos-status", { credentials: "same-origin" });
        const json = (await res.json()) as {
          replace_proyectos_visible?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setRpcReady(false);
          setRpcStatusError(json.error ?? "No se pudo comprobar el estado del RPC.");
          return;
        }
        setRpcReady(Boolean(json.replace_proyectos_visible));
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
  const [comparison, setComparison] = useState<PortfolioDiffResult | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);

  const resetFlow = useCallback(() => {
    setFile(null);
    setPreview(null);
    setComparison(null);
    setComparisonError(null);
    setError(null);
    setSuccessMsg(null);
    setUnderstood(false);
  }, []);

  const runPreview = async (f: File) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setPreview(null);
    setComparison(null);
    setComparisonError(null);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await fetch("/api/upload-excel", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        preview?: PreviewBody;
        error?: string;
        comparison?: PortfolioDiffResult | null;
        comparisonError?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Error al procesar el archivo");
        return;
      }
      if (json.preview) setPreview(json.preview);
      setComparison(json.comparison ?? null);
      setComparisonError(json.comparisonError ?? null);
    } catch {
      setError("No se pudo contactar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const onFileChosen = (f: File | undefined) => {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
      setError("Solo se admiten archivos .xlsx o .xlsm");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("El archivo supera 50 MB.");
      return;
    }
    setFile(f);
    setPreview(null);
    setComparison(null);
    setComparisonError(null);
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
      const res = await fetch("/api/upload-excel?confirm=true", {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        duracion_ms?: number;
        preview?: PreviewBody;
      };
      if (!res.ok) {
        setError(json.error ?? "Error al guardar");
        return;
      }
      const ms = json.duracion_ms ?? 0;
      setSuccessMsg(`Datos actualizados correctamente (${(ms / 1000).toFixed(1)} s).`);
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
          <p className="font-medium">Función replace_proyectos no detectada en la API de Supabase</p>
          <p className="mt-1 text-amber-900/90">
            Ejecuta en el SQL Editor el archivo{" "}
            <code className="rounded bg-amber-100/80 px-1">scripts/supabase/replace_proyectos.sql</code>{" "}
            (proyecto correcto), incluida la línea NOTIFY al final. Luego pulsa &quot;Reintentar comprobación&quot;.
          </p>
          {rpcStatusError ? <p className="mt-2 text-xs text-amber-900/80">{rpcStatusError}</p> : null}
          <button
            type="button"
            className="mt-3 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100"
            onClick={() => {
              setRpcReady(null);
              setRpcStatusError(null);
              void fetch("/api/replace-proyectos-status", { credentials: "same-origin" })
                .then(async (res) => {
                  const json = (await res.json()) as {
                    replace_proyectos_visible?: boolean;
                    error?: string;
                  };
                  if (!res.ok) {
                    setRpcReady(false);
                    setRpcStatusError(json.error ?? "Error");
                    return;
                  }
                  setRpcReady(Boolean(json.replace_proyectos_visible));
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
          RPC <code className="rounded bg-green-100/80 px-1">replace_proyectos</code> visible para PostgREST.
        </p>
      ) : null}

      <div className="bg-card rounded-lg border border-subtle p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-icam-900">Actualizar datos del portfolio</h2>
        <p className="mt-1 text-sm text-text-muted">
          Sube el Excel maestro (.xlsm) para actualizar todos los proyectos en Supabase.
        </p>

        <div
          className={`mt-4 flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition ${
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
            input.accept = ".xlsx,.xlsm";
            input.onchange = () => onFileChosen(input.files?.[0]);
            input.click();
          }}
        >
          <p className="text-center text-sm text-text-body">
            Arrastra el archivo aquí o haz clic para seleccionar
          </p>
          <p className="mt-1 text-xs text-text-muted">.xlsx / .xlsm · máx. 50 MB</p>
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
            <li>Proyectos: {preview.stats.totalProyectos}</li>
            <li>Activos / culminados: {preview.stats.activos} / {preview.stats.culminados}</li>
            <li>Inversión total (suma): {preview.stats.inversionTotal.toLocaleString("es-ES")}</li>
            <li>GDV total (suma): {preview.stats.gdvTotal.toLocaleString("es-ES")}</li>
          </ul>

          <DataComparisonPanel comparison={comparison} comparisonError={comparisonError} />

          {preview.warnings.length > 0 ? (
            <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium">Avisos</p>
              <ul className="mt-1 list-inside list-disc">
                {preview.warnings.map((w, i) => (
                  <li key={`${i}-${w.slice(0, 40)}`}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 max-h-56 overflow-auto rounded border border-subtle text-sm">
            <table className="min-w-full border-collapse text-left">
              <thead className="sticky top-0 bg-subtle/80 text-xs uppercase text-text-muted">
                <tr>
                  <th className="px-2 py-1">Proyecto</th>
                  <th className="px-2 py-1">Situación</th>
                  <th className="px-2 py-1">Tipo</th>
                  <th className="px-2 py-1">Inversión</th>
                </tr>
              </thead>
              <tbody>
                {preview.proyectos.map((p) => (
                  <tr key={p.proyecto} className="border-t border-subtle">
                    <td className="px-2 py-1 font-medium">{p.proyecto}</td>
                    <td className="px-2 py-1">{p.situacion}</td>
                    <td className="px-2 py-1">{p.tipo_proyecto}</td>
                    <td className="px-2 py-1">
                      {p.inversion_total != null ? p.inversion_total.toLocaleString("es-ES") : "—"}
                    </td>
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
            <span>Entiendo que esto reemplazará todos los datos actuales del portfolio en Supabase.</span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!understood || confirming}
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
