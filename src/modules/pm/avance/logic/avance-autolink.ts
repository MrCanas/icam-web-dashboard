/**
 * Emparejamiento activo de PM ↔ promoción de Zoho decidido A MANO, una vez.
 *
 * NO es una normalización, y no puede serlo: «DC-15» → «DC15» saldría de quitar
 * los guiones, pero «SA-33-31» → «SA31» no sale de ninguna regla sensata
 * (quitar los no alfanuméricos da «SA3331»), y «LDH171» convive con
 * «LDH171-V1», con lo que cualquier regla de sufijos los confundiría. Tampoco
 * sirve pasar por el maestro financiero, que usa TO123/FU149 donde Zoho usa
 * T123/FC149.
 *
 * En tiempo de ejecución NO se ejecuta ningún matching: la aplicación solo lee
 * pm_activo_promocion_map. Esta lista se aplica una sola vez desde el script de
 * carga y los 5 activos restantes (CSP-10, PC25-CP6, PC25-26-RESIDENCIAL,
 * EM-RESIDENCIAL, CA1) los empareja la PMO en /dashboard/pm/proyectos — igual
 * que la 020 dejó pm_activo_proyecto_map vacío a propósito.
 */
export const AUTOLINK_PROMOCION_POR_ACTIVO: Readonly<Record<string, string>> = {
  SE84: "SE84", // Santa Engracia 84 — coincidencia literal
  GQ8: "GQ8", // Glorieta de Quevedo 8 — coincidencia literal
  "DC-15": "DC15", // Doctor Cortezo 15
  "SA-33-31": "SA31", // Sagasta 31
};

export interface AutolinkPar {
  idActivo: string;
  codigo: string;
}

export interface AutolinkResultado {
  pares: AutolinkPar[];
  /**
   * Entradas de la lista cuyo activo o cuya promoción no existe en la base.
   * Se devuelven para que el script las grite: si alguien renombra
   * «SA-33-31», el fallo tiene que salir en la carga, no en silencio.
   */
  faltantes: string[];
}

/**
 * Resuelve la lista contra lo que existe de verdad en la base.
 *
 * No hace ninguna comparación aproximada: si un lado no está, va a `faltantes`.
 */
export function resolveAutolink(
  idsActivo: readonly string[],
  codigosPromocion: readonly string[],
): AutolinkResultado {
  const activos = new Set(idsActivo);
  const codigos = new Set(codigosPromocion);
  const pares: AutolinkPar[] = [];
  const faltantes: string[] = [];

  for (const [idActivo, codigo] of Object.entries(AUTOLINK_PROMOCION_POR_ACTIVO)) {
    const faltaActivo = !activos.has(idActivo);
    const faltaCodigo = !codigos.has(codigo);
    if (faltaActivo || faltaCodigo) {
      faltantes.push(
        `${idActivo} → ${codigo}: falta ${
          faltaActivo && faltaCodigo
            ? "el activo de PM y la promoción de Zoho"
            : faltaActivo
              ? "el activo de PM"
              : "la promoción de Zoho"
        }`,
      );
      continue;
    }
    pares.push({ idActivo, codigo });
  }

  return { pares, faltantes };
}
