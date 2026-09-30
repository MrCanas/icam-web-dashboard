import assert from "node:assert/strict";
import { test } from "node:test";

import { emparejarActivo, idsDeFotos, reescribirFotos } from "../importacion";

const NUEVO_A = "0f4b0a0e-1111-4222-8333-444455556666";
const NUEVO_B = "1f4b0a0e-1111-4222-8333-444455556666";

test("reescribirFotos cambia rutas de slides e ids de la lista de fotos", () => {
  const doc = {
    id: "SE84_Q2-2026",
    fotos: [
      { id: "aaa111", nombre: "fachada.jpg" },
      { id: "bbb222", nombre: "obra-1.jpg" },
    ],
    informe: {
      slides: [
        { id: "portada", c: "Portada", props: { imagen: "/_blob/aaa111" } },
        { id: "obra", c: "Galeria", props: { fotos: [{ src: "/_blob/bbb222" }, { src: "/_blob/ccc333" }] } },
      ],
    },
  };
  assert.deepEqual(idsDeFotos(doc), ["aaa111", "bbb222", "ccc333"]);

  const { doc: r, sinResolver } = reescribirFotos(doc, { aaa111: NUEVO_A, bbb222: NUEVO_B });
  const texto = JSON.stringify(r);
  assert.ok(texto.includes(`"/api/informes/assets/${NUEVO_A}"`));
  assert.ok(texto.includes(`"/api/informes/assets/${NUEVO_B}"`));
  assert.ok(texto.includes('"/_blob/ccc333"'), "lo que no se resuelve se deja");
  assert.deepEqual((r.fotos as { id: string }[]).map((f) => f.id), [NUEVO_A, NUEVO_B]);
  assert.deepEqual(sinResolver, ["ccc333"]);
  assert.equal((doc.fotos[0] as { id: string }).id, "aaa111", "no muta el original");
});

test("emparejarActivo: exacto, normalizado y ambiguo", () => {
  const activos = ["SE84", "CSP-10", "PC25-CP6", "PC25-26-RESIDENCIAL", "SA-33-31"];
  assert.equal(emparejarActivo("SE84", activos), "SE84");
  assert.equal(emparejarActivo("CSP10", activos), "CSP-10");
  assert.equal(emparejarActivo("PC25", activos), null);
  assert.equal(emparejarActivo("SA31-33", activos), null);
});
