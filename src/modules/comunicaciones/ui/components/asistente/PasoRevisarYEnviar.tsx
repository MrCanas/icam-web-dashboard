"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Desplegable } from "@/components/ui/Ayuda";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { ensayarEnvioAction, type InformeDeEnsayo } from "@/modules/comunicaciones/actions/envio";
import type { PasoAsistente } from "@/modules/comunicaciones/logic/asistente";
import {
  ensayoVigente,
  puedeConfirmar,
  puedeEnsayar,
  VIGENCIA_DEL_ENSAYO_MIN,
  type ContextoControles,
} from "@/modules/comunicaciones/logic/controles";
import { TANDA, type Progreso } from "@/modules/comunicaciones/logic/envio";
import { comunicacionAnaliticaPath, COMUNICACIONES_PATH } from "@/modules/comunicaciones/logic/paths";
import { LIMITE_DIARIO_ZOHO, type NombrePasarela } from "@/modules/comunicaciones/types";
import type { CandadoSimulado } from "@/modules/comunicaciones/ui/components/envio/EnvioPanel";
import { cuantos } from "@/modules/comunicaciones/ui/components/envio/texto";
import { useEnvioPorTandas } from "@/modules/comunicaciones/ui/components/envio/useEnvioPorTandas";
import { ChipModo, ChipPasarela } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";
import { ListaDeDirecciones } from "@/modules/comunicaciones/ui/components/ui/ListaDeDirecciones";

import { BarraDeAcciones, PasoDelAsistente } from "./marco";

/**
 * Paso 5: el resumen de todo lo anterior, la comprobación final (el ensayo
 * general), la confirmación escrita y el envío por tandas.
 *
 * La comprobación final se lanza sola al entrar si no hay una vigente: no
 * envía nada, monta todos los correos, los valida y guarda su huella. Lo que
 * después salga tiene que ser exactamente lo ensayado.
 */
export function PasoRevisarYEnviar({
  ctx,
  usuarioEmail,
  pasarela,
  audiencia,
  lineas,
  candado,
  progreso,
  puedeEscribir,
  atras,
  ir,
  seguimiento,
}: {
  ctx: ContextoControles;
  usuarioEmail: string;
  pasarela: NombrePasarela;
  /** «PROMOCIONTEST», «Toda la base»… */
  audiencia: string;
  /** Una línea por correo que saldría: «Cuenta — direcciones». */
  lineas: string[];
  candado: CandadoSimulado | null;
  progreso: Progreso;
  puedeEscribir: boolean;
  atras: ReactNode;
  ir: (paso: PasoAsistente) => void;
  seguimiento?: ReactNode;
}) {
  const router = useRouter();
  const { comunicacion, resumen, ajustes } = ctx;
  const envio = useEnvioPorTandas({ comunicacionId: comunicacion.id, estadoInicial: comunicacion.estado, progresoInicial: progreso });
  const [numero, setNumero] = useState("");
  const [ensayando, setEnsayando] = useState(false);
  const [informe, setInforme] = useState<InformeDeEnsayo | null>(null);
  const [errorEnsayo, setErrorEnsayo] = useState<string | null>(null);

  const confirmada = ["enviando", "pausada", "enviada"].includes(envio.estado);
  const bloqueada = !confirmada && candado !== null && candado.rechazados > 0;
  const motivoEnsayar = puedeEnsayar(ctx);
  const motivoDelEnsayo = ensayoVigente(ctx);
  const ensayoHecho = motivoEnsayar === null && motivoDelEnsayo === null;
  const motivoConfirmar = puedeConfirmar(ctx, Number(numero));
  const simulada = pasarela === "simulada";
  const ensayo = comunicacion.ensayo_resumen;

  const ensayar = async () => {
    setEnsayando(true);
    setErrorEnsayo(null);
    setInforme(null);
    const r = await ensayarEnvioAction(comunicacion.id);
    if (r.ok) {
      setInforme(r.informe);
      router.refresh();
    } else {
      setErrorEnsayo(r.mensaje);
    }
    setEnsayando(false);
  };

  // Al entrar, si no hay una comprobación vigente y se puede hacer, se hace sola.
  // Se decide una vez, al montar: si falla o caduca, se repite con el botón.
  const ensayarAlEntrar = puedeEscribir && !bloqueada && !confirmada && motivoEnsayar === null && motivoDelEnsayo !== null;
  useEffect(() => {
    if (!ensayarAlEntrar) return;
    const t = setTimeout(() => void ensayar(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (confirmada) {
    return (
      <Envio
        ctx={ctx}
        envio={envio}
        simulada={simulada || comunicacion.pasarela === "simulada"}
        puedeEscribir={puedeEscribir}
        seguimiento={seguimiento}
      />
    );
  }

  const problemas = informe?.problemas ?? [];
  const numeroEscrito = numero.trim() !== "";
  const limite = ajustes.limite_diario ?? LIMITE_DIARIO_ZOHO;

  const motivoPie = !puedeEscribir
    ? "Tu rol en Comunicaciones es de lectura: puedes ver en qué punto está, pero no enviar."
    : bloqueada
      ? "El candado no deja enviar esta comunicación."
      : ensayando
        ? "Haciendo la comprobación final…"
        : motivoEnsayar ?? (problemas.length > 0 ? "Resuelve los problemas de la comprobación final." : motivoDelEnsayo ?? (numeroEscrito ? motivoConfirmar : null));

  return (
    <PasoDelAsistente
      ancho="normal"
      titulo={bloqueada ? "Esta comunicación no se puede enviar" : ensayoHecho ? "Todo listo para enviar" : "Revisa y envía"}
      subtitulo={
        bloqueada
          ? "El candado de destinatarios rechazaría parte de sus correos, así que no sale ninguno."
          : "Repasa el resumen. Cuando la comprobación final esté en verde, escribe el número de correos y envía."
      }
      pie={
        <BarraDeAcciones
          atras={atras}
          motivo={motivoPie}
          extra={
            puedeEscribir && ensayoHecho && !bloqueada ? (
              <label className="flex items-center gap-2 text-xs text-text-muted">
                Escribe <strong className="text-text-primary">{fmtInt(resumen.aEnviar)}</strong> para confirmar
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  aria-label="Número de correos que van a salir"
                  className={`${claseCampo} w-20 py-1.5 text-center`}
                />
              </label>
            ) : null
          }
          principal={
            puedeEscribir && !bloqueada ? (
              <Boton
                variante="primario"
                icono={<Icono nombre="enviar" />}
                cargando={envio.ocupado}
                disabled={!ensayoHecho || motivoConfirmar !== null || envio.ocupado || ensayando || problemas.length > 0}
                onClick={() => void envio.confirmar(Number(numero))}
              >
                Enviar {cuantos(resumen.aEnviar, "correo", "correos")}
              </Boton>
            ) : null
          }
        />
      }
    >
      {/* El resumen, estilo lista de comprobación: cada fila lleva a su paso. */}
      <ol className="divide-y divide-subtle/60 overflow-hidden rounded-xl border border-subtle/60 bg-card shadow-sm">
        <Fila
          estado="ok"
          titulo="Para"
          onEditar={() => ir("destinatarios")}
          detalle={
            <>
              {audiencia} · <strong>{cuantos(resumen.aEnviar, "correo", "correos")}</strong>, uno por cuenta, a{" "}
              {cuantos(resumen.direcciones, "dirección", "direcciones")} ({cuantos(resumen.direccionesExternas, "externa", "externas")})
            </>
          }
        >
          <Desplegable titulo={`Ver ${resumen.aEnviar === 1 ? "la cuenta" : `las ${fmtInt(resumen.aEnviar)} cuentas`}, una por una`} className="mt-2 shadow-none">
            <ul className="max-h-56 divide-y divide-subtle/60 overflow-auto text-sm">
              {lineas.map((l) => (
                <li key={l} className="py-1.5">
                  {l}
                </li>
              ))}
            </ul>
          </Desplegable>
        </Fila>
        <Fila estado="ok" titulo="Contenido" onEditar={() => ir("contenido")} detalle={comunicacion.plantilla_nombre ?? "—"} />
        <Fila estado="ok" titulo="Desde" onEditar={() => ir("prueba")} detalle={comunicacion.remitente_email ?? "—"} />
        <Fila
          estado="ok"
          titulo="Prueba"
          onEditar={() => ir("prueba")}
          detalle={`Dada por buena por ${comunicacion.probada_por_email ?? "—"} · ${fmtFechaHora(comunicacion.probada_at)}`}
        />
        <Fila
          estado={ajustes.modo === "real" ? "atencion" : "ok"}
          titulo="Modo"
          detalle={
            <span className="flex flex-wrap items-center gap-1.5">
              <ChipModo modo={ajustes.modo} />
              <ChipPasarela pasarela={pasarela} />
              <span>
                {ajustes.modo === "pruebas"
                  ? `${resumen.aEnviar === 1 ? "el correo te llega" : `los ${fmtInt(resumen.aEnviar)} correos te llegan`} a ti (${usuarioEmail}), no a los destinatarios`
                  : "los correos van a las direcciones de la lista"}
                {simulada ? " · no saldrá ningún correo" : ""}
              </span>
            </span>
          }
        >
          {candado && !bloqueada ? (
            <div className="mt-2">
              <p className="mb-1 text-xs text-text-muted">
                {candado.direcciones.length === 1 ? "La única dirección que recibiría algo:" : "Las únicas direcciones que recibirían algo:"}
              </p>
              <ListaDeDirecciones direcciones={candado.direcciones} tono="marca" />
            </div>
          ) : null}
        </Fila>

        {bloqueada && candado ? (
          <Fila
            estado="error"
            titulo="Candado"
            detalle={
              <>
                Rechazaría {fmtInt(candado.rechazados)} de sus {fmtInt(candado.rechazados + candado.permitidos)} correos, así que no se
                envía ninguno.
                {candado.primerRechazo ? ` Por ejemplo, ${candado.primerRechazo.cuenta}: ${candado.primerRechazo.motivo}.` : ""}
              </>
            }
          >
            <p className="mt-1 text-xs text-text-muted">
              Mientras el candado exista, este módulo solo puede escribir a las direcciones de la lista cerrada y sobre
              las cuentas de prueba de la promoción de pruebas. La lista de destinatarios es a quién iría si no hubiera
              candado: sirve para revisarla, pero a nadie de ella se le escribe.
            </p>
          </Fila>
        ) : (
          <Fila
            estado={ensayando ? "cargando" : problemas.length > 0 || errorEnsayo ? "error" : ensayoHecho ? "ok" : "pendiente"}
            titulo="Comprobación final"
            detalle={
              ensayando
                ? "Montando y validando cada correo, sin enviar ninguno…"
                : problemas.length > 0
                  ? `Ha encontrado ${cuantos(problemas.length, "problema", "problemas")}: no se puede enviar hasta resolverlos.`
                  : ensayoHecho && ensayo
                    ? (
                        <>
                          <strong>{cuantos(ensayo.correos, "correo correcto", "correos correctos")}</strong>
                          {ensayo.omitidos > 0 ? `, ${cuantos(ensayo.omitidos, "omitido", "omitidos")} por dirección repetida` : ""} ·{" "}
                          {cuantos(ensayo.enlaces, "enlace rastreado", "enlaces rastreados")} ·{" "}
                          {ensayo.adjuntos.length > 0 ? `adjuntos: ${ensayo.adjuntos.join(", ")}` : "sin adjuntos"} · hecha a las{" "}
                          {fmtFechaHora(comunicacion.ensayo_at)}
                        </>
                      )
                    : (errorEnsayo ?? motivoEnsayar ?? motivoDelEnsayo ?? "Pendiente")
            }
            accion={
              puedeEscribir && !ensayando && motivoEnsayar === null && (!ensayoHecho || problemas.length > 0) ? (
                <Boton variante={ensayoHecho ? "secundario" : "primario"} pequeno icono={<Icono nombre="actualizar" />} onClick={() => void ensayar()}>
                  {comunicacion.ensayo_at || errorEnsayo || problemas.length > 0 ? "Repetir" : "Comprobar"}
                </Boton>
              ) : puedeEscribir && ensayoHecho ? (
                <Boton variante="texto" pequeno onClick={() => void ensayar()}>
                  Repetir
                </Boton>
              ) : null
            }
          >
            {problemas.length > 0 ? (
              <ul className="mt-2 max-h-56 list-disc overflow-auto pl-5 text-sm text-red-800">
                {problemas.map((p, i) => (
                  <li key={`${p.cuenta}-${i}`}>
                    {p.cuenta}: {p.problema}
                  </li>
                ))}
              </ul>
            ) : null}
            {ensayoHecho && ensayo ? (
              <div className="mt-2 space-y-2">
                <div>
                  <p className="mb-1 text-xs text-text-muted">Direcciones exactas que recibirían algo:</p>
                  <ListaDeDirecciones direcciones={ensayo.direcciones} />
                </div>
                {ensayo.conCamposVacios.length > 0 ? (
                  <Aviso
                    tipo="aviso"
                    titulo={`${cuantos(ensayo.conCamposVacios.length, "cuenta tiene", "cuentas tienen")} vacío algún campo de la plantilla; ese hueco saldría en blanco`}
                  >
                    <ul className="max-h-40 list-disc overflow-auto pl-5">
                      {ensayo.conCamposVacios.map((c) => (
                        <li key={c.cuenta}>
                          {c.cuenta}: {c.campos.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </Aviso>
                ) : null}
              </div>
            ) : null}
          </Fila>
        )}
      </ol>

      {envio.error ? <Aviso tipo="error">{envio.error}</Aviso> : null}

      {/* Las letras pequeñas, al final y plegadas. */}
      <Desplegable titulo="Antes de enviar: qué comprueba el portal">
        <p>
          <strong>Comprobación final.</strong> El portal monta todos los correos —con los datos de cada cuenta, sus
          enlaces y sus adjuntos—, los valida uno a uno y los pasa por el candado, sin enviar ninguno. De cada uno
          guarda una huella: lo que después se envíe tiene que ser exactamente lo comprobado, o no sale. Vale{" "}
          {VIGENCIA_DEL_ENSAYO_MIN} minutos; si cambias la lista o el modo, hay que repetirla.
        </p>
        <p>
          <strong>En cada correo.</strong> Ningún campo combinado sin resolver ni resto de <code>{"${…}"}</code>; asunto
          y cuerpo dentro de tamaño; tantos enlaces rastreados como tenía la plantilla y una sola imagen de apertura; el
          identificador de seguimiento es el de ese destinatario y el registro de Zoho el de su cuenta; el remitente es
          uno que Zoho acepta; y, al final, el candado de destinatarios.
        </p>
        <p>
          <strong>Durante el envío.</strong> Sale en tandas de {TANDA}. Antes de cada correo se vuelven a leer el
          interruptor general, el estado, el modo y el tope diario; y tras cada tanda, donde Zoho lo expone, se compara a
          quién dice Zoho que mandó el correo. Puedes detenerlo en cualquier momento. No cierres la página mientras
          envía: cerrarla lo detiene.
        </p>
        <p>
          <strong>Tope diario.</strong> Zoho permite como máximo {fmtInt(limite)} correos al día por usuario, y las
          pruebas también cuentan. Si esta comunicación no cabe en lo que queda del día, no se puede confirmar.
        </p>
        <p>
          <strong>Confirmación.</strong> Escribir el número de correos a mano es a propósito: obliga a leer cuántos van a
          salir. Cada paso queda registrado con quién y cuándo.
        </p>
      </Desplegable>
    </PasoDelAsistente>
  );
}

type EstadoFila = "ok" | "pendiente" | "error" | "atencion" | "cargando";

const ICONO_FILA: Record<EstadoFila, string> = {
  ok: "bg-green-600 text-white",
  pendiente: "border-2 border-subtle bg-card text-text-muted",
  error: "bg-red-600 text-white",
  atencion: "bg-amber-500 text-white",
  cargando: "bg-icam-900/10 text-icam-900",
};

function Fila({
  estado,
  titulo,
  detalle,
  onEditar,
  accion,
  children,
}: {
  estado: EstadoFila;
  titulo: string;
  detalle: ReactNode;
  onEditar?: () => void;
  accion?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ICONO_FILA[estado]}`} aria-hidden="true">
        {estado === "ok" ? (
          <Icono nombre="check" className="h-3.5 w-3.5" />
        ) : estado === "error" || estado === "atencion" ? (
          <span className="text-xs font-bold">!</span>
        ) : estado === "cargando" ? (
          <Icono nombre="actualizar" className="h-3.5 w-3.5 animate-spin" />
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-text-primary">{titulo}</p>
          <div className="flex items-center gap-2">
            {accion}
            {onEditar ? (
              <Boton variante="texto" pequeno onClick={onEditar}>
                Editar
              </Boton>
            ) : null}
          </div>
        </div>
        <div className={`text-sm ${estado === "error" ? "text-red-800" : "text-text-body"}`}>{detalle}</div>
        {children}
      </div>
    </li>
  );
}

/** El envío en curso, detenido o terminado. */
function Envio({
  ctx,
  envio,
  simulada,
  puedeEscribir,
  seguimiento,
}: {
  ctx: ContextoControles;
  envio: ReturnType<typeof useEnvioPorTandas>;
  simulada: boolean;
  puedeEscribir: boolean;
  seguimiento?: ReactNode;
}) {
  const { comunicacion } = ctx;
  const { estado, avance, enviando, ocupado } = envio;
  const hechos = avance.enviados + avance.errores + avance.omitidos;
  const porcentaje = avance.total > 0 ? Math.round((hechos / avance.total) * 100) : 0;
  const terminada = estado === "enviada";

  const cifras = (
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
        <div key={etiqueta} className="rounded-lg border border-subtle/60 bg-card px-3 py-2">
          <dt className="text-xs font-medium uppercase tracking-wider text-text-muted">{etiqueta}</dt>
          <dd className="text-xl font-semibold tabular-nums text-text-primary">{fmtInt(valor)}</dd>
        </div>
      ))}
    </dl>
  );

  if (terminada) {
    return (
      <PasoDelAsistente
        ancho="estrecho"
        titulo="¡Enviada!"
        subtitulo={`Terminó${comunicacion.enviada_at ? ` el ${fmtFechaHora(comunicacion.enviada_at)}` : ""}. Las aperturas y los clics irán apareciendo en la analítica.`}
        pie={
          <BarraDeAcciones
            atras={
              <BotonEnlace href={COMUNICACIONES_PATH} variante="texto">
                Volver al historial
              </BotonEnlace>
            }
            extra={puedeEscribir ? seguimiento : null}
            principal={
              <BotonEnlace href={comunicacionAnaliticaPath(comunicacion.id)} variante="primario" icono={<Icono nombre="grafica" />}>
                Ver analítica
              </BotonEnlace>
            }
          />
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-6 py-8 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white">
            <Icono nombre="check" className="h-7 w-7" />
          </span>
          <p className="text-lg font-semibold text-green-900">
            {cuantos(avance.enviados, "correo enviado", "correos enviados")}
            {avance.errores > 0 ? ` · ${cuantos(avance.errores, "error", "errores")}` : ""}
          </p>
          {simulada ? <p className="text-sm text-green-900/80">Pasarela simulada: no ha salido ningún correo de verdad.</p> : null}
        </div>
        {cifras}
      </PasoDelAsistente>
    );
  }

  return (
    <PasoDelAsistente
      ancho="normal"
      titulo={estado === "pausada" ? "Envío detenido" : "Enviando…"}
      subtitulo={
        estado === "pausada"
          ? "Los pendientes siguen pendientes. Puedes reanudarlo cuando quieras."
          : enviando
            ? "No cierres esta página: cerrarla detiene el envío."
            : "El envío está a medias y ahora mismo no sale nada: nadie tiene esta página enviando."
      }
      pie={
        <BarraDeAcciones
          atras={
            enviando ? null : (
              <BotonEnlace href={COMUNICACIONES_PATH} variante="texto">
                Volver al historial
              </BotonEnlace>
            )
          }
          motivo={envio.aviso}
          extra={
            puedeEscribir && estado === "enviando" ? (
              enviando ? (
                <Boton variante="peligro" icono={<Icono nombre="pausa" />} disabled={ocupado} onClick={() => void envio.detener()}>
                  Detener
                </Boton>
              ) : (
                <Boton variante="secundario" disabled={ocupado} onClick={() => void envio.detener()}>
                  Dejarlo detenido
                </Boton>
              )
            ) : null
          }
          principal={
            puedeEscribir && estado === "enviando" && !enviando ? (
              <Boton variante="primario" icono={<Icono nombre="play" />} disabled={ocupado} onClick={() => void envio.enviarTandas()}>
                Continuar el envío
              </Boton>
            ) : puedeEscribir && estado === "pausada" ? (
              <Boton variante="primario" icono={<Icono nombre="play" />} disabled={ocupado || enviando} onClick={() => void envio.reanudar()}>
                Reanudar
              </Boton>
            ) : null
          }
        />
      }
    >
      <div className="rounded-xl border border-subtle/60 bg-card p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between text-sm text-text-muted">
          <span>
            {fmtInt(hechos)} de {fmtInt(avance.total)}
            {enviando ? ` · en tandas de ${TANDA}` : ""}
          </span>
          <span className="text-lg font-semibold tabular-nums text-text-primary">{porcentaje} %</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full bg-icam-900 transition-all ${enviando ? "animate-pulse" : ""}`} style={{ width: `${porcentaje}%` }} />
        </div>
      </div>
      {cifras}
      {simulada ? <Aviso tipo="info">Pasarela simulada: no ha salido ningún correo de verdad.</Aviso> : null}
      {envio.error ? <Aviso tipo="error">{envio.error}</Aviso> : null}
    </PasoDelAsistente>
  );
}
