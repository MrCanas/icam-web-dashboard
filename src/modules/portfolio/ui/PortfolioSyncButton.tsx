"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SyncStatus = "idle" | "syncing" | "success" | "error";

/** Respuesta de /api/cron/portfolio-sync (éxito, salto del gate horario o error). */
interface SyncResponse {
  ok?: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  sawForce?: boolean;
  isAdmin?: boolean;
  archivo?: string;
  numProyectos?: number;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

export function PortfolioSyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("syncing");
    setMessage(null);

    try {
      const response = await fetch("/api/cron/portfolio-sync?force=true", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as SyncResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "No se pudo sincronizar desde SharePoint.");
      }

      // El gate horario no debería saltar con force, pero si lo hace decimos por qué.
      if (payload.skipped) {
        throw new Error(
          `${payload.reason ?? "Sincronización omitida."} (force=${payload.sawForce}, admin=${payload.isAdmin})`,
        );
      }

      setStatus("success");
      setMessage(
        `${payload.archivo ?? "Maestro"} — ${payload.numProyectos ?? 0} proyectos cargados.`,
      );
      router.refresh();
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Error al sincronizar.");
      setTimeout(() => setStatus("idle"), 8000);
    }
  }

  const buttonClass = useMemo(() => {
    if (status === "success") return "bg-[#22C55E] text-white";
    if (status === "error") return "bg-[#EF4444] text-white";
    return "bg-[#1E2A56] text-white";
  }, [status]);

  const buttonLabel =
    status === "syncing"
      ? "Sincronizando..."
      : status === "success"
        ? "Sincronizado ✓"
        : status === "error"
          ? "Error al sincronizar"
          : "Sincronizar ahora";

  return (
    <section className="bg-card rounded-lg border border-subtle shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={status === "syncing"}
          className={`h-10 px-4 rounded-md text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 ${buttonClass}`}
        >
          {status === "syncing" ? <Spinner /> : <span aria-hidden>↻</span>}
          {buttonLabel}
        </button>

        <p className="text-xs text-text-muted">
          Descarga el maestro más reciente de SharePoint y <strong>reemplaza la tabla de
          proyectos entera</strong>. No es aditivo.
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className={`mt-3 text-sm ${status === "error" ? "text-[#EF4444]" : "text-text-muted"}`}
        >
          {message}
        </p>
      ) : (
        <p className="mt-3 text-xs text-text-muted">
          Automático: miércoles a las 10:00. Úsalo solo si necesitas los datos antes.
        </p>
      )}
    </section>
  );
}
