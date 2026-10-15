import type { ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { BotonEnlace } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { Icono } from "@/components/ui/Icono";
import { KPICard } from "@/components/ui/KPICard";
import { Tabs } from "@/components/ui/Tabs";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { nombreDeAudiencia } from "@/modules/comunicaciones/logic/asistente";
import type { Progreso } from "@/modules/comunicaciones/logic/envio";
import { comunicacionAnaliticaPath, COMUNICACIONES_PATH } from "@/modules/comunicaciones/logic/paths";
import {
  ETIQUETA_ROL,
  ETIQUETA_TIPO,
  type ComAjustesRow,
  type ComComunicacionRow,
  type ComDestinatarioRow,
  type ResumenDestinatarios,
} from "@/modules/comunicaciones/types";
import { AvisoDeSeguimiento } from "@/modules/comunicaciones/ui/components/AvisoDeSeguimiento";
import { DestinatariosPanel } from "@/modules/comunicaciones/ui/components/DestinatariosPanel";
import { cuantos } from "@/modules/comunicaciones/ui/components/envio/texto";
import { PlantillaPanel } from "@/modules/comunicaciones/ui/components/PlantillaPanel";
import { ChipEstadoComunicacion } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";

/**
 * Una comunicación enviada o descartada: qué salió, a quién y con qué
 * plantilla, en solo lectura. El seguimiento y la analítica salen de aquí.
 */
export default function ResumenPage({
  comunicacion,
  destinatarios,
  resumen,
  ajustes,
  progreso,
  seguimiento,
}: {
  comunicacion: ComComunicacionRow;
  destinatarios: ComDestinatarioRow[];
  resumen: ResumenDestinatarios;
  ajustes: ComAjustesRow | null;
  progreso: Progreso;
  seguimiento: ReactNode;
}) {
  const enviada = comunicacion.estado === "enviada";
  const cancelada = comunicacion.estado === "cancelada";
  const roles = (lista: readonly (keyof typeof ETIQUETA_ROL)[]) =>
    lista.length > 0 ? lista.map((r) => ETIQUETA_ROL[r]).join(", ") : "nadie";
  const aEnviar = destinatarios.filter((d) => !d.excluido && d.para.length > 0);

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        ruta={[{ etiqueta: "Comunicaciones", href: COMUNICACIONES_PATH }, { etiqueta: comunicacion.nombre }]}
        titulo={comunicacion.nombre}
        chips={
          <>
            <ChipEstadoComunicacion estado={comunicacion.estado} pasarela={comunicacion.pasarela} />
            <Chip tono="neutro">{ETIQUETA_TIPO[comunicacion.tipo]}</Chip>
            <Chip tono="neutro">{nombreDeAudiencia(comunicacion)}</Chip>
          </>
        }
        meta={
          <>
            Para: {roles(comunicacion.roles_para)} · Copia: {roles(comunicacion.roles_copia)} · Preparada el{" "}
            {fmtFechaHora(comunicacion.created_at)} por {comunicacion.creada_por_email} con datos de Zoho del{" "}
            {fmtFechaHora(comunicacion.datos_zoho_at)}
          </>
        }
        acciones={
          <>
            {seguimiento}
            {enviada ? (
              <BotonEnlace href={comunicacionAnaliticaPath(comunicacion.id)} variante="secundario" icono={<Icono nombre="grafica" />}>
                Ver analítica
              </BotonEnlace>
            ) : null}
          </>
        }
      />

      <AvisoDeSeguimiento comunicacion={comunicacion} />

      {!ajustes && !cancelada && !enviada ? <Aviso tipo="aviso">No se pudieron leer los ajustes de envío.</Aviso> : null}

      {cancelada ? (
        <Aviso tipo="info" titulo="Descartada">
          No se envió. Queda en el historial tal como estaba al descartarla.
        </Aviso>
      ) : null}

      {enviada ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
            <Icono nombre="check" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-green-900">
              Enviada{comunicacion.enviada_at ? ` el ${fmtFechaHora(comunicacion.enviada_at)}` : ""} ·{" "}
              {cuantos(progreso.enviados, "correo", "correos")}
              {progreso.errores > 0 ? ` · ${cuantos(progreso.errores, "error", "errores")}` : ""}
              {progreso.omitidos > 0 ? ` · ${cuantos(progreso.omitidos, "omitido", "omitidos")}` : ""}
            </p>
            <p className="text-sm text-green-900/80">
              Con «{comunicacion.plantilla_nombre}», desde {comunicacion.remitente_email}
              {comunicacion.pasarela === "simulada" ? " · pasarela simulada: no salió ningún correo de verdad" : ""}
            </p>
          </div>
        </div>
      ) : null}

      {!enviada ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <KPICard title="Correos que saldrían" value={fmtInt(resumen.aEnviar)} subtitle="uno por cuenta" highlight />
          <KPICard title="Direcciones en Para" value={fmtInt(resumen.direcciones)} subtitle={`${fmtInt(resumen.direccionesExternas)} externas`} />
          <KPICard title="Excluidos" value={fmtInt(resumen.excluidos)} subtitle={`de ${fmtInt(resumen.total)} cuentas en la lista`} />
          <KPICard title="Sin destinatario" value={fmtInt(resumen.sinDestinatario)} subtitle="no recibirían nada" />
        </div>
      ) : null}

      <Tabs
        pestanas={[
          { clave: "destinatarios", etiqueta: "Destinatarios", extra: fmtInt(resumen.total) },
          { clave: "plantilla", etiqueta: "Contenido" },
        ]}
        porDefecto="destinatarios"
      >
        {{
          destinatarios: (
            <DestinatariosPanel
              comunicacionId={comunicacion.id}
              nombre={comunicacion.nombre}
              destinatarios={destinatarios}
              dominiosInternos={ajustes?.dominios_internos ?? []}
              editable={false}
            />
          ),
          plantilla: (
            <PlantillaPanel
              comunicacionId={comunicacion.id}
              plantillaId={comunicacion.plantilla_id}
              plantillaNombre={comunicacion.plantilla_nombre}
              destinatarios={aEnviar.map((d) => ({ id: d.id, nombre: d.cuenta_nombre }))}
              editable={false}
            />
          ),
        }}
      </Tabs>
    </div>
  );
}
