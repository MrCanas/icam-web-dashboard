"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Desplegable } from "@/components/ui/Ayuda";
import { fmtInt } from "@/lib/formatters";
import {
  ensayarEnvioAction,
  enviarPruebaAction,
  type InformeDeEnsayo,
  marcarPruebaVistaAction,
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
import type { Progreso } from "@/modules/comunicaciones/logic/envio";
import type {
  ComAjustesRow,
  ComComunicacionRow,
  NombrePasarela,
  ResumenDestinatarios,
} from "@/modules/comunicaciones/types";
import { ListaDeDirecciones } from "@/modules/comunicaciones/ui/components/ui/ListaDeDirecciones";

import { PasoConfirmar } from "./PasoConfirmar";
import { PasoEnvio } from "./PasoEnvio";
import { PasoPrueba } from "./PasoPrueba";
import { PasoRevisar } from "./PasoRevisar";
import { cuantos } from "./texto";
import { useEnvioPorTandas } from "./useEnvioPorTandas";

export interface CandadoSimulado {
  permitidos: number;
  rechazados: number;
  primerRechazo: { cuenta: string; motivo: string } | null;
  /** Las direcciones exactas a las que saldría algo. */
  direcciones: string[];
}

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
  candado: CandadoSimulado | null;
  /** El botón de seguimiento, para ofrecerlo al terminar. */
  seguimiento?: ReactNode;
}

/**
 * Los pasos hasta el envío, en orden, y el envío mismo.
 *
 * La pantalla explica qué falta y apaga lo que todavía no toca, pero no es ella
 * quien lo impide: cada acción vuelve a comprobarlo en el servidor. Las tandas
 * las pide esta pantalla una a una, así que cerrarla deja de enviar.
 *
 * Este fichero es el orquestador: aquí viven el estado, el bucle de tandas y
 * las llamadas; los pasos (`Paso*.tsx`) solo pintan y avisan.
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
  seguimiento,
}: Props) {
  const router = useRouter();
  const [ocupadoAqui, setOcupado] = useState(false);
  const [errorAqui, setError] = useState<string | null>(null);
  const [avisoAqui, setAviso] = useState<string | null>(null);
  const [remitente, setRemitente] = useState(
    ajustes.remitentes_permitidos.includes(usuarioEmail.toLowerCase())
      ? usuarioEmail.toLowerCase()
      : (comunicacion.remitente_email ?? ajustes.remitentes_permitidos[0] ?? ""),
  );
  const [numero, setNumero] = useState("");
  const [ensayando, setEnsayando] = useState(false);
  const [informe, setInforme] = useState<InformeDeEnsayo | null>(null);
  const envio = useEnvioPorTandas({ comunicacionId: comunicacion.id, estadoInicial: comunicacion.estado, progresoInicial: progreso });
  const { estado, avance, enviando, enviarTandas, detener, reanudar } = envio;
  const ocupado = ocupadoAqui || envio.ocupado;
  const error = errorAqui ?? envio.error;
  const aviso = avisoAqui ?? envio.aviso;

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
    setError(null);
    setAviso(null);
    await envio.confirmar(Number(numero));
  };

  const revisada = estado !== "borrador";
  const probada = !["borrador", "revisada"].includes(estado);
  const confirmada = ["enviando", "pausada", "enviada"].includes(estado);
  const hayPrueba = pruebaVigente(comunicacion);

  const motivoRevisar = puedeRevisar(ctx, resumen.aEnviar);
  const motivoPrueba = puedeEnviarPrueba(ctx, remitente);
  const motivoMarcar = puedeMarcarPrueba(ctx);
  const motivoConfirmar = puedeConfirmar(ctx, Number(numero));
  const motivoEnsayar = puedeEnsayar(ctx);
  const motivoDelEnsayo = ensayoVigente(ctx);
  const ensayoHecho = motivoEnsayar === null && motivoDelEnsayo === null;
  const simulada = pasarela === "simulada";

  // Antes de empezar, si el candado rechazaría un solo correo, aquí no hay nada
  // que pulsar: se dice por qué y no se ofrece ningún paso.
  if (!confirmada && candado && candado.rechazados > 0) {
    return (
      <div className="space-y-3">
        <Aviso tipo="error" titulo="Esta comunicación no se puede enviar">
          El candado de destinatarios rechazaría {fmtInt(candado.rechazados)} de sus{" "}
          {fmtInt(candado.rechazados + candado.permitidos)} correos, así que no se envía ninguno.
          {candado.primerRechazo ? ` Por ejemplo, ${candado.primerRechazo.cuenta}: ${candado.primerRechazo.motivo}.` : ""}
        </Aviso>
        <Desplegable titulo="Por qué, y para qué sirve entonces la lista">
          <p>
            Mientras el candado exista, este módulo solo puede escribir a las direcciones de la lista cerrada y
            sobre las cuentas de prueba de la promoción de pruebas. La lista de destinatarios es a quién iría si no
            hubiera candado: sirve para revisarla, pero a nadie de ella se le escribe.
          </p>
        </Desplegable>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!confirmada && candado ? (
        <Aviso tipo="info" titulo={`Con el candado y el modo de ahora ${candado.permitidos === 1 ? "saldría" : "saldrían"} ${cuantos(candado.permitidos, "correo", "correos")}`}>
          <p className="mb-1">
            {candado.direcciones.length === 1 ? "La única dirección que recibiría algo:" : "Las únicas direcciones que recibirían algo:"}
          </p>
          <ListaDeDirecciones direcciones={candado.direcciones} tono="marca" />
        </Aviso>
      ) : null}

      {!puedeEscribir ? (
        <Aviso tipo="info">Tu rol en Comunicaciones es de lectura: puedes ver en qué punto está, pero no enviar.</Aviso>
      ) : null}

      <ol className="space-y-2">
        <PasoRevisar
          comunicacion={comunicacion}
          resumen={resumen}
          hecho={revisada}
          puedeEscribir={puedeEscribir}
          ocupado={ocupado}
          motivo={motivoRevisar}
          onRevisar={() => ejecutar(() => revisarDestinatariosAction(comunicacion.id, resumen.aEnviar))}
        />

        <PasoPrueba
          comunicacion={comunicacion}
          ajustes={ajustes}
          usuarioEmail={usuarioEmail}
          hecho={probada}
          bloqueado={!revisada}
          hayPrueba={hayPrueba}
          puedeEscribir={puedeEscribir}
          ocupado={ocupado}
          remitente={remitente}
          onRemitente={setRemitente}
          motivoPrueba={motivoPrueba}
          motivoMarcar={motivoMarcar}
          onEnviarPrueba={() =>
            ejecutar(async () => {
              const r = await enviarPruebaAction(comunicacion.id, remitente);
              return r.ok ? { ok: true as const } : r;
            }, `Prueba enviada a ${usuarioEmail}.`)
          }
          onMarcarVista={() => ejecutar(() => marcarPruebaVistaAction(comunicacion.id))}
        />

        <PasoConfirmar
          comunicacion={comunicacion}
          resumen={resumen}
          ajustes={ajustes}
          usuarioEmail={usuarioEmail}
          pasarela={pasarela}
          lineas={lineas}
          hecho={confirmada}
          bloqueado={!probada}
          puedeEscribir={puedeEscribir}
          ocupado={ocupado}
          enviando={enviando}
          ensayando={ensayando}
          ensayoHecho={ensayoHecho}
          informe={informe}
          motivoEnsayar={motivoEnsayar}
          motivoDelEnsayo={motivoDelEnsayo}
          motivoConfirmar={motivoConfirmar}
          numero={numero}
          onNumero={setNumero}
          onEnsayar={ensayar}
          onConfirmar={confirmar}
        />

        {confirmada ? (
          <PasoEnvio
            comunicacion={comunicacion}
            estado={estado}
            avance={avance}
            simulada={simulada}
            enviando={enviando}
            ocupado={ocupado}
            puedeEscribir={puedeEscribir}
            onDetener={detener}
            onContinuar={enviarTandas}
            onReanudar={reanudar}
            seguimiento={seguimiento}
          />
        ) : null}
      </ol>

      {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
    </div>
  );
}
