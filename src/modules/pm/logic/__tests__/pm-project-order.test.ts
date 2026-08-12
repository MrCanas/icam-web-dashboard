import assert from "node:assert/strict";
import { test } from "node:test";

import {
  legacyProjectOrderIndex,
  PM_PROJECT_ORDER_LEGACY,
  sortPortfolioRows,
} from "../pm-project-order";

const row = (id_activo: string, orden?: number) => ({ activo: { id_activo, orden } });
const ids = (rows: { activo: { id_activo: string } }[]) => rows.map((r) => r.activo.id_activo);

test("legacyProjectOrderIndex devuelve la posición histórica", () => {
  assert.equal(legacyProjectOrderIndex("SE84"), 0);
  assert.equal(legacyProjectOrderIndex("CA1"), 8);
});

test("un activo desconocido va al final, no al principio", () => {
  assert.equal(legacyProjectOrderIndex("NUEVO"), 1000);
});

test("manda pm_activos.orden", () => {
  const rows = [row("CA1", 2), row("SE84", 0), row("GQ8", 1)];
  assert.deepEqual(ids(sortPortfolioRows(rows)), ["SE84", "GQ8", "CA1"]);
});

test("con todos a 0 se cae al orden histórico", () => {
  // Es el estado tras restaurar el Excel: replace_pm_portfolio no conoce `orden`.
  const rows = [row("CA1"), row("GQ8"), row("SE84")];
  assert.deepEqual(ids(sortPortfolioRows(rows)), ["SE84", "GQ8", "CA1"]);
});

test("el fallback reproduce exactamente el orden hardcodeado de antes", () => {
  // Barajado a propósito: el Overview debe verse igual que antes de la migración.
  const rows = [...PM_PROJECT_ORDER_LEGACY].reverse().map((id) => row(id));
  assert.deepEqual(ids(sortPortfolioRows(rows)), [...PM_PROJECT_ORDER_LEGACY]);
});

test("basta con que UN activo tenga orden para que mande la base de datos", () => {
  // Si el fallback se activara por «alguno a 0», un alta con orden=1 quedaría
  // detrás de los que valen 0 y se mezclarían los dos criterios.
  const rows = [row("NUEVO", 1), row("SE84", 0), row("CA1", 0)];
  const r = ids(sortPortfolioRows(rows));
  assert.equal(r[2], "NUEVO", "NUEVO va al final por su orden, no por ser desconocido");
  assert.deepEqual(r, ["CA1", "SE84", "NUEVO"], "los empates a 0 desempatan por código");
});

test("un proyecto nuevo aparece aunque no esté en la lista histórica", () => {
  // Justo el bug que tenía PM_PROJECT_ORDER: un alta caía fuera del Gantt.
  const rows = [row("SE84", 0), row("VE1-NUEVO", 1)];
  assert.deepEqual(ids(sortPortfolioRows(rows)), ["SE84", "VE1-NUEVO"]);
});

test("los empates de orden desempatan por código, no por azar", () => {
  const rows = [row("ZZZ", 5), row("AAA", 5)];
  assert.deepEqual(ids(sortPortfolioRows(rows)), ["AAA", "ZZZ"]);
});

test("no muta el array recibido", () => {
  const rows = [row("CA1", 2), row("SE84", 0)];
  sortPortfolioRows(rows);
  assert.deepEqual(ids(rows), ["CA1", "SE84"]);
});

test("una lista vacía no revienta", () => {
  assert.deepEqual(sortPortfolioRows([]), []);
});
