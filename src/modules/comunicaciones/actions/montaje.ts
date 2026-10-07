import { randomBytes } from "node:crypto";

import { listarCampos } from "@/lib/zoho/client";
import { leerPlantilla } from "@/modules/comunicaciones/data/zohoPlantillas";
import { leerRegistro } from "@/modules/comunicaciones/data/zohoRegistros";
import {
  adjuntosDePlantilla,
  adjuntosSinIdentificador,
  componerCorreo,
  enlacesDePlantilla,
  type PlantillaParaComponer,
} from "@/modules/comunicaciones/logic/composicion";
import { montarCorreo, moduloDePlantilla, type CorreoSaliente } from "@/modules/comunicaciones/logic/envio";
import { baseDeSeguimientoValida } from "@/modules/comunicaciones/logic/seguimiento";
import { validarCorreo } from "@/modules/comunicaciones/logic/validarCorreo";
import type {
  ComComunicacionRow,
  ComDestinatarioRow,
  ImagenApertura,
  ModoEnvio,
} from "@/modules/comunicaciones/types";

/**
 * Montar un correo de verdad: leer de Zoho lo que hace falta y pasarlo por la
 * lógica pura (`logic/composicion.ts`, `logic/validarCorreo.ts`).
 *
 * Lo usan la prueba, el ensayo general y el envío, para que los tres monten el
 * correo exactamente igual. Aquí no se envía nada.
 *
 * Solo servidor, y fuera de los ficheros `"use server"`: no son acciones.
 */

export const VARIABLE_DE_SEGUIMIENTO = "COMUNICACIONES_SEGUIMIENTO_URL";

/** Un identificador de seguimiento nuevo: 16 bytes aleatorios, 22 caracteres. */
export function nuevoToken(): string {
  return randomBytes(16).toString("base64url");
}

/** Lo que es igual para todos los correos de una comunicación. Se lee una vez. */
export interface Material {
  plantilla: PlantillaParaComponer;
  modulo: string;
  tipos: Map<string, string>;
  base: string;
  enlaces: { posicion: number; url: string; texto: string }[];
}

export async function cargarMaterial(
  comunicacion: Pick<ComComunicacionRow, "plantilla_id" | "plantilla_modulo">,
): Promise<{ ok: true; material: Material } | { ok: false; motivo: string }> {
  const base = process.env[VARIABLE_DE_SEGUIMIENTO]?.trim();
  if (!baseDeSeguimientoValida(base)) {
    return {
      ok: false,
      motivo:
        `Falta la dirección de seguimiento (${VARIABLE_DE_SEGUIMIENTO}) o no es válida. ` +
        "Sin ella no se pueden rastrear aperturas ni clics, y no se envía.",
    };
  }
  if (!comunicacion.plantilla_id) return { ok: false, motivo: "Elige antes una plantilla." };

  const plantilla = await leerPlantilla(comunicacion.plantilla_id);
  const modulo = plantilla.modulo ?? moduloDePlantilla(comunicacion);
  const sinId = adjuntosSinIdentificador(plantilla.crudo);
  if (sinId > 0) {
    return {
      ok: false,
      motivo: `La plantilla tiene ${sinId} adjuntos de los que Zoho no da el identificador de fichero: no se podrían adjuntar.`,
    };
  }
  const campos = await listarCampos(modulo);
  return {
    ok: true,
    material: {
      plantilla: {
        id: plantilla.id,
        asunto: plantilla.asunto,
        html: plantilla.html,
        adjuntos: adjuntosDePlantilla(plantilla.crudo),
      },
      modulo,
      tipos: new Map(campos.map((c) => [c.api_name, c.data_type])),
      base,
      enlaces: enlacesDePlantilla(plantilla.html),
    },
  };
}

export type Montado =
  | {
      tipo: "correo";
      correo: CorreoSaliente;
      /** Los destinos de verdad de sus enlaces, por posición. */
      enlaces: string[];
      imagen: ImagenApertura;
      vacios: string[];
      /** Las direcciones de la lista a las que corresponde, vayan redirigidas o no. */
      direccionesReales: string[];
      /** Lo que `validarCorreo` encuentra mal. Vacío es que puede salir. */
      problemas: string[];
    }
  | { tipo: "omitido"; motivo: string }
  | { tipo: "error"; motivo: string };

/**
 * El correo completo de un destinatario: a quién va, sobre qué registro, y el
 * contenido ya montado con SU seguimiento y validado.
 */
export async function montarParaDestinatario(
  material: Material,
  comunicacion: Pick<ComComunicacionRow, "plantilla_id" | "plantilla_modulo">,
  destinatario: Pick<ComDestinatarioRow, "cuenta_zoho_id" | "para" | "copia">,
  opciones: {
    modo: ModoEnvio;
    usuarioEmail: string;
    remitente: string;
    yaEnviadas: ReadonlySet<string>;
    token: string;
  },
): Promise<Montado> {
  const direcciones = montarCorreo({
    comunicacion: { plantilla_id: comunicacion.plantilla_id, plantilla_modulo: material.modulo },
    destinatario,
    modo: opciones.modo,
    usuarioEmail: opciones.usuarioEmail,
    remitente: opciones.remitente,
    yaEnviadas: opciones.yaEnviadas,
  });
  if (direcciones.tipo !== "correo") return direcciones;

  return componerYValidar(material, direcciones.correo, opciones.token, direcciones.direccionesReales);
}

/** Lo mismo a partir de un correo que ya tiene direcciones y registro (la prueba). */
export async function componerYValidar(
  material: Material,
  correoSinContenido: CorreoSaliente,
  token: string,
  direccionesReales: string[] = [],
): Promise<Montado> {
  const { registro } = correoSinContenido;
  const datos = await leerRegistro(registro.modulo, registro.id);
  if (!datos) return { tipo: "error", motivo: "Zoho no devolvió el registro sobre el que se envía." };

  const compuesto = componerCorreo({
    plantilla: material.plantilla,
    modulo: material.modulo,
    registro: datos,
    tipos: material.tipos,
    base: material.base,
    token,
  });
  if (!compuesto.ok) return { tipo: "error", motivo: compuesto.motivo };

  const correo: CorreoSaliente = { ...correoSinContenido, contenido: compuesto.contenido };
  const problemas = validarCorreo(correo, {
    token,
    registro,
    enlaces: compuesto.enlaces,
    enlacesDePlantilla: material.enlaces.length,
    adjuntosDePlantilla: material.plantilla.adjuntos.length,
    base: material.base,
  });
  return {
    tipo: "correo",
    correo,
    enlaces: compuesto.enlaces,
    imagen: compuesto.imagen,
    vacios: compuesto.vacios,
    direccionesReales,
    problemas,
  };
}
