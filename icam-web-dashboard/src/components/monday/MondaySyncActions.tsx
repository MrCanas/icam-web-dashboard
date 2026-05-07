"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface SyncLogRecord {
  id: string;
  estado: string;
  fecha?: string | null;
  created_at?: string | null;
}

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface MondaySyncActionsProps {
  initialLatestLog: SyncLogRecord | null;
}

function formatDateTime(input?: string | null): string {
  if (!input) return "Sin sincronizar";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "Sin sincronizar";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

export function MondaySyncActions({ initialLatestLog }: MondaySyncActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [latestLog, setLatestLog] = useState<SyncLogRecord | null>(initialLatestLog);

  async function handleSync() {
    try {
      setStatus("syncing");
      const response = await fetch("/api/monday/sync", { method: "POST" });
      if (!response.ok) {
        throw new Error("No se pudo iniciar la sincronización");
      }

      let done = false;
      for (let i = 0; i < 120 && !done; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const poll = await fetch("/api/monday/sync-logs?limit=1", { cache: "no-store" });
        if (!poll.ok) continue;
        const payload = (await poll.json()) as { logs?: SyncLogRecord[] };
        const current = payload.logs?.[0] ?? null;
        setLatestLog(current);
        const estado = current?.estado;
        if (estado && estado !== "en_proceso") {
          done = true;
          if (estado === "completado" || estado === "completado_con_errores") {
            setStatus("success");
            router.refresh();
            setTimeout(() => setStatus("idle"), 3000);
          } else {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 5000);
          }
        }
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
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
          : "Sincronizar";

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

        <Link
          href="/dashboard/monday/logs"
          className="h-10 px-4 rounded-md border border-subtle text-icam-900 text-sm font-medium inline-flex items-center gap-2 hover:bg-subtle/70 transition"
        >
          <span aria-hidden>📋</span>
          Ver Logs
        </Link>
      </div>

      <p className="mt-2 text-xs text-text-muted">
        Última sincronización: {formatDateTime(latestLog?.fecha ?? latestLog?.created_at)}
      </p>
    </section>
  );
}

