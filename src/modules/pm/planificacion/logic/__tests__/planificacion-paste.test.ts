import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_LINEAS_PASTE,
  mapPasteAFilas,
  parseClipboardFechas,
  parseFechaTexto,
} from "../planificacion-paste";

// ---------------------------------------------------------------------------
// parseFechaTexto
// ---------------------------------------------------------------------------

test("parseFechaTexto acepta el formato es-ES del Excel", () => {
  assert.deepEqual(parseFechaTexto("31/12/2026"), { ok: true, value: "2026-12-31" });
  assert.deepEqual(parseFechaTexto("1/3/2027"), { ok: true, value: "2027-03-01" });
  assert.deepEqual(parseFechaTexto("01-06-2025"), { ok: true, value: "2025-06-01" });
});

test("parseFechaTexto expande el año de dos cifras a 20xx", () => {
  assert.deepEqual(parseFechaTexto("1/3/27"), { ok: true, value: "2027-03-01" });
  assert.deepEqual(parseFechaTexto("31/12/26"), { ok: true, value: "2026-12-31" });
});

test("parseFechaTexto deja pasar ISO tal cual", () => {
  assert.deepEqual(parseFechaTexto("2026-12-31"), { ok: true, value: "2026-12-31" });
  assert.deepEqual(parseFechaTexto("2026/6/1"), { ok: true, value: "2026-06-01" });
});

test("parseFechaTexto interpreta SIEMPRE día/mes, nunca mes/día", () => {
  // 03/07 es el 3 de julio, no el 7 de marzo: el Excel de la PM es es-ES.
  assert.deepEqual(parseFechaTexto("03/07/2026"), { ok: true, value: "2026-07-03" });
});

test("parseFechaTexto trata vacío y el centinela 1899 de Excel como null", () => {
  assert.deepEqual(parseFechaTexto(""), { ok: true, value: null });
  assert.deepEqual(parseFechaTexto("   "), { ok: true, value: null });
  // Serial 0 de Excel: celda de fecha vacía formateada.
  assert.deepEqual(parseFechaTexto("30/12/1899"), { ok: true, value: null });
  assert.deepEqual(parseFechaTexto("1899-12-30"), { ok: true, value: null });
});

test("parseFechaTexto rechaza fechas imposibles", () => {
  // El maestro tiene un 31-02-2027 real en Fecha LPO: el round-trip lo caza.
  assert.equal(parseFechaTexto("31/02/2027").ok, false);
  assert.equal(parseFechaTexto("31/13/2026").ok, false);
});

test("parseFechaTexto rechaza texto que no es fecha", () => {
  for (const v of ["junio 2026", "Q3 2026", "n/a", "12", "2026"]) {
    assert.equal(parseFechaTexto(v).ok, false, `debería rechazar «${v}»`);
  }
});

// ---------------------------------------------------------------------------
// parseClipboardFechas
// ---------------------------------------------------------------------------

test("parseClipboardFechas parsea una columna con CRLF de Windows", () => {
  const r = parseClipboardFechas("31/12/2026\r\n01/01/2027\r\n15/06/2027\r\n");
  assert.deepEqual(r.fechas, ["2026-12-31", "2027-01-01", "2027-06-15"]);
  assert.equal(r.errores.length, 0);
  assert.equal(r.multiColumna, false);
  assert.equal(r.truncado, false);
});

test("parseClipboardFechas no cuenta el salto de línea final de Excel como fila", () => {
  const r = parseClipboardFechas("31/12/2026\n");
  assert.equal(r.fechas.length, 1);
});

test("parseClipboardFechas conserva las líneas vacías intermedias como null", () => {
  // La PM copia una columna con huecos: el hueco borra la fecha de esa fila,
  // igual que en su Excel.
  const r = parseClipboardFechas("31/12/2026\n\n15/06/2027");
  assert.deepEqual(r.fechas, ["2026-12-31", null, "2027-06-15"]);
});

test("parseClipboardFechas usa solo la primera columna si hay tabuladores", () => {
  const r = parseClipboardFechas("31/12/2026\tcomentario\n01/01/2027\totra cosa");
  assert.deepEqual(r.fechas, ["2026-12-31", "2027-01-01"]);
  assert.equal(r.multiColumna, true);
});

test("parseClipboardFechas señala la línea del error", () => {
  const r = parseClipboardFechas("31/12/2026\n31/13/2026\n01/01/2027");
  assert.equal(r.errores.length, 1);
  assert.equal(r.errores[0].linea, 2);
  assert.equal(r.errores[0].valor, "31/13/2026");
});

test("parseClipboardFechas recorta al límite de líneas", () => {
  const texto = Array.from({ length: MAX_LINEAS_PASTE + 50 }, () => "01/01/2027").join("\n");
  const r = parseClipboardFechas(texto);
  assert.equal(r.fechas.length, MAX_LINEAS_PASTE);
  assert.equal(r.truncado, true);
});

// ---------------------------------------------------------------------------
// mapPasteAFilas
// ---------------------------------------------------------------------------

const IDS = ["a", "b", "c", "d", "e"];

test("mapPasteAFilas rellena hacia abajo desde el ancla", () => {
  assert.deepEqual(mapPasteAFilas("b", IDS, ["2026-01-01", null, "2026-03-01"]), [
    { hitoId: "b", fecha: "2026-01-01" },
    { hitoId: "c", fecha: null },
    { hitoId: "d", fecha: "2026-03-01" },
  ]);
});

test("mapPasteAFilas recorta al final de las filas visibles", () => {
  const fechas = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"];
  const r = mapPasteAFilas("d", IDS, fechas);
  assert.equal(r.length, 2);
  assert.equal(r[1].hitoId, "e");
});

test("mapPasteAFilas con el ancla fuera de la lista no pega nada", () => {
  // Pasa si el hito se archivó o se filtró entre el clic y el pegado.
  assert.deepEqual(mapPasteAFilas("z", IDS, ["2026-01-01"]), []);
});

test("mapPasteAFilas con una sola fecha actualiza solo el ancla", () => {
  assert.deepEqual(mapPasteAFilas("e", IDS, ["2026-01-01"]), [
    { hitoId: "e", fecha: "2026-01-01" },
  ]);
});
