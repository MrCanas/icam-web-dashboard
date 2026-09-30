import assert from "node:assert/strict";
import { test } from "node:test";

import { COLECCIONES, esColeccion, esIdValido, validarDocumento } from "../colecciones";
import { esTablaInexistente, MENSAJE_SIN_MIGRACION, mensajeErrorBd } from "../errores";
import { codigoInforme, proyectosConActivosPm } from "../proyectos";
import { codigoSnapshot, parseTrimestre, rangoTrimestre, trimestreAnterior } from "../trimestre";

test("colecciones y ids de la app", () => {
  assert.ok(esColeccion("informes"));
  assert.ok(!esColeccion("usuarios"));
  assert.ok(esIdValido("SE84_Q3-2026"));
  assert.ok(esIdValido("SA31-33_Q3-2026_v2"));
  assert.ok(!esIdValido("../informe"));
  assert.ok(!esIdValido(""));
});

test("validarDocumento exige el trimestre y el código en los informes", () => {
  assert.equal(validarDocumento("informes", "SE84_Q3-2026", { codigo: "SE84", trimestre: "Q3 2026" }), null);
  assert.match(validarDocumento("informes", "SE84_Q3-2026", { codigo: "SE84", trimestre: "2026-Q3" })!, /trimestre/);
  assert.match(validarDocumento("fuentes", "x", [])!, /objeto/);
  assert.match(
    validarDocumento("fuentes", "x", { notas: "a".repeat(400_000) })!,
    /bytes/,
  );
});

test("las columnas del informe salen del documento", () => {
  const cols = COLECCIONES.informes.columnas({
    codigo: "SE84",
    trimestre: "Q3 2026",
    estado: "borrador",
    version: 3,
    idActivo: "SE84",
  });
  assert.deepEqual(cols, {
    codigo: "SE84",
    trimestre: "Q3 2026",
    estado: "borrador",
    version: 3,
    id_activo: "SE84",
  });
  assert.deepEqual(COLECCIONES.versiones.columnas({ informeId: "SE84_Q3-2026", version: "2" }), {
    informe_id: "SE84_Q3-2026",
    version: 2,
  });
});

test("proyectosConActivosPm añade los activos sin configurar y no duplica", () => {
  const lista = proyectosConActivosPm(
    [
      { id: "SA31-33", datos: { nombre: "Santa Ana", codigo: "SA31-33", idActivo: "SA-33-31" } },
      { id: "CA1", datos: { nombre: "Castellana 1", codigo: "CA1" } },
    ],
    [
      { id_activo: "SA-33-31", nombre_display: "Santa Ana 31-33" },
      { id_activo: "CA1", nombre_display: null },
      { id_activo: "DC 15", nombre_display: "Doctor Castelo 15" },
    ],
  );
  assert.deepEqual(
    lista.map((d) => d.id),
    ["SA31-33", "CA1", "DC-15"],
  );
  assert.deepEqual(lista[2]!.datos, {
    nombre: "Doctor Castelo 15",
    codigo: "DC-15",
    idActivo: "DC 15",
    sinConfigurar: true,
  });
  assert.equal(codigoInforme(" SE 84/ "), "SE-84");
});

test("proyectosConActivosPm usa el nombre de Actas cuando el activo no tiene nombre", () => {
  const lista = proyectosConActivosPm([], [{ id_activo: "SE84", nombre_display: null }, { id_activo: "GQ8", nombre_display: null }], {
    SE84: "Santa Engracia 84",
  });
  assert.deepEqual(
    lista.map((d) => d.datos.nombre),
    ["Santa Engracia 84", "GQ8"],
  );
});

test("errores de tabla inexistente se traducen a la migración pendiente", () => {
  assert.ok(esTablaInexistente({ code: "PGRST205", message: "Could not find the table 'public.informe_fuente' in the schema cache" }));
  assert.ok(!esTablaInexistente({ code: "23505", message: "duplicate key" }));
  assert.equal(mensajeErrorBd({ code: "PGRST205", message: "x" }), MENSAJE_SIN_MIGRACION);
  assert.equal(mensajeErrorBd({ code: "23505", message: "duplicate key" }), "duplicate key");
});

test("trimestres: rango, anterior y código de snapshot", () => {
  const q3 = parseTrimestre("Q3 2026")!;
  assert.deepEqual(rangoTrimestre(q3), { desde: "2026-07-01", hasta: "2026-09-30" });
  assert.deepEqual(rangoTrimestre(parseTrimestre("Q1 2024")!), { desde: "2024-01-01", hasta: "2024-03-31" });
  assert.deepEqual(trimestreAnterior(parseTrimestre("Q1 2027")!), { anio: 2026, q: 4 });
  assert.equal(codigoSnapshot(q3), "2026_Q3");
  assert.equal(parseTrimestre("2026_Q3"), null);
});
