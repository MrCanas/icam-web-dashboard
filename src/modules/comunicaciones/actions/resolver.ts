import { dominiosSinCorreo } from "@/modules/comunicaciones/data/dns";
import {
  dominiosDeLosDestinatarios,
  resolverDestinatarios,
  type EspejosDeContacto,
  type OpcionesDestinatarios,
} from "@/modules/comunicaciones/logic/destinatarios";
import type { DestinatarioCalculado } from "@/modules/comunicaciones/types";
import type { InvCuentaRow } from "@/modules/portfolio/inversores/types";

/**
 * Resolver los destinatarios de unas cuentas y preguntarle al DNS solo por los
 * dominios que de verdad van a recibir algo.
 *
 * Se calcula dos veces: la primera sin DNS, para saber qué dominios salen; la
 * segunda con lo que contestó el DNS. Las dos son puras y rápidas; lo lento es
 * el DNS, y así se consulta por la audiencia (decenas de dominios) y no por la
 * base entera (cientos). Si el DNS falla, no se excluye a nadie por ello.
 *
 * Solo servidor, y fuera de los ficheros `"use server"`: no es una acción.
 */
export async function resolverDestinatariosConDns(
  cuentas: readonly InvCuentaRow[],
  espejos: Pick<EspejosDeContacto, "contactos" | "cuentaContacto">,
  opciones: Omit<OpcionesDestinatarios, "dominiosSinCorreo">,
): Promise<DestinatarioCalculado[]> {
  const sinDns = resolverDestinatarios(cuentas, espejos, opciones);
  const sinCorreo = await dominiosSinCorreo(dominiosDeLosDestinatarios(sinDns)).catch(() => new Set<string>());
  if (sinCorreo.size === 0) return sinDns;
  return resolverDestinatarios(cuentas, espejos, { ...opciones, dominiosSinCorreo: sinCorreo });
}
