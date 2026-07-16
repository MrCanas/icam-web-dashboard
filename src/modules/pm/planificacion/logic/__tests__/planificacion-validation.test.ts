import assert from "node:assert/strict";
import { test } from "node:test";

import {
  shiftIsoMonths,
  validateFechaIso,
  validateIdActivo,
  validateMeses,
  validateSnapshotCode,
  validateTipoUso,
  validateUuid,
} from "../planificacion-validation";

test("validateFechaIso acepta una fecha normal", () => {
  assert.deepEqual(validateFechaIso("2026-06-01"), { ok: true, value: "2026-06-01" });
});

test("validateFechaIso trata vacío como borrar la fecha", () => {
  for (const v of ["", null, undefined, "   "]) {
    assert.deepEqual(validateFechaIso(v), { ok: true, value: null });
  }
});

test("validateFechaIso rechaza el 31 de febrero", () => {
  // No es teórico: el maestro financiero tiene un 31-02-2027 en Fecha LPO, y
  // new Date("2027-02-31") no falla — desplaza a marzo en silencio.
  const r = validateFechaIso("2027-02-31");
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.error : "", /inexistente/);
});

test("validateFechaIso rechaza formatos que no son ISO", () => {
  // dd-mm-yyyy es justo lo que trae la Tabla madre como texto: Date.parse lo
  // interpretaría como mm-dd-yyyy y daría enero en vez de junio.
  for (const v of ["01-06-2025", "1/6/2025", "2026-6-1", "junio 2026"]) {
    assert.equal(validateFechaIso(v).ok, false, `debería rechazar ${v}`);
  }
});

test("validateFechaIso acota el año", () => {
  assert.equal(validateFechaIso("1899-12-30").ok, false);
  assert.equal(validateFechaIso("2101-01-01").ok, false);
});

test("validateSnapshotCode normaliza el trimestre", () => {
  assert.deepEqual(validateSnapshotCode("2026_q2"), { ok: true, value: "2026_Q2" });
  assert.deepEqual(validateSnapshotCode(" 2026_Q2 "), { ok: true, value: "2026_Q2" });
});

test("validateSnapshotCode rechaza fecha_actual y formatos raros", () => {
  assert.equal(validateSnapshotCode("fecha_actual").ok, false);
  assert.equal(validateSnapshotCode("2026_Q5").ok, false);
  assert.equal(validateSnapshotCode("levantamiento").ok, false);
  assert.equal(validateSnapshotCode("").ok, false);
});

test("validateUuid acepta uuid y rechaza basura", () => {
  assert.equal(validateUuid("0f8fad5b-d9cb-469f-a165-70867728950e").ok, true);
  assert.equal(validateUuid("1; DROP TABLE pm_hitos").ok, false);
  assert.equal(validateUuid("").ok, false);
});

test("validateTipoUso solo admite lo que acepta el CHECK", () => {
  assert.deepEqual(validateTipoUso("apt"), { ok: true, value: "APT" });
  assert.equal(validateTipoUso("HOTEL").ok, false);
});

test("validateIdActivo limpia espacios y exige contenido", () => {
  assert.deepEqual(validateIdActivo("  PC25-CP6 "), { ok: true, value: "PC25-CP6" });
  assert.equal(validateIdActivo("   ").ok, false);
});

test("validateMeses rechaza 0 y valores desmedidos", () => {
  assert.deepEqual(validateMeses(3), { ok: true, value: 3 });
  assert.deepEqual(validateMeses(-6), { ok: true, value: -6 });
  assert.equal(validateMeses(0).ok, false);
  assert.equal(validateMeses(121).ok, false);
  assert.equal(validateMeses(1.5).ok, false);
});

test("shiftIsoMonths respeta el fin de mes", () => {
  assert.equal(shiftIsoMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(shiftIsoMonths("2028-01-31", 1), "2028-02-29"); // bisiesto
  assert.equal(shiftIsoMonths("2026-06-15", 3), "2026-09-15");
  assert.equal(shiftIsoMonths("2026-01-15", -1), "2025-12-15");
  assert.equal(shiftIsoMonths("2026-12-31", 2), "2027-02-28");
});
