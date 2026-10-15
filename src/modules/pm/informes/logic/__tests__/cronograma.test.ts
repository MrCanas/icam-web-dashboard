import assert from "node:assert/strict";
import { test } from "node:test";

import { bloqueCronograma, hitosDeSlides, hitosObligatorios, reponerHitos } from "@/modules/pm/informes/logic/cronograma";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";
import type { Analisis, PrevioEstructurado } from "@/modules/pm/informes/types";

const hitos = [
  { titulo: "Licencia de obras", fecha: "03/26", hecho: true },
  { titulo: "Inicio de obra", fecha: "06/26", hecho: true },
  { titulo: "Estructura terminada", fecha: "12/26", hecho: false },
  { titulo: "Entrega al operador", fecha: "09/27", hecho: false },
];

const calendario = (h: unknown[]): SlideJson => ({
  id: "calendario",
  compuesto: { titulo: "Calendario", contenido: [{ c: "Timeline", props: { hitos: h } }] },
});

const previo: PrevioEstructurado = { id: "X_Q2-2026", version: 1, meta: { proyecto: "X", codigo: "X", trimestre: "Q2 2026" }, slides: [calendario(hitos)] };

test("los hitos se leen de los Timeline del informe anterior, con su slide", () => {
  const h = hitosDeSlides(previo.slides);
  assert.equal(h.length, 4);
  assert.equal(h[0]!.slide, "calendario");
});

test("manda la lista del análisis si el equipo la ha editado", () => {
  const a = { hitosPrevios: [hitos[0]!] } as Analisis;
  assert.equal(hitosObligatorios(a, previo).length, 1);
  assert.equal(hitosObligatorios(null, previo).length, 4);
  assert.deepEqual(hitosObligatorios(null, null), []);
});

test("el prompt lista todos los hitos que se conservan", () => {
  const t = bloqueCronograma(hitosDeSlides(previo.slides))!;
  assert.match(t, /Consérvalos TODOS/);
  assert.match(t, /Entrega al operador · 09\/27 · pendiente/);
  assert.equal(bloqueCronograma([]), null);
});

test("un hito que Claude ha quitado se repone en su sitio y queda aviso", () => {
  const nuevo = calendario([hitos[0], hitos[1], { ...hitos[3], fecha: "11/27" }]);
  const r = reponerHitos([nuevo], hitosDeSlides(previo.slides));
  const lista = (r.slides[0]!.compuesto!.contenido![0] as { props: { hitos: { titulo: string }[] } }).props.hitos;
  assert.deepEqual(
    lista.map((x) => x.titulo),
    ["Licencia de obras", "Inicio de obra", "Estructura terminada", "Entrega al operador"],
  );
  assert.deepEqual(
    r.cambios.map((c) => c.tipo),
    ["repuesto", "fecha"],
  );
  // Sin mutar lo de entrada.
  assert.equal((nuevo.compuesto!.contenido![0] as { props: { hitos: unknown[] } }).props.hitos.length, 3);
});

test("los títulos se comparan sin tildes ni mayúsculas", () => {
  const r = reponerHitos([calendario([{ titulo: "LICENCIA DE OBRAS", fecha: "03/26", hecho: true }])], [hitos[0]!]);
  assert.equal(r.cambios.length, 0);
});

test("si el equipo pidió quitar un hito, no se repone; y las cerradas no se tocan", () => {
  const r = reponerHitos([calendario(hitos.slice(0, 3))], hitos, { quitados: ["entrega al operador"] });
  assert.equal(r.cambios.length, 0);
  const cerrada = { ...calendario(hitos.slice(0, 1)), cerrada: true };
  assert.equal(reponerHitos([cerrada], hitos).cambios.length, 0);
});
