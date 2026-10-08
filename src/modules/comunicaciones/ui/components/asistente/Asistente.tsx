"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { Icono } from "@/components/ui/Icono";
import { Stepper } from "@/components/ui/Stepper";
import { fmtFechaHora } from "@/lib/formatters";
import {
  avisoDeRetroceso,
  ETIQUETA_PASO,
  estadosDePasos,
  pasoAnterior,
  pasoSiguiente,
  PASOS,
  pasoSugerido,
  puedeIrA,
  type PasoAsistente,
} from "@/modules/comunicaciones/logic/asistente";
import type { ContextoControles, RolZona } from "@/modules/comunicaciones/logic/controles";
import type { Progreso } from "@/modules/comunicaciones/logic/envio";
import { comunicacionPath, COMUNICACIONES_NUEVA_PATH } from "@/modules/comunicaciones/logic/paths";
import {
  ESTADOS_EDITABLES,
  ETIQUETA_ROL,
  ETIQUETA_TIPO,
  type ComAjustesRow,
  type ComComunicacionRow,
  type ComDestinatarioRow,
  type EstadoComunicacion,
  type NombrePasarela,
  type ResumenDestinatarios,
} from "@/modules/comunicaciones/types";
import { CancelarButton } from "@/modules/comunicaciones/ui/components/CancelarButton";
import type { CandadoSimulado } from "@/modules/comunicaciones/ui/components/envio/EnvioPanel";

import { ChipEntorno } from "./ChipEntorno";
import type { EntornoDeEnvio } from "./entorno";
import { BarraDeAcciones, ID_CUERPO_DEL_ASISTENTE, ModoFoco, PasoDelAsistente } from "./marco";
import { PasoContenido } from "./PasoContenido";
import { PasoDePrueba } from "./PasoDePrueba";
import { PasoDestinatarios } from "./PasoDestinatarios";
import { PasoRevisarYEnviar } from "./PasoRevisarYEnviar";

interface Props {
  comunicacion: ComComunicacionRow;
  destinatarios: ComDestinatarioRow[];
  resumen: ResumenDestinatarios;
  ajustes: ComAjustesRow;
  rol: RolZona;
  usuarioEmail: string;
  pasarela: NombrePasarela;
  entorno: EntornoDeEnvio;
  progreso: Progreso;
  lineas: string[];
  candado: CandadoSimulado | null;
  /** El paso con el que se abre (de `?paso=`, ya validado en el servidor). */
  pasoInicial: PasoAsistente;
  /** «PROMOCIONTEST», «Toda la base»… */
  audiencia: string;
  /** Si es un seguimiento, de dónde sale y qué cambió. */
  avisoDeSeguimiento?: ReactNode;
  seguimiento?: ReactNode;
}

/**
 * El asistente de envío: cinco pasos, uno en pantalla cada vez, con el
 * siguiente siempre a la vista.
 *
 * El paso que se ve vive en `?paso=` (se puede recargar y compartir); hacia
 * delante solo se llega hasta el primero que falta. Cada «Continuar» que hace
 * algo pasa por su acción del servidor, que vuelve a comprobar los controles.
 */
export function Asistente(props: Props) {
  const { comunicacion, destinatarios, resumen, ajustes, rol, usuarioEmail, pasarela, entorno, progreso, lineas, candado, audiencia } = props;
  const router = useRouter();
  const [paso, setPaso] = useState<PasoAsistente>(props.pasoInicial);
  // Si la comunicación retrocede (se cambió la lista o la plantilla), se dice qué repetir.
  const [estadoPrevio, setEstadoPrevio] = useState<EstadoComunicacion>(comunicacion.estado);
  const [retroceso, setRetroceso] = useState<string | null>(null);
  if (estadoPrevio !== comunicacion.estado) {
    setEstadoPrevio(comunicacion.estado);
    setRetroceso(avisoDeRetroceso(estadoPrevio, comunicacion.estado));
  }

  const ctx: ContextoControles = { comunicacion, resumen, ajustes, rol };
  const puedeEscribir = rol === "admin" || rol === "editor";
  const editable = puedeEscribir && ESTADOS_EDITABLES.includes(comunicacion.estado);
  const bloqueadaPorCandado = candado !== null && candado.rechazados > 0 && ESTADOS_EDITABLES.includes(comunicacion.estado);
  // Mientras llega del servidor el estado que permite el paso pedido, se queda en el que se puede.
  const viendo: PasoAsistente = puedeIrA(paso, comunicacion) ? paso : pasoSugerido(comunicacion);

  const ir = (destino: PasoAsistente) => {
    setPaso(destino);
    setRetroceso(null);
    window.history.replaceState(null, "", `${comunicacionPath(comunicacion.id)}?paso=${destino}`);
    document.getElementById(ID_CUERPO_DEL_ASISTENTE)?.scrollTo({ top: 0 });
  };

  /** Tras una acción del servidor: avanza y trae el estado nuevo. */
  const avanzar = (desde: PasoAsistente) => {
    const siguiente = pasoSiguiente(desde);
    if (siguiente) ir(siguiente);
    router.refresh();
  };

  const anterior = pasoAnterior(viendo);
  const atras = anterior ? (
    <Boton variante="secundario" onClick={() => ir(anterior)}>
      <Icono nombre="chevron" className="h-3.5 w-3.5 rotate-180" />
      Atrás
    </Boton>
  ) : null;

  const estados = estadosDePasos(comunicacion, viendo, bloqueadaPorCandado);
  const notas: Partial<Record<PasoAsistente, string>> = {
    destinatarios: comunicacion.revisada_at ? `Revisada ${fmtFechaHora(comunicacion.revisada_at)}` : undefined,
    prueba: comunicacion.probada_at ? `Probada ${fmtFechaHora(comunicacion.probada_at)}` : undefined,
    enviar: bloqueadaPorCandado ? "El candado no la deja salir" : undefined,
  };

  const aEnviar = destinatarios.filter((d) => !d.excluido && d.para.length > 0);

  let contenido: ReactNode;
  switch (viendo) {
    case "audiencia":
      contenido = (
        <PasoDelAsistente
          ancho="estrecho"
          titulo="¿A quién va dirigida?"
          subtitulo="La audiencia se fija al preparar la comunicación. Para otra audiencia, empieza una nueva."
          pie={
            <BarraDeAcciones
              principal={
                <Boton variante="primario" onClick={() => ir("destinatarios")}>
                  Continuar a Destinatarios
                  <Icono nombre="chevron" className="h-3.5 w-3.5" />
                </Boton>
              }
            />
          }
        >
          {props.avisoDeSeguimiento}
          <dl className="divide-y divide-subtle/60 overflow-hidden rounded-xl border border-subtle/60 bg-card text-sm shadow-sm">
            {(
              [
                ["Audiencia", audiencia],
                ["Tipo", ETIQUETA_TIPO[comunicacion.tipo]],
                ["En Para", comunicacion.roles_para.map((r) => ETIQUETA_ROL[r]).join(", ") || "nadie"],
                ["En copia", comunicacion.roles_copia.map((r) => ETIQUETA_ROL[r]).join(", ") || "nadie"],
                ["Datos de Zoho", fmtFechaHora(comunicacion.datos_zoho_at)],
                ["Preparada", `${fmtFechaHora(comunicacion.created_at)} por ${comunicacion.creada_por_email}`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
                <dt className="text-text-muted">{k}</dt>
                <dd className="font-medium text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          {puedeEscribir ? (
            <p className="text-sm text-text-muted">
              ¿Necesitas otra audiencia?{" "}
              <Link href={COMUNICACIONES_NUEVA_PATH} className="font-medium text-icam-900 underline-offset-2 hover:underline">
                Empieza una comunicación nueva
              </Link>
              .
            </p>
          ) : null}
        </PasoDelAsistente>
      );
      break;
    case "destinatarios":
      contenido = (
        <PasoDestinatarios
          ctx={ctx}
          destinatarios={destinatarios}
          dominiosInternos={ajustes.dominios_internos}
          editable={editable}
          puedeEscribir={puedeEscribir && ESTADOS_EDITABLES.includes(comunicacion.estado)}
          atras={atras}
          onContinuar={() => avanzar("destinatarios")}
        />
      );
      break;
    case "contenido":
      contenido = (
        <PasoContenido
          ctx={ctx}
          destinatarios={aEnviar.map((d) => ({ id: d.id, nombre: d.cuenta_nombre }))}
          editable={editable}
          atras={atras}
          onContinuar={() => ir("prueba")}
        />
      );
      break;
    case "prueba":
      contenido = (
        <PasoDePrueba
          ctx={ctx}
          usuarioEmail={usuarioEmail}
          puedeEscribir={puedeEscribir && ESTADOS_EDITABLES.includes(comunicacion.estado)}
          atras={atras}
          onContinuar={() => avanzar("prueba")}
        />
      );
      break;
    case "enviar":
      contenido = (
        <PasoRevisarYEnviar
          ctx={ctx}
          usuarioEmail={usuarioEmail}
          pasarela={pasarela}
          audiencia={audiencia}
          lineas={lineas}
          candado={candado}
          progreso={progreso}
          puedeEscribir={puedeEscribir}
          atras={atras}
          ir={ir}
          seguimiento={props.seguimiento}
        />
      );
      break;
  }

  return (
    <ModoFoco
      titulo={comunicacion.nombre}
      subtitulo={`${ETIQUETA_TIPO[comunicacion.tipo]} · ${audiencia} · se guarda sola en cada paso`}
      entorno={<ChipEntorno entorno={entorno} bloqueada={bloqueadaPorCandado} />}
      acciones={editable ? <CancelarButton comunicacionId={comunicacion.id} /> : null}
      stepper={
        <Stepper
          variante="linea"
          etiqueta="Pasos del envío"
          onIr={(clave) => ir(clave as PasoAsistente)}
          pasos={PASOS.map((p) => ({
            clave: p,
            etiqueta: ETIQUETA_PASO[p],
            estado: estados[p],
            href: puedeIrA(p, comunicacion) ? `${comunicacionPath(comunicacion.id)}?paso=${p}` : undefined,
            nota: notas[p],
          }))}
        />
      }
    >
      {!puedeEscribir || retroceso ? (
        <div className="mx-auto w-full max-w-6xl space-y-2 px-4 pt-4 sm:px-6">
          {!puedeEscribir ? (
            <Aviso tipo="info">Tu rol en Comunicaciones es de lectura: puedes ver en qué punto está, pero no enviar.</Aviso>
          ) : null}
          {retroceso ? <Aviso tipo="aviso">{retroceso}</Aviso> : null}
        </div>
      ) : null}
      {contenido}
    </ModoFoco>
  );
}
