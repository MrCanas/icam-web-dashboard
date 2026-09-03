import * as XLSX from "xlsx";
import type { PmTipoUso } from "@/modules/pm/types";

const SHEET_NAMES = ["OVERVIEW", "overview", "Overview"];

/** ISO date YYYY-MM-DD from Excel serial, Date, or date string. */
export function excelSerialToIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 20000 && v < 60000) {
      const utc = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(utc);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const s = String(v).trim();
  if (!s || s === "#N/A" || s === "—" || s === "-") return null;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(n) && n > 20000 && n < 60000) {
    const utc = Math.round((n - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Binary (.xlsb) OLE or ZIP-based Excel. */
export function isLikelyPmExcelBuffer(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return true;
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return true;
  return false;
}

export interface PmReplaceRow {
  id_activo: string;
  tipo_uso_activo: PmTipoUso;
  hito: string;
  orden_hito: number;
  fecha_actual: string | null;
  desviacion_vs_anterior_dias: number | null;
  desviacion_vs_levantamiento_dias: number | null;
  snapshots: Record<string, string | null>;
}

export interface PmOverviewParseStats {
  filasLeidas: number;
  filasValidas: number;
  activosDistintos: number;
  columnasSnapshot: number;
}

export interface PmOverviewParseResult {
  rows: PmReplaceRow[];
  warnings: string[];
  stats: PmOverviewParseStats;
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return stripDiacritics(String(raw))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function toIntLoose(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  const s = String(v).trim().replace(/\s/g, "").replace(",", ".");
  if (!s || s === "#N/A" || s === "—") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

/**
 * Los dos usos que añadió la 037 se comprueban ANTES que RESIDENCIAL: el CHECK
 * los admite, así que un «Terciario» o un «Fondo» en el Excel tiene que llegar
 * tal cual. Si no, el upsert de replace_pm_portfolio pisaría con APT el uso que
 * la PMO fijó a mano (LSE84 es terciario; SICCII y VBARE, fondo).
 */
function parseTipoUso(raw: string): PmTipoUso | null {
  const u = stripDiacritics(raw).trim().toUpperCase();
  if (!u) return null;
  if (u.includes("TERCIARIO") || u.includes("LOCAL") || u.includes("COMERCIAL")) {
    return "TERCIARIO";
  }
  if (u.includes("FONDO") || u.includes("VEHICULO")) return "FONDO";
  if (u.includes("RESIDENCIAL") || u.includes("LIBRE") || u.includes("RL")) {
    return "RESIDENCIAL_LIBRE";
  }
  if (u === "APT" || u.includes("APART")) return "APT";
  return null;
}

/** Normaliza código snapshot tipo 2025_q2 → 2025_Q2 */
function normalizeSnapshotCode(code: string): string {
  const m = /^(\d{4})_q([1-4])$/i.exec(code);
  if (m) return `${m[1]}_Q${m[2]}`;
  return code;
}

function snapshotCodeFromHeader(norm: string): string | null {
  if (norm.startsWith("snapshot_")) {
    const rest = norm.slice("snapshot_".length);
    return rest ? normalizeSnapshotCode(rest) : null;
  }
  if (norm === "levantamiento") return "levantamiento";
  if (/^\d{4}_q[1-4]$/.test(norm)) return normalizeSnapshotCode(norm);
  return null;
}

interface ColumnMapping {
  idActivo: number;
  tipoUso: number;
  hito: number;
  ordenHito: number;
  fechaActual: number;
  desvAnt: number;
  desvLev: number;
  snapshotCols: { idx: number; code: string }[];
}

function resolveColumns(headers: string[]): { mapping: ColumnMapping; warnings: string[] } {
  const warnings: string[] = [];
  const idx: Partial<Record<keyof Omit<ColumnMapping, "snapshotCols">, number>> = {};
  const snapshotCols: { idx: number; code: string }[] = [];

  const aliases: [keyof Omit<ColumnMapping, "snapshotCols">, string[]][] = [
    ["idActivo", ["id_activo", "idactivo", "activo_pm", "proyecto_pm", "codigo_activo"]],
    ["tipoUso", ["tipo_uso_activo", "tipousoactivo", "tipo_uso", "tipouso"]],
    ["hito", ["hito", "milestone", "nombre_hito"]],
    ["ordenHito", ["orden_hito", "ordenhito", "orden", "order", "seq"]],
    ["fechaActual", ["fecha_actual", "fechaactual"]],
    ["desvAnt", ["desviacion_vs_anterior_dias", "desviacionvsanteriordias", "desv_vs_anterior", "dv_anterior"]],
    [
      "desvLev",
      [
        "desviacion_vs_levantamiento_dias",
        "desviacionvslevantamientodias",
        "desv_vs_levantamiento",
        "dv_levantamiento",
      ],
    ],
  ];

  for (let i = 0; i < headers.length; i++) {
    const norm = normalizeHeader(headers[i]);
    if (!norm) continue;

    let matchedCore = false;
    for (const [key, names] of aliases) {
      if (idx[key] !== undefined) continue;
      if (names.includes(norm)) {
        idx[key] = i;
        matchedCore = true;
        break;
      }
    }
    if (matchedCore) continue;

    const snap = snapshotCodeFromHeader(norm);
    if (snap) {
      snapshotCols.push({ idx: i, code: snap });
    }
  }

  const requiredKeys: (keyof Omit<ColumnMapping, "snapshotCols">)[] = [
    "idActivo",
    "tipoUso",
    "hito",
    "ordenHito",
  ];
  for (const k of requiredKeys) {
    if (idx[k] === undefined) {
      warnings.push(`No se encontró columna obligatoria para «${k}». Revisa cabeceras en OVERVIEW.`);
    }
  }
  const optionalCols: (keyof Omit<ColumnMapping, "snapshotCols">)[] = [
    "fechaActual",
    "desvAnt",
    "desvLev",
  ];
  for (const k of optionalCols) {
    if (idx[k] === undefined) {
      warnings.push(`Opcional: no hay columna «${k}»; se importará como null.`);
    }
  }

  if (snapshotCols.length === 0) {
    warnings.push(
      "No se detectaron columnas snapshot (snapshot_* , levantamiento o YYYY_Qn). ¿Cabeceras en inglés/español?",
    );
  }

  const mapping: ColumnMapping = {
    idActivo: idx.idActivo ?? -1,
    tipoUso: idx.tipoUso ?? -1,
    hito: idx.hito ?? -1,
    ordenHito: idx.ordenHito ?? -1,
    fechaActual: idx.fechaActual ?? -1,
    desvAnt: idx.desvAnt ?? -1,
    desvLev: idx.desvLev ?? -1,
    snapshotCols,
  };

  if (idx.tipoUso === undefined) {
    warnings.push("Columna tipo_uso_activo no encontrada; se asume APT cuando el valor falte.");
  }

  return { mapping, warnings };
}

function findOverviewSheet(wb: XLSX.WorkBook): XLSX.WorkSheet {
  for (const name of SHEET_NAMES) {
    if (wb.Sheets[name]) return wb.Sheets[name];
  }
  const lowerMap = new Map(wb.SheetNames.map((n) => [n.trim().toLowerCase(), n]));
  const hit = lowerMap.get("overview");
  if (hit && wb.Sheets[hit]) return wb.Sheets[hit];
  throw new Error(
    `No se encontró la hoja OVERVIEW. Hojas disponibles: ${wb.SheetNames.join(", ")}`,
  );
}

export function parsePmOverviewWorkbook(buffer: ArrayBuffer): PmOverviewParseResult {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: true,
  });

  const sheet = findOverviewSheet(workbook);
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];

  if (!matrix.length) {
    return {
      rows: [],
      warnings: ["La hoja OVERVIEW está vacía."],
      stats: { filasLeidas: 0, filasValidas: 0, activosDistintos: 0, columnasSnapshot: 0 },
    };
  }

  const headerRow = matrix[0].map((c) => (c == null ? "" : String(c)));
  const { mapping, warnings } = resolveColumns(headerRow);

  const rows: PmReplaceRow[] = [];
  const activosSet = new Set<string>();
  let filasLeidas = 0;

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!line || line.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      continue;
    }
    filasLeidas++;

    const cell = (i: number): unknown => (i >= 0 ? line[i] : null);

    const idActivo =
      mapping.idActivo >= 0 ? String(cell(mapping.idActivo) ?? "").trim() : "";
    const hitoRaw = mapping.hito >= 0 ? String(cell(mapping.hito) ?? "").trim() : "";

    if (!idActivo || !hitoRaw) continue;

    const tipoRaw =
      mapping.tipoUso >= 0 ? String(cell(mapping.tipoUso) ?? "").trim() : "";
    let tipo = parseTipoUso(tipoRaw);
    if (!tipo) {
      tipo = "APT";
      if (tipoRaw) {
        warnings.push(`Fila ${r + 1}: tipo_uso desconocido «${tipoRaw}», se usó APT.`);
      }
    }

    const orden =
      mapping.ordenHito >= 0 ? toIntLoose(cell(mapping.ordenHito)) : null;
    if (orden === null) {
      warnings.push(`Fila ${r + 1} (${idActivo} / ${hitoRaw}): falta orden_hito válido, se omite.`);
      continue;
    }

    const fechaActual =
      mapping.fechaActual >= 0 ? excelSerialToIso(cell(mapping.fechaActual)) : null;
    const desvAnt = mapping.desvAnt >= 0 ? toIntLoose(cell(mapping.desvAnt)) : null;
    const desvLev = mapping.desvLev >= 0 ? toIntLoose(cell(mapping.desvLev)) : null;

    const snapshots: Record<string, string | null> = {};
    for (const { idx: ci, code } of mapping.snapshotCols) {
      const iso = excelSerialToIso(cell(ci));
      if (iso) snapshots[code] = iso;
    }

    activosSet.add(idActivo);
    rows.push({
      id_activo: idActivo,
      tipo_uso_activo: tipo,
      hito: hitoRaw,
      orden_hito: orden,
      fecha_actual: fechaActual,
      desviacion_vs_anterior_dias: desvAnt,
      desviacion_vs_levantamiento_dias: desvLev,
      snapshots,
    });
  }

  const stats: PmOverviewParseStats = {
    filasLeidas,
    filasValidas: rows.length,
    activosDistintos: activosSet.size,
    columnasSnapshot: mapping.snapshotCols.length,
  };

  return { rows, warnings: [...new Set(warnings)], stats };
}
