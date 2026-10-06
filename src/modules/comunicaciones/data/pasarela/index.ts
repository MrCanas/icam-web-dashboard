import { pasarelaSimulada } from "@/modules/comunicaciones/data/pasarela/pasarelaSimulada";
import { crearPasarelaZoho, hayTokenDeEnvios } from "@/modules/comunicaciones/data/pasarela/pasarelaZoho";
import type { PasarelaCorreo, ResultadoEnvio } from "@/modules/comunicaciones/data/pasarela/tipos";
import { verificarCandado, type PermitidosCandado } from "@/modules/comunicaciones/logic/candado";
import type { CorreoSaliente } from "@/modules/comunicaciones/logic/envio";
import type { NombrePasarela } from "@/modules/comunicaciones/types";

/**
 * La única puerta por la que sale un correo de este módulo.
 *
 * Detrás hay dos pasarelas: la real (Zoho) donde existe el token de envíos, y
 * la simulada en todos los demás sitios. Delante de las dos, siempre, el
 * candado de destinatarios.
 *
 * Fuera de esta carpeta nadie importa una pasarela: se llama a
 * `enviarConCandado`. Lo vigila una prueba (`__tests__/arquitectura.test.ts`).
 */

export type { PasarelaCorreo, ResultadoEnvio } from "@/modules/comunicaciones/data/pasarela/tipos";

export function nombreDePasarelaActiva(): NombrePasarela {
  return hayTokenDeEnvios() ? "zoho" : "simulada";
}

function pasarelaActiva(): PasarelaCorreo {
  return hayTokenDeEnvios() ? crearPasarelaZoho() : pasarelaSimulada;
}

/**
 * Envía un correo, si el candado lo permite.
 *
 * El candado se comprueba aquí, pegado a la llamada, y no solo en los pasos
 * anteriores: es la última línea antes de que algo salga, y vale igual para la
 * pasarela real que para la simulada. Un correo que el candado rechaza no llega
 * a ninguna de las dos.
 *
 * `pasarela` solo se pasa desde las pruebas.
 */
export async function enviarConCandado(
  correo: CorreoSaliente,
  permitidos: PermitidosCandado,
  pasarela?: PasarelaCorreo,
): Promise<ResultadoEnvio> {
  const veredicto = verificarCandado(correo, permitidos);
  if (!veredicto.ok) {
    return {
      ok: false,
      error: `Candado de destinatarios: ${veredicto.motivo}.`,
      pasarela: pasarela?.nombre ?? nombreDePasarelaActiva(),
      bloqueadoPorCandado: true,
    };
  }

  let elegida: PasarelaCorreo;
  try {
    elegida = pasarela ?? pasarelaActiva();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      pasarela: "zoho",
      bloqueadoPorCandado: false,
    };
  }

  const respuesta = await elegida.enviar(correo);
  return respuesta.ok
    ? { ok: true, messageId: respuesta.messageId, pasarela: elegida.nombre }
    : { ok: false, error: respuesta.error, pasarela: elegida.nombre, bloqueadoPorCandado: false };
}
