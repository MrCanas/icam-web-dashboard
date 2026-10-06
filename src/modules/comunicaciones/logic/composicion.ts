import { renderizarPlantilla } from "@/modules/comunicaciones/logic/plantilla";
import { enlacesDe, instrumentar } from "@/modules/comunicaciones/logic/seguimiento";
import type { ContenidoDeCorreo } from "@/modules/comunicaciones/logic/envio";
import type { ImagenApertura } from "@/modules/comunicaciones/types";

/**
 * El correo, montado por el portal.
 *
 * Hasta aquí lo montaba Zoho a partir de la plantilla. Para poder poner a cada
 * destinatario su propia imagen de apertura y sus propios enlaces, lo monta el
 * portal: resuelve los campos combinados con el registro, añade el seguimiento
 * y le pasa a Zoho el resultado ya hecho. Zoho sigue siendo quien lo envía.
 *
 * Puro: recibe la plantilla, el registro y el identificador, y devuelve el
 * correo o por qué no se puede montar.
 */

export interface PlantillaParaComponer {
  id: string;
  asunto: string | null;
  html: string;
  /** Identificadores de fichero de Zoho de los adjuntos de la plantilla. */
  adjuntos: { id: string; nombre: string }[];
}

export interface ComponerEntrada {
  plantilla: PlantillaParaComponer;
  /** Módulo de la plantilla: de él salen los campos combinados. */
  modulo: string;
  /** El registro entero, leído de Zoho. */
  registro: Record<string, unknown>;
  /** Nombre API → tipo de campo, de ese módulo. */
  tipos: ReadonlyMap<string, string>;
  /** Dirección base del seguimiento (`COMUNICACIONES_SEGUIMIENTO_URL`). */
  base: string;
  /** El identificador de seguimiento de ESTE correo. */
  token: string;
}

export type Compuesto =
  | {
      ok: true;
      contenido: ContenidoDeCorreo;
      /** El destino de verdad de cada enlace, por posición. */
      enlaces: string[];
      imagen: ImagenApertura;
      /** Campos que existen pero están vacíos en este registro: «Estimado ,». */
      vacios: string[];
    }
  | { ok: false; motivo: string };

export function componerCorreo(entrada: ComponerEntrada): Compuesto {
  const { plantilla, modulo, registro, tipos, base, token } = entrada;
  if (!plantilla.html.trim()) return { ok: false, motivo: "La plantilla no tiene cuerpo." };

  const montado = renderizarPlantilla(
    { asunto: plantilla.asunto, html: plantilla.html },
    modulo,
    registro,
    tipos,
  );
  if (montado.sinResolver.length > 0) {
    return {
      ok: false,
      motivo: `La plantilla usa campos que el portal no sabe resolver: ${montado.sinResolver.join(", ")}.`,
    };
  }
  if (!montado.asunto.trim()) return { ok: false, motivo: "El asunto queda vacío." };

  const instrumentado = instrumentar(montado.html, base, token);
  return {
    ok: true,
    contenido: {
      asunto: montado.asunto.trim(),
      html: instrumentado.html,
      adjuntos: plantilla.adjuntos.map((a) => a.id),
    },
    enlaces: instrumentado.enlaces,
    imagen: instrumentado.imagen,
    vacios: montado.vacios,
  };
}

/** Los enlaces de la plantilla tal como vienen, para agrupar los clics por enlace. */
export function enlacesDePlantilla(html: string): { posicion: number; url: string; texto: string }[] {
  return enlacesDe(html);
}

/** Los adjuntos de una plantilla tal como los devuelve Zoho (`attachments`). */
export function adjuntosDePlantilla(crudo: Record<string, unknown>): { id: string; nombre: string }[] {
  const lista = crudo.attachments;
  if (!Array.isArray(lista)) return [];
  const adjuntos: { id: string; nombre: string }[] = [];
  for (const a of lista) {
    if (typeof a !== "object" || a === null) continue;
    const o = a as Record<string, unknown>;
    const id = typeof o.file_id === "string" ? o.file_id.trim() : "";
    if (!id) continue;
    adjuntos.push({ id, nombre: typeof o.file_name === "string" ? o.file_name : "(sin nombre)" });
  }
  return adjuntos;
}

/** ¿Trae la plantilla algún adjunto del que no se sabe el identificador de fichero? */
export function adjuntosSinIdentificador(crudo: Record<string, unknown>): number {
  const lista = crudo.attachments;
  if (!Array.isArray(lista)) return 0;
  return lista.length - adjuntosDePlantilla(crudo).length;
}
