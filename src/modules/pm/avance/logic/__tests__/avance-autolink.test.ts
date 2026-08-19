import assert from "node:assert/strict";
import { test } from "node:test";

import { AUTOLINK_PROMOCION_POR_ACTIVO, resolveAutolink } from "../avance-autolink";

/** Los 9 activos reales de PM y los 30 códigos del export de Zoho. */
const ACTIVOS = [
  "SE84",
  "DC-15",
  "GQ8",
  "CSP-10",
  "PC25-CP6",
  "SA-33-31",
  "PC25-26-RESIDENCIAL",
  "EM-RESIDENCIAL",
  "CA1",
];
/** Los 47 códigos del export completo (Promociones_2026_08_19.csv). */
const CODIGOS = [
  "GA91", "LST5", "GV61", "BA49", "CR20", "T123", "FC149", "FR02", "CO13",
  "DRC26", "NB86", "CE", "LDH171", "GA9", "PL", "F5", "RDA16", "PS7", "CA82",
  "F3", "N64", "F27", "JJ54", "LDH171-V1", "HC13", "MADRR", "DC15", "SA31",
  "GQ8", "SE84",
  // Las 17 que el primer export dejaba fuera.
  "CA1", "CSP10", "FICCI", "FICCII", "FICCIII", "IP", "LSE84", "PC", "PC25",
  "PROMOCIONTEST", "Placeholder", "SICCI", "SICCII", "SP", "VBARE", "VDR", "VE1",
];

test("los pares escritos a mano resuelven contra los datos reales", () => {
  const { pares, faltantes } = resolveAutolink(ACTIVOS, CODIGOS);
  assert.deepEqual(faltantes, []);
  assert.deepEqual(
    pares.map((p) => `${p.idActivo}→${p.codigo}`).sort(),
    ["CA1→CA1", "CSP-10→CSP10", "DC-15→DC15", "GQ8→GQ8", "SA-33-31→SA31", "SE84→SE84"],
  );
});

test("los tres activos de Padre Claret quedan fuera: los confirma la PMO", () => {
  // PC25-CP6, PC25-26-RESIDENCIAL y EM-RESIDENCIAL apuntarían a la misma
  // promoción PC25; compartirla es admisible, pero no se decide por parecido.
  const { pares } = resolveAutolink(ACTIVOS, CODIGOS);
  const mapeados = new Set(pares.map((p) => p.idActivo));
  for (const id of ["PC25-CP6", "PC25-26-RESIDENCIAL", "EM-RESIDENCIAL"]) {
    assert.equal(mapeados.has(id), false, id);
  }
});

test("SE84 se empareja aunque Zoho lo haya renombrado al vehículo", () => {
  // En Zoho, «SE84» pasó a llamarse «Impar Prime Alternative Investment II».
  // El emparejamiento va por código, no por nombre, así que aguanta el cambio.
  const { pares } = resolveAutolink(["SE84"], ["SE84"]);
  assert.deepEqual(pares, [{ idActivo: "SE84", codigo: "SE84" }]);
});

test("LSE84 no se confunde con SE84: son dos registros distintos", () => {
  // «Locales Comerciales Santa Engracia 84» es otra promoción del mismo edificio.
  const { pares } = resolveAutolink(["SE84"], ["LSE84"]);
  assert.deepEqual(pares, []);
});

test("no se inventa ningún par por parecido", () => {
  // CA1 (PM) y CA82 (Zoho) comparten prefijo y no tienen nada que ver.
  const { pares } = resolveAutolink(["CA1"], ["CA82"]);
  assert.deepEqual(pares, []);
  // LDH171 y LDH171-V1 conviven: ninguna regla de sufijos debe tocarlos.
  assert.deepEqual(resolveAutolink(["LDH171"], ["LDH171-V1"]).pares, []);
});

test("si renombran un activo, sale en faltantes en vez de perderse en silencio", () => {
  const { pares, faltantes } = resolveAutolink(
    ACTIVOS.filter((a) => a !== "SA-33-31"),
    CODIGOS,
  );
  assert.equal(pares.length, 5);
  assert.equal(faltantes.length, 1);
  assert.match(faltantes[0], /SA-33-31 → SA31: falta el activo de PM/);
});

test("si el export deja de traer una promoción, también sale en faltantes", () => {
  const { faltantes } = resolveAutolink(ACTIVOS, CODIGOS.filter((c) => c !== "DC15"));
  assert.equal(faltantes.length, 1);
  assert.match(faltantes[0], /falta la promoción de Zoho/);
});

test("la lista solo cubre los casos verificados a mano", () => {
  assert.equal(Object.keys(AUTOLINK_PROMOCION_POR_ACTIVO).length, 6);
});
