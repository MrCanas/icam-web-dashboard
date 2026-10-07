import Link from "next/link";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { Chip } from "@/components/ui/Chip";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { EstadoVacio } from "@/components/ui/EstadoVacio";
import { KPICard } from "@/components/ui/KPICard";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { TABLA } from "@/components/ui/tabla";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import {
  agruparPorPlantilla,
  cifrasDe,
  esMedible,
  filasPorComunicacion,
  filasPorCuenta,
  porQueNoEsMedible,
  tasa,
} from "@/modules/comunicaciones/logic/analitica";
import { loadAnaliticaGlobal } from "@/modules/comunicaciones/logic/loadComunicaciones";
import {
  COMUNICACIONES_ANALITICA_PATH,
  COMUNICACIONES_PATH,
  comunicacionAnaliticaPath,
} from "@/modules/comunicaciones/logic/paths";
import { AvisoDeAnalitica, pct } from "@/modules/comunicaciones/ui/components/CifrasDeAnalitica";

const PERIODOS = [
  { clave: "30", etiqueta: "30 días", dias: 30 },
  { clave: "90", etiqueta: "90 días", dias: 90 },
  { clave: "365", etiqueta: "1 año", dias: 365 },
  { clave: "todo", etiqueta: "Todo", dias: null },
] as const;

/** El periodo se cuenta desde ahora mismo: es una página que se pide, no una que se cachea. */
function inicioDelPeriodo(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
}

function Tasa({ parte, total }: { parte: number; total: number }) {
  return (
    <>
      {fmtInt(parte)} <span className="text-text-muted">· {pct(tasa(parte, total))}</span>
    </>
  );
}

/**
 * La analítica de TODAS las comunicaciones: el conjunto, cada comunicación
 * comparada con las demás, los envíos de una misma plantilla juntos, y cada
 * cuenta a través de todo lo que ha recibido.
 *
 * Solo entra lo que se envió de verdad (por Zoho) y a sus destinatarios (modo
 * real). Lo enviado en modo pruebas o por la pasarela simulada se lista aparte,
 * sin cifras: sus aperturas son de quien lo envió.
 */
export default async function AnaliticaGlobalPage({ periodo }: { periodo: string | undefined }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const elegido = PERIODOS.find((p) => p.clave === periodo) ?? PERIODOS[1];
  const desde = elegido.dias === null ? null : inicioDelPeriodo(elegido.dias);
  const { datos, error } = await loadAnaliticaGlobal(user, desde);

  const medibles = datos.comunicaciones.filter(esMedible);
  const idsMedibles = new Set(medibles.map((c) => c.id));
  const destinatarios = datos.destinatarios.filter((d) => idsMedibles.has(d.comunicacion_id));
  const noMedibles = datos.comunicaciones.filter((c) => !esMedible(c));

  const total = cifrasDe(destinatarios);
  const filas = filasPorComunicacion(medibles, destinatarios);
  const grupos = agruparPorPlantilla(filas, destinatarios).sort((a, b) => b.envios.length - a.envios.length);
  const cuentas = filasPorCuenta(destinatarios);

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        ruta={[{ etiqueta: "Comunicaciones", href: COMUNICACIONES_PATH }, { etiqueta: "Analítica" }]}
        titulo="Analítica de los correos"
        meta="El conjunto de lo enviado en modo real. La analítica de cada correo está en su propia página."
        acciones={
          <nav aria-label="Periodo" className="flex gap-1 rounded-md border border-subtle bg-card p-0.5">
            {PERIODOS.map((p) => (
              <Link
                key={p.clave}
                href={`${COMUNICACIONES_ANALITICA_PATH}?periodo=${p.clave}`}
                aria-current={p.clave === elegido.clave ? "page" : undefined}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  p.clave === elegido.clave ? "bg-icam-900 text-white" : "text-text-body hover:bg-page"
                }`}
              >
                {p.etiqueta}
              </Link>
            ))}
          </nav>
        }
      />

      {error ? <Aviso tipo="error">No se pudo leer la analítica: {error}</Aviso> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KPICard title="Comunicaciones" value={fmtInt(medibles.length)} subtitle={elegido.dias ? `últimos ${elegido.etiqueta}` : "desde el principio"} />
        <KPICard title="Correos enviados" value={fmtInt(total.enviados)} />
        <KPICard title="Abiertos" value={fmtInt(total.abiertos)} subtitle={`${pct(total.tasaApertura)} de los enviados`} highlight />
        <KPICard title="Con clic" value={fmtInt(total.conClic)} subtitle={`${pct(total.tasaClic)} de los enviados`} />
      </div>

      <AvisoDeAnalitica />

      {!error && medibles.length === 0 ? (
        <EstadoVacio
          icono="grafica"
          titulo="Nada que medir en este periodo"
          descripcion="Solo entran las comunicaciones enviadas de verdad, por Zoho y en modo real."
          compacto
        />
      ) : null}

      {medibles.length > 0 ? (
        <>
          <Tarjeta id="ag-comunicaciones" titulo="Por comunicación" subtitulo="Cada envío con sus propias cifras." sinRelleno>
            <div className={TABLA.marco}>
              <table className={`${TABLA.tabla} min-w-[860px]`}>
                <caption className="sr-only">Cada comunicación enviada, con sus aperturas y sus clics.</caption>
                <thead className={TABLA.thead}>
                  <tr>
                    <th scope="col" className={TABLA.th}>Comunicación</th>
                    <th scope="col" className={TABLA.th}>Enviada</th>
                    <th scope="col" className={TABLA.thNum}>Enviados</th>
                    <th scope="col" className={TABLA.thNum}>Abrieron</th>
                    <th scope="col" className={TABLA.thNum}>Clic</th>
                    <th scope="col" className={TABLA.thNum}>Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ comunicacion: c, cifras, esReenvio }) => (
                    <tr key={c.id} className={TABLA.trPulsable}>
                      <th scope="row" className={`${TABLA.td} max-w-[460px] text-left font-normal`}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Link href={comunicacionAnaliticaPath(c.id)} className="font-medium text-icam-900 underline-offset-2 hover:underline">
                            {c.nombre}
                          </Link>
                          {esReenvio ? <Chip tono="neutro">seguimiento</Chip> : null}
                        </span>
                        <span className={TABLA.sub}>{c.plantilla_nombre ?? "—"}</span>
                      </th>
                      <td className={`${TABLA.td} whitespace-nowrap text-text-muted`}>{fmtFechaHora(c.confirmada_at ?? c.created_at)}</td>
                      <td className={TABLA.tdNum}>{fmtInt(cifras.enviados)}</td>
                      <td className={TABLA.tdNum}>
                        <Tasa parte={cifras.abiertos} total={cifras.enviados} />
                      </td>
                      <td className={TABLA.tdNum}>
                        <Tasa parte={cifras.conClic} total={cifras.enviados} />
                      </td>
                      <td className={TABLA.tdNum}>{fmtInt(cifras.errores)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>

          <Tarjeta
            id="ag-plantillas"
            titulo={
              <span className="inline-flex items-center gap-1.5">
                Por plantilla
                <Ayuda>
                  Cuando una plantilla se envía más de una vez —otra comunicación, o un seguimiento—, cada envío lleva
                  su propio seguimiento y se cuenta por separado. «Personas» son direcciones distintas: quien recibió
                  dos envíos cuenta una vez.
                </Ayuda>
              </span>
            }
            subtitulo="Los envíos de una misma plantilla, juntos, y las personas distintas alcanzadas."
            sinRelleno
          >
            <div className={TABLA.marco}>
              <table className={`${TABLA.tabla} min-w-[860px]`}>
                <caption className="sr-only">Los envíos de cada plantilla, juntos, y las personas alcanzadas.</caption>
                <thead className={TABLA.thead}>
                  <tr>
                    <th scope="col" className={TABLA.th}>Plantilla y sus envíos</th>
                    <th scope="col" className={TABLA.thNum}>Enviados</th>
                    <th scope="col" className={TABLA.thNum}>Abrieron</th>
                    <th scope="col" className={TABLA.thNum}>Clic</th>
                  </tr>
                </thead>
                {grupos.map((g) => (
                  <tbody key={g.plantillaId}>
                    <tr className="border-t border-subtle bg-page/70">
                      <th scope="rowgroup" className={`${TABLA.td} text-left font-semibold text-text-primary`}>
                        {g.plantillaNombre}
                        <Chip tono="neutro" className="ml-2">
                          {g.envios.length === 1 ? "1 envío" : `${fmtInt(g.envios.length)} envíos`}
                        </Chip>
                      </th>
                      <td className={`${TABLA.tdNum} font-semibold`}>
                        {fmtInt(g.personas)} {g.personas === 1 ? "persona" : "personas"}
                      </td>
                      <td className={`${TABLA.tdNum} font-semibold`}>
                        <Tasa parte={g.personasQueAbrieron} total={g.personas} />
                      </td>
                      <td className={`${TABLA.tdNum} font-semibold`}>
                        <Tasa parte={g.personasConClic} total={g.personas} />
                      </td>
                    </tr>
                    {g.envios.map(({ comunicacion: c, cifras, esReenvio }) => (
                      <tr key={c.id} className={TABLA.tr}>
                        <th scope="row" className="py-2.5 pl-8 pr-3 text-left font-normal">
                          <Link href={comunicacionAnaliticaPath(c.id)} className="text-icam-900 underline-offset-2 hover:underline">
                            {c.nombre}
                          </Link>
                          <span className={TABLA.sub}>
                            {fmtFechaHora(c.confirmada_at ?? c.created_at)}
                            {esReenvio ? " · seguimiento" : ""}
                          </span>
                        </th>
                        <td className={TABLA.tdNum}>{fmtInt(cifras.enviados)}</td>
                        <td className={TABLA.tdNum}>
                          <Tasa parte={cifras.abiertos} total={cifras.enviados} />
                        </td>
                        <td className={TABLA.tdNum}>
                          <Tasa parte={cifras.conClic} total={cifras.enviados} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </Tarjeta>

          <Tarjeta
            id="ag-cuentas"
            titulo="Por cuenta"
            subtitulo="Cada cuenta a través de todas las comunicaciones del periodo: quién sigue los correos y quién no."
            sinRelleno
          >
            <div className={TABLA.marcoFijo}>
              <table className={`${TABLA.tabla} min-w-[860px]`}>
                <caption className="sr-only">Cada cuenta de inversión, con lo que ha recibido, abierto y pulsado.</caption>
                <thead className={TABLA.theadFija}>
                  <tr>
                    <th scope="col" className={TABLA.th}>Cuenta de inversión</th>
                    <th scope="col" className={TABLA.th}>Direcciones</th>
                    <th scope="col" className={TABLA.thNum}>Recibidas</th>
                    <th scope="col" className={TABLA.thNum}>Abiertas</th>
                    <th scope="col" className={TABLA.thNum}>Con clic</th>
                    <th scope="col" className={TABLA.th}>Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.cuentaZohoId} className={TABLA.tr}>
                      <th scope="row" className={`${TABLA.td} text-left font-medium text-text-primary`}>
                        {c.cuentaNombre}
                      </th>
                      <td className={`${TABLA.td} break-all font-mono text-xs text-text-muted`}>{c.direcciones.join(", ")}</td>
                      <td className={TABLA.tdNum}>{fmtInt(c.recibidas)}</td>
                      <td className={TABLA.tdNum}>
                        <Tasa parte={c.abiertas} total={c.recibidas} />
                      </td>
                      <td className={TABLA.tdNum}>
                        <Tasa parte={c.conClic} total={c.recibidas} />
                      </td>
                      <td className={`${TABLA.td} whitespace-nowrap`}>
                        {c.ultimaActividad ? fmtFechaHora(c.ultimaActividad) : <span className="text-text-muted">No consta</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </>
      ) : null}

      {noMedibles.length > 0 ? (
        <Tarjeta
          id="ag-fuera"
          titulo="Fuera de las cifras"
          subtitulo="Enviadas en modo pruebas, por la pasarela simulada o antes de existir el seguimiento: no miden a los destinatarios."
          sinRelleno
        >
          <div className={TABLA.marco}>
            <table className={TABLA.tabla}>
              <caption className="sr-only">Comunicaciones que no entran en las cifras, y por qué.</caption>
              <tbody>
                {noMedibles.map((c) => (
                  <tr key={c.id} className={TABLA.tr}>
                    <th scope="row" className={`${TABLA.td} text-left font-normal`}>
                      <Link href={comunicacionAnaliticaPath(c.id)} className="text-icam-900 underline-offset-2 hover:underline">
                        {c.nombre}
                      </Link>
                    </th>
                    <td className={`${TABLA.td} text-text-muted`}>{porQueNoEsMedible(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      ) : null}
    </div>
  );
}
