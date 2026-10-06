import Link from "next/link";

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
import { AvisoDeAnalitica, Cifra, pct } from "@/modules/comunicaciones/ui/components/CifrasDeAnalitica";

const PERIODOS = [
  { clave: "30", etiqueta: "Últimos 30 días", dias: 30 },
  { clave: "90", etiqueta: "Últimos 90 días", dias: 90 },
  { clave: "365", etiqueta: "Último año", dias: 365 },
  { clave: "todo", etiqueta: "Todo", dias: null },
] as const;

/** El periodo se cuenta desde ahora mismo: es una página que se pide, no una que se cachea. */
function inicioDelPeriodo(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString();
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
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">
            <Link href={COMUNICACIONES_PATH} className="underline-offset-2 hover:underline">
              Comunicaciones
            </Link>{" "}
            / Analítica
          </p>
          <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">Analítica de los correos</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            El conjunto de lo enviado. La analítica de cada correo está en su propia página.
          </p>
        </div>
        <nav aria-label="Periodo" className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <Link
              key={p.clave}
              href={`${COMUNICACIONES_ANALITICA_PATH}?periodo=${p.clave}`}
              aria-current={p.clave === elegido.clave ? "page" : undefined}
              className={`min-h-9 rounded-md border px-3 py-1.5 text-sm ${
                p.clave === elegido.clave
                  ? "border-icam-900 bg-icam-900 text-white"
                  : "border-subtle text-text-body hover:border-icam-900"
              }`}
            >
              {p.etiqueta}
            </Link>
          ))}
        </nav>
      </header>

      {error ? (
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-4 text-sm text-[#9B3B3B]">
          No se pudo leer la analítica: {error}
        </p>
      ) : null}

      <AvisoDeAnalitica />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra etiqueta="Comunicaciones" valor={fmtInt(medibles.length)} nota={elegido.etiqueta.toLowerCase()} />
        <Cifra etiqueta="Correos enviados" valor={fmtInt(total.enviados)} />
        <Cifra etiqueta="Abiertos" valor={fmtInt(total.abiertos)} nota={`${pct(total.tasaApertura)} de los enviados`} />
        <Cifra etiqueta="Con clic" valor={fmtInt(total.conClic)} nota={`${pct(total.tasaClic)} de los enviados`} />
      </dl>

      {!error && medibles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-subtle p-6 text-center text-sm text-text-muted">
          En este periodo no hay ninguna comunicación enviada en modo real.
        </p>
      ) : null}

      {medibles.length > 0 ? (
        <>
          <section className="space-y-2" aria-labelledby="ag-comunicaciones">
            <h2 id="ag-comunicaciones" className="text-base font-semibold text-text-primary">
              Por comunicación
            </h2>
            <div className="overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">Cada comunicación enviada, con sus aperturas y sus clics.</caption>
                <thead>
                  <tr className="border-b border-subtle text-left text-text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">Comunicación</th>
                    <th scope="col" className="px-3 py-2 font-medium">Plantilla</th>
                    <th scope="col" className="px-3 py-2 font-medium">Enviada</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Enviados</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Abrieron</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Clic</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Errores</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(({ comunicacion: c, cifras, esReenvio }) => (
                    <tr key={c.id} className="border-b border-subtle/60 text-text-body last:border-b-0">
                      <th scope="row" className="px-3 py-2 text-left font-normal">
                        <Link
                          href={comunicacionAnaliticaPath(c.id)}
                          className="font-medium text-icam-900 underline-offset-2 hover:underline"
                        >
                          {c.nombre}
                        </Link>
                        {esReenvio ? <span className="ml-1 text-xs text-text-muted">· reenvío</span> : null}
                      </th>
                      <td className="px-3 py-2">{c.plantilla_nombre ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                        {fmtFechaHora(c.confirmada_at ?? c.created_at)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(cifras.enviados)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtInt(cifras.abiertos)} <span className="text-text-muted">· {pct(cifras.tasaApertura)}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtInt(cifras.conClic)} <span className="text-text-muted">· {pct(cifras.tasaClic)}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(cifras.errores)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2" aria-labelledby="ag-plantillas">
            <h2 id="ag-plantillas" className="text-base font-semibold text-text-primary">
              Por plantilla
            </h2>
            <p className="text-sm text-text-muted">
              Cuando una plantilla se envía más de una vez —otra comunicación, o un reenvío—, cada envío lleva su
              propio seguimiento y se cuenta por separado. «Personas» son direcciones distintas: quien recibió dos
              envíos cuenta una vez.
            </p>
            <div className="overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">Los envíos de cada plantilla, juntos, y las personas alcanzadas.</caption>
                <thead>
                  <tr className="border-b border-subtle text-left text-text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">Plantilla y sus envíos</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Enviados</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Abrieron</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Clic</th>
                  </tr>
                </thead>
                {grupos.map((g) => (
                  <tbody key={g.plantillaId} className="border-b border-subtle last:border-b-0">
                    <tr className="bg-black/[0.02] text-text-body">
                      <th scope="rowgroup" className="px-3 py-2 text-left font-medium text-text-primary">
                        {g.plantillaNombre}
                        <span className="ml-2 font-normal text-text-muted">
                          {g.envios.length === 1 ? "1 envío" : `${fmtInt(g.envios.length)} envíos`}
                        </span>
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(g.personas)} {g.personas === 1 ? "persona" : "personas"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtInt(g.personasQueAbrieron)}{" "}
                        <span className="text-text-muted">· {pct(tasa(g.personasQueAbrieron, g.personas))}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtInt(g.personasConClic)}{" "}
                        <span className="text-text-muted">· {pct(tasa(g.personasConClic, g.personas))}</span>
                      </td>
                    </tr>
                    {g.envios.map(({ comunicacion: c, cifras, esReenvio }) => (
                      <tr key={c.id} className="border-t border-subtle/60 text-text-body">
                        <th scope="row" className="py-2 pl-8 pr-3 text-left font-normal">
                          <Link
                            href={comunicacionAnaliticaPath(c.id)}
                            className="text-icam-900 underline-offset-2 hover:underline"
                          >
                            {c.nombre}
                          </Link>
                          <span className="ml-2 text-xs text-text-muted">
                            {fmtFechaHora(c.confirmada_at ?? c.created_at)}
                            {esReenvio ? " · reenvío" : ""}
                          </span>
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtInt(cifras.enviados)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtInt(cifras.abiertos)}{" "}
                          <span className="text-text-muted">· {pct(cifras.tasaApertura)}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtInt(cifras.conClic)} <span className="text-text-muted">· {pct(cifras.tasaClic)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </section>

          <section className="space-y-2" aria-labelledby="ag-cuentas">
            <h2 id="ag-cuentas" className="text-base font-semibold text-text-primary">
              Por cuenta
            </h2>
            <p className="text-sm text-text-muted">
              Cada cuenta a través de todas las comunicaciones del periodo: cuántas recibió, cuántas abrió y en
              cuántas pulsó algún enlace.
            </p>
            <div className="max-h-[640px] overflow-auto overscroll-x-contain rounded-lg border border-subtle/50 bg-card">
              <table className="w-full min-w-[860px] text-sm">
                <caption className="sr-only">Cada cuenta de inversión, con lo que ha recibido, abierto y pulsado.</caption>
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-subtle text-left text-text-muted">
                    <th scope="col" className="px-3 py-2 font-medium">Cuenta de inversión</th>
                    <th scope="col" className="px-3 py-2 font-medium">Direcciones</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Recibidas</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Abiertas</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Con clic</th>
                    <th scope="col" className="px-3 py-2 font-medium">Última actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.cuentaZohoId} className="border-b border-subtle/60 align-top text-text-body last:border-b-0">
                      <th scope="row" className="px-3 py-2 text-left font-medium text-text-primary">
                        {c.cuentaNombre}
                      </th>
                      <td className="px-3 py-2 break-all text-text-muted">{c.direcciones.join(", ")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtInt(c.recibidas)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtInt(c.abiertas)} <span className="text-text-muted">· {pct(tasa(c.abiertas, c.recibidas))}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtInt(c.conClic)} <span className="text-text-muted">· {pct(tasa(c.conClic, c.recibidas))}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {c.ultimaActividad ? fmtFechaHora(c.ultimaActividad) : "No consta"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {noMedibles.length > 0 ? (
        <section className="space-y-2" aria-labelledby="ag-fuera">
          <h2 id="ag-fuera" className="text-base font-semibold text-text-primary">
            Fuera de las cifras
          </h2>
          <ul className="space-y-1 rounded-lg border border-subtle/50 bg-card p-3 text-sm text-text-body">
            {noMedibles.map((c) => (
              <li key={c.id}>
                <Link href={comunicacionAnaliticaPath(c.id)} className="text-icam-900 underline-offset-2 hover:underline">
                  {c.nombre}
                </Link>
                <span className="text-text-muted"> — {porQueNoEsMedible(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
