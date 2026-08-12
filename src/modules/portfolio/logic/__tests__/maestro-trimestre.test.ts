import assert from "node:assert/strict";
import { test } from "node:test";

import { limpiarFechaMaestro, normalizeTrimestreCode } from "../maestro-trimestre";

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
