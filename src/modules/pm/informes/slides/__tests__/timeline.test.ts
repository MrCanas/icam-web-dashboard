import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { elemento } from "@/modules/pm/informes/slides/elemento";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const meta = { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q3 2026" };
const hitos = [
  { titulo: "Inicio", fecha: "01/24", hecho: true },
  { titulo: "Fin", fecha: "2027", hecho: false },
];
const slide = (nota?: string): SlideJson => ({
  id: "calendario",
  compuesto: { seccion: 3, titulo: "Calendario", contenido: [{ c: "Timeline", props: { hitos, ...(nota ? { nota } : {}) } }] },
});
const pintar = (s: SlideJson) => renderToStaticMarkup(elemento(s, 7, meta));

test("Timeline: la nota va debajo del calendario, en el flujo, y sin ella el calendario no cambia", () => {
  const sin = pintar(slide());
  assert.ok(sin.includes('<div class="iq-timeline iq-timeline-slate" style="width:760px;height:170px">'));
  assert.ok(!sin.includes("iq-nota"));

  const con = pintar(slide("**Nota:** el proceso dura 5 o 6 meses."));
  assert.ok(con.includes('<div class="iq-timeline iq-timeline-slate" style="width:760px;padding-top:170px">'));
  // Dentro del calendario (sigue siendo un solo bloque) y sin la clase .iq-nota, que la colocaba fuera de la slide.
  assert.match(con, /<div class="iq-nota-inline"><strong>Nota:<\/strong> el proceso dura 5 o 6 meses\.<\/div><\/div><\/div>/);
  assert.ok(!con.includes('class="iq-nota"'));
  // Todo lo demás del calendario se pinta igual.
  const cuerpo = (h: string) => h.slice(h.indexOf('<div class="iq-tl-linea'), h.indexOf("Punto de situación"));
  assert.equal(cuerpo(con), cuerpo(sin));
});
