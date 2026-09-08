import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";

import { parseCorporativoWorkbook } from "../corporativo-excel-parser";

/**
 * Los tests construyen su propio libro en memoria en vez de leer el maestro real:
 * el fichero vive en la carpeta de SharePoint de cada uno, así que un test que
 * dependiera de él fallaría en CI y en la máquina de cualquiera que no lo tenga
 * sincronizado. Lo que se comprueba aquí es el contrato del parser, no el
 * contenido de una versión concreta del Excel.
 */

const CABECERA = [
  "ID",
  "Sociedad",
  "Perímetro",
  "Es Última Fila",
  "Periodo",
  "Tipo Periodo",
  "Año",
  "Trimestre",
  "Fecha Inicio",
  "Fecha Fin",
  "Meses",
  "Naturaleza",
  "Facturación",
  "Gastos Totales",
  "EBITDA",
  "Capital Bajo Gestión",
  "Nº Vehículos en Gestión",
];

/** 44197 = 2021-01-01 como serial de Excel; 44286 = 2021-03-31. */
const FILA_TRIMESTRE = [
  "GIIC|20211T",
  "GIIC",
  "Intermediación",
  0,
  "2021 1T",
  "TRIMESTRE",
  2021,
  1,
  44197,
  44286,
  3,
  "REAL",
  393110.68,
  311620.32,
  81490.36,
  null,
  null,
];

const FILA_ULTIMA = [
  "GRUPO|20262T",
  "GRUPO",
  "Consolidado",
  1,
  "2026 2T",
  "TRIMESTRE",
  2026,
  2,
  46174,
  46264,
  3,
  "REAL",
  1236990,
  885136,
  351854,
  180482090.91,
  10,
];

const FILA_ANIO = [
  "GRUPO|2025",
  "GRUPO",
  "Consolidado",
  0,
  "2025",
  "AÑO",
  2025,
  null,
  45658,
  46022,
  12,
  "REAL",
  5560335.35,
  4547052.67,
  1013282.68,
  163352090.91,
  10,
];

function construirLibro(filas: unknown[][], opciones?: { sinDiccionario?: boolean }): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([CABECERA, ...filas]),
    "DATOS",
  );
  if (!opciones?.sinDiccionario) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["CAMPO", "UNIDAD", "QUÉ ES Y DE DÓNDE SALE"],
        ["EBITDA", "€", "El EBITDA tal y como lo define el CF de cada sociedad."],
        ["Capital Bajo Gestión", "€", "AUM a cierre del periodo. STOCK: no se suma."],
      ]),
      "DICCIONARIO",
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["MAESTRO CORPORATIVO · notas de uso", ""],
        ["", ""],
        ["ORIGEN DE LOS DATOS", ""],
        ["GIIC", "CF2024, CF2025 y CF2026."],
        ["", ""],
        ["AVISOS", ""],
        ["1", "GIIC 2021-2023 solo trae facturación, gastos totales y EBITDA."],
        ["2", "Los saldos no se suman entre periodos."],
      ]),
      "NOTAS",
    );
  }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

test("parsea las filas y mapea las cabeceras por nombre", () => {
  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE, FILA_ANIO, FILA_ULTIMA]));

  assert.equal(r.rows.length, 3);
  const giic = r.rows.find((f) => f.id === "GIIC|20211T")!;
  assert.equal(giic.sociedad, "GIIC");
  assert.equal(giic.tipo_periodo, "TRIMESTRE");
  assert.equal(giic.naturaleza, "REAL");
  assert.equal(giic.anio, 2021);
  assert.equal(giic.trimestre, 1);
  assert.equal(giic.facturacion, 393110.68);
  assert.equal(giic.ebitda, 81490.36);
  // Columnas ausentes del libro quedan a null, no a 0: 0 sería un dato falso.
  assert.equal(giic.capital_bajo_gestion, null);
  assert.equal(giic.margen_ebitda_pct, null);
});

test("convierte los seriales de Excel a fechas ISO", () => {
  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE]));
  assert.equal(r.rows[0]!.fecha_inicio, "2021-01-01");
  assert.equal(r.rows[0]!.fecha_fin, "2021-03-31");
});

test("es_ultima_fila es 1 o 0, nunca null", () => {
  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE, FILA_ULTIMA]));
  assert.equal(r.rows.find((f) => f.id === "GIIC|20211T")!.es_ultima_fila, 0);
  assert.equal(r.rows.find((f) => f.id === "GRUPO|20262T")!.es_ultima_fila, 1);
  assert.deepEqual(r.stats.ultimosPeriodosReales, ["GRUPO 2026 2T"]);
});

test("cuenta filas por tipo de periodo y por sociedad", () => {
  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE, FILA_ANIO, FILA_ULTIMA]));
  assert.deepEqual(r.stats.porTipoPeriodo, { TRIMESTRE: 2, AÑO: 1 });
  assert.deepEqual(r.stats.porSociedad, { GIIC: 1, GRUPO: 2 });
});

test("descarta con aviso las filas cuyo vocabulario no reconoce", () => {
  // La 038 tiene CHECK sobre sociedad, tipo_periodo y naturaleza: colar una fila
  // así cambiaría un aviso legible por un error de Postgres a mitad del RPC.
  const mala = [...FILA_TRIMESTRE];
  mala[0] = "OTRA|20211T";
  mala[1] = "SOCIEDAD DESCONOCIDA";

  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE, mala]));
  assert.equal(r.rows.length, 1);
  assert.equal(r.warnings.filter((w) => w.includes("sociedad no reconocida")).length, 1);
});

test("descarta IDs duplicados quedándose con el primero", () => {
  const duplicada = [...FILA_TRIMESTRE];
  duplicada[12] = 999999;

  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE, duplicada]));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0]!.facturacion, 393110.68);
  assert.equal(r.warnings.filter((w) => w.includes("ID duplicado")).length, 1);
});

test("lee el glosario y agrupa las notas por sección", () => {
  const r = parseCorporativoWorkbook(construirLibro([FILA_TRIMESTRE]));

  assert.equal(r.diccionario.length, 2);
  assert.equal(r.diccionario[0]!.campo, "EBITDA");
  assert.equal(r.diccionario[0]!.unidad, "€");

  const secciones = r.notas.map((n) => n.seccion);
  assert.deepEqual(secciones, ["ORIGEN DE LOS DATOS", "AVISOS", "AVISOS"]);
  assert.equal(r.notas[0]!.titulo, "GIIC");
  assert.match(r.notas[1]!.texto ?? "", /solo trae facturación/);
});

test("sin hojas DICCIONARIO ni NOTAS avisa pero no falla", () => {
  const r = parseCorporativoWorkbook(
    construirLibro([FILA_TRIMESTRE], { sinDiccionario: true }),
  );
  assert.equal(r.rows.length, 1);
  assert.equal(r.diccionario.length, 0);
  assert.equal(r.notas.length, 0);
  assert.equal(r.warnings.filter((w) => w.includes("no trae hoja")).length, 2);
});

test("falla si la hoja DATOS no trae las cabeceras identificadoras", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([["Cosa", "Otra"], ["a", "b"]]),
    "DATOS",
  );
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  assert.throws(() => parseCorporativoWorkbook(buf), /fila de cabecera/);
});

test("falla si el libro no tiene hoja DATOS", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a"]]), "OTRA");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  assert.throws(() => parseCorporativoWorkbook(buf), /no tiene la hoja "DATOS"/);
});
