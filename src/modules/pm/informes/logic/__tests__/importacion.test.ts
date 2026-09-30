import assert from "node:assert/strict";
import { test } from "node:test";

import {
  categoriaFoto,
  emparejarActivo,
  filaInforme,
  fuentesDe,
  idsDeFotos,
  reescribirFotos,
} from "@/modules/pm/informes/logic/importacion";

test("las fotos /_blob/<id> pasan a /api/informes/fotos/<id nuevo>", () => {
  const doc = { slides: [{ props: { imagen: "/_blob/aaa", galeria: [{ src: "/_blob/bbb" }, { src: "/_blob/aaa" }] } }] };
  assert.deepEqual(idsDeFotos(doc), ["aaa", "bbb"]);
  const r = reescribirFotos(doc, { aaa: "11111111-1111-1111-1111-111111111111" });
  assert.equal(r.doc.slides[0]!.props.imagen, "/api/informes/fotos/11111111-1111-1111-1111-111111111111");
  assert.equal(r.doc.slides[0]!.props.galeria[0]!.src, "/_blob/bbb");
  assert.deepEqual(r.sinResolver, ["bbb"]);
});

test("emparejar proyectos con activos PM: exacto o normalizado único", () => {
  const activos = ["SE84", "CSP-10", "PC25-CP6", "PC25-26-RESIDENCIAL", "SA-33-31"];
  assert.equal(emparejarActivo("SE84", activos), "SE84");
  assert.equal(emparejarActivo("CSP10", activos), "CSP-10");
  // PC25 no es ninguno de los dos PC25-* y SA31-33 ≠ SA-33-31: se vinculan en la app.
  assert.equal(emparejarActivo("PC25", activos), null);
  assert.equal(emparejarActivo("SA31-33", activos), null);
});

test("documentos de la app → filas de la migración 043", () => {
  const f = filaInforme({
    id: "SE84_Q2-2026",
    codigo: "SE84",
    trimestre: "Q2 2026",
    trimestreAnterior: "Q1 2026",
    siguiente: "Q3 2026",
    estado: "rarísimo",
    version: 2,
    informe: { meta: { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q2 2026" }, slides: [{ id: "portada" }] },
    creado: "2026-09-24T09:00:00Z",
  });
  assert.equal(f.estado, "borrador");
  assert.equal(f.version, 2);
  assert.equal(f.contenido?.slides.length, 1);
  assert.deepEqual(f.base, { tipo: "ninguno" });
  assert.equal(f.created_at, "2026-09-24T09:00:00Z");
  assert.equal(categoriaFoto("Render o diseño"), "Render");
  assert.equal(categoriaFoto("Portada"), "Portada");
  assert.equal(categoriaFoto("x"), "Otra");
  assert.deepEqual(
    fuentesDe({ notas: " ", previoTexto: "texto", previoNombre: "Q1.pdf", documentos: [{ nombre: "acta.pdf", texto: "acta" }, { nombre: "vacío", texto: "" }] }).map((x) => [x.tipo, x.nombre]),
    [
      ["previo", "Q1.pdf"],
      ["documento", "acta.pdf"],
    ],
  );
});
