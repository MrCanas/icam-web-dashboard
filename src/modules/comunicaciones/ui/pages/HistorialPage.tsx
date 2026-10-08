import Link from "next/link";

import { Aviso } from "@/components/ui/Aviso";
import { BotonEnlace } from "@/components/ui/Boton";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { Icono } from "@/components/ui/Icono";
import { KPICard } from "@/components/ui/KPICard";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { TABLA } from "@/components/ui/tabla";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { loadDatosDeEnvios, loadHistorial } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { esMedible, tasa } from "@/modules/comunicaciones/logic/analitica";
import {
  COMUNICACIONES_NUEVA_PATH,
  comunicacionAnaliticaPath,
  comunicacionPath,
  ZONA_COMUNICACIONES,
} from "@/modules/comunicaciones/logic/paths";
import { pct } from "@/modules/comunicaciones/ui/components/CifrasDeAnalitica";
import { ETIQUETA_PASO, indiceDe, PASOS, pasoSugerido } from "@/modules/comunicaciones/logic/asistente";
import { ChipEntorno } from "@/modules/comunicaciones/ui/components/asistente/ChipEntorno";
import { entornoDe } from "@/modules/comunicaciones/ui/components/asistente/entorno";
import { ChipEstadoComunicacion } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";
import { ETIQUETA_AUDIENCIA } from "@/modules/comunicaciones/types";

/** Las que todavía no han terminado: se retoman en el asistente. */
const EN_CURSO = ["borrador", "revisada", "probada", "enviando", "pausada"];

const TREINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

/** Desde cuándo cuentan los «últimos 30 días». Es una página que se pide, no una que se cachea. */
function hace30Dias(): number {
  return Date.now() - TREINTA_DIAS_MS;
}

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

  const desde = hace30Dias();
  const enPreparacion = comunicaciones.filter((c) => ["borrador", "revisada", "probada"].includes(c.comunicacion.estado)).length;
  const enCurso = comunicaciones.filter((c) => ["enviando", "pausada"].includes(c.comunicacion.estado)).length;
  const enviadas = comunicaciones.filter((c) => c.comunicacion.estado === "enviada").length;
  const correos30 = comunicaciones
    .filter((c) => esMedible(c.comunicacion) && new Date(c.comunicacion.created_at).getTime() >= desde)
    .reduce((n, c) => n + c.seguimiento.enviados, 0);

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        titulo="Comunicaciones"
        meta="Correos a inversores: la lista y la plantilla se ven antes de que salga nada."
        chips={<ChipEntorno entorno={entornoDe(envios)} />}
        acciones={
          puedePreparar ? (
            <BotonEnlace href={COMUNICACIONES_NUEVA_PATH} variante="primario" icono={<Icono nombre="mas" />}>
              Nueva comunicación
            </BotonEnlace>
          ) : null
        }
      />

      {sinMigracion ? (
        <Aviso tipo="aviso" titulo="Faltan las tablas de Comunicaciones">
          Falta aplicar la migración <code>047_comunicaciones</code>.
        </Aviso>
      ) : null}
      {error ? <Aviso tipo="error">No se pudo leer el historial: {error}</Aviso> : null}

      {!sinMigracion && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KPICard title="En preparación" value={fmtInt(enPreparacion)} subtitle="borrador, revisada o probada" />
          <KPICard title="Enviando" value={fmtInt(enCurso)} subtitle="en curso o detenidas" />
          <KPICard title="Enviadas" value={fmtInt(enviadas)} />
          <KPICard title="Correos reales" value={fmtInt(correos30)} subtitle="últimos 30 días" highlight />
        </div>
      ) : null}

      {!sinMigracion && !error && comunicaciones.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay comunicaciones"
          descripcion="Preparar una no envía nada: calcula a quién iría y con qué plantilla."
          accion={
            puedePreparar ? (
              <BotonEnlace href={COMUNICACIONES_NUEVA_PATH} variante="primario">
                Preparar la primera
              </BotonEnlace>
            ) : null
          }
        />
      ) : null}

      {comunicaciones.length > 0 ? (
        <Tarjeta sinRelleno>
          <div className={TABLA.marco}>
            <table className={`${TABLA.tabla} min-w-[760px]`}>
              <caption className="sr-only">Comunicaciones preparadas, de la más reciente a la más antigua.</caption>
              <thead className={TABLA.thead}>
                <tr>
                  <th scope="col" className={TABLA.th}>Comunicación</th>
                  <th scope="col" className={TABLA.th}>Estado</th>
                  <th scope="col" className={TABLA.thNum}>Correos</th>
                  <th scope="col" className={TABLA.thNum}>Abrieron</th>
                  <th scope="col" className={TABLA.thNum}>Clic</th>
                  <th scope="col" className={TABLA.th}>Preparada</th>
                  {puedePreparar ? <th scope="col" className={TABLA.th}><span className="sr-only">Acciones</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {comunicaciones.map(({ comunicacion: c, resumen, seguimiento }) => {
                  const medible = esMedible(c) && seguimiento.enviados > 0;
                  const audiencia =
                    c.audiencia === "promocion" && c.promocion_nombre ? c.promocion_nombre : ETIQUETA_AUDIENCIA[c.audiencia];
                  return (
                    <tr key={c.id} className={TABLA.trPulsable}>
                      <th scope="row" className={`${TABLA.td} max-w-[420px] text-left font-normal`}>
                        <Link href={comunicacionPath(c.id)} className="font-medium text-icam-900 underline-offset-2 hover:underline">
                          {c.nombre}
                        </Link>
                        <span className={TABLA.sub}>
                          {audiencia}
                          {c.plantilla_nombre ? ` · ${c.plantilla_nombre}` : " · sin plantilla"}
                        </span>
                      </th>
                      <td className={TABLA.td}>
                        <span className="inline-flex flex-wrap gap-1">
                          <ChipEstadoComunicacion estado={c.estado} pasarela={c.pasarela} />
                        </span>
                      </td>
                      <td className={TABLA.tdNum}>
                        {fmtInt(resumen.aEnviar)}
                        {resumen.excluidos > 0 || resumen.sinDestinatario > 0 ? (
                          <span className={TABLA.sub}>
                            {resumen.excluidos > 0 ? `${fmtInt(resumen.excluidos)} excl.` : ""}
                            {resumen.excluidos > 0 && resumen.sinDestinatario > 0 ? " · " : ""}
                            {resumen.sinDestinatario > 0 ? `${fmtInt(resumen.sinDestinatario)} sin dest.` : ""}
                          </span>
                        ) : null}
                      </td>
                      {medible ? (
                        <>
                          <td className={TABLA.tdNum}>
                            <Link href={comunicacionAnaliticaPath(c.id)} className="text-icam-900 underline-offset-2 hover:underline">
                              {pct(tasa(seguimiento.abiertos, seguimiento.enviados))}
                            </Link>
                          </td>
                          <td className={TABLA.tdNum}>{pct(tasa(seguimiento.conClic, seguimiento.enviados))}</td>
                        </>
                      ) : (
                        <>
                          <td className={`${TABLA.tdNum} text-text-muted`}>—</td>
                          <td className={`${TABLA.tdNum} text-text-muted`}>—</td>
                        </>
                      )}
                      <td className={`${TABLA.td} whitespace-nowrap`}>
                        {fmtFechaHora(c.created_at)}
                        <span className={TABLA.sub}>{c.creada_por_email}</span>
                      </td>
                      {puedePreparar ? (
                        <td className={`${TABLA.td} whitespace-nowrap text-right`}>
                          {EN_CURSO.includes(c.estado) ? (
                            <BotonEnlace href={comunicacionPath(c.id)} variante="secundario" pequeno>
                              Continuar
                              <span className="text-text-muted">
                                · paso {indiceDe(pasoSugerido(c)) + 1} de {PASOS.length}: {ETIQUETA_PASO[pasoSugerido(c)]}
                              </span>
                            </BotonEnlace>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : null}
    </div>
  );
}
