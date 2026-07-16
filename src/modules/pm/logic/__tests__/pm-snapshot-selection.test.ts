import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeQuarterCodes, PRESET_QUARTERS } from "../pm-snapshot-selection";

/**
 * REGRESIÓN — el check «publicar» de Planificación no tenía efecto.
 *
 * mergeQuarterCodes unía PRESET_QUARTERS (2026_Q1, 2025_Q4, 2025_Q3, 2025_Q2)
 * con lo recibido, así que desmarcar «publicar» en un trimestre preset no lo
 * quitaba del Overview: el preset lo devolvía. Build y tipos pasaban igual; solo
 * se vio conduciendo la UI.
 */
test("los presets NO se suman a los trimestres publicados", () => {
  // La PMO despublica 2025_Q2: el repositorio ya no lo manda.
  const publicados = ["2026_Q1", "2025_Q4", "2025_Q3"];
  const result = mergeQuarterCodes(publicados);

  assert.ok(
    !result.includes("2025_Q2"),
    "2025_Q2 está despublicado y NO debe salir, aunque sea un preset",
  );
  assert.deepEqual(result, ["2026_Q1", "2025_Q4", "2025_Q3"]);
});

test("despublicar todos los trimestres menos uno deja solo ese", () => {
  const result = mergeQuarterCodes(["2025_Q3"]);
  assert.deepEqual(result, ["2025_Q3"]);
});

test("un trimestre nuevo fuera de los presets se muestra", () => {
  // Al añadir 2026_Q2 debe aparecer sin tocar ninguna constante del código.
  const result = mergeQuarterCodes(["2026_Q2", "2026_Q1"]);
  assert.deepEqual(result, ["2026_Q2", "2026_Q1"]);
});

test("los presets actúan solo como respaldo si no llega nada", () => {
  // Estado previo a aplicar la migración 020: pm_snapshots no existe todavía.
  const result = mergeQuarterCodes([]);
  assert.deepEqual(result, [...PRESET_QUARTERS]);
});

test("levantamiento nunca sale: es el plan original, no un trimestre reportado", () => {
  const result = mergeQuarterCodes(["levantamiento", "2026_Q1"]);
  assert.deepEqual(result, ["2026_Q1"]);
});

test("si solo llega levantamiento se cae al respaldo", () => {
  // Sin trimestres reales no hay nada que enseñar; mejor los presets que un
  // selector con un único botón «Fecha actual».
  const result = mergeQuarterCodes(["levantamiento"]);
  assert.deepEqual(result, [...PRESET_QUARTERS]);
});

test("ordena del más reciente al más antiguo y cruza el cambio de año", () => {
  const result = mergeQuarterCodes(["2025_Q1", "2026_Q2", "2025_Q4", "2026_Q1"]);
  assert.deepEqual(result, ["2026_Q2", "2026_Q1", "2025_Q4", "2025_Q1"]);
});

test("descarta códigos con formato inválido", () => {
  const result = mergeQuarterCodes(["2026_Q1", "basura", "2026_Q5", "", "fecha_actual"]);
  assert.deepEqual(result, ["2026_Q1"]);
});

test("deduplica", () => {
  const result = mergeQuarterCodes(["2026_Q1", "2026_Q1", "2025_Q4"]);
  assert.deepEqual(result, ["2026_Q1", "2025_Q4"]);
});

test("no muta el array recibido", () => {
  const input = ["2025_Q4", "2026_Q1"];
  mergeQuarterCodes(input);
  assert.deepEqual(input, ["2025_Q4", "2026_Q1"]);
});
