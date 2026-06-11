import * as XLSX from "xlsx";
import type { Proyecto, SituacionProyecto, TipoProyecto } from "@/modules/portfolio/types";

/** Columna Excel 1-based → índice 0-based en array de fila */
function col(n1Based: number): number {
  return n1Based - 1;
}

/** Índices según MAESTRO - VEHICULOS ICAM, hoja "Tabla madre" */
const C = {
  proyecto: col(5),
  ubicacion: col(6),
  esUltimaFila: col(7),
  holdingPeriod: col(9),
  fechaInicio: col(10),
  superficieEdificable: col(13),
  unidadesTotales: col(21),
  equity: col(51),
  inversionTotal: col(59),
  totalIngresosVenta: col(75),
  tirDespuesIS: col(98),
  roeDespuesIS: col(99),
  projectIRR: col(103),
  beneficios: col(115),
  multiplo: col(116),
  bcr: col(117),
  tipoProyecto: col(125),
  situacion: col(126),
} as const;

const SHEET_NAME = "Tabla madre";
const MAX_EMPTY_STREAK = 5;

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
  const maxCol = Math.max(
    C.situacion,
    C.tipoProyecto,
    C.bcr,
    C.beneficios,
  );

  const warnings: string[] = [];
  const rows: ProyectoInsert[] = [];
  let emptyStreak = 0;

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rawRow: unknown[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddr];
      rawRow[c] = cell?.v;
    }

    const proyecto = trimStr(rawRow[C.proyecto]);
    if (!proyecto) {
      emptyStreak += 1;
      if (emptyStreak >= MAX_EMPTY_STREAK) {
        break;
      }
      continue;
    }
    emptyStreak = 0;

    if (toEsUltimaFila(rawRow[C.esUltimaFila]) !== 1) {
      continue;
    }

    const situRaw = trimStr(rawRow[C.situacion]);
    const tipoRaw = trimStr(rawRow[C.tipoProyecto]);
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

    const inversion_total = toNum(rawRow[C.inversionTotal]);
    const beneficios = toNum(rawRow[C.beneficios]);
    if (inversion_total === null && beneficios === null) {
      warnings.push(`${proyecto}: inversión y beneficios vacíos (se guardarán como NULL).`);
    }

    const hp = toNum(rawRow[C.holdingPeriod]);
    const row: ProyectoInsert = {
      proyecto,
      situacion,
      tipo_proyecto,
      inversion_total,
      total_ingresos_venta: toNum(rawRow[C.totalIngresosVenta]),
      beneficios,
      unidades_totales: toNum(rawRow[C.unidadesTotales]),
      tir_desp_is: toNum(rawRow[C.tirDespuesIS]),
      roe_desp_is: toNum(rawRow[C.roeDespuesIS]),
      multiplo: toNum(rawRow[C.multiplo]),
      project_irr: toNum(rawRow[C.projectIRR]),
      bcr: toNum(rawRow[C.bcr]),
      ubicacion: trimStr(rawRow[C.ubicacion]) || null,
      equity: toNum(rawRow[C.equity]),
      holding_period: hp === null ? null : Math.round(hp),
      superficie_edificable: toNum(rawRow[C.superficieEdificable]),
      es_ultima_fila: 1,
      fecha_inicio: excelCellToIsoDate(rawRow[C.fechaInicio]),
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
