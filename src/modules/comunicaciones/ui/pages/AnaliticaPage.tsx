import Link from "next/link";

import { Aviso } from "@/components/ui/Aviso";
import { BotonEnlace } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { Icono } from "@/components/ui/Icono";
import { KPICard } from "@/components/ui/KPICard";
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
import { AvisoDeAnalitica, pct } from "@/modules/comunicaciones/ui/components/CifrasDeAnalitica";
import { SeguimientoBoton } from "@/modules/comunicaciones/ui/components/SeguimientoModal";
import { ChipEstadoComunicacion } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";

/**
 * La analítica de UN correo: cuántos lo abrieron, cuántos pulsaron y qué, y
 * destinatario a destinatario.
 *
 * Cada envío tiene su propio seguimiento: si la misma plantilla se ha enviado
 * otra vez, o esta comunicación tiene seguimientos, aquí solo están las cifras
 * de este envío. El conjunto está en la pestaña Analítica.
 */
export default async function AnaliticaPage({ ctx, id }: { ctx: UserContext; id: string }) {
  const { comunicacion, destinatarios, eventos, enlaces, origen, reenvios, error } = await loadAnalitica(ctx, id);

  if (error) {
    return (
      <div className="min-w-0">
        <Aviso tipo="error">No se pudo leer la analítica: {error}</Aviso>
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

  const cifras = cifrasDe(destinatarios);
  const medible = esMedible(comunicacion);
  const noMedible = porQueNoEsMedible(comunicacion);
  const desde = comunicacion.confirmada_at ?? comunicacion.enviada_at ?? null;
  const puedeEscribir = checkWriteAccess(ctx, ZONA_COMUNICACIONES) === null;
  const enviada = ["enviando", "pausada", "enviada"].includes(comunicacion.estado);

  const seguimiento = (props: { etiqueta?: string; pequeno?: boolean; variante?: "primario" | "secundario" }) =>
    enviada && puedeEscribir ? (
      <SeguimientoBoton
        comunicacionId={comunicacion.id}
        destinatarios={destinatarios}
        enlaces={enlaces}
        eventos={eventos}
        medible={medible}
        porQueNoEsMedible={noMedible}
        plantilla={comunicacion.plantilla_id ? { id: comunicacion.plantilla_id, nombre: comunicacion.plantilla_nombre } : null}
        {...props}
      />
    ) : null;

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        ruta={[
          { etiqueta: "Comunicaciones", href: COMUNICACIONES_PATH },
          { etiqueta: comunicacion.nombre, href: comunicacionPath(comunicacion.id) },
          { etiqueta: "Analítica" },
        ]}
        titulo={comunicacion.nombre}
        chips={
          <>
            <ChipEstadoComunicacion estado={comunicacion.estado} pasarela={comunicacion.pasarela} />
            {!medible ? <Chip tono="aviso">no mide a los destinatarios</Chip> : null}
          </>
        }
        meta={
          <>
            Plantilla: {comunicacion.plantilla_nombre ?? "—"}
            {desde ? ` · confirmada el ${fmtFechaHora(desde)}` : ""}
            {comunicacion.remitente_email ? ` · remitente ${comunicacion.remitente_email}` : ""}
            {origen ? (
              <>
                {" · seguimiento de "}
                <Link href={comunicacionAnaliticaPath(origen.id)} className="text-icam-900 underline-offset-2 hover:underline">
                  {origen.nombre}
                </Link>
              </>
            ) : null}
            {reenvios.length > 0 ? (
              <>
                {" · "}
                {reenvios.length === 1 ? "un seguimiento" : `${fmtInt(reenvios.length)} seguimientos`}:{" "}
                {reenvios.map((r, i) => (
                  <span key={r.id}>
                    {i > 0 ? ", " : ""}
                    <Link href={comunicacionAnaliticaPath(r.id)} className="text-icam-900 underline-offset-2 hover:underline">
                      {r.nombre}
                    </Link>
                  </span>
                ))}
              </>
            ) : null}
          </>
        }
        acciones={
          <>
            <BotonEnlace href={comunicacionPath(comunicacion.id)} variante="secundario">
              Ver la comunicación
            </BotonEnlace>
            <BotonEnlace href={COMUNICACIONES_ANALITICA_PATH} variante="secundario" icono={<Icono nombre="grafica" />}>
              Analítica de todas
            </BotonEnlace>
            {seguimiento({ variante: "primario" })}
          </>
        }
      />

      {noMedible ? (
        <Aviso tipo="aviso" titulo="Estas cifras no miden a los destinatarios">
          {noMedible} No entra en la analítica agregada.
        </Aviso>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KPICard title="Correos enviados" value={fmtInt(cifras.enviados)} />
        <KPICard title="Abrieron" value={fmtInt(cifras.abiertos)} subtitle={`${pct(cifras.tasaApertura)} de los enviados`} highlight />
        <KPICard title="Hicieron clic" value={fmtInt(cifras.conClic)} subtitle={`${pct(cifras.tasaClic)} de los enviados`} />
        <KPICard title="Errores al enviar" value={fmtInt(cifras.errores)} />
        <KPICard title="Omitidos" value={fmtInt(cifras.omitidos)} subtitle="dirección repetida" />
        <KPICard
          title="Rebotados"
          value={fmtInt(cifras.rebotados)}
          subtitle={`Zoho da el dato de ${fmtInt(cifras.conDatoDeEntrega)} de ${fmtInt(cifras.enviados)}`}
        />
      </div>

      <AvisoDeAnalitica />

      <AnaliticaPanel
        comunicacionId={comunicacion.id}
        nombre={comunicacion.nombre}
        destinatarios={destinatarios}
        eventos={eventos}
        enlaces={clicsPorEnlace(eventos, enlaces)}
        enlacesDePlantilla={enlaces}
        serie={serieTemporal(eventos, desde, 72)}
        medible={medible}
        porQueNoEsMedible={noMedible}
        plantilla={comunicacion.plantilla_id ? { id: comunicacion.plantilla_id, nombre: comunicacion.plantilla_nombre } : null}
        puedeEscribir={puedeEscribir}
        salioPorZoho={comunicacion.pasarela === "zoho"}
      />
    </div>
  );
}
