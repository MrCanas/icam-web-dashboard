/**
 * Pegado en columna estilo Excel: la PM copia una columna de fechas de su hoja
 * y la pega sobre una celda de la rejilla; los valores rellenan hacia abajo.
 *
 * Solo parseo y emparejamiento — sin React ni Supabase, para poder testearlo
 * con node:test como el resto de la lógica de Planificación.
 */
import { validateFechaIso, type Validated } from "./planificacion-validation";

/** Tope de líneas por pegado: muy por encima de los 17 hitos del catálogo. */
export const MAX_LINEAS_PASTE = 200;

export interface PasteParseResult {
  /** ISO ya validadas; null = celda vacía o centinela 1899 (quitar fecha). */
  fechas: (string | null)[];
  errores: { linea: number; valor: string; motivo: string }[];
  /** El texto traía varias columnas (tabuladores): solo se usa la primera. */
  multiColumna: boolean;
  /** Se recortó a MAX_LINEAS_PASTE. */
  truncado: boolean;
}

/**
 * Normaliza un token a ISO. Formatos del Excel es-ES: `31/12/2026`, `1/3/27`
 * (yy → 20yy), `31-12-2026`; ISO passthrough. SIEMPRE día/mes, nunca mes/día.
 * Año 1899 = centinela de celda vacía en Excel → null.
 */
export function parseFechaTexto(raw: string): Validated<string | null> {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: null };

  const pad = (n: number) => String(n).padStart(2, "0");

  // ISO (o ISO con /): AAAA-MM-DD
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) {
    const year = Number(m[1]);
    if (year === 1899) return { ok: true, value: null };
    return validateFechaIso(`${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`);
  }

  // es-ES: DD/MM/AAAA o DD/MM/AA (también con guiones)
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/.exec(s);
  if (m) {
    let year = Number(m[3]);
    if (m[3].length === 2) year += 2000;
    if (year === 1899) return { ok: true, value: null };
    const iso = `${year}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
    const v = validateFechaIso(iso);
    if (!v.ok) return { ok: false, error: `«${raw}» no es una fecha válida (${v.error})` };
    return v;
  }

  return { ok: false, error: `«${raw}» no es una fecha (usa DD/MM/AAAA)` };
}

/**
 * Parsea el texto del portapapeles: una fecha por línea. Si hay tabuladores
 * (varias columnas copiadas) se usa solo la primera columna. Línea vacía en
 * medio = quitar la fecha de esa fila. Con cualquier error no se pega nada.
 */
export function parseClipboardFechas(text: string): PasteParseResult {
  const crudo = String(text ?? "").replace(/\r\n?/g, "\n");
  // Excel añade un salto de línea final al copiar: no es una fila más.
  const lineas = crudo.replace(/\n+$/, "").split("\n");

  const truncado = lineas.length > MAX_LINEAS_PASTE;
  const acotadas = truncado ? lineas.slice(0, MAX_LINEAS_PASTE) : lineas;

  let multiColumna = false;
  const fechas: (string | null)[] = [];
  const errores: PasteParseResult["errores"] = [];

  acotadas.forEach((linea, i) => {
    let celda = linea;
    if (linea.includes("\t")) {
      multiColumna = true;
      celda = linea.split("\t")[0];
    }
    const parsed = parseFechaTexto(celda);
    if (parsed.ok) fechas.push(parsed.value);
    else errores.push({ linea: i + 1, valor: celda.trim(), motivo: parsed.error });
  });

  return { fechas, errores, multiColumna, truncado };
}

/**
 * Empareja los valores pegados con las filas visibles a partir de la celda
 * ancla, hacia abajo. Recorta al final de la lista: pegar 20 fechas con 5 filas
 * por debajo del ancla actualiza 5. Devuelve [] si el ancla no está visible.
 */
export function mapPasteAFilas(
  hitoIdAncla: string,
  hitosVisiblesIds: string[],
  fechas: (string | null)[],
): { hitoId: string; fecha: string | null }[] {
  const desde = hitosVisiblesIds.indexOf(hitoIdAncla);
  if (desde < 0) return [];
  return fechas
    .slice(0, hitosVisiblesIds.length - desde)
    .map((fecha, i) => ({ hitoId: hitosVisiblesIds[desde + i], fecha }));
}
