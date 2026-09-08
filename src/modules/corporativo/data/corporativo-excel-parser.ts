/**
 * Parser del maestro corporativo (20260810_MAESTRO_CORPORATIVO.xlsx).
 *
 * Mismo criterio que el parser del maestro de vehículos: el mapeo columna→campo se
 * resuelve por NOMBRE de cabecera normalizado, nunca por posición, de modo que
 * reordenar o insertar columnas en el Excel no corrompe la carga.
 *
 * A diferencia de aquél, aquí las claves de campo SON los nombres de columna de
 * `corp_periodos`. El fichero ya viene en formato largo y limpio, así que un
 * segundo mapeo campo→columna solo añadiría un sitio donde equivocarse.
 */
import * as XLSX from "xlsx";

import {
  NATURALEZAS,
  SOCIEDADES,
  TIPOS_PERIODO,
  type CorpDiccionarioEntrada,
  type CorpNota,
  type CorpPeriodo,
  type Naturaleza,
  type Sociedad,
  type TipoPeriodo,
} from "@/modules/corporativo/types";

const HOJA_DATOS = "DATOS";
const HOJA_DICCIONARIO = "DICCIONARIO";
const HOJA_NOTAS = "NOTAS";

/** Nº de filas iniciales donde buscar la cabecera. */
const HEADER_SCAN_ROWS = 15;
/** Filas seguidas sin `ID` que dan por terminada la tabla. */
const MAX_EMPTY_STREAK = 5;

type CampoTexto = "id" | "sociedad" | "perimetro" | "periodo" | "tipo_periodo" | "naturaleza";
type CampoFecha = "fecha_inicio" | "fecha_fin";
type CampoEntero = "es_ultima_fila" | "anio" | "trimestre" | "meses";
type CampoNumerico =
  | "facturacion"
  | "gastos_totales"
  | "gastos_variables"
  | "gastos_estructura"
  | "ebitda"
  | "margen_ebitda_pct"
  | "gastos_sobre_facturacion_pct"
  | "ebitda_caja"
  | "ajuste_periodificacion"
  | "facturacion_acumulada_anio"
  | "var_facturacion_interanual_pct"
  | "saldo_caja_cierre"
  | "saldo_banco_cierre"
  | "capital_bajo_gestion"
  | "aum_regulado_icam"
  | "aum_no_regulado_ici"
  | "n_vehiculos"
  | "fee_sobre_aum_pct"
  | "facturacion_por_vehiculo"
  | "facturacion_icam"
  | "facturacion_ici"
  | "facturacion_giic"
  | "ebitda_icam"
  | "ebitda_ici"
  | "ebitda_giic"
  | "peso_sobre_facturacion_grupo_pct"
  | "cifra_negocio_cuentas"
  | "resultado_explotacion_cuentas"
  | "resultado_ejercicio_cuentas"
  | "total_activo"
  | "patrimonio_neto"
  | "efectivo_balance"
  | "volumen_intermediado"
  | "n_proyectos_giic";

export type CampoCorp = CampoTexto | CampoFecha | CampoEntero | CampoNumerico;

const CAMPOS_TEXTO: CampoTexto[] = [
  "id",
  "sociedad",
  "perimetro",
  "periodo",
  "tipo_periodo",
  "naturaleza",
];
const CAMPOS_FECHA: CampoFecha[] = ["fecha_inicio", "fecha_fin"];
const CAMPOS_ENTERO: CampoEntero[] = ["es_ultima_fila", "anio", "trimestre", "meses"];
const CAMPOS_NUMERICO: CampoNumerico[] = [
  "facturacion",
  "gastos_totales",
  "gastos_variables",
  "gastos_estructura",
  "ebitda",
  "margen_ebitda_pct",
  "gastos_sobre_facturacion_pct",
  "ebitda_caja",
  "ajuste_periodificacion",
  "facturacion_acumulada_anio",
  "var_facturacion_interanual_pct",
  "saldo_caja_cierre",
  "saldo_banco_cierre",
  "capital_bajo_gestion",
  "aum_regulado_icam",
  "aum_no_regulado_ici",
  "n_vehiculos",
  "fee_sobre_aum_pct",
  "facturacion_por_vehiculo",
  "facturacion_icam",
  "facturacion_ici",
  "facturacion_giic",
  "ebitda_icam",
  "ebitda_ici",
  "ebitda_giic",
  "peso_sobre_facturacion_grupo_pct",
  "cifra_negocio_cuentas",
  "resultado_explotacion_cuentas",
  "resultado_ejercicio_cuentas",
  "total_activo",
  "patrimonio_neto",
  "efectivo_balance",
  "volumen_intermediado",
  "n_proyectos_giic",
];

const CAMPOS: CampoCorp[] = [
  ...CAMPOS_TEXTO,
  ...CAMPOS_FECHA,
  ...CAMPOS_ENTERO,
  ...CAMPOS_NUMERICO,
];

/**
 * Alias de cabecera ya normalizados (minúsculas, sin diacríticos, espacios
 * colapsados) contra la hoja DATOS del maestro real.
 *
 * Ojo con dos normalizaciones que no son evidentes: «Año» pierde la tilde de la ñ
 * y queda en «ano», y la «º» de «Nº» sobrevive a NFD porque no es un diacrítico
 * combinante. Por eso esos campos llevan también la variante sin «º».
 */
const ALIAS: Record<CampoCorp, string[]> = {
  id: ["id"],
  sociedad: ["sociedad"],
  perimetro: ["perimetro"],
  es_ultima_fila: ["es ultima fila"],
  periodo: ["periodo"],
  tipo_periodo: ["tipo periodo"],
  anio: ["ano", "anio", "year"],
  trimestre: ["trimestre"],
  fecha_inicio: ["fecha inicio"],
  fecha_fin: ["fecha fin"],
  meses: ["meses"],
  naturaleza: ["naturaleza"],
  facturacion: ["facturacion"],
  gastos_totales: ["gastos totales"],
  gastos_variables: ["gastos variables"],
  gastos_estructura: ["gastos estructura"],
  ebitda: ["ebitda"],
  margen_ebitda_pct: ["margen ebitda %", "margen ebitda"],
  gastos_sobre_facturacion_pct: ["gastos sobre facturacion %", "gastos sobre facturacion"],
  ebitda_caja: ["ebitda de caja"],
  ajuste_periodificacion: ["ajuste periodificacion"],
  facturacion_acumulada_anio: ["facturacion acumulada ano", "facturacion acumulada anio"],
  var_facturacion_interanual_pct: [
    "var. facturacion interanual %",
    "var facturacion interanual %",
    "var. facturacion interanual",
  ],
  saldo_caja_cierre: ["saldo caja cierre"],
  saldo_banco_cierre: ["saldo banco cierre"],
  capital_bajo_gestion: ["capital bajo gestion"],
  aum_regulado_icam: ["aum regulado icam"],
  aum_no_regulado_ici: ["aum no regulado ici"],
  n_vehiculos: ["nº vehiculos en gestion", "n vehiculos en gestion", "no vehiculos en gestion"],
  fee_sobre_aum_pct: ["fee sobre aum % anualizado", "fee sobre aum %"],
  facturacion_por_vehiculo: ["facturacion por vehiculo"],
  facturacion_icam: ["facturacion icam"],
  facturacion_ici: ["facturacion ici"],
  facturacion_giic: ["facturacion giic"],
  ebitda_icam: ["ebitda icam"],
  ebitda_ici: ["ebitda ici"],
  ebitda_giic: ["ebitda giic"],
  peso_sobre_facturacion_grupo_pct: [
    "peso sobre facturacion grupo %",
    "peso sobre facturacion grupo",
  ],
  cifra_negocio_cuentas: ["cifra de negocio cuentas"],
  resultado_explotacion_cuentas: ["resultado explotacion cuentas"],
  resultado_ejercicio_cuentas: ["resultado ejercicio cuentas"],
  total_activo: ["total activo"],
  patrimonio_neto: ["patrimonio neto"],
  efectivo_balance: ["efectivo en balance"],
  volumen_intermediado: ["volumen intermediado"],
  n_proyectos_giic: [
    "nº proyectos giic en marcha",
    "n proyectos giic en marcha",
    "no proyectos giic en marcha",
  ],
};

/**
 * Sin estos campos la tabla no se puede ni indexar ni filtrar, así que su ausencia
 * es error y no aviso: mejor no cargar nada que cargar 83 filas que luego no se
 * pueden agrupar.
 */
const CAMPOS_REQUERIDOS: CampoCorp[] = [
  "id",
  "sociedad",
  "periodo",
  "tipo_periodo",
  "naturaleza",
];

/** Normaliza un rótulo para comparar: minúsculas, sin diacríticos, espacios colapsados. */
function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function trimStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : null;
  }
  const s = String(v).trim();
  if (s === "" || s === "#N/A" || s === "—" || s === "-") return null;
  // Miles con punto y decimal con coma («1.234,56») frente al formato inglés.
  const limpio = s.replace(/\s|€|%/g, "");
  const n = Number(
    /,\d{1,2}$/.test(limpio) ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/,/g, ""),
  );
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n);
}

/** Serial de Excel → ISO. Misma conversión que el parser del maestro de vehículos. */
function excelCellToIsoDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const n = toNum(v);
  if (n !== null && n > 20000 && n < 60000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = trimStr(v);
  if (!s) return null;
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

type ColumnMap = Partial<Record<CampoCorp, number>>;

/**
 * Localiza la fila de cabecera y devuelve el mapa campo→índice de columna. Elige
 * la fila con más alias reconocidos que además contenga los identificadores
 * (`id` y `tipo_periodo`).
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
      const norm = normalizeHeader(cell?.v);
      if (!norm) continue;
      for (const campo of CAMPOS) {
        if (colByField[campo] !== undefined) continue;
        if (ALIAS[campo].includes(norm)) {
          colByField[campo] = c;
          break;
        }
      }
    }
    const matched = CAMPOS.filter((f) => colByField[f] !== undefined).length;
    const tieneIdentificadores =
      colByField.id !== undefined && colByField.tipo_periodo !== undefined;
    if (tieneIdentificadores && (!best || matched > best.matched)) {
      best = { rowIndex: r, colByField, matched };
    }
  }

  if (!best) {
    throw new Error(
      `No se encontró la fila de cabecera en la hoja "${HOJA_DATOS}" ` +
        "(faltan las columnas identificadoras 'ID' y/o 'Tipo Periodo').",
    );
  }

  const faltan = CAMPOS_REQUERIDOS.filter((f) => best!.colByField[f] === undefined);
  if (faltan.length > 0) {
    throw new Error(
      `Cabeceras requeridas no encontradas en "${HOJA_DATOS}": ` +
        faltan.map((f) => ALIAS[f][0]).join(", ") +
        ". Revisa que el maestro corporativo conserve esas columnas.",
    );
  }

  return { headerRowIndex: best.rowIndex, colByField: best.colByField };
}

export interface CorporativoParseStats {
  totalFilas: number;
  porTipoPeriodo: Record<string, number>;
  porSociedad: Record<string, number>;
  /** Periodos marcados como último trimestre real, uno por sociedad. */
  ultimosPeriodosReales: string[];
  columnasReconocidas: number;
}

export interface CorporativoParseResult {
  rows: CorpPeriodo[];
  diccionario: CorpDiccionarioEntrada[];
  notas: CorpNota[];
  warnings: string[];
  stats: CorporativoParseStats;
}

function esSociedad(v: string): v is Sociedad {
  return (SOCIEDADES as readonly string[]).includes(v);
}
function esTipoPeriodo(v: string): v is TipoPeriodo {
  return (TIPOS_PERIODO as readonly string[]).includes(v);
}
function esNaturaleza(v: string): v is Naturaleza {
  return (NATURALEZAS as readonly string[]).includes(v);
}

/**
 * Lee la hoja DATOS. Las filas cuya `sociedad`, `tipo_periodo` o `naturaleza` no
 * pertenezcan al vocabulario conocido se descartan con aviso: la migración 038
 * tiene CHECK sobre las tres, así que colarlas solo cambiaría un aviso legible por
 * un error de Postgres en mitad del RPC.
 */
function parseDatos(
  wb: XLSX.WorkBook,
  warnings: string[],
): { rows: CorpPeriodo[]; columnasReconocidas: number } {
  const sheet = wb.Sheets[HOJA_DATOS];
  if (!sheet) {
    throw new Error(
      `El libro no tiene la hoja "${HOJA_DATOS}". Hojas encontradas: ${wb.SheetNames.join(", ")}.`,
    );
  }
  const ref = sheet["!ref"];
  if (!ref) throw new Error(`La hoja "${HOJA_DATOS}" está vacía.`);
  const range = XLSX.utils.decode_range(ref);

  const { headerRowIndex, colByField } = locateHeaderRow(sheet, range);
  const columnasReconocidas = CAMPOS.filter((f) => colByField[f] !== undefined).length;

  const noEncontradas = CAMPOS.filter((f) => colByField[f] === undefined);
  if (noEncontradas.length > 0) {
    warnings.push(
      `Columnas no encontradas en el maestro (se cargarán vacías): ${noEncontradas.join(", ")}.`,
    );
  }

  const leer = (r: number, campo: CampoCorp): unknown => {
    const c = colByField[campo];
    if (c === undefined) return null;
    return sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? null;
  };

  const rows: CorpPeriodo[] = [];
  const vistos = new Set<string>();
  let racha = 0;

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const id = trimStr(leer(r, "id"));
    if (!id) {
      racha += 1;
      if (racha >= MAX_EMPTY_STREAK) break;
      continue;
    }
    racha = 0;

    const sociedad = trimStr(leer(r, "sociedad"));
    const tipoPeriodo = trimStr(leer(r, "tipo_periodo"));
    const naturaleza = trimStr(leer(r, "naturaleza"));

    if (!esSociedad(sociedad)) {
      warnings.push(`Fila ${r + 1} descartada: sociedad no reconocida «${sociedad}» (ID ${id}).`);
      continue;
    }
    if (!esTipoPeriodo(tipoPeriodo)) {
      warnings.push(
        `Fila ${r + 1} descartada: tipo de periodo no reconocido «${tipoPeriodo}» (ID ${id}).`,
      );
      continue;
    }
    if (!esNaturaleza(naturaleza)) {
      warnings.push(
        `Fila ${r + 1} descartada: naturaleza no reconocida «${naturaleza}» (ID ${id}).`,
      );
      continue;
    }
    if (vistos.has(id)) {
      warnings.push(`Fila ${r + 1} descartada: ID duplicado «${id}».`);
      continue;
    }
    vistos.add(id);

    const fila: Record<string, unknown> = {
      id,
      sociedad,
      tipo_periodo: tipoPeriodo,
      naturaleza,
      periodo: trimStr(leer(r, "periodo")),
      perimetro: trimStr(leer(r, "perimetro")) || null,
    };
    for (const campo of CAMPOS_FECHA) fila[campo] = excelCellToIsoDate(leer(r, campo));
    for (const campo of CAMPOS_ENTERO) fila[campo] = toInt(leer(r, campo));
    for (const campo of CAMPOS_NUMERICO) fila[campo] = toNum(leer(r, campo));
    // `es_ultima_fila` es la única entera que no admite null: 0 es su ausencia.
    fila.es_ultima_fila = fila.es_ultima_fila === 1 ? 1 : 0;

    rows.push(fila as unknown as CorpPeriodo);
  }

  return { rows, columnasReconocidas };
}

/** Hoja DICCIONARIO: CAMPO / UNIDAD / QUÉ ES Y DE DÓNDE SALE. Su ausencia no es fatal. */
function parseDiccionario(wb: XLSX.WorkBook, warnings: string[]): CorpDiccionarioEntrada[] {
  const sheet = wb.Sheets[HOJA_DICCIONARIO];
  if (!sheet) {
    warnings.push(`El libro no trae hoja "${HOJA_DICCIONARIO}": el tab se mostrará sin glosario.`);
    return [];
  }
  const filas = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const salida: CorpDiccionarioEntrada[] = [];
  const vistos = new Set<string>();

  // La primera fila es la cabecera («CAMPO»); se salta comparando en normalizado.
  filas.forEach((fila, i) => {
    const campo = trimStr(fila?.[0]);
    if (!campo || normalizeHeader(campo) === "campo") return;
    if (vistos.has(campo)) return;
    vistos.add(campo);
    salida.push({
      campo,
      unidad: trimStr(fila?.[1]) || null,
      descripcion: trimStr(fila?.[2]) || null,
      orden: i,
    });
  });
  return salida;
}

/**
 * Hoja NOTAS: dos columnas sin cabecera fija. Las filas en mayúsculas y sin
 * segunda columna («ORIGEN DE LOS DATOS», «AVISOS») son títulos de sección; el
 * resto cuelgan de la última sección vista. Su ausencia no es fatal.
 */
function parseNotas(wb: XLSX.WorkBook, warnings: string[]): CorpNota[] {
  const sheet = wb.Sheets[HOJA_NOTAS];
  if (!sheet) {
    warnings.push(`El libro no trae hoja "${HOJA_NOTAS}": el tab se mostrará sin metodología.`);
    return [];
  }
  const filas = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const salida: CorpNota[] = [];
  let seccion = "GENERAL";

  filas.forEach((fila, i) => {
    const a = trimStr(fila?.[0]);
    const b = trimStr(fila?.[1]);
    if (!a && !b) return;
    if (i === 0 && !b) return; // título del documento

    if (a && !b && a === a.toUpperCase()) {
      seccion = a;
      return;
    }
    if (!b) return;

    salida.push({
      id: `${seccion}|${i}`,
      seccion,
      orden: i,
      titulo: a || null,
      texto: b,
    });
  });
  return salida;
}

/** Punto de entrada: buffer del .xlsx → filas listas para `replace_corp_periodos`. */
export function parseCorporativoWorkbook(buffer: ArrayBuffer): CorporativoParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const warnings: string[] = [];

  const { rows, columnasReconocidas } = parseDatos(wb, warnings);
  if (rows.length === 0) {
    throw new Error(
      `La hoja "${HOJA_DATOS}" no tiene ninguna fila válida. No se ha modificado la base de datos.`,
    );
  }

  const diccionario = parseDiccionario(wb, warnings);
  const notas = parseNotas(wb, warnings);

  const porTipoPeriodo: Record<string, number> = {};
  const porSociedad: Record<string, number> = {};
  for (const fila of rows) {
    porTipoPeriodo[fila.tipo_periodo] = (porTipoPeriodo[fila.tipo_periodo] ?? 0) + 1;
    porSociedad[fila.sociedad] = (porSociedad[fila.sociedad] ?? 0) + 1;
  }

  const ultimosPeriodosReales = rows
    .filter((f) => f.es_ultima_fila === 1)
    .map((f) => `${f.sociedad} ${f.periodo}`);

  if (ultimosPeriodosReales.length === 0) {
    warnings.push(
      "Ninguna fila tiene «Es Última Fila» = 1: los KPI de cabecera caerán al periodo REAL más reciente.",
    );
  }

  return {
    rows,
    diccionario,
    notas,
    warnings,
    stats: {
      totalFilas: rows.length,
      porTipoPeriodo,
      porSociedad,
      ultimosPeriodosReales,
      columnasReconocidas,
    },
  };
}
