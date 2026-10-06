import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { loadDatosDeEnvios, loadHistorial } from "@/modules/comunicaciones/logic/loadComunicaciones";
import {
  COMUNICACIONES_NUEVA_PATH,
  comunicacionPath,
  ZONA_COMUNICACIONES,
} from "@/modules/comunicaciones/logic/paths";
import { EstadoDeEnvios } from "@/modules/comunicaciones/ui/components/EstadoDeEnvios";
import { ETIQUETA_AUDIENCIA, ETIQUETA_ESTADO } from "@/modules/comunicaciones/types";

/**
 * Historial: las comunicaciones preparadas y en qué punto está cada una.
 *
 * Es la página de entrada de la zona. Un lector la ve entera; preparar una
 * nueva exige rol de editor.
 */
export default async function HistorialPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [{ comunicaciones, sinMigracion, error }, envios] = await Promise.all([
    loadHistorial(user),
    loadDatosDeEnvios(user),
  ]);
  const puedePreparar = checkWriteAccess(user, ZONA_COMUNICACIONES) === null;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Comunicaciones</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Correos a inversores: a quién van y con qué plantilla, antes de que salga nada, y el envío con
            sus controles.
          </p>
        </div>
        {puedePreparar ? (
          <Link
            href={COMUNICACIONES_NUEVA_PATH}
            className="min-h-9 rounded-md bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            Nueva comunicación
          </Link>
        ) : null}
      </header>

      <EstadoDeEnvios datos={envios} />

      {sinMigracion ? (
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          Las tablas de Comunicaciones no existen todavía en la base de datos. Falta aplicar la
          migración <code>047_comunicaciones</code>.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-4 text-sm text-[#9B3B3B]">
          No se pudo leer el historial: {error}
        </p>
      ) : null}

      {!sinMigracion && !error && comunicaciones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-subtle p-6 text-center text-sm text-text-muted">
          Todavía no se ha preparado ninguna comunicación.
        </p>
      ) : null}

      {comunicaciones.length > 0 ? (
        <div className="overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Comunicaciones preparadas, de la más reciente a la más antigua.</caption>
            <thead>
              <tr className="border-b border-subtle text-left text-text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Comunicación</th>
                <th scope="col" className="px-3 py-2 font-medium">Audiencia</th>
                <th scope="col" className="px-3 py-2 font-medium">Estado</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Correos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Excluidos</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Sin destinatario</th>
                <th scope="col" className="px-3 py-2 font-medium">Plantilla</th>
                <th scope="col" className="px-3 py-2 font-medium">Preparada</th>
              </tr>
            </thead>
            <tbody>
              {comunicaciones.map(({ comunicacion: c, resumen }) => (
                <tr key={c.id} className="border-b border-subtle/60 text-text-body last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <Link
                      href={comunicacionPath(c.id)}
                      className="font-medium text-icam-900 underline-offset-2 hover:underline"
                    >
                      {c.nombre}
                    </Link>
                  </th>
                  <td className="px-3 py-2">
                    {c.audiencia === "promocion" && c.promocion_nombre
                      ? c.promocion_nombre
                      : ETIQUETA_AUDIENCIA[c.audiencia]}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ETIQUETA_ESTADO[c.estado]}
                    {/* Una comunicación «enviada» por la pasarela simulada no ha escrito a nadie. */}
                    {c.pasarela === "simulada" && ["enviando", "pausada", "enviada"].includes(c.estado)
                      ? " (simulada)"
                      : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(resumen.aEnviar)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(resumen.excluidos)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtInt(resumen.sinDestinatario)}</td>
                  <td className="px-3 py-2">{c.plantilla_nombre ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                    {fmtFechaHora(c.created_at)} · {c.creada_por_email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
