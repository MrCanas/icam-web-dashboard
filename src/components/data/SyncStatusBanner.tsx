/** A partir de aquí, la última carga buena se considera vieja. Los crones son semanales. */
const DIAS_PARA_CONSIDERARLO_RANCIO = 10;

export interface FilaCargaMaestro {
  fecha: string;
  estado: string;
  archivo: string;
  detalle: unknown;
}

interface SyncStatusBannerProps {
  /** Las últimas cargas de UNA sola sincronización, ya filtradas y ordenadas. */
  filas: FilaCargaMaestro[];
  /** Qué maestro es, para que el aviso diga cuál de los dos ha fallado. */
  maestro: string;
  /** Qué se ve afectado mientras no se actualice. */
  afectado: string;
  /** Comando de diagnóstico que se ofrece al pie. */
  comando: string;
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
 * Avisa en la pestaña Datos cuando una sincronización no está sana: o la última
 * intentona falló, o la última buena es demasiado vieja para un cron semanal.
 *
 * Existe porque el cron del portfolio falló cuatro miércoles seguidos dejando su
 * error en `upload_logs` sin que nadie lo viera. El correo de `logDownloadError`
 * avisa en caliente; esto lo hace visible al entrar, que es donde se mira.
 *
 * Recibe las filas ya leídas en vez de consultarlas: desde que hay dos maestros
 * escribiendo en la misma tabla, cada uno las lee con el repositorio de su
 * módulo y filtra por su `fuente`. Si este componente consultara por su cuenta,
 * mezclaría las dos y daría por caído el portfolio cuando el que falló fue el
 * corporativo.
 */
export function SyncStatusBanner({
  filas,
  maestro,
  afectado,
  comando,
}: SyncStatusBannerProps) {
  if (filas.length === 0) return null;

  const ultima = filas[0]!;
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
      className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:p-4"
    >
      <p className="font-semibold">
        {fallo
          ? `La última sincronización del ${maestro} falló${
              fallosSeguidos > 1 ? ` (${fallosSeguidos} seguidas)` : ""
            }.`
          : `El ${maestro} lleva sin actualizarse más de lo previsto.`}
      </p>
      {ultimaBuena ? (
        <p>
          Última carga correcta: <b>{ultimaBuena.archivo}</b>
          {diasBuena !== null ? `, hace ${diasBuena} día${diasBuena === 1 ? "" : "s"}` : ""}.{" "}
          {afectado} sigue mostrando esos datos.
        </p>
      ) : (
        <p>No consta ninguna carga correcta.</p>
      )}
      {msg ? <p className="break-words font-mono text-xs">{msg}</p> : null}
      <p className="text-xs">
        Para ver qué hay en la carpeta de SharePoint y con qué IDs se está mirando:{" "}
        <code>{comando}</code>
      </p>
    </section>
  );
}
