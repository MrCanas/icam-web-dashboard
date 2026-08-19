import assert from "node:assert/strict";
import { test } from "node:test";

import {
  anchoBarra,
  API_NAME_PENDIENTE,
  construirFilasCsvZoho,
  construirJsonZoho,
  fmtPorcentaje,
  generalDivergeDeFases,
  hayCambioVsZoho,
  parsePorcentajeZoho,
  serializarCsvZoho,
  validatePorcentaje,
  type CambioAprobado,
} from "../avance-obra";

// ---------------------------------------------------------------------------
// Parseo del export
// ---------------------------------------------------------------------------

test("parsePorcentajeZoho admite los tres tipos que mezcla el export", () => {
  assert.deepEqual(parsePorcentajeZoho("100.0"), { ok: true, value: 100 });
  assert.deepEqual(parsePorcentajeZoho(75), { ok: true, value: 75 });
  assert.deepEqual(parsePorcentajeZoho("45,38"), { ok: true, value: 45.38 });
});

test("parsePorcentajeZoho distingue vacío de cero", () => {
  assert.deepEqual(parsePorcentajeZoho(null), { ok: true, value: null });
  assert.deepEqual(parsePorcentajeZoho(""), { ok: true, value: null });
  assert.deepEqual(parsePorcentajeZoho(undefined), { ok: true, value: null });
  assert.deepEqual(parsePorcentajeZoho(0), { ok: true, value: 0 });
});

test("parsePorcentajeZoho rechaza basura y fuera de rango", () => {
  assert.equal(parsePorcentajeZoho("n/a").ok, false);
  assert.equal(parsePorcentajeZoho(101).ok, false);
  assert.equal(parsePorcentajeZoho(-1).ok, false);
});

test("parsePorcentajeZoho redondea a los 2 decimales de numeric(5,2)", () => {
  assert.deepEqual(parsePorcentajeZoho(45.3849), { ok: true, value: 45.38 });
});

// ---------------------------------------------------------------------------
// Validación de la edición
// ---------------------------------------------------------------------------

test("validatePorcentaje acepta vaciar el dato", () => {
  assert.deepEqual(validatePorcentaje(""), { ok: true, value: null });
  assert.deepEqual(validatePorcentaje(null), { ok: true, value: null });
});

test("validatePorcentaje rechaza lo que la base no aceptaría", () => {
  assert.equal(validatePorcentaje("101").ok, false);
  assert.equal(validatePorcentaje("-0.5").ok, false);
  assert.equal(validatePorcentaje("hola").ok, false);
  assert.equal(validatePorcentaje(Number.NaN).ok, false);
});

test("validatePorcentaje da mensajes en español", () => {
  const r = validatePorcentaje(101);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /no puede pasar de 100/);
});

// ---------------------------------------------------------------------------
// NULL ≠ 0 (la trampa que rompe el diff con Zoho)
// ---------------------------------------------------------------------------

test("fmtPorcentaje no confunde «sin dato» con «cero»", () => {
  assert.equal(fmtPorcentaje(null), "—");
  assert.equal(fmtPorcentaje(0), "0,0 %");
});

test("fmtPorcentaje usa formato español con 1-2 decimales", () => {
  assert.equal(fmtPorcentaje(45.38), "45,38 %");
  assert.equal(fmtPorcentaje(100), "100,0 %");
});

test("anchoBarra deja la barra vacía para null y acota fuera de rango", () => {
  assert.equal(anchoBarra(null), "0%");
  assert.equal(anchoBarra(0), "0%");
  assert.equal(anchoBarra(45.38), "45.38%");
  assert.equal(anchoBarra(120), "100%");
});

test("hayCambioVsZoho es el espejo de IS DISTINCT FROM", () => {
  assert.equal(hayCambioVsZoho(null, null), false);
  assert.equal(hayCambioVsZoho(0, null), true);
  assert.equal(hayCambioVsZoho(null, 0), true);
  assert.equal(hayCambioVsZoho(45.38, 45.38), false);
  assert.equal(hayCambioVsZoho(45.4, 45.38), true);
});

// ---------------------------------------------------------------------------
// El aviso de que el general no cuadra
// ---------------------------------------------------------------------------

test("SE84 diverge: 1,35 % general con las previas al 45,38 %", () => {
  const r = generalDivergeDeFases(1.35, [45.38, 0, 0, 0, 0, null]);
  assert.equal(r.diverge, true);
  assert.equal(r.mediaFases, 9.08);
});

test("PS7 diverge: 0 % general con la estructura al 75 %", () => {
  assert.equal(generalDivergeDeFases(0, [0, 75, 0, 0, 0, null]).diverge, true);
});

test("PL no diverge: todo al 100 %", () => {
  assert.equal(generalDivergeDeFases(100, [100, 100, 100, 100, 100, null]).diverge, false);
});

test("sin fases con dato no se avisa de nada", () => {
  const r = generalDivergeDeFases(100, [null, null, null, null, null, null]);
  assert.equal(r.diverge, false);
  assert.equal(r.mediaFases, null);
});

test("sin avance general no se avisa de nada", () => {
  assert.equal(generalDivergeDeFases(null, [50, 50]).diverge, false);
});

test("una diferencia de redondeo no dispara el aviso", () => {
  assert.equal(generalDivergeDeFases(50, [52, 48]).diverge, false);
});

// ---------------------------------------------------------------------------
// Exportación para Zoho
// ---------------------------------------------------------------------------

const cambio = (over: Partial<CambioAprobado> = {}): CambioAprobado => ({
  zohoRecordId: "261199000046470311",
  zohoAnalyticsId: "zcrm_261199000046470311",
  codigoPromocion: "SE84",
  zohoColumna: "Instalaciones",
  zohoApiName: null,
  faseNombre: "Instalaciones",
  porcentajeNuevo: 30,
  ...over,
});

test("construirFilasCsvZoho agrupa por promoción y usa la cabecera literal", () => {
  const filas = construirFilasCsvZoho([
    cambio(),
    cambio({ zohoColumna: "Obra gris", faseNombre: "Obra gris", porcentajeNuevo: 10 }),
    cambio({
      zohoRecordId: "261199000029760296",
      zohoAnalyticsId: "zcrm_261199000029760296",
      codigoPromocion: "DC15",
      porcentajeNuevo: 5,
    }),
  ]);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas[0].valores, { Instalaciones: 30, "Obra gris": 10 });
  assert.equal(filas[0].recordId, "261199000046470311");
  assert.equal(filas[0].analyticsId, "zcrm_261199000046470311");
});

test("una fase sin cambio aprobado no aparece: no se reescribe lo no aprobado", () => {
  const [fila] = construirFilasCsvZoho([cambio()]);
  assert.equal("Acabados" in fila.valores, false);

  const csv = serializarCsvZoho([fila], ["Instalaciones", "Acabados"]);
  const [, datos] = csv.split("\r\n");
  assert.equal(datos.endsWith(";30;"), true, csv);
});

test("vaciar un dato viaja como celda vacía, no como 0", () => {
  const [fila] = construirFilasCsvZoho([cambio({ porcentajeNuevo: null })]);
  assert.equal(fila.valores.Instalaciones, null);
  const csv = serializarCsvZoho([fila], ["Instalaciones"]);
  assert.equal(csv.split("\r\n")[1].endsWith(";"), true, csv);
});

test("el CSV lleva las cabeceras que espera Zoho", () => {
  const csv = serializarCsvZoho([], ["Instalaciones"]);
  assert.equal(csv, "Record Id;Id;Código de Promoción;Instalaciones");
});

test("el JSON marca los campos cuyo nombre API no conocemos", () => {
  const cuerpo = construirJsonZoho([cambio()]);
  assert.deepEqual(cuerpo.data, [
    { id: "261199000046470311", [`${API_NAME_PENDIENTE}Instalaciones`]: 30 },
  ]);
});

test("el JSON usa el nombre API en cuanto existe", () => {
  const cuerpo = construirJsonZoho([cambio({ zohoApiName: "Instalaciones_pct" })]);
  assert.deepEqual(cuerpo.data, [{ id: "261199000046470311", Instalaciones_pct: 30 }]);
});

test("el JSON es el cuerpo exacto del PUT: campos al nivel del registro, sin triggers", () => {
  const cuerpo = construirJsonZoho([
    cambio({ zohoApiName: "Instalaciones_pct" }),
    cambio({ zohoApiName: "Obra_gris_pct", faseNombre: "Obra gris", porcentajeNuevo: null }),
  ]);
  // Una sola entrada: las dos fases son de la misma promoción.
  assert.equal(cuerpo.data.length, 1);
  assert.deepEqual(cuerpo.data[0], {
    id: "261199000046470311",
    Instalaciones_pct: 30,
    Obra_gris_pct: null, // vaciar en el portal vacía en Zoho, no pone 0
  });
  assert.deepEqual(cuerpo.trigger, []);
});
