/**
 * Gate de publicación: un trimestre de un proyecto NO puede publicarse en el
 * Overview hasta que el Financiero haya reportado su línea en el maestro
 * (maestro_lineas_trimestre) y la PM haya resuelto las discrepancias de fechas.
 *
 * Lógica pura compartida por la UI (deshabilitar el check con su motivo) y por
 * la server action (que revalida: la UI es cortesía, el servidor manda).
 */

import { parseQuarterCode } from "@/modules/pm/logic/pm-viz";

/**
 * Primer trimestre que pasa por el flujo de validación contra el maestro.
 *
 * TODO lo anterior es historia consolidada y NO cambia nunca: sigue publicado,
 * editable y sin columna «Maestro», aunque el maestro traiga líneas antiguas o
 * el trimestre se añada tarde. Decidido por la PMO el 2026-08-12: el primer
 * trimestre que se reporta con el flujo nuevo es Q2 2026.
 */
export const PRIMER_TRIMESTRE_VALIDADO = "2026_Q2";

/** ¿Este trimestre está sujeto al flujo de validación? */
export function sujetoAValidacion(snapshotCode: string): boolean {
  const q = parseQuarterCode(snapshotCode);
  if (!q) return false; // levantamiento y códigos raros: fuera del flujo
  const corte = parseQuarterCode(PRIMER_TRIMESTRE_VALIDADO)!;
  return q.y * 4 + q.q >= corte.y * 4 + corte.q;
}

export type MotivoGate = "sin_mapeo" | "sin_linea_maestro" | "discrepancias_pendientes";

export type GatePublicacion =
  | { permitido: true }
  | { permitido: false; motivo: MotivoGate };

export function evaluarGatePublicacion(input: {
  snapshotCode: string;
  /** proyecto_financiero_key del activo, o null si la PMO no lo ha mapeado. */
  proyectoFinanciero: string | null;
  lineaMaestroExiste: boolean;
  discrepanciasPendientes: number;
}): GatePublicacion {
  // Fuera del flujo: el levantamiento (foto inicial, sin línea en el maestro)
  // y todo lo anterior al corte PRIMER_TRIMESTRE_VALIDADO, que es historia
  // consolidada y se publica como siempre.
  if (!sujetoAValidacion(input.snapshotCode)) return { permitido: true };
  if (!input.proyectoFinanciero) return { permitido: false, motivo: "sin_mapeo" };
  if (!input.lineaMaestroExiste) return { permitido: false, motivo: "sin_linea_maestro" };
  if (input.discrepanciasPendientes > 0) {
    return { permitido: false, motivo: "discrepancias_pendientes" };
  }
  return { permitido: true };
}

/** Texto del motivo, compartido por el title del check y el error del servidor. */
export function motivoGateTexto(
  motivo: MotivoGate,
  ctx: { proyectoFinanciero: string | null; etiquetaTrimestre: string; pendientes?: number },
): string {
  switch (motivo) {
    case "sin_mapeo":
      return "Mapea el proyecto al maestro financiero en Proyectos (/dashboard/pm/proyectos) antes de publicar.";
    case "sin_linea_maestro":
      return `El maestro aún no tiene línea de ${ctx.proyectoFinanciero ?? "este proyecto"} para ${ctx.etiquetaTrimestre}. Se publica cuando el Financiero la reporte.`;
    case "discrepancias_pendientes": {
      const n = ctx.pendientes ?? 0;
      return `${n || "Hay"} ${n === 1 ? "discrepancia" : "discrepancias"} con el maestro sin resolver en ${ctx.etiquetaTrimestre}.`;
    }
  }
}
