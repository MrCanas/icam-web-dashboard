import { normalizarEmail } from "@/modules/comunicaciones/logic/candado";
import {
  cumpleFiltro,
  type DestinatarioAnalitica,
  type FiltroAnalitica,
} from "@/modules/comunicaciones/logic/analitica";
import type { Aviso, ComDestinatarioRow, DestinatarioCalculado } from "@/modules/comunicaciones/types";

/**
 * Reenviar una comunicación a parte de sus destinatarios.
 *
 * Un reenvío es una comunicación NUEVA que nace de otra: se elige un filtro en
 * el panel de analítica («no consta apertura», «abrió y no hizo clic»…) y se
 * prepara un borrador con las cuentas que lo cumplen. A partir de ahí pasa por
 * los mismos controles y el mismo candado que cualquier otra.
 *
 * Dos reglas que no se negocian:
 *   · un reenvío NUNCA incluye una cuenta que no estuviera en el envío original;
 *   · una dirección que no estaba en el original no entra sola: la cuenta nace
 *     excluida y alguien tiene que volver a incluirla mirándola.
 *
 * Puro.
 */

/** Filtros sobre los que tiene sentido reenviar. «Todos» y «rebotado» no. */
export const FILTROS_DE_REENVIO: readonly FiltroAnalitica[] = [
  "no_consta_apertura",
  "abrio",
  "hizo_clic",
  "abrio_sin_clic",
  "pulso_enlace",
  "error",
];

export function esFiltroDeReenvio(filtro: FiltroAnalitica): boolean {
  return FILTROS_DE_REENVIO.includes(filtro);
}

/** Las cuentas del envío original que cumplen el filtro. Lo decide el servidor, con sus datos. */
export function cuentasParaReenvio(
  originales: readonly DestinatarioAnalitica[],
  filtro: FiltroAnalitica,
  enlace: number | null,
  pulsados: ReadonlyMap<string, ReadonlySet<number>>,
): string[] {
  if (!esFiltroDeReenvio(filtro)) return [];
  return originales.filter((d) => cumpleFiltro(d, filtro, enlace, pulsados)).map((d) => d.cuenta_zoho_id);
}

type Original = Pick<ComDestinatarioRow, "cuenta_zoho_id" | "cuenta_nombre" | "para" | "copia">;

export const MOTIVO_DIRECCION_NUEVA =
  "Tiene una dirección que no estaba en el envío original. Revísala y vuelve a incluirla si es correcta";

export interface DiferenciasConElOriginal {
  /** Cuentas que cumplían el filtro y hoy no recibirían nada, y por qué. */
  seCaen: { cuenta: string; motivo: string }[];
  /** Direcciones que hoy salen y no estaban en el envío original. */
  nuevas: { cuenta: string; email: string }[];
}

/**
 * Deja la lista recalculada con los datos de hoy lista para un reenvío.
 *
 * - Quita cualquier cuenta que no esté entre las filtradas del original.
 * - Marca y excluye de salida las cuentas con una dirección nueva.
 * - Devuelve qué ha cambiado respecto al original, para enseñarlo antes de la
 *   revisión.
 */
export function ajustarAlOriginal(
  calculados: readonly DestinatarioCalculado[],
  originales: readonly Original[],
  cuentasFiltradas: readonly string[],
): { destinatarios: DestinatarioCalculado[]; diferencias: DiferenciasConElOriginal } {
  const filtradas = new Set(cuentasFiltradas);
  const originalPorCuenta = new Map(originales.map((o) => [o.cuenta_zoho_id, o]));
  const diferencias: DiferenciasConElOriginal = { seCaen: [], nuevas: [] };
  const destinatarios: DestinatarioCalculado[] = [];
  const presentes = new Set<string>();

  for (const calculado of calculados) {
    const original = originalPorCuenta.get(calculado.cuentaZohoId);
    // Ni estaba en el original ni cumple el filtro: fuera, sin excepción.
    if (!original || !filtradas.has(calculado.cuentaZohoId)) continue;
    presentes.add(calculado.cuentaZohoId);

    const deAntes = new Set([...original.para, ...original.copia].map((d) => normalizarEmail(d.email)));
    const nuevas = [...calculado.para, ...calculado.copia]
      .map((d) => normalizarEmail(d.email))
      .filter((email) => !deAntes.has(email));
    for (const email of nuevas) diferencias.nuevas.push({ cuenta: calculado.cuentaNombre, email });

    if (calculado.para.length === 0) {
      diferencias.seCaen.push({ cuenta: calculado.cuentaNombre, motivo: "Hoy no tiene a nadie en «Para»" });
    } else if (calculado.excluido) {
      diferencias.seCaen.push({ cuenta: calculado.cuentaNombre, motivo: calculado.excluidoMotivo ?? "Excluida" });
    }

    if (nuevas.length === 0) {
      destinatarios.push(calculado);
    } else {
      const avisos: Aviso[] = calculado.avisos.includes("direccion_nueva")
        ? calculado.avisos
        : [...calculado.avisos, "direccion_nueva"];
      destinatarios.push({
        ...calculado,
        avisos,
        excluido: true,
        // Si ya estaba excluida por otra causa, esa manda: es la más grave.
        excluidoMotivo: calculado.excluido ? calculado.excluidoMotivo : MOTIVO_DIRECCION_NUEVA,
      });
    }
  }

  for (const cuenta of filtradas) {
    if (presentes.has(cuenta)) continue;
    diferencias.seCaen.push({
      cuenta: originalPorCuenta.get(cuenta)?.cuenta_nombre ?? cuenta,
      motivo: "Ya no está en los datos de Zoho",
    });
  }

  return { destinatarios, diferencias };
}
