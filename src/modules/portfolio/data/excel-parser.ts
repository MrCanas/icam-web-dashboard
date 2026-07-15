import * as XLSX from "xlsx";
import type { Proyecto, SituacionProyecto, TipoProyecto } from "@/modules/portfolio/types";

/**
 * Campos que el parser necesita localizar en la hoja "Tabla madre".
 * El mapeo columna→campo se resuelve por NOMBRE de cabecera (no por posición),
 * de modo que reordenar o insertar columnas en el maestro no corrompe la carga.
 */
type FieldKey =
  | "proyecto"
  | "ubicacion"
  | "esUltimaFila"
  | "holdingPeriod"
  | "fechaInicio"
  | "superficieEdificable"
  | "unidadesTotales"
  | "equity"
  | "inversionTotal"
  | "totalIngresosVenta"
  | "tirDespuesIS"
  | "roeDespuesIS"
  | "projectIRR"
  | "beneficios"
  | "multiplo"
  | "bcr"
  | "tipoProyecto"
  | "situacion";

const FIELD_KEYS: FieldKey[] = [
  "proyecto",
  "ubicacion",
  "esUltimaFila",
  "holdingPeriod",
  "fechaInicio",
  "superficieEdificable",
  "unidadesTotales",
  "equity",
  "inversionTotal",
  "totalIngresosVenta",
  "tirDespuesIS",
  "roeDespuesIS",
  "projectIRR",
  "beneficios",
  "multiplo",
  "bcr",
  "tipoProyecto",
  "situacion",
];

/**
 * Alias de cabecera (ya normalizados: minúsculas, sin acentos, espacios colapsados)
 * según "MAESTRO - VEHICULOS ICAM", hoja "Tabla madre". Cada campo admite varios
 * alias por si el rótulo varía ligeramente (p. ej. con/sin punto).
 */
const HEADER_ALIASES: Record<FieldKey, string[]> = {
  proyecto: ["proyecto"],
  ubicacion: ["ubicacion"],
  esUltimaFila: ["es ultima fila"],
  holdingPeriod: ["holding period"],
  fechaInicio: ["fecha inicio"],
  superficieEdificable: ["superficie edificable"],
  unidadesTotales: ["unidades totales"],
  equity: ["equity"],
  inversionTotal: ["inversion total"],
  totalIngresosVenta: ["total ingresos por venta"],
  tirDespuesIS: ["tir desp. is", "tir desp is"],
  roeDespuesIS: ["roe desp. is", "roe desp is"],
  projectIRR: ["project irr"],
  beneficios: ["beneficios"],
  multiplo: ["multiplo"],
  bcr: ["bcr"],
  tipoProyecto: ["tipo de proyecto"],
  situacion: ["situacion"],
};

/** Campos sin los que la carga no tiene sentido: si faltan, se lanza error. */
const REQUIRED_FIELDS: FieldKey[] = ["proyecto", "esUltimaFila", "situacion", "tipoProyecto"];

const SHEET_NAME = "Tabla madre";
const MAX_EMPTY_STREAK = 5;
/** Nº de filas iniciales donde buscar la cabecera. */
const HEADER_SCAN_ROWS = 15;

/** Normaliza un rótulo para comparar: minúsculas, sin diacríticos, espacios colapsados. */
function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type ColumnMap = Partial<Record<FieldKey, number>>;

/**
 * Localiza la fila de cabecera dentro de las primeras filas y devuelve el mapa
 * campo→índice de columna. Elige la fila con más alias reconocidos que además
 * contenga los campos identificadores (`proyecto` y `esUltimaFila`).
 */
function locateHeaderRow(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
): { headerRowIndex: number; colByField: ColumnMap } {
  let best: { rowIndex: number; colByField: ColumnMap; matched: number } | null = null;
  const lastScanRow = Math.min(range.s.r + HEADER_SCAN_ROWS - 1, range.e.r);

  for (let r = range.s.r; r <= lastScanRow; r++) {
    const colByField: ColumnMap = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell?.v === undefined || cell?.v === null) continue;
      const norm = normalizeHeader(cell.v);
      if (!norm) continue;
      for (const field of FIELD_KEYS) {
        if (colByField[field] !== undefined) continue;
        if (HEADER_ALIASES[field].includes(norm)) {
          colByField[field] = c;
          break;
        }
      }
    }
    const matched = FIELD_KEYS.filter((f) => colByField[f] !== undefined).length;
    const hasIdentifiers =
      colByField.proyecto !== undefined && colByField.esUltimaFila !== undefined;
    if (hasIdentifiers && (!best || matched > best.matched)) {
      best = { rowIndex: r, colByField, matched };
    }
  }

  if (!best) {
    throw new Error(
      `No se encontró la fila de cabecera en la hoja "${SHEET_NAME}" ` +
        "(faltan las columnas identificadoras 'Proyecto' y/o 'Es Ultima fila').",
    );
  }

  const missing = REQUIRED_FIELDS.filter((f) => best!.colByField[f] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Cabeceras requeridas no encontradas en "${SHEET_NAME}": ` +
        missing.map((f) => HEADER_ALIASES[f][0]).join(", ") +
        ". Revisa que el maestro conserve esas columnas.",
    );
  }

  return { headerRowIndex: best.rowIndex, colByField: best.colByField };
}

export type ProyectoInsert = Omit<Proyecto, "id" | "created_at">;

export interface MaestroParseStats {
  totalProyectos: number;
  activos: number;
  culminados: number;
  inversionTotal: number;
  gdvTotal: number;
}

export interface MaestroParseResult {
  rows: ProyectoInsert[];
  warnings: string[];
  stats: MaestroParseStats;
}

function trimStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (Number.isNaN(v) || !Number.isFinite(v)) return null;
    return v;
  }
  const s = String(v).trim();
  if (s === "" || s === "#N/A" || s === "—" || s === "-") return null;
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n;
}

function toEsUltimaFila(v: unknown): number {
  const n = toNum(v);
  if (n === 1) return 1;
  if (typeof v === "string" && v.trim() === "1") return 1;
  return 0;
}

function excelCellToIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const n = toNum(v);
  if (n !== null && n > 20000 && n < 60000) {
    const utc = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = trimStr(v);
  if (!s) return null;
  const parsed = Date.parse(s);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeSituacion(raw: string): SituacionProyecto | null {
  const s = raw.trim().toLowerCase();
  if (s.includes("marcha")) return "En Marcha";
  if (s.includes("culmin")) return "Culminado";
  if (raw === "En Marcha" || raw === "Culminado") return raw;
  return null;
}

function normalizeTipo(raw: string): TipoProyecto | null {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("promoc")) return "Promoción";
  if (s === "fondo" || s.includes("fondo")) return "Fondo";
  return null;
}

/**
 * Parsea el buffer del Excel maestro (.xlsm/.xlsx).
 * Solo incluye filas con EsUltimaFila = 1.
 */
export function parseMaestroWorkbook(buffer: ArrayBuffer): MaestroParseResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: false,
  });

  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`No se encontró la hoja "${SHEET_NAME}".`);
  }

  const ref = sheet["!ref"];
  if (!ref) {
    return {
      rows: [],
      warnings: ["La hoja está vacía."],
      stats: emptyStats(),
    };
  }

  const range = XLSX.utils.decode_range(ref);

  const warnings: string[] = [];
  const { headerRowIndex, colByField } = locateHeaderRow(sheet, range);

  // Avisar de campos opcionales ausentes (se guardarán como NULL, no rompen la carga).
  for (const field of FIELD_KEYS) {
    if (colByField[field] === undefined && !REQUIRED_FIELDS.includes(field)) {
      warnings.push(`Columna "${HEADER_ALIASES[field][0]}" no encontrada; se guardará como NULL.`);
    }
  }

  /** Lee la celda de la fila `r` para el campo dado según el mapa de cabeceras. */
  const cellFor = (rawRow: unknown[], field: FieldKey): unknown => {
    const c = colByField[field];
    return c === undefined ? undefined : rawRow[c];
  };

  const maxCol = Math.max(range.s.c, ...Object.values(colByField).filter((c): c is number => c !== undefined));

  const rows: ProyectoInsert[] = [];
  let emptyStreak = 0;

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const rawRow: unknown[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddr];
      rawRow[c] = cell?.v;
    }

    const proyecto = trimStr(cellFor(rawRow, "proyecto"));
    if (!proyecto) {
      emptyStreak += 1;
      if (emptyStreak >= MAX_EMPTY_STREAK) {
        break;
      }
      continue;
    }
    emptyStreak = 0;

    if (toEsUltimaFila(cellFor(rawRow, "esUltimaFila")) !== 1) {
      continue;
    }

    const situRaw = trimStr(cellFor(rawRow, "situacion"));
    const tipoRaw = trimStr(cellFor(rawRow, "tipoProyecto"));
    const situacion = normalizeSituacion(situRaw);
    const tipo_proyecto = normalizeTipo(tipoRaw);

    if (!situacion) {
      warnings.push(`Fila ${r + 1} (${proyecto}): situación no reconocida "${situRaw}". Fila omitida.`);
      continue;
    }
    if (!tipo_proyecto) {
      warnings.push(`Fila ${r + 1} (${proyecto}): tipo no reconocido "${tipoRaw}". Fila omitida.`);
      continue;
    }

    const inversion_total = toNum(cellFor(rawRow, "inversionTotal"));
    const beneficios = toNum(cellFor(rawRow, "beneficios"));
    if (inversion_total === null && beneficios === null) {
      warnings.push(`${proyecto}: inversión y beneficios vacíos (se guardarán como NULL).`);
    }

    const hp = toNum(cellFor(rawRow, "holdingPeriod"));
    const row: ProyectoInsert = {
      proyecto,
      situacion,
      tipo_proyecto,
      inversion_total,
      total_ingresos_venta: toNum(cellFor(rawRow, "totalIngresosVenta")),
      beneficios,
      unidades_totales: toNum(cellFor(rawRow, "unidadesTotales")),
      tir_desp_is: toNum(cellFor(rawRow, "tirDespuesIS")),
      roe_desp_is: toNum(cellFor(rawRow, "roeDespuesIS")),
      multiplo: toNum(cellFor(rawRow, "multiplo")),
      project_irr: toNum(cellFor(rawRow, "projectIRR")),
      bcr: toNum(cellFor(rawRow, "bcr")),
      ubicacion: trimStr(cellFor(rawRow, "ubicacion")) || null,
      equity: toNum(cellFor(rawRow, "equity")),
      holding_period: hp === null ? null : Math.round(hp),
      superficie_edificable: toNum(cellFor(rawRow, "superficieEdificable")),
      es_ultima_fila: 1,
      fecha_inicio: excelCellToIsoDate(cellFor(rawRow, "fechaInicio")),
    };

    rows.push(row);
  }

  rows.sort((a, b) => a.proyecto.localeCompare(b.proyecto));

  const stats = computeStats(rows);
  return { rows, warnings, stats };
}

function emptyStats(): MaestroParseStats {
  return {
    totalProyectos: 0,
    activos: 0,
    culminados: 0,
    inversionTotal: 0,
    gdvTotal: 0,
  };
}

function computeStats(rows: ProyectoInsert[]): MaestroParseStats {
  let activos = 0;
  let culminados = 0;
  let inversionTotal = 0;
  let gdvTotal = 0;
  for (const p of rows) {
    if (p.situacion === "En Marcha") activos += 1;
    else culminados += 1;
    inversionTotal += p.inversion_total ?? 0;
    gdvTotal += p.total_ingresos_venta ?? 0;
  }
  return {
    totalProyectos: rows.length,
    activos,
    culminados,
    inversionTotal,
    gdvTotal,
  };
}

export function isLikelyExcelBuffer(bytes: Uint8Array): boolean {
  // OOXML: ZIP "PK", legacy XLS: D0 CF 11 E0
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  )
    return true;
  return false;
}
