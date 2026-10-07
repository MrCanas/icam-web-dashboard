import Link from "next/link";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { BotonEnlace } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";
import { EncabezadoDePagina } from "@/components/ui/EncabezadoDePagina";
import { Icono } from "@/components/ui/Icono";
import { KPICard } from "@/components/ui/KPICard";
import { Stepper, type PasoDeStepper } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess, getUserRole } from "@/lib/auth/permissions";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { calcularProgreso, simularCandado } from "@/modules/comunicaciones/logic/envio";
import { loadDatosDeEnvios, loadDetalle } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { esFiltro, esMedible, ETIQUETA_FILTRO, porQueNoEsMedible } from "@/modules/comunicaciones/logic/analitica";
import {
  comunicacionAnaliticaPath,
  comunicacionPath,
  COMUNICACIONES_PATH,
  ZONA_COMUNICACIONES,
} from "@/modules/comunicaciones/logic/paths";
import { CancelarButton } from "@/modules/comunicaciones/ui/components/CancelarButton";
import { DestinatariosPanel } from "@/modules/comunicaciones/ui/components/DestinatariosPanel";
import { EnvioPanel } from "@/modules/comunicaciones/ui/components/envio/EnvioPanel";
import { PlantillaPanel } from "@/modules/comunicaciones/ui/components/PlantillaPanel";
import { SeguimientoBoton } from "@/modules/comunicaciones/ui/components/SeguimientoModal";
import { Candado } from "@/modules/comunicaciones/ui/components/ui/Candado";
import { ChipEstadoComunicacion } from "@/modules/comunicaciones/ui/components/ui/ChipEstado";
import {
  ESTADOS_EDITABLES,
  ETIQUETA_AUDIENCIA,
  ETIQUETA_ROL,
  ETIQUETA_TIPO,
  type EstadoComunicacion,
} from "@/modules/comunicaciones/types";

const ENVIADA: readonly EstadoComunicacion[] = ["enviando", "pausada", "enviada"];

/**
 * Una comunicación: a quién iría, uno por uno, cómo queda la plantilla con los
 * datos de cada destinatario y, después, los pasos hasta enviarla.
 *
 * Los destinatarios son una foto tomada al preparar. No se recalculan solos: lo
 * que se revisa aquí es exactamente lo que después se envía.
 */
export default async function DetallePage({ ctx, id }: { ctx: UserContext; id: string }) {
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
  const editable = puedeEscribir && ESTADOS_EDITABLES.includes(comunicacion.estado);
  const enviada = ENVIADA.includes(comunicacion.estado);
  const roles = (lista: readonly (keyof typeof ETIQUETA_ROL)[]) =>
    lista.length > 0 ? lista.map((r) => ETIQUETA_ROL[r]).join(", ") : "nadie";
  const aEnviar = destinatarios.filter((d) => !d.excluido && d.para.length > 0);

  // Qué dejaría salir el candado de ESTA comunicación, calculado con las mismas
  // funciones que el envío. Se enseña desde el principio: quien ve 125 inversores
  // en la lista tiene que leer, al lado, que no se les puede escribir.
  const simulacion =
    ajustes && envios.permitidos
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
  const candado = simulacion
    ? {
        permitidos: simulacion.permitidos.length,
        rechazados: simulacion.rechazados.length,
        primerRechazo: simulacion.rechazados[0] ?? null,
        // Las direcciones EXACTAS a las que saldría algo, juntas y sin repetir.
        direcciones: [
          ...new Set(
            simulacion.permitidos.flatMap(({ correo }) => [...correo.para, ...correo.copia, ...correo.copiaOculta]),
          ),
        ].sort(),
      }
    : null;
  const bloqueadaPorCandado = !enviada && candado !== null && candado.rechazados > 0;

  // El stepper: dónde está el envío.
  const idx: Record<EstadoComunicacion, number> = {
    borrador: 0,
    revisada: 1,
    probada: 2,
    enviando: 3,
    pausada: 3,
    enviada: 4,
    cancelada: -1,
  };
  const actual = idx[comunicacion.estado];
  const ruta = (vista: string) => `${comunicacionPath(comunicacion.id)}?vista=${vista}`;
  const pasoDe = (n: number, etiqueta: string, vista: string, nota?: string): PasoDeStepper => ({
    clave: etiqueta,
    etiqueta,
    estado: actual < 0 ? "pendiente" : bloqueadaPorCandado && n >= actual ? "bloqueado" : n < actual ? "hecho" : n === actual ? "actual" : "pendiente",
    href: ruta(vista),
    nota,
  });
  const pasos: PasoDeStepper[] = [
    pasoDe(0, "Revisar", "destinatarios", comunicacion.revisada_at ? fmtFechaHora(comunicacion.revisada_at) : undefined),
    pasoDe(1, "Prueba", "envio", comunicacion.probada_at ? fmtFechaHora(comunicacion.probada_at) : undefined),
    pasoDe(2, "Ensayo y confirmación", "envio", comunicacion.confirmada_at ? fmtFechaHora(comunicacion.confirmada_at) : undefined),
    pasoDe(3, "Envío", "envio", comunicacion.enviada_at ? fmtFechaHora(comunicacion.enviada_at) : undefined),
  ];

  const audiencia =
    comunicacion.audiencia === "promocion" && comunicacion.promocion_nombre
      ? comunicacion.promocion_nombre
      : ETIQUETA_AUDIENCIA[comunicacion.audiencia];
  const filtroReenvio = comunicacion.reenvio_filtro;
  const diferencias = filtroReenvio?.diferencias;

  const seguimiento =
    enviada && puedeEscribir ? (
      <SeguimientoBoton
        comunicacionId={comunicacion.id}
        destinatarios={destinatarios}
        enlaces={enlaces}
        eventos={eventos}
        medible={esMedible(comunicacion)}
        porQueNoEsMedible={porQueNoEsMedible(comunicacion)}
        plantilla={comunicacion.plantilla_id ? { id: comunicacion.plantilla_id, nombre: comunicacion.plantilla_nombre } : null}
        variante={comunicacion.estado === "enviada" ? "primario" : "secundario"}
      />
    ) : null;

  const plantillaExtra = comunicacion.plantilla_id ? (
    <Chip tono="ok">elegida</Chip>
  ) : (
    <Chip tono="aviso">sin elegir</Chip>
  );

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <EncabezadoDePagina
        ruta={[{ etiqueta: "Comunicaciones", href: COMUNICACIONES_PATH }, { etiqueta: comunicacion.nombre }]}
        titulo={comunicacion.nombre}
        chips={
          <>
            <ChipEstadoComunicacion estado={comunicacion.estado} pasarela={comunicacion.pasarela} />
            <Chip tono="neutro">{ETIQUETA_TIPO[comunicacion.tipo]}</Chip>
            <Chip tono="neutro">{audiencia}</Chip>
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
              <BotonEnlace
                href={comunicacionAnaliticaPath(comunicacion.id)}
                variante={comunicacion.estado === "enviada" ? "secundario" : "primario"}
                icono={<Icono nombre="grafica" />}
              >
                Ver analítica
              </BotonEnlace>
            ) : null}
            {editable ? <CancelarButton comunicacionId={comunicacion.id} /> : null}
          </>
        }
      />

      {comunicacion.audiencia === "reenvio" ? (
        <Aviso tipo="info" titulo="Es un seguimiento">
          Sale de{" "}
          {comunicacion.origen_comunicacion_id ? (
            <Link href={comunicacionAnaliticaPath(comunicacion.origen_comunicacion_id)} className="font-medium underline underline-offset-2">
              otra comunicación
            </Link>
          ) : (
            "otra comunicación"
          )}
          , con el filtro «{esFiltro(filtroReenvio?.filtro) ? ETIQUETA_FILTRO[filtroReenvio.filtro] : "desconocido"}».
          {diferencias && (diferencias.seCaen.length > 0 || diferencias.nuevas.length > 0) ? (
            <>
              {" "}
              Respecto a aquel envío:{" "}
              {diferencias.seCaen.length > 0 ? `${fmtInt(diferencias.seCaen.length)} ${diferencias.seCaen.length === 1 ? "cuenta se cae" : "cuentas se caen"}` : ""}
              {diferencias.seCaen.length > 0 && diferencias.nuevas.length > 0 ? " y " : ""}
              {diferencias.nuevas.length > 0 ? `${fmtInt(diferencias.nuevas.length)} ${diferencias.nuevas.length === 1 ? "dirección es nueva" : "direcciones son nuevas"}` : ""}
              .
            </>
          ) : null}
          <Ayuda className="ml-1">
            Un seguimiento solo puede incluir cuentas que estuvieran en el envío original, con las direcciones de
            hoy. Una cuenta con una dirección que no estaba en aquel envío nace excluida, con el aviso «Dirección
            nueva»: mírala y vuelve a incluirla solo si es correcta.
            {diferencias && diferencias.seCaen.length > 0 ? (
              <>
                <br />
                <br />
                Se caen: {diferencias.seCaen.map((s) => `${s.cuenta} (${s.motivo})`).join("; ")}.
              </>
            ) : null}
            {diferencias && diferencias.nuevas.length > 0 ? (
              <>
                <br />
                Direcciones nuevas: {diferencias.nuevas.map((n) => `${n.cuenta}: ${n.email}`).join("; ")}.
              </>
            ) : null}
          </Ayuda>
        </Aviso>
      ) : null}

      <Candado datos={envios} />

      {comunicacion.estado !== "cancelada" ? <Stepper pasos={pasos} etiqueta="Pasos del envío" /> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KPICard title="Correos que saldrían" value={fmtInt(resumen.aEnviar)} subtitle="uno por cuenta" highlight />
        <KPICard title="Direcciones en Para" value={fmtInt(resumen.direcciones)} subtitle={`${fmtInt(resumen.direccionesExternas)} externas`} />
        <KPICard title="Excluidos" value={fmtInt(resumen.excluidos)} subtitle={`de ${fmtInt(resumen.total)} cuentas en la lista`} />
        <KPICard title="Sin destinatario" value={fmtInt(resumen.sinDestinatario)} subtitle="no recibirían nada" />
      </div>

      <Tabs
        pestanas={[
          { clave: "destinatarios", etiqueta: "Destinatarios", extra: fmtInt(resumen.total) },
          { clave: "plantilla", etiqueta: "Plantilla", extra: plantillaExtra },
          { clave: "envio", etiqueta: "Envío", extra: comunicacion.estado === "cancelada" ? undefined : `paso ${Math.min(actual + 1, 4)} de 4` },
        ]}
        porDefecto={comunicacion.estado === "borrador" || comunicacion.estado === "cancelada" ? "destinatarios" : "envio"}
      >
        {{
          destinatarios: (
            <DestinatariosPanel
              comunicacionId={comunicacion.id}
              nombre={comunicacion.nombre}
              destinatarios={destinatarios}
              dominiosInternos={ajustes?.dominios_internos ?? []}
              editable={editable}
            />
          ),
          plantilla: (
            <PlantillaPanel
              comunicacionId={comunicacion.id}
              plantillaId={comunicacion.plantilla_id}
              plantillaNombre={comunicacion.plantilla_nombre}
              destinatarios={aEnviar.map((d) => ({ id: d.id, nombre: d.cuenta_nombre }))}
              editable={editable}
            />
          ),
          envio: ajustes ? (
            <EnvioPanel
              comunicacion={comunicacion}
              resumen={resumen}
              ajustes={ajustes}
              rol={getUserRole(ctx, ZONA_COMUNICACIONES)}
              usuarioEmail={ctx.email}
              pasarela={envios.pasarela}
              progreso={calcularProgreso(destinatarios)}
              lineas={aEnviar.map((d) => `${d.cuenta_nombre} — ${d.para.map((p) => p.email).join(", ")}`)}
              candado={candado}
              seguimiento={
                enviada && puedeEscribir ? (
                  <SeguimientoBoton
                    comunicacionId={comunicacion.id}
                    destinatarios={destinatarios}
                    enlaces={enlaces}
                    eventos={eventos}
                    medible={esMedible(comunicacion)}
                    porQueNoEsMedible={porQueNoEsMedible(comunicacion)}
                    plantilla={comunicacion.plantilla_id ? { id: comunicacion.plantilla_id, nombre: comunicacion.plantilla_nombre } : null}
                    etiqueta="Preparar seguimiento"
                    variante="primario"
                    pequeno
                  />
                ) : null
              }
            />
          ) : (
            <Aviso tipo="aviso">No se pudieron leer los ajustes de envío.</Aviso>
          ),
        }}
      </Tabs>
    </div>
  );
}
