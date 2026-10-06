import Link from "next/link";

import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import {
  cifrasDe,
  clicsPorEnlace,
  esMedible,
  porQueNoEsMedible,
  serieTemporal,
} from "@/modules/comunicaciones/logic/analitica";
import { loadAnalitica } from "@/modules/comunicaciones/logic/loadComunicaciones";
import {
  COMUNICACIONES_ANALITICA_PATH,
  COMUNICACIONES_PATH,
  comunicacionAnaliticaPath,
  comunicacionPath,
  ZONA_COMUNICACIONES,
} from "@/modules/comunicaciones/logic/paths";
import { AnaliticaPanel } from "@/modules/comunicaciones/ui/components/AnaliticaPanel";
import { AvisoDeAnalitica, Cifra, pct } from "@/modules/comunicaciones/ui/components/CifrasDeAnalitica";
import { ETIQUETA_ESTADO } from "@/modules/comunicaciones/types";

/**
 * La analítica de UN correo: cuántos lo abrieron, cuántos pulsaron y qué, y
 * destinatario a destinatario.
 *
 * Cada envío tiene su propio seguimiento: si la misma plantilla se ha enviado
 * otra vez, o esta comunicación tiene reenvíos, aquí solo están las cifras de
 * este envío. El conjunto está en la pestaña Analítica.
 */
export default async function AnaliticaPage({ ctx, id }: { ctx: UserContext; id: string }) {
  const { comunicacion, destinatarios, eventos, enlaces, origen, reenvios, error } = await loadAnalitica(ctx, id);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-4 text-sm text-[#9B3B3B]">
          No se pudo leer la analítica: {error}
        </p>
      </div>
    );
  }
  if (!comunicacion) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          Esta comunicación no existe.{" "}
          <Link href={COMUNICACIONES_PATH} className="text-icam-900 underline">
            Volver al historial
          </Link>
        </p>
      </div>
    );
  }

  const cifras = cifrasDe(destinatarios);
  const medible = esMedible(comunicacion);
  const noMedible = porQueNoEsMedible(comunicacion);
  const desde = comunicacion.confirmada_at ?? comunicacion.enviada_at ?? null;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header>
        <p className="text-sm text-text-muted">
          <Link href={COMUNICACIONES_PATH} className="underline-offset-2 hover:underline">
            Comunicaciones
          </Link>{" "}
          /{" "}
          <Link href={comunicacionPath(comunicacion.id)} className="underline-offset-2 hover:underline">
            {ETIQUETA_ESTADO[comunicacion.estado]}
          </Link>{" "}
          / Analítica
        </p>
        <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">{comunicacion.nombre}</h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Plantilla: {comunicacion.plantilla_nombre ?? "—"}
          {desde ? ` · confirmada el ${fmtFechaHora(desde)}` : ""}
          {comunicacion.remitente_email ? ` · remitente ${comunicacion.remitente_email}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href={comunicacionPath(comunicacion.id)} className="text-icam-900 underline underline-offset-2">
            Ver la comunicación
          </Link>
          <Link href={COMUNICACIONES_ANALITICA_PATH} className="text-icam-900 underline underline-offset-2">
            Analítica de todas
          </Link>
        </p>
      </header>

      {origen ? (
        <p className="rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
          Es un <strong>reenvío</strong> de{" "}
          <Link href={comunicacionAnaliticaPath(origen.id)} className="text-icam-900 underline underline-offset-2">
            {origen.nombre}
          </Link>
          . Lleva su propio seguimiento: estas cifras son solo de este envío.
        </p>
      ) : null}
      {reenvios.length > 0 ? (
        <p className="rounded-lg border border-subtle bg-card p-3 text-sm text-text-body">
          De esta comunicación {reenvios.length === 1 ? "ha salido un reenvío" : `han salido ${fmtInt(reenvios.length)} reenvíos`}:{" "}
          {reenvios.map((r, i) => (
            <span key={r.id}>
              {i > 0 ? ", " : ""}
              <Link href={comunicacionAnaliticaPath(r.id)} className="text-icam-900 underline underline-offset-2">
                {r.nombre}
              </Link>
            </span>
          ))}
          . Cada uno tiene sus propias cifras.
        </p>
      ) : null}

      {noMedible ? (
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-3 text-sm text-text-body">
          <strong className="text-[#9B3B3B]">Estas cifras no miden a los destinatarios.</strong> {noMedible} No entra
          en la analítica agregada.
        </p>
      ) : null}

      <AvisoDeAnalitica />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Cifra etiqueta="Correos enviados" valor={fmtInt(cifras.enviados)} />
        <Cifra
          etiqueta="Abrieron"
          valor={fmtInt(cifras.abiertos)}
          nota={`${pct(cifras.tasaApertura)} de los enviados`}
        />
        <Cifra etiqueta="Hicieron clic" valor={fmtInt(cifras.conClic)} nota={`${pct(cifras.tasaClic)} de los enviados`} />
        <Cifra etiqueta="Errores al enviar" valor={fmtInt(cifras.errores)} />
        <Cifra etiqueta="Omitidos" valor={fmtInt(cifras.omitidos)} nota="dirección repetida" />
        <Cifra
          etiqueta="Rebotados"
          valor={fmtInt(cifras.rebotados)}
          nota={`Zoho da el dato de ${fmtInt(cifras.conDatoDeEntrega)} de ${fmtInt(cifras.enviados)}`}
        />
      </dl>

      <AnaliticaPanel
        comunicacionId={comunicacion.id}
        nombre={comunicacion.nombre}
        destinatarios={destinatarios}
        eventos={eventos}
        enlaces={clicsPorEnlace(eventos, enlaces)}
        serie={serieTemporal(eventos, desde, 72)}
        medible={medible}
        puedeEscribir={checkWriteAccess(ctx, ZONA_COMUNICACIONES) === null}
        salioPorZoho={comunicacion.pasarela === "zoho"}
      />
    </div>
  );
}
