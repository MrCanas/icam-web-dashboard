"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type SyncStatus = "idle" | "syncing" | "success" | "error";

/** Respuesta de los crones de maestro: éxito, salto de la puerta horaria o error. */
interface SyncResponse {
  ok?: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
  sawForce?: boolean;
  isAdmin?: boolean;
  archivo?: string;
  numProyectos?: number;
  numFilas?: number;
}

export interface MaestroSyncButtonProps {
  /** Ruta del cron, sin la query: se le añade `?force=true`. */
  endpoint: string;
  /** Qué reemplaza la sincronización. Se avisa de que NO es aditiva. */
  descripcion: string;
  /** Nombre de lo que se cuenta al terminar: «proyectos», «periodos»… */
  unidad: string;
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

/**
 * Botón de «sincronizar ahora» de la pestaña Datos, compartido por los dos
 * maestros. Llama al cron con `?force=true`, que salta la puerta horaria pero no
 * la autorización: quien lo pulsa tiene que ser admin de la zona.
 *
 * Está parametrizado en vez de duplicado porque lo único que cambia entre los
 * dos maestros es a qué ruta llama y cómo se llama lo que cuenta; toda la
 * mecánica de estados, el aviso de que el reemplazo no es aditivo y el trato del
 * `skipped` es idéntica y conviene que siga siéndolo.
 */
export function MaestroSyncButton({ endpoint, descripcion, unidad }: MaestroSyncButtonProps) {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("syncing");
    setMessage(null);

    try {
      const response = await fetch(`${endpoint}?force=true`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as SyncResponse;

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error ?? "No se pudo sincronizar desde SharePoint.");
      }

      // La puerta horaria no debería saltar con force, pero si lo hace decimos por qué.
      if (payload.skipped) {
        throw new Error(
          `${payload.reason ?? "Sincronización omitida."} (force=${payload.sawForce}, admin=${payload.isAdmin})`,
        );
      }

      const cuantos = payload.numFilas ?? payload.numProyectos ?? 0;
      setStatus("success");
      setMessage(`${payload.archivo ?? "Maestro"} — ${cuantos} ${unidad} cargados.`);
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
    <section className="rounded-lg border border-subtle bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={status === "syncing"}
          className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
        >
          {status === "syncing" ? <Spinner /> : <span aria-hidden>↻</span>}
          {buttonLabel}
        </button>

        <p className="text-xs text-text-muted">
          Descarga el maestro más reciente de SharePoint y{" "}
          <strong>reemplaza {descripcion} entera</strong>. No es aditivo.
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
