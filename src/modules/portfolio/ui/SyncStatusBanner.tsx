import { listUploadLogs } from "@/modules/portfolio/data/uploadLogsRepository";
import type { UserContext } from "@/lib/auth/currentUser";

/** A partir de aquí, la última carga buena se considera vieja. El cron es semanal. */
const DIAS_PARA_CONSIDERARLO_RANCIO = 10;

interface UltimaCarga {
  fecha: string;
  estado: string;
  archivo: string;
  detalle: unknown;
}

function diasDesde(iso: string): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function errorDe(detalle: unknown): string | null {
  if (detalle && typeof detalle === "object" && "error" in detalle) {
    const e = (detalle as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return null;
}

/**
 * Avisa en la pestaña Datos cuando la carga del maestro no está sana: o la última
 * intentona falló, o la última buena es demasiado vieja para un cron semanal.
 *
 * Existe porque el cron falló cuatro miércoles seguidos dejando su error en
 * `upload_logs` sin que nadie lo viera. El correo de `logDownloadError` avisa en
 * caliente; esto lo hace visible al entrar, que es donde se mira.
 *
 * Server Component: lee con el cliente de servidor, igual que el resto de la página.
 */
export async function SyncStatusBanner({ ctx }: { ctx: UserContext }) {
  const { data, error } = await listUploadLogs(ctx, 20);
  if (error || !data?.length) return null;

  const filas = data as unknown as UltimaCarga[];
  const ultima = filas[0];
  const ultimaBuena = filas.find((f) => f.estado === "completado");

  const fallo = ultima.estado === "error";
  const diasBuena = ultimaBuena ? diasDesde(ultimaBuena.fecha) : null;
  const rancia = diasBuena !== null && diasBuena > DIAS_PARA_CONSIDERARLO_RANCIO;

  if (!fallo && !rancia) return null;

  const msg = errorDe(ultima.detalle);
  const fallosSeguidos = (() => {
    let n = 0;
    for (const f of filas) {
      if (f.estado === "completado") break;
      if (f.estado === "error") n += 1;
    }
    return n;
  })();

  return (
    <section
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 sm:p-4 text-sm text-amber-900 space-y-1"
    >
      <p className="font-semibold">
        {fallo
          ? `La última sincronización del maestro falló${fallosSeguidos > 1 ? ` (${fallosSeguidos} seguidas)` : ""}.`
          : "El maestro lleva sin actualizarse más de lo previsto."}
      </p>
      {ultimaBuena ? (
        <p>
          Última carga correcta: <b>{ultimaBuena.archivo}</b>
          {diasBuena !== null ? `, hace ${diasBuena} día${diasBuena === 1 ? "" : "s"}` : ""}. El
          portfolio sigue mostrando esos datos.
        </p>
      ) : (
        <p>No consta ninguna carga correcta.</p>
      )}
      {msg ? <p className="font-mono text-xs break-words">{msg}</p> : null}
      <p className="text-xs">
        Para ver qué hay en la carpeta de SharePoint y con qué IDs se está mirando:{" "}
        <code>npm run portfolio:check-sharepoint -- --list</code>
      </p>
    </section>
  );
}
