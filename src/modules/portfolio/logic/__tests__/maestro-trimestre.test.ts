import assert from "node:assert/strict";
import { test } from "node:test";

import {
  finDeTrimestreIso,
  limpiarFechaMaestro,
  normalizeTrimestreCode,
} from "../maestro-trimestre";

test("normalizeTrimestreCode traduce el formato del maestro al de PM", () => {
  // «2025 4T» es el formato real de la columna H de la Tabla madre.
  assert.equal(normalizeTrimestreCode("2025 4T"), "2025_Q4");
  assert.equal(normalizeTrimestreCode("2018 3T"), "2018_Q3");
  assert.equal(normalizeTrimestreCode("2026 1T"), "2026_Q1");
});

test("normalizeTrimestreCode admite variantes razonables", () => {
  assert.equal(normalizeTrimestreCode("4T 2025"), "2025_Q4");
  assert.equal(normalizeTrimestreCode("2025_Q4"), "2025_Q4");
  assert.equal(normalizeTrimestreCode("2025 q4"), "2025_Q4");
  assert.equal(normalizeTrimestreCode("q4 2025"), "2025_Q4");
  assert.equal(normalizeTrimestreCode("  2025   4t  "), "2025_Q4");
});

test("normalizeTrimestreCode ignora ALL TIME", () => {
  // Línea consolidada de proyectos culminados: no es un trimestre reportado.
  assert.equal(normalizeTrimestreCode("ALL TIME"), null);
  assert.equal(normalizeTrimestreCode("all time"), null);
});

test("normalizeTrimestreCode devuelve null con basura", () => {
  for (const v of ["", null, undefined, "2025", "5T 2025", "2025 0T", "Q5 2025", "trimestre"]) {
    assert.equal(normalizeTrimestreCode(v), null, `debería rechazar «${v}»`);
  }
});

test("limpiarFechaMaestro anula el centinela 1899 de Excel", () => {
  // Serial 0: celda de fecha vacía. «Fecha obra» vacía sale así en el maestro real.
  assert.equal(limpiarFechaMaestro("1899-12-30"), null);
  assert.equal(limpiarFechaMaestro("1899-12-31"), null);
  assert.equal(limpiarFechaMaestro(null), null);
  assert.equal(limpiarFechaMaestro("2026-06-01"), "2026-06-01");
});

test("finDeTrimestreIso materializa EndQuarter en el último día del trimestre", () => {
  assert.equal(finDeTrimestreIso("2025 4T"), "2025-12-31");
  assert.equal(finDeTrimestreIso("2025 1T"), "2025-03-31");
  assert.equal(finDeTrimestreIso("2024 2T"), "2024-06-30");
  assert.equal(finDeTrimestreIso("2024 3T"), "2024-09-30");
  // Mismas variantes que acepta normalizeTrimestreCode.
  assert.equal(finDeTrimestreIso("Q2 2027"), "2027-06-30");
});

test("finDeTrimestreIso devuelve null para lo que no es un trimestre", () => {
  // El llamante (parseFechaFin del parser) interpreta el null como «pruébalo
  // como fecha suelta», así que aquí no puede colarse una fecha inventada.
  assert.equal(finDeTrimestreIso("ALL TIME"), null);
  assert.equal(finDeTrimestreIso("2025-12-31"), null);
  assert.equal(finDeTrimestreIso(""), null);
  assert.equal(finDeTrimestreIso(null), null);
  assert.equal(finDeTrimestreIso(undefined), null);
  assert.equal(finDeTrimestreIso("cualquier cosa"), null);
});
