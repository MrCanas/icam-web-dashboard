import assert from "node:assert/strict";
import { test } from "node:test";

import type { PmHitoEnriched } from "@/modules/pm/data/pmRepository";
import type { PmSnapshot } from "@/modules/pm/types";
import {
  anchoDe,
  anchoMinimoDe,
  boardMinWidthPx,
  columnasDisponibles,
  columnasPorDefecto,
  COLUMNAS_FIJAS,
  planificacionGridTemplate,
  snapshotsConDatos,
  ultimoTrimestre,
} from "../planificacion-display";

const snap = (code: string, orden: number): PmSnapshot => ({
  snapshot_code: code,
  label: null,
  visible_en_dashboard: true,
  orden,
  congelado_at: null,
});

// El registro real tras el backfill: la fórmula pm_snapshot_orden() da estos.
const REGISTRO = [
  snap("levantamiento", 0),
  snap("2025_Q2", 102),
  snap("2025_Q3", 103),
  snap("2025_Q4", 104),
  snap("2026_Q1", 105),
];

const hito = (snapshots: Record<string, string | null>): PmHitoEnriched => ({
  id: "h1",
  activo_id: "a1",
  hito: "Inicio de obra",
  orden_hito: 1,
  fecha_actual: null,
  desviacion_vs_anterior_dias: null,
  desviacion_vs_levantamiento_dias: null,
  snapshots,
});

// === snapshotsConDatos ========================================================

test("un trimestre con fecha null no cuenta como que tiene datos", () => {
  const hitos = [hito({ levantamiento: "2026-01-01", "2025_Q2": null })];
  assert.deepEqual([...snapshotsConDatos(hitos)], ["levantamiento"]);
});

test("basta con que UN hito tenga fecha en el trimestre", () => {
  const hitos = [hito({ "2025_Q2": null }), hito({ "2025_Q2": "2026-01-01" })];
  assert.ok(snapshotsConDatos(hitos).has("2025_Q2"));
});

// === columnasPorDefecto =======================================================

test("CA1: empezó tarde, solo tiene el último trimestre", () => {
  // Caso real: CA1 tiene 0 fechas en Q2/Q3/Q4 2025 y 13 en Q1 2026. Antes abría
  // con 5 columnas, 3 de ellas enteras de rayas.
  const hitos = [hito({ levantamiento: "2025-12-29", "2026_Q1": "2025-12-29" })];
  assert.deepEqual(columnasPorDefecto(REGISTRO, hitos), ["levantamiento", "2026_Q1"]);
});

test("DC-15: dejó de reportarse, solo queda Levantamiento", () => {
  // Caso real: DC-15 tiene fechas en Q2 y Q3 2025 pero ninguna en Q4 ni Q1 2026.
  // El último trimestre del registro es 2026_Q1 y no tiene datos → no se muestra.
  const hitos = [
    hito({ levantamiento: "2024-01-01", "2025_Q2": "2024-06-01", "2025_Q3": "2024-09-01" }),
  ];
  assert.deepEqual(columnasPorDefecto(REGISTRO, hitos), ["levantamiento"]);
});

test("GQ8: reporta desde el principio, también abre con 2 columnas", () => {
  // Aunque tenga los 4 trimestres, por defecto solo se ve el último: el resto
  // están a un clic en el menú de columnas.
  const hitos = [
    hito({
      levantamiento: "2024-01-01",
      "2025_Q2": "2024-06-01",
      "2025_Q3": "2024-09-01",
      "2025_Q4": "2024-12-01",
      "2026_Q1": "2025-03-01",
    }),
  ];
  assert.deepEqual(columnasPorDefecto(REGISTRO, hitos), ["levantamiento", "2026_Q1"]);
});

test("un proyecto sin levantamiento no lo muestra", () => {
  const hitos = [hito({ "2026_Q1": "2026-01-01" })];
  assert.deepEqual(columnasPorDefecto(REGISTRO, hitos), ["2026_Q1"]);
});

test("un proyecto recién creado, sin nada congelado, no muestra columnas", () => {
  assert.deepEqual(columnasPorDefecto(REGISTRO, [hito({})]), []);
});

test("sin trimestres en el registro solo cabe Levantamiento", () => {
  const solo = [snap("levantamiento", 0)];
  const hitos = [hito({ levantamiento: "2026-01-01" })];
  assert.deepEqual(columnasPorDefecto(solo, hitos), ["levantamiento"]);
});

// === ultimoTrimestre ==========================================================

test("ultimoTrimestre es el de mayor orden, no el último del array", () => {
  const desordenado = [snap("2026_Q1", 105), snap("levantamiento", 0), snap("2025_Q2", 102)];
  assert.equal(ultimoTrimestre(desordenado), "2026_Q1");
});

test("ultimoTrimestre nunca devuelve levantamiento", () => {
  assert.equal(ultimoTrimestre([snap("levantamiento", 0)]), null);
});

test("al congelar un trimestre nuevo, pasa a ser el último", () => {
  const conQ2 = [...REGISTRO, snap("2026_Q2", 106)];
  assert.equal(ultimoTrimestre(conQ2), "2026_Q2");

  // Y aparece por defecto en los proyectos que se hayan congelado.
  const congelado = [hito({ levantamiento: "2026-01-01", "2026_Q2": "2026-04-01" })];
  assert.deepEqual(columnasPorDefecto(conQ2, congelado), ["levantamiento", "2026_Q2"]);

  // Los que NO se congelaron siguen sin verlo.
  const noCongelado = [hito({ levantamiento: "2026-01-01", "2026_Q1": "2026-03-01" })];
  assert.deepEqual(columnasPorDefecto(conQ2, noCongelado), ["levantamiento"]);
});

// === columnasDisponibles ======================================================

test("el menú solo ofrece trimestres con datos: uno vacío no es una opción", () => {
  const hitos = [hito({ levantamiento: "2024-01-01", "2025_Q3": "2024-09-01" })];
  assert.deepEqual(
    columnasDisponibles(REGISTRO, hitos).map((s) => s.snapshot_code),
    ["levantamiento", "2025_Q3"],
  );
});

test("el menú respeta el orden cronológico del registro", () => {
  const hitos = [
    hito({ "2026_Q1": "x", "2025_Q2": "x", levantamiento: "x", "2025_Q4": "x" }),
  ];
  assert.deepEqual(
    columnasDisponibles(REGISTRO, hitos).map((s) => s.snapshot_code),
    ["levantamiento", "2025_Q2", "2025_Q4", "2026_Q1"],
  );
});

// === Anchos ===================================================================

test("anchoDe cae al valor por defecto de la columna fija", () => {
  assert.equal(anchoDe("hito", {}), 240);
  assert.equal(anchoDe("orden", {}), 52);
});

test("anchoDe usa el ancho guardado si lo hay", () => {
  assert.equal(anchoDe("hito", { hito: 300 }), 300);
});

test("una columna de snapshot desconocida usa el ancho de snapshot", () => {
  assert.equal(anchoDe("2026_Q2", {}), 104);
});

test("cada columna tiene un mínimo para no poder colapsarla a 0", () => {
  for (const c of COLUMNAS_FIJAS) {
    assert.ok(anchoMinimoDe(c.key) > 0, `${c.key} sin mínimo`);
    assert.ok(anchoMinimoDe(c.key) <= c.ancho, `${c.key}: el mínimo supera al defecto`);
  }
  assert.ok(anchoMinimoDe("2026_Q1") > 0);
});

test("«Hito» y «Previsión» no se pueden ocultar", () => {
  // Sin Hito la fila no se identifica; sin Previsión no hay nada que editar.
  const noOcultables = COLUMNAS_FIJAS.filter((c) => !c.ocultable).map((c) => c.key);
  assert.deepEqual(noOcultables, ["hito", "prevision"]);
});

// === Plantilla ================================================================

test("la plantilla lleva selección + fijas visibles + snapshots", () => {
  const t = planificacionGridTemplate(["hito", "prevision"], ["levantamiento", "2026_Q1"]);
  assert.equal(t.split(" ").length, 1 + 2 + 2);
  assert.equal(t, "28px 240px 124px 104px 104px");
});

test("ocultar una columna la saca de la plantilla", () => {
  const con = planificacionGridTemplate(["hito", "orden", "prevision"], []);
  const sin = planificacionGridTemplate(["hito", "prevision"], []);
  assert.equal(con.split(" ").length - sin.split(" ").length, 1);
});

test("redimensionar cambia la plantilla y cabecera y fila siguen coincidiendo", () => {
  // La garantía de que no se desalinean: ambas llaman a la misma función con los
  // mismos anchos.
  const anchos = { hito: 320 };
  const cabecera = planificacionGridTemplate(["hito", "prevision"], ["2026_Q1"], anchos);
  const fila = planificacionGridTemplate(["hito", "prevision"], ["2026_Q1"], anchos);
  assert.equal(cabecera, fila);
  assert.ok(cabecera.includes("320px"));
});

test("sin snapshots la plantilla sigue siendo CSS válido", () => {
  const t = planificacionGridTemplate(["hito", "prevision"], []);
  assert.ok(!t.includes("undefined"));
  assert.ok(!t.includes("NaN"));
});

test("el ancho mínimo del tablero refleja los anchos reales", () => {
  const base = boardMinWidthPx(["hito"], []);
  const ancho = boardMinWidthPx(["hito"], [], { hito: 340 });
  assert.equal(ancho - base, 100, "340 - 240");
});

test("cada snapshot suma su ancho al mínimo del tablero", () => {
  const uno = boardMinWidthPx(["hito"], ["2026_Q1"]);
  const dos = boardMinWidthPx(["hito"], ["2026_Q1", "2025_Q4"]);
  assert.equal(dos - uno, 104);
});
