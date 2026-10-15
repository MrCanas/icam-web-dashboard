import Link from "next/link";

import { Aviso } from "@/components/ui/Aviso";
import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess, getUserRole } from "@/lib/auth/permissions";
import { esMedible, porQueNoEsMedible } from "@/modules/comunicaciones/logic/analitica";
import { nombreDeAudiencia, pasoAMostrar } from "@/modules/comunicaciones/logic/asistente";
import { calcularProgreso, simularCandado } from "@/modules/comunicaciones/logic/envio";
import { loadDatosDeEnvios, loadDetalle } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_PATH, ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";
import { Asistente } from "@/modules/comunicaciones/ui/components/asistente/Asistente";
import { entornoDe } from "@/modules/comunicaciones/ui/components/asistente/entorno";
import { AvisoDeSeguimiento } from "@/modules/comunicaciones/ui/components/AvisoDeSeguimiento";
import type { CandadoSimulado } from "@/modules/comunicaciones/ui/components/envio/EnvioPanel";
import { SeguimientoBoton } from "@/modules/comunicaciones/ui/components/SeguimientoModal";
import DetalleClasicoPage from "@/modules/comunicaciones/ui/pages/DetalleClasicoPage";
import ResumenPage from "@/modules/comunicaciones/ui/pages/ResumenPage";

/**
 * Una comunicación. Mientras se prepara o se envía, es el asistente de envío
 * (a pantalla completa, paso a paso). Una vez enviada o descartada, su resumen.
 *
 * `?clasica=1` abre la página de antes, con pestañas, mientras se valida el
 * asistente.
 *
 * Los destinatarios son una foto tomada al preparar. No se recalculan solos: lo
 * que se revisa aquí es exactamente lo que después se envía.
 */
export default async function DetallePage({
  ctx,
  id,
  paso,
  clasica,
}: {
  ctx: UserContext;
  id: string;
  paso?: string;
  clasica?: boolean;
}) {
  if (clasica) return <DetalleClasicoPage ctx={ctx} id={id} />;

  const [{ comunicacion, destinatarios, resumen, ajustes, eventos, enlaces, error }, envios] = await Promise.all([
    loadDetalle(ctx, id),
    loadDatosDeEnvios(ctx),
  ]);

  if (error) {
    return (
      <div className="min-w-0">
        <Aviso tipo="error">No se pudo leer la comunicación: {error}</Aviso>
      </div>
    );
  }
  if (!comunicacion) {
    return (
      <div className="min-w-0">
        <Aviso tipo="aviso">
          Esta comunicación no existe.{" "}
          <Link href={COMUNICACIONES_PATH} className="font-medium underline underline-offset-2">
            Volver al historial
          </Link>
        </Aviso>
      </div>
    );
  }

  const puedeEscribir = checkWriteAccess(ctx, ZONA_COMUNICACIONES) === null;
  const enviada = comunicacion.estado === "enviada";

  const seguimiento = (etiqueta?: string) =>
    puedeEscribir && ["enviando", "pausada", "enviada"].includes(comunicacion.estado) ? (
      <SeguimientoBoton
        comunicacionId={comunicacion.id}
        destinatarios={destinatarios}
        enlaces={enlaces}
        eventos={eventos}
        medible={esMedible(comunicacion)}
        porQueNoEsMedible={porQueNoEsMedible(comunicacion)}
        plantilla={comunicacion.plantilla_id ? { id: comunicacion.plantilla_id, nombre: comunicacion.plantilla_nombre } : null}
        etiqueta={etiqueta}
        variante={enviada ? "primario" : "secundario"}
      />
    ) : null;

  // Enviada (salvo justo al terminar, que el asistente enseña su pantalla final) o descartada: el resumen.
  if (comunicacion.estado === "cancelada" || (enviada && paso !== "enviar") || !ajustes) {
    return (
      <ResumenPage
        comunicacion={comunicacion}
        destinatarios={destinatarios}
        resumen={resumen}
        ajustes={ajustes}
        progreso={calcularProgreso(destinatarios)}
        seguimiento={seguimiento()}
      />
    );
  }

  // Qué dejaría salir el candado de ESTA comunicación, calculado con las mismas
  // funciones que el envío. Se enseña desde el principio: quien ve 125 inversores
  // en la lista tiene que saber, al lado, que no se les puede escribir.
  const simulacion = envios.permitidos
    ? simularCandado(
        { plantilla_id: comunicacion.plantilla_id ?? "(sin elegir)", plantilla_modulo: comunicacion.plantilla_modulo },
        destinatarios,
        {
          modo: ajustes.modo,
          usuarioEmail: ctx.email,
          remitente: comunicacion.remitente_email ?? ctx.email,
        },
        envios.permitidos,
      )
    : null;
  const candado: CandadoSimulado | null = simulacion
    ? {
        permitidos: simulacion.permitidos.length,
        rechazados: simulacion.rechazados.length,
        primerRechazo: simulacion.rechazados[0] ?? null,
        // Las direcciones EXACTAS a las que saldría algo, juntas y sin repetir.
        direcciones: [
          ...new Set(simulacion.permitidos.flatMap(({ correo }) => [...correo.para, ...correo.copia, ...correo.copiaOculta])),
        ].sort(),
      }
    : null;

  const aEnviar = destinatarios.filter((d) => !d.excluido && d.para.length > 0);

  return (
    <Asistente
      comunicacion={comunicacion}
      destinatarios={destinatarios}
      resumen={resumen}
      ajustes={ajustes}
      rol={getUserRole(ctx, ZONA_COMUNICACIONES)}
      usuarioEmail={ctx.email}
      pasarela={envios.pasarela}
      entorno={entornoDe(envios)}
      progreso={calcularProgreso(destinatarios)}
      lineas={aEnviar.map((d) => `${d.cuenta_nombre} — ${d.para.map((p) => p.email).join(", ")}`)}
      candado={candado}
      pasoInicial={pasoAMostrar(paso, comunicacion)}
      audiencia={nombreDeAudiencia(comunicacion)}
      avisoDeSeguimiento={<AvisoDeSeguimiento comunicacion={comunicacion} />}
      seguimiento={seguimiento("Preparar seguimiento")}
    />
  );
}
