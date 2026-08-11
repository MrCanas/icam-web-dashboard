/**
 * Gate de publicación: un trimestre de un proyecto NO puede publicarse en el
 * Overview hasta que el Financiero haya reportado su línea en el maestro
 * (maestro_lineas_trimestre) y la PM haya resuelto las discrepancias de fechas.
 *
 * Lógica pura compartida por la UI (deshabilitar el check con su motivo) y por
 * la server action (que revalida: la UI es cortesía, el servidor manda).
 */

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
  // El levantamiento es la foto inicial del proyecto, anterior al ciclo de
  // reporte trimestral: no tiene línea en el maestro que esperar.
  if (input.snapshotCode === "levantamiento") return { permitido: true };
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
