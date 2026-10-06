"use server";

import { revalidatePath } from "next/cache";

import type { ResultadoAccion } from "@/modules/comunicaciones/actions/comunicaciones";
import { usuarioConEscritura } from "@/modules/comunicaciones/actions/permisos";
import {
  anotarLoQueDiceZoho,
  crearComunicacion,
  leerAjustes,
  leerComunicacion,
} from "@/modules/comunicaciones/data/comunicacionesRepository";
import { dominiosSinCorreo } from "@/modules/comunicaciones/data/dns";
import { leerEventos } from "@/modules/comunicaciones/data/seguimientoRepository";
import { leerCorreoEnviado } from "@/modules/comunicaciones/data/zohoCorreos";
import { enlacesPulsados, esFiltro, esMedible, porQueNoEsMedible } from "@/modules/comunicaciones/logic/analitica";
import { mismoDia } from "@/modules/comunicaciones/logic/controles";
import { resolverDestinatarios } from "@/modules/comunicaciones/logic/destinatarios";
import { dominioDe } from "@/modules/comunicaciones/logic/direcciones";
import { moduloDePlantilla } from "@/modules/comunicaciones/logic/envio";
import {
  COMUNICACIONES_PATH,
  comunicacionPath,
  HISTORIAL_ROUTE_KEY,
} from "@/modules/comunicaciones/logic/paths";
import {
  ajustarAlOriginal,
  cuentasParaReenvio,
  esFiltroDeReenvio,
  type DiferenciasConElOriginal,
} from "@/modules/comunicaciones/logic/reenvio";
import { ETIQUETA_FILTRO } from "@/modules/comunicaciones/logic/analitica";
import {
  cargarEspejosDeContacto,
  ultimoSyncOk,
} from "@/modules/portfolio/inversores/data/inversoresRepository";

/**
 * Lo que se puede HACER desde el panel de analítica: preguntarle a Zoho por la
 * entrega de los correos y preparar un reenvío.
 *
 * Ninguna de las dos envía nada. Preparar un reenvío crea una comunicación
 * nueva en borrador, que después pasa por los mismos controles y el mismo
 * candado que cualquier otra.
 */

function fallo(err: unknown, porDefecto: string): { ok: false; mensaje: string } {
  return { ok: false, mensaje: err instanceof Error ? err.message : porDefecto };
}

const CONSULTAS_A_LA_VEZ = 4;

/**
 * Le pregunta a Zoho, correo a correo, si lo entregó o rebotó.
 *
 * Solo lee de Zoho. Zoho no lo expone para todos los registros: los que no,
 * quedan como «sin dato».
 */
export async function consultarEntregaAction(
  comunicacionId: string,
): Promise<ResultadoAccion<{ consultados: number; rebotados: number; sinDato: number }>> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const completa = await leerComunicacion(user, comunicacionId);
    if (!completa) return { ok: false, mensaje: "La comunicación no existe." };
    const { comunicacion, destinatarios } = completa;
    if (comunicacion.pasarela !== "zoho") {
      return { ok: false, mensaje: "Esta comunicación no salió por Zoho: no hay nada que consultar." };
    }
    const modulo = moduloDePlantilla(comunicacion);
    const cola = destinatarios.filter((d) => d.estado_envio === "enviado" && d.zoho_message_id);
    let rebotados = 0;
    let sinDato = 0;
    const consultados = cola.length;

    const obrero = async () => {
      for (;;) {
        const d = cola.shift();
        if (!d) return;
        const registroId = modulo === "Contacts" ? d.para[0]?.contactoZohoId : d.cuenta_zoho_id;
        let entrega: "entregado" | "rebotado" | "sin_dato" = "sin_dato";
        let motivo: string | null = null;
        if (registroId) {
          try {
            const enZoho = await leerCorreoEnviado(modulo, registroId, d.zoho_message_id!);
            entrega = enZoho.entrega;
            motivo = enZoho.motivo;
          } catch {
            entrega = "sin_dato";
          }
        }
        if (entrega === "rebotado") rebotados++;
        if (entrega === "sin_dato") sinDato++;
        await anotarLoQueDiceZoho(user, d.id, { entrega, motivo });
      }
    };
    await Promise.all(Array.from({ length: CONSULTAS_A_LA_VEZ }, obrero));

    revalidatePath(comunicacionPath(comunicacionId), "layout");
    return { ok: true, consultados, rebotados, sinDato };
  } catch (err) {
    return fallo(err, "No se pudo consultar la entrega en Zoho.");
  }
}

/**
 * Prepara un reenvío: una comunicación NUEVA, en borrador, con las cuentas de
 * la original que cumplen un filtro.
 *
 * - Quién cumple el filtro lo calcula el servidor con sus datos; no se acepta
 *   una lista del navegador.
 * - Los destinatarios se vuelven a resolver con los datos de Zoho de hoy, y
 *   nunca entra una cuenta que no estuviera en el envío original.
 * - Una dirección que no estaba en el original deja su cuenta excluida hasta
 *   que alguien la revise.
 *
 * No envía nada.
 */
export async function prepararReenvioAction(
  comunicacionId: string,
  filtro: string,
  enlace: number | null,
): Promise<ResultadoAccion<{ id: string; path: string; diferencias: DiferenciasConElOriginal }>> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  if (!esFiltro(filtro) || !esFiltroDeReenvio(filtro)) {
    return { ok: false, mensaje: "Ese filtro no sirve para preparar un reenvío." };
  }
  const posicion = filtro === "pulso_enlace" ? enlace : null;
  if (filtro === "pulso_enlace" && (posicion === null || !Number.isInteger(posicion) || posicion < 0)) {
    return { ok: false, mensaje: "Elige el enlace." };
  }

  try {
    const [original, eventos, espejos, datosZohoAt, ajustes] = await Promise.all([
      leerComunicacion(user, comunicacionId),
      leerEventos(user, comunicacionId),
      cargarEspejosDeContacto(user),
      ultimoSyncOk(user),
      leerAjustes(user),
    ]);
    if (!original) return { ok: false, mensaje: "La comunicación no existe." };
    if (!esMedible(original.comunicacion)) {
      return {
        ok: false,
        mensaje: `No se puede reenviar a partir de esta comunicación. ${porQueNoEsMedible(original.comunicacion) ?? ""}`.trim(),
      };
    }
    if (espejos.sinMigracion) return { ok: false, mensaje: "Faltan las tablas de Inversores (migración 040)." };
    if (!mismoDia(datosZohoAt, new Date())) {
      return {
        ok: false,
        mensaje: "Los datos de Zoho no son de hoy. Actualízalos en «Nueva» antes de preparar el reenvío.",
      };
    }

    const cuentasFiltradas = cuentasParaReenvio(
      original.destinatarios,
      filtro,
      posicion,
      enlacesPulsados(eventos),
    );
    if (cuentasFiltradas.length === 0) {
      return { ok: false, mensaje: "Ninguna cuenta cumple ese filtro." };
    }

    // Los datos de hoy, solo de las cuentas filtradas, con los mismos papeles.
    const filtradas = new Set(cuentasFiltradas);
    const cuentasDeHoy = espejos.cuentas.filter((c) => filtradas.has(c.zoho_id));
    const sinCorreo = await dominiosSinCorreo(
      espejos.contactos.map((c) => dominioDe(c.email ?? "")).filter(Boolean),
    ).catch(() => new Set<string>());
    const calculados = resolverDestinatarios(cuentasDeHoy, espejos, {
      rolesPara: original.comunicacion.roles_para,
      rolesCopia: original.comunicacion.roles_copia,
      dominiosInternos: ajustes.dominios_internos,
      dominiosSinCorreo: sinCorreo,
    });
    const { destinatarios, diferencias } = ajustarAlOriginal(calculados, original.destinatarios, cuentasFiltradas);
    if (destinatarios.length === 0) {
      return { ok: false, mensaje: "Ninguna de las cuentas filtradas sigue en los datos de Zoho." };
    }

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    const creada = await crearComunicacion(
      user,
      {
        nombre: `Reenvío (${ETIQUETA_FILTRO[filtro].toLowerCase()}) · ${original.comunicacion.nombre} · ${hoy}`.slice(0, 300),
        tipo: original.comunicacion.tipo,
        audiencia: "reenvio",
        promocionZohoId: original.comunicacion.promocion_zoho_id,
        promocionNombre: original.comunicacion.promocion_nombre,
        rolesPara: original.comunicacion.roles_para,
        rolesCopia: original.comunicacion.roles_copia,
        datosZohoAt,
        reenvio: {
          origenComunicacionId: original.comunicacion.id,
          filtro: { filtro, enlace: posicion },
          plantilla: original.comunicacion.plantilla_id
            ? {
                id: original.comunicacion.plantilla_id,
                nombre: original.comunicacion.plantilla_nombre,
                modulo: original.comunicacion.plantilla_modulo,
              }
            : null,
        },
      },
      destinatarios,
    );
    if (!creada.ok) return { ok: false, mensaje: creada.error };

    revalidatePath(COMUNICACIONES_PATH);
    return { ok: true, id: creada.id, path: comunicacionPath(creada.id), diferencias };
  } catch (err) {
    return fallo(err, "No se pudo preparar el reenvío.");
  }
}
