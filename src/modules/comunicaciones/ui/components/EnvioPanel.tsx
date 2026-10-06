"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import {
  confirmarEnvioAction,
  detenerEnvioAction,
  ensayarEnvioAction,
  enviarPruebaAction,
  type InformeDeEnsayo,
  enviarTandaAction,
  marcarPruebaVistaAction,
  reanudarEnvioAction,
  revisarDestinatariosAction,
} from "@/modules/comunicaciones/actions/envio";
import {
  ensayoVigente,
  pruebaVigente,
  puedeConfirmar,
  puedeEnsayar,
  puedeEnviarPrueba,
  puedeMarcarPrueba,
  puedeRevisar,
  type ContextoControles,
  type RolZona,
} from "@/modules/comunicaciones/logic/controles";
import { TANDA, type Progreso } from "@/modules/comunicaciones/logic/envio";
import type {
  ComAjustesRow,
  ComComunicacionRow,
  EstadoComunicacion,
  NombrePasarela,
  ResumenDestinatarios,
} from "@/modules/comunicaciones/types";

interface Props {
  comunicacion: ComComunicacionRow;
  resumen: ResumenDestinatarios;
  ajustes: ComAjustesRow;
  rol: RolZona;
  usuarioEmail: string;
  pasarela: NombrePasarela;
  progreso: Progreso;
  /** Una línea por correo que saldría: «Cuenta — direcciones». */
  lineas: string[];
  /** Lo que el candado dejaría salir de esta comunicación, simulado en el servidor. */
  candado: {
    permitidos: number;
    rechazados: number;
    primerRechazo: { cuenta: string; motivo: string } | null;
    /** Las direcciones exactas a las que saldría algo. */
    direcciones: string[];
  } | null;
}

const BOTON =
  "min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900 disabled:opacity-60";
const BOTON_PRINCIPAL =
  "min-h-9 rounded-md bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60";
const CAMPO = "rounded-md border border-subtle bg-card px-3 py-2 text-sm text-text-body";

/** «1 correo», «2 correos». */
function cuantos(n: number, uno: string, varios: string): string {
  return `${fmtInt(n)} ${n === 1 ? uno : varios}`;
}

function Paso({
  numero,
  titulo,
  hecho,
  children,
}: {
  numero: number;
  titulo: string;
  hecho: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="space-y-2 rounded-lg border border-subtle/50 bg-card p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-text-primary">
        {numero}. {titulo}
        {hecho ? <span className="ml-2 font-normal text-text-muted">· hecho</span> : null}
      </h3>
      <div className="space-y-2 text-sm text-text-body">{children}</div>
    </li>
  );
}

/**
 * Los pasos hasta el envío, en orden, y el envío mismo.
 *
 * La pantalla explica qué falta y apaga lo que todavía no toca, pero no es ella
 * quien lo impide: cada acción vuelve a comprobarlo en el servidor. Las tandas
 * las pide esta pantalla una a una, así que cerrarla deja de enviar.
 */
export function EnvioPanel({
  comunicacion,
  resumen,
  ajustes,
  rol,
  usuarioEmail,
  pasarela,
  progreso,
  lineas,
  candado,
}: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [remitente, setRemitente] = useState(
    ajustes.remitentes_permitidos.includes(usuarioEmail.toLowerCase())
      ? usuarioEmail.toLowerCase()
      : (comunicacion.remitente_email ?? ajustes.remitentes_permitidos[0] ?? ""),
  );
  const [numero, setNumero] = useState("");
  // El envío en curso manda sobre lo que trajo la página: se actualiza tanda a tanda.
  const [enVivo, setEnVivo] = useState<{ progreso: Progreso; estado: EstadoComunicacion } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ensayando, setEnsayando] = useState(false);
  const [informe, setInforme] = useState<InformeDeEnsayo | null>(null);
  const parar = useRef(false);

  const estado = enVivo?.estado ?? comunicacion.estado;
  const avance = enVivo?.progreso ?? progreso;
  const ctx: ContextoControles = { comunicacion, resumen, ajustes, rol };
  const puedeEscribir = rol === "admin" || rol === "editor";

  if (estado === "cancelada") return null;

  /** Ejecuta una acción de un paso y recarga lo que trae el servidor. */
  const ejecutar = async (accion: () => Promise<{ ok: true } | { ok: false; mensaje: string }>, hecho?: string) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await accion();
    if (r.ok) {
      if (hecho) setAviso(hecho);
      router.refresh();
    } else {
      setError(r.mensaje);
    }
    setOcupado(false);
    return r.ok;
  };

  /** Pide tandas hasta que no quede nadie, alguien detenga o algo falle. */
  const enviarTandas = async () => {
    parar.current = false;
    setEnviando(true);
    setError(null);
    setAviso(null);
    for (;;) {
      if (parar.current) break;
      const r = await enviarTandaAction(comunicacion.id);
      if (!r.ok) {
        setError(r.mensaje);
        break;
      }
      setEnVivo({ progreso: r.progreso, estado: r.estado });
      if (r.detenidoPor) {
        setAviso(r.detenidoPor);
        break;
      }
      if (r.estado !== "enviando") break;
    }
    setEnviando(false);
    router.refresh();
  };

  /** Monta y valida todos los correos sin enviar ninguno. */
  const ensayar = async () => {
    setOcupado(true);
    setEnsayando(true);
    setError(null);
    setAviso(null);
    setInforme(null);
    const r = await ensayarEnvioAction(comunicacion.id);
    if (r.ok) {
      setInforme(r.informe);
      if (r.informe.problemas.length === 0) setAviso("Ensayo general correcto. Ya puedes confirmar.");
      router.refresh();
    } else {
      setError(r.mensaje);
    }
    setEnsayando(false);
    setOcupado(false);
  };

  const confirmar = async () => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    const r = await confirmarEnvioAction(comunicacion.id, Number(numero));
    setOcupado(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setEnVivo({ progreso, estado: "enviando" });
    await enviarTandas();
  };

  const detener = async () => {
    parar.current = true;
    setOcupado(true);
    const r = await detenerEnvioAction(comunicacion.id);
    if (r.ok) setEnVivo((v) => ({ progreso: v?.progreso ?? progreso, estado: "pausada" }));
    else setError(r.mensaje);
    setOcupado(false);
    router.refresh();
  };

  const reanudar = async () => {
    setOcupado(true);
    setError(null);
    const r = await reanudarEnvioAction(comunicacion.id);
    setOcupado(false);
    if (!r.ok) {
      setError(r.mensaje);
      return;
    }
    setEnVivo((v) => ({ progreso: v?.progreso ?? progreso, estado: "enviando" }));
    await enviarTandas();
  };

  const revisada = estado !== "borrador";
  const probada = !["borrador", "revisada"].includes(estado);
  const confirmada = ["enviando", "pausada", "enviada"].includes(estado);
  const hayPrueba = pruebaVigente(comunicacion);

  const motivoRevisar = puedeRevisar(ctx, resumen.aEnviar);
  const motivoPrueba = puedeEnviarPrueba(ctx, remitente);
  const motivoMarcar = puedeMarcarPrueba(ctx);
  const motivoConfirmar = puedeConfirmar(ctx, Number(numero));
  const numeroEscrito = numero.trim() !== "";
  const motivoEnsayar = puedeEnsayar(ctx);
  const motivoDelEnsayo = ensayoVigente(ctx);
  const ensayoHecho = motivoEnsayar === null && motivoDelEnsayo === null;
  const simulada = pasarela === "simulada";

  // Antes de empezar, si el candado rechazaría un solo correo, aquí no hay nada
  // que pulsar: se dice por qué y no se ofrece ningún paso.
  if (!confirmada && candado && candado.rechazados > 0) {
    return (
      <section className="space-y-2" aria-labelledby="com-envio">
        <h2 id="com-envio" className="text-base font-semibold text-text-primary">
          Envío
        </h2>
        <div className="space-y-1 rounded-lg border border-[#9B3B3B]/40 bg-card p-3 text-sm text-text-body sm:p-4">
          <p>
            <strong className="text-[#9B3B3B]">Esta comunicación no se puede enviar.</strong> El candado de
            destinatarios rechazaría {fmtInt(candado.rechazados)} de sus{" "}
            {fmtInt(candado.rechazados + candado.permitidos)} correos, así que no se envía ninguno.
          </p>
          {candado.primerRechazo ? (
            <p className="text-text-muted">
              Por ejemplo, {candado.primerRechazo.cuenta}: {candado.primerRechazo.motivo}.
            </p>
          ) : null}
          <p className="text-text-muted">
            La lista de arriba es a quién iría si no hubiera candado. Sirve para revisarla; a nadie de ella se
            le escribe.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2" aria-labelledby="com-envio">
      <h2 id="com-envio" className="text-base font-semibold text-text-primary">
        Envío
      </h2>

      {!confirmada && candado ? (
        <p className="rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
          Con el candado y el modo de ahora, de esta comunicación{" "}
          {candado.permitidos === 1 ? "saldría" : "saldrían"}{" "}
          <strong>{cuantos(candado.permitidos, "correo", "correos")}</strong>
          {candado.direcciones.length > 0 ? (
            <>
              , y {candado.direcciones.length === 1 ? "la única dirección que recibiría" : "las únicas direcciones que recibirían"}{" "}
              algo {candado.direcciones.length === 1 ? "es" : "son"}{" "}
              <strong>{candado.direcciones.join(", ")}</strong>
            </>
          ) : null}
          .
        </p>
      ) : null}

      {!puedeEscribir ? (
        <p className="rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
          Tu rol en Comunicaciones es de lectura: puedes ver en qué punto está, pero no enviar.
        </p>
      ) : null}

      <ol className="space-y-2">
        <Paso numero={1} titulo="Revisar los destinatarios" hecho={revisada}>
          {revisada ? (
            <p>
              Revisada por {comunicacion.revisada_por_email} el {fmtFechaHora(comunicacion.revisada_at)}:{" "}
              {cuantos(comunicacion.revisada_n ?? 0, "correo", "correos")}.
            </p>
          ) : (
            <>
              <p>
                Repasa la lista de arriba. {resumen.aEnviar === 1 ? "Saldría" : "Saldrían"}{" "}
                <strong>{cuantos(resumen.aEnviar, "correo", "correos")}</strong>, a{" "}
                {cuantos(resumen.direcciones, "dirección", "direcciones")} (
                {cuantos(resumen.direccionesExternas, "externa", "externas")}). Si después excluyes o incluyes a
                alguien, habrá que revisarla otra vez.
              </p>
              {puedeEscribir ? (
                <button
                  type="button"
                  disabled={ocupado || motivoRevisar !== null}
                  onClick={() => ejecutar(() => revisarDestinatariosAction(comunicacion.id, resumen.aEnviar))}
                  className={BOTON_PRINCIPAL}
                >
                  {resumen.aEnviar === 1
                    ? "He revisado el destinatario"
                    : `He revisado los ${fmtInt(resumen.aEnviar)} destinatarios`}
                </button>
              ) : null}
              {puedeEscribir && motivoRevisar ? <p className="text-text-muted">{motivoRevisar}</p> : null}
            </>
          )}
        </Paso>

        <Paso numero={2} titulo="Enviarte una prueba y mirarla" hecho={probada}>
          {probada ? (
            <p>
              Prueba dada por buena por {comunicacion.probada_por_email} el{" "}
              {fmtFechaHora(comunicacion.probada_at)}, con remitente {comunicacion.remitente_email}.
            </p>
          ) : !revisada ? (
            <p className="text-text-muted">Antes hay que revisar los destinatarios.</p>
          ) : (
            <>
              <p>
                Se envía el correo de verdad, con la plantilla elegida, <strong>solo a {usuarioEmail}</strong>.
                Sale sobre la cuenta de pruebas, no sobre un destinatario de la lista.
              </p>
              {hayPrueba ? (
                <p>
                  Prueba enviada el {fmtFechaHora(comunicacion.prueba_enviada_at)} por{" "}
                  {comunicacion.prueba_enviada_por_email}
                  {comunicacion.pasarela === "simulada" ? " (simulada: no ha salido ningún correo)" : ""}.
                </p>
              ) : null}
              {puedeEscribir ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm text-text-body">
                    Remitente
                    <select
                      value={remitente}
                      onChange={(e) => setRemitente(e.target.value)}
                      className={`${CAMPO} mt-1 block min-w-[260px]`}
                    >
                      {ajustes.remitentes_permitidos.length === 0 ? <option value="">(ninguno permitido)</option> : null}
                      {ajustes.remitentes_permitidos.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={ocupado || motivoPrueba !== null}
                    onClick={() =>
                      ejecutar(async () => {
                        const r = await enviarPruebaAction(comunicacion.id, remitente);
                        return r.ok ? { ok: true as const } : r;
                      }, `Prueba enviada a ${usuarioEmail}.`)
                    }
                    className={hayPrueba ? BOTON : BOTON_PRINCIPAL}
                  >
                    {hayPrueba ? "Enviar otra prueba" : "Enviarme la prueba"}
                  </button>
                  {hayPrueba ? (
                    <button
                      type="button"
                      disabled={ocupado || motivoMarcar !== null}
                      onClick={() => ejecutar(() => marcarPruebaVistaAction(comunicacion.id))}
                      className={BOTON_PRINCIPAL}
                    >
                      La he recibido y está bien
                    </button>
                  ) : null}
                </div>
              ) : null}
              {puedeEscribir && motivoPrueba ? <p className="text-text-muted">{motivoPrueba}</p> : null}
            </>
          )}
        </Paso>

        <Paso numero={3} titulo="Resumen y confirmación" hecho={confirmada}>
          {confirmada ? (
            <p>
              Confirmada por {comunicacion.confirmada_por_email ?? usuarioEmail}
              {comunicacion.confirmada_at ? ` el ${fmtFechaHora(comunicacion.confirmada_at)}` : ""}.
            </p>
          ) : !probada ? (
            <p className="text-text-muted">Antes hay que dar por buena la prueba.</p>
          ) : (
            <>
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="text-text-muted">Correos</dt>
                <dd>
                  <strong>{fmtInt(resumen.aEnviar)}</strong>, uno por cuenta, a{" "}
                  {cuantos(resumen.direcciones, "dirección", "direcciones")} ({fmtInt(resumen.direccionesExternas)}{" "}
                  {resumen.direccionesExternas === 1 ? "externa" : "externas"})
                </dd>
                <dt className="text-text-muted">Plantilla</dt>
                <dd>{comunicacion.plantilla_nombre}</dd>
                <dt className="text-text-muted">Remitente</dt>
                <dd>{comunicacion.remitente_email}</dd>
                <dt className="text-text-muted">Modo</dt>
                <dd>
                  {ajustes.modo === "pruebas" ? (
                    <>
                      <strong>Pruebas</strong>: los {fmtInt(resumen.aEnviar)} correos te llegan a ti (
                      {usuarioEmail}), no a los destinatarios
                    </>
                  ) : (
                    <strong className="text-[#9B3B3B]">
                      Real: los correos van a las direcciones de la lista
                    </strong>
                  )}
                  {simulada ? " · pasarela simulada: no saldrá ningún correo" : ""}
                </dd>
              </dl>
              <div>
                <p className="text-text-muted">A quién, uno por uno:</p>
                <ul className="mt-1 max-h-56 overflow-auto rounded-md border border-subtle px-3 py-2">
                  {lineas.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2 border-t border-subtle pt-3">
                <p>
                  <strong>Ensayo general.</strong> Antes de confirmar, el portal monta todos los correos —con
                  los datos de cada cuenta, sus enlaces y sus adjuntos—, los valida uno a uno y los pasa por el
                  candado, sin enviar ninguno. Lo que después se envíe tiene que ser exactamente lo ensayado.
                </p>
                {puedeEscribir ? (
                  <button
                    type="button"
                    disabled={ocupado || enviando || motivoEnsayar !== null}
                    onClick={ensayar}
                    className={ensayoHecho ? BOTON : BOTON_PRINCIPAL}
                  >
                    {ensayando ? "Montando y validando los correos…" : ensayoHecho ? "Repetir el ensayo general" : "Hacer el ensayo general"}
                  </button>
                ) : null}
                {puedeEscribir && motivoEnsayar ? <p className="text-text-muted">{motivoEnsayar}</p> : null}

                {informe && informe.problemas.length > 0 ? (
                  <div role="alert" className="rounded-md border border-[#9B3B3B]/40 p-3 text-[#9B3B3B]">
                    <p>
                      <strong>El ensayo ha encontrado {cuantos(informe.problemas.length, "problema", "problemas")}.</strong>{" "}
                      No se puede enviar hasta resolverlos.
                    </p>
                    <ul className="mt-1 max-h-56 list-disc overflow-auto pl-5">
                      {informe.problemas.map((p, i) => (
                        <li key={`${p.cuenta}-${i}`}>
                          {p.cuenta}: {p.problema}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {ensayoHecho && comunicacion.ensayo_resumen ? (
                  <div className="rounded-md border border-subtle p-3">
                    <p>
                      Ensayado el {fmtFechaHora(comunicacion.ensayo_at)} por {comunicacion.ensayo_por_email}:{" "}
                      <strong>{cuantos(comunicacion.ensayo_resumen.correos, "correo correcto", "correos correctos")}</strong>
                      {comunicacion.ensayo_resumen.omitidos > 0
                        ? `, ${cuantos(comunicacion.ensayo_resumen.omitidos, "omitido", "omitidos")} por dirección repetida`
                        : ""}
                      .
                    </p>
                    <p>
                      Direcciones exactas que recibirían algo:{" "}
                      <strong>{comunicacion.ensayo_resumen.direcciones.join(", ") || "ninguna"}</strong>
                    </p>
                    <p className="text-text-muted">
                      {cuantos(comunicacion.ensayo_resumen.enlaces, "enlace rastreado", "enlaces rastreados")} ·{" "}
                      {comunicacion.ensayo_resumen.adjuntos.length > 0
                        ? `adjuntos: ${comunicacion.ensayo_resumen.adjuntos.join(", ")}`
                        : "sin adjuntos"}{" "}
                      ·{" "}
                      {comunicacion.ensayo_resumen.imagen === "logo"
                        ? "la plantilla no trae imágenes: se añade el logotipo al pie"
                        : "imagen de apertura invisible"}
                    </p>
                    {comunicacion.ensayo_resumen.conCamposVacios.length > 0 ? (
                      <div className="mt-1 text-[#9B3B3B]">
                        <p>
                          {cuantos(comunicacion.ensayo_resumen.conCamposVacios.length, "cuenta tiene", "cuentas tienen")}{" "}
                          vacío algún campo de la plantilla, y ese hueco saldría en blanco:
                        </p>
                        <ul className="max-h-40 list-disc overflow-auto pl-5">
                          {comunicacion.ensayo_resumen.conCamposVacios.map((c) => (
                            <li key={c.cuenta}>
                              {c.cuenta}: {c.campos.join(", ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {!ensayoHecho && motivoEnsayar === null && motivoDelEnsayo ? (
                  <p className="text-text-muted">{motivoDelEnsayo}</p>
                ) : null}
              </div>

              {puedeEscribir && ensayoHecho ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm text-text-body">
                    Escribe el número de correos que van a salir
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      className={`${CAMPO} mt-1 block w-40`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={ocupado || enviando || motivoConfirmar !== null}
                    onClick={confirmar}
                    className={BOTON_PRINCIPAL}
                  >
                    Enviar {cuantos(resumen.aEnviar, "correo", "correos")}
                  </button>
                </div>
              ) : null}
              {puedeEscribir && ensayoHecho && motivoConfirmar && numeroEscrito ? (
                <p className="text-text-muted">{motivoConfirmar}</p>
              ) : null}
            </>
          )}
        </Paso>

        {confirmada ? (
          <Paso numero={4} titulo="Envío" hecho={estado === "enviada"}>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ["Enviados", avance.enviados],
                  ["Pendientes", avance.pendientes + avance.enCurso],
                  ["Errores", avance.errores],
                  ["Omitidos", avance.omitidos],
                  ["Total", avance.total],
                ] as const
              ).map(([etiqueta, valor]) => (
                <div key={etiqueta} className="rounded-lg border border-subtle/50 px-3 py-2">
                  <dt className="text-xs text-text-muted">{etiqueta}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-text-primary">{fmtInt(valor)}</dd>
                </div>
              ))}
            </dl>

            {comunicacion.pasarela === "simulada" || simulada ? (
              <p className="text-[#9B3B3B]">Pasarela simulada: no ha salido ningún correo de verdad.</p>
            ) : null}

            {estado === "enviada" ? (
              <p>
                Terminado{comunicacion.enviada_at ? ` el ${fmtFechaHora(comunicacion.enviada_at)}` : ""}. El
                detalle de cada correo está en la lista de destinatarios.
              </p>
            ) : null}

            {estado === "enviando" && enviando ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>Enviando en tandas de {TANDA}. No cierres esta página: cerrarla detiene el envío.</span>
                <button type="button" disabled={ocupado} onClick={detener} className={BOTON}>
                  Detener
                </button>
              </div>
            ) : null}

            {estado === "enviando" && !enviando && puedeEscribir ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>El envío está a medias y ahora mismo no sale nada: nadie tiene esta página enviando.</span>
                <button type="button" disabled={ocupado} onClick={enviarTandas} className={BOTON_PRINCIPAL}>
                  Continuar el envío
                </button>
                <button type="button" disabled={ocupado} onClick={detener} className={BOTON}>
                  Dejarlo detenido
                </button>
              </div>
            ) : null}

            {estado === "pausada" && puedeEscribir ? (
              <div className="flex flex-wrap items-center gap-2">
                <span>Envío detenido. Los pendientes siguen pendientes.</span>
                <button type="button" disabled={ocupado || enviando} onClick={reanudar} className={BOTON_PRINCIPAL}>
                  Reanudar
                </button>
              </div>
            ) : null}
          </Paso>
        ) : null}
      </ol>

      {aviso ? (
        <p role="status" className="text-sm text-text-body">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[#9B3B3B]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
