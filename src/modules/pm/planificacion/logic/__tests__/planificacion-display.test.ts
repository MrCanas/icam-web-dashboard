import assert from "node:assert/strict";
import { test } from "node:test";

import type { PmSnapshot } from "@/modules/pm/types";
import {
  formatFechaCorta,
  snapshotLabel,
  trimestreActual,
} from "../planificacion-display";
import {
  estadoMapeo,
  ETIQUETA_MAPEO,
  TABLA_MADRE_COLUMNAS_HITO,
} from "../tabla-madre-columnas";

const snap = (over: Partial<PmSnapshot> = {}): PmSnapshot => ({
  snapshot_code: "2026_Q1",
  label: null,
  visible_en_dashboard: true,
  orden: 105,
  congelado_at: null,
  ...over,
});

// La plantilla de la rejilla, los anchos y las columnas por proyecto se cubren
// en columnas-por-proyecto.test.ts, donde vive esa lógica desde la 022.

// === Etiquetas ================================================================

test("snapshotLabel humaniza el trimestre", () => {
  assert.equal(snapshotLabel(snap({ snapshot_code: "2026_Q1" })), "Q1 2026");
});

test("snapshotLabel nombra el levantamiento", () => {
  assert.equal(snapshotLabel(snap({ snapshot_code: "levantamiento" })), "Levantamiento");
});

test("snapshotLabel respeta el override de pm_snapshots.label", () => {
  assert.equal(
    snapshotLabel(snap({ snapshot_code: "2026_Q1", label: "Cierre anual" })),
    "Cierre anual",
  );
});

test("un label en blanco no gana al calculado", () => {
  assert.equal(snapshotLabel(snap({ snapshot_code: "2026_Q1", label: "   " })), "Q1 2026");
});

test("un código raro se muestra tal cual, sin romper", () => {
  assert.equal(snapshotLabel(snap({ snapshot_code: "cierre_2026" })), "cierre_2026");
});

// === Fechas ===================================================================

test("formatFechaCorta usa formato español de dos dígitos", () => {
  assert.equal(formatFechaCorta("2026-06-15"), "15/06/26");
});

test("formatFechaCorta trata los centinelas de Excel como vacío", () => {
  assert.equal(formatFechaCorta("1899-12-30"), null);
  assert.equal(formatFechaCorta("1899-12-31"), null);
});

test("formatFechaCorta devuelve null en vacíos y basura", () => {
  assert.equal(formatFechaCorta(null), null);
  assert.equal(formatFechaCorta(""), null);
  assert.equal(formatFechaCorta("no-es-fecha"), null);
});

test("formatFechaCorta tolera timestamps", () => {
  assert.equal(formatFechaCorta("2026-06-15T00:00:00.000Z"), "15/06/26");
});

// === Trimestre sugerido =======================================================

test("trimestreActual mapea el mes a su trimestre", () => {
  assert.equal(trimestreActual(new Date(2026, 0, 15)), "2026_Q1"); // enero
  assert.equal(trimestreActual(new Date(2026, 2, 31)), "2026_Q1"); // marzo
  assert.equal(trimestreActual(new Date(2026, 3, 1)), "2026_Q2"); // abril
  assert.equal(trimestreActual(new Date(2026, 8, 30)), "2026_Q3"); // septiembre
  assert.equal(trimestreActual(new Date(2026, 9, 1)), "2026_Q4"); // octubre
  assert.equal(trimestreActual(new Date(2026, 11, 31)), "2026_Q4"); // diciembre
});

// === Mapeo con la Tabla madre =================================================

test("estadoMapeo: mapeado a una columna que ya existe", () => {
  assert.equal(estadoMapeo("Fecha Adquisición", true), "en_tabla_madre");
});

test("estadoMapeo: mapeado a una columna propuesta", () => {
  // El hito no cabe hoy en la hoja; queda documentada la cabecera que haría falta.
  assert.equal(estadoMapeo("Fecha Anteproyecto", false), "propuesto");
});

test("estadoMapeo: sin cabecera es sin mapear, aunque existe diga true", () => {
  assert.equal(estadoMapeo(null, false), "sin_mapear");
  assert.equal(estadoMapeo(null, true), "sin_mapear");
  assert.equal(estadoMapeo("", true), "sin_mapear");
});

test("los tres estados tienen etiqueta", () => {
  for (const e of ["en_tabla_madre", "propuesto", "sin_mapear"] as const) {
    assert.ok(ETIQUETA_MAPEO[e]?.length > 0, `falta etiqueta para ${e}`);
  }
});

test("el catálogo tiene las 8 columnas de hito leídas del maestro", () => {
  // Son las que existen de verdad en DW-EL. Si esto cambia, el desplegable de
  // mapeo estaría ofreciendo columnas que no están en el Excel.
  assert.equal(TABLA_MADRE_COLUMNAS_HITO.length, 8);
  const cabeceras = TABLA_MADRE_COLUMNAS_HITO.map((c) => c.cabecera);
  assert.deepEqual(cabeceras, [
    "Fecha Adquisición",
    "Fecha Licencia y Financiación",
    "Fecha obra",
    "Fecha LPO",
    "Fecha Explotación",
    "Fecha Desinversión",
    "Fecha entrega",
    "Fecha Finalización",
  ]);
});

test("cada columna declara su letra y su flag", () => {
  for (const c of TABLA_MADRE_COLUMNAS_HITO) {
    assert.match(c.letra, /^[A-Z]{2}$/, `letra inválida en ${c.cabecera}`);
    assert.ok(c.flag.length > 0, `falta flag en ${c.cabecera}`);
  }
});

test("no hay cabeceras duplicadas", () => {
  const set = new Set(TABLA_MADRE_COLUMNAS_HITO.map((c) => c.cabecera.toLowerCase()));
  assert.equal(set.size, TABLA_MADRE_COLUMNAS_HITO.length);
});
