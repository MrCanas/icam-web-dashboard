/**
 * Write-back de fechas validadas al Excel maestro de SharePoint.
 *
 * Modo por env MAESTRO_WRITEBACK_MODE:
 *   - "off":    desactivado del todo.
 *   - "manual": (defecto) la app NO escribe el Excel; devuelve las celdas y
 *               valores para que el Financiero los pegue a mano. Es el fallback
 *               permanente aunque algún día funcione el modo graph.
 *   - "graph":  escribir las celdas DW-EL vía Microsoft Graph Workbook API.
 *               PENDIENTE DE SPIKE — no habilitar sin validarlo antes:
 *
 * Spike del modo graph (hacer sobre una COPIA del maestro real, nunca el vivo):
 *   1. Elevar el grant Sites.Selected de la carpeta de lectura a escritura
 *      (hoy src/lib/graph/sharepoint.ts solo descarga).
 *   2. POST /drives/{driveId}/items/{itemId}/workbook/createSession sobre el
 *      .xlsm. El Workbook API oficialmente solo soporta .xlsx: puede devolver
 *      400 o, peor, versiones antiguas corrompían las macros.
 *   3. Localizar la fila por Proyecto (col E) + Trimestre (col H) vía usedRange.
 *   4. PATCH .../worksheets('Tabla madre')/range(address='DW{fila}:EL{fila}').
 *   5. Abrir el fichero en Excel de escritorio y comprobar que las macros
 *      siguen intactas y el libro no pide reparación.
 * Si el spike falla, el modo manual se queda como definitivo.
 */

export interface ReporteFechaCelda {
  /** Cabecera de la columna de fecha en la Tabla madre («Fecha obra»). */
  columna: string;
  /** Letra de la columna en la hoja (DX, DZ, EB…), para localizar la celda. */
  letra: string;
  /** Fecha oficial validada en PM; null = dejar la celda vacía. */
  fecha: string | null;
}

export interface ReporteFechasInput {
  proyecto: string;
  trimestreCode: string;
  fechas: ReporteFechaCelda[];
}

export type ReporteFechasResult =
  | { ok: true; modo: "graph" }
  | { ok: true; modo: "manual"; instrucciones: ReporteFechasInput }
  | { ok: false; error: string };

export type MaestroWritebackMode = "off" | "manual" | "graph";

export function maestroWritebackMode(): MaestroWritebackMode {
  const raw = (process.env.MAESTRO_WRITEBACK_MODE ?? "manual").trim().toLowerCase();
  if (raw === "off" || raw === "graph") return raw;
  return "manual";
}

export async function reportarFechasAlMaestro(
  input: ReporteFechasInput,
): Promise<ReporteFechasResult> {
  const modo = maestroWritebackMode();

  if (modo === "off") {
    return { ok: false, error: "El reporte de fechas al maestro está desactivado (MAESTRO_WRITEBACK_MODE=off)." };
  }

  if (modo === "graph") {
    // Deliberadamente sin implementar hasta pasar el spike de la cabecera:
    // escribir un .xlsm compartido con macros sin validarlo puede corromperlo.
    return {
      ok: false,
      error:
        "El modo graph aún no está habilitado (falta el spike sobre el .xlsm). Usa MAESTRO_WRITEBACK_MODE=manual.",
    };
  }

  return { ok: true, modo: "manual", instrucciones: input };
}
