"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Subida manual del maestro corporativo, en dos pasos: primero se parsea y se
 * enseña qué va a cambiar, y solo entonces se confirma el reemplazo.
 *
 * No reutiliza `DataUpload`: aquel está cableado a la previsualización del
 * maestro de vehículos (proyectos, situación, tipo, inversión) y a la
 * comprobación de su RPC. Aquí lo que hay que enseñar antes de confirmar es
 * otra cosa —cuántos periodos por sociedad y por tipo, y qué filas cambian—, y
 * parametrizar aquel componente para servir a los dos habría dejado un tercer
 * componente más difícil de leer que estos dos.
 */

interface PreviewBody {
  archivoNombre: string;
  stats: {
    totalFilas: number;
    porTipoPeriodo: Record<string, number>;
    porSociedad: Record<string, number>;
    ultimosPeriodosReales: string[];
    columnasReconocidas: number;
  };
  warnings: string[];
  diccionario: number;
  notas: number;
}

interface ComparisonBody {
  nuevos: string[];
  eliminados: string[];
  modificados: { id: string }[];
  sinCambios: number;
}

interface RespuestaUpload {
  success?: boolean;
  error?: string;
  preview?: PreviewBody;
  comparison?: ComparisonBody | null;
  comparisonError?: string;
}

export function CorporativoUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewBody | null>(null);
  const [comparison, setComparison] = useState<ComparisonBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(confirmar: boolean) {
    if (!file) return;
    setCargando(true);
    setError(null);
    setOk(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(
        `/api/upload-corporativo-excel${confirmar ? "?confirm=true" : ""}`,
        { method: "POST", body, credentials: "same-origin" },
      );
      const json = (await res.json()) as RespuestaUpload;

      if (!res.ok || json.success !== true) {
        throw new Error(json.error ?? "No se pudo procesar el Excel.");
      }

      setPreview(json.preview ?? null);
      setComparison(json.comparison ?? null);

      if (confirmar) {
        setOk(`${json.preview?.stats.totalFilas ?? 0} periodos cargados.`);
        setFile(null);
        setPreview(null);
        setComparison(null);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir el Excel.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="rounded-lg border border-subtle bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-subtle px-4 text-sm font-medium text-text-body hover:bg-page/80">
          <input
            type="file"
            accept=".xlsx,.xlsm,.xlsb"
            className="sr-only"
            onChange={(ev) => {
              setFile(ev.target.files?.[0] ?? null);
              setPreview(null);
              setComparison(null);
              setError(null);
              setOk(null);
            }}
          />
          Elegir Excel…
        </label>
        <span className="truncate text-sm text-text-muted">
          {file ? file.name : "Ningún archivo seleccionado"}
        </span>
        <button
          type="button"
          disabled={!file || cargando}
          onClick={() => void enviar(false)}
          className="h-10 shrink-0 rounded-md bg-icam-900 px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cargando && !preview ? "Analizando…" : "Analizar"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#EF4444]">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p role="status" className="mt-3 text-sm text-text-muted">
          {ok}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-4 space-y-2 border-t border-subtle pt-4 text-sm">
          <p className="font-medium text-text-primary">{preview.archivoNombre}</p>
          <p className="text-text-body">
            {preview.stats.totalFilas} periodos · {preview.stats.columnasReconocidas}/46 columnas
            reconocidas · {preview.diccionario} entradas de glosario · {preview.notas} notas
          </p>
          <p className="text-text-muted">
            Por tipo:{" "}
            {Object.entries(preview.stats.porTipoPeriodo)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
            {" — "}
            Por sociedad:{" "}
            {Object.entries(preview.stats.porSociedad)
              .map(([k, v]) => `${k} ${v}`)
              .join(" · ")}
          </p>
          <p className="text-text-muted">
            Último cierre: {preview.stats.ultimosPeriodosReales.join(" · ") || "—"}
          </p>

          {comparison ? (
            <p className="text-text-body">
              Cambios: <b>{comparison.nuevos.length}</b> nuevos ·{" "}
              <b>{comparison.modificados.length}</b> modificados ·{" "}
              <b>{comparison.eliminados.length}</b> que desaparecen ·{" "}
              {comparison.sinCambios} sin cambios.
            </p>
          ) : null}

          {preview.warnings.length > 0 ? (
            <details className="text-text-muted">
              <summary className="cursor-pointer">
                {preview.warnings.length} aviso(s) del parseo
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="text-xs text-text-muted">
            Confirmar <strong>reemplaza la tabla de periodos corporativos entera</strong>. No es
            aditivo.
          </p>
          <button
            type="button"
            disabled={cargando}
            onClick={() => void enviar(true)}
            className="h-10 rounded-md bg-icam-gold px-4 text-sm font-medium text-white transition hover:bg-icam-gold-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? "Cargando…" : "Confirmar y reemplazar"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
