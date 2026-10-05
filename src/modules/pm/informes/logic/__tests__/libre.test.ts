import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { arbolBloques, leerRuta } from "@/modules/pm/informes/logic/edicion";
import { alinear, AREA, colocarLibre, libreDe, limitarLibre, volverAlFlujo } from "@/modules/pm/informes/logic/libre";
import { elemento } from "@/modules/pm/informes/slides/elemento";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const meta = { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q3 2026" };
const pintar = (s: SlideJson) => renderToStaticMarkup(elemento(s, 7, meta)).replace(/<link rel="preload"[^>]*\/>/g, "");

const obra: SlideJson = {
  id: "obra-1",
  compuesto: {
    seccion: 5,
    titulo: "Obra",
    clase: "iq-cols",
    contenido: [
      { c: "div", hijos: [{ c: "Texto", props: { parrafos: ["Uno"] } }, { c: "Vinetas", props: { items: ["a", "b"] } }] },
      { c: "div", hijos: [{ c: "ImagenMarco", props: { src: "/api/informes/fotos/a", ancho: 395, alto: 237 } }] },
    ],
  },
};
const texto = ["compuesto", "contenido", 0, "hijos", 0];
const imagen = ["compuesto", "contenido", 1, "hijos", 0];

test("limitarLibre: enteros, ancho mínimo y dentro del área de contenido", () => {
  assert.deepEqual(limitarLibre({ x: 10, y: 10, ancho: 5 }), { x: AREA.izquierda, y: AREA.arriba, ancho: 40 });
  assert.deepEqual(limitarLibre({ x: 900, y: 600, ancho: 300.4 }), { x: AREA.derecha - 300, y: AREA.abajo - 8, ancho: 300 });
  assert.deepEqual(limitarLibre({ x: 100.6, y: 120.2, ancho: 2000 }), { x: AREA.izquierda, y: 120, ancho: AREA.derecha - AREA.izquierda });
});

test("colocarLibre y volverAlFlujo: el bloque sale del flujo y se pinta donde se le pone; sin «libre» todo sigue igual", () => {
  const sin = pintar(obra);
  assert.ok(!sin.includes("iq-libre"));
  const libre = colocarLibre(obra, texto, { x: 500, y: 300, ancho: 200 });
  assert.deepEqual(libreDe(leerRuta(libre, texto)), { x: 500, y: 300, ancho: 200 });
  assert.equal(libreDe(leerRuta(obra, texto)), null);
  const html = pintar(libre);
  assert.ok(html.includes(`<div class="iq-libre" style="left:${500 - AREA.izquierda}px;top:${300 - AREA.arriba}px;width:200px"><div class="iq-texto">`), html);
  // El árbol de bloques del editor no cambia: el bloque sigue siendo el mismo hijo de su columna.
  assert.deepEqual(arbolBloques(libre)!.contenedor!.hijos[0]!.contenedor!.hijos.map((b) => b.c), ["Texto", "Vinetas"]);
  assert.equal(pintar(volverAlFlujo(libre, texto)), sin);
  // Una imagen suelta toma el ancho de su caja.
  const im = colocarLibre(obra, imagen, { x: 100, y: 100, ancho: 300 });
  assert.equal((leerRuta(im, [...imagen, "props", "ancho"]) as number), 300);
  assert.throws(() => colocarLibre(obra, ["compuesto", "contenido", 9], { x: 0, y: 0, ancho: 100 }));
});

test("alinear: fila con reparto de ancho, columna con el ancho de la referencia", () => {
  const a = { ruta: texto, caja: { x: 400, y: 200, ancho: 300, alto: 60 } };
  const b = { ruta: imagen, caja: { x: 100, y: 150, ancho: 200, alto: 120 } };
  // Horizontal, mitad y mitad: el de la izquierda (b) sigue a la izquierda; ancho total 600 − hueco 10.
  const fila = alinear(obra, a, b, { eje: "horizontal", ratio: [1, 1] });
  assert.deepEqual(libreDe(leerRuta(fila, imagen)), { x: 100, y: 150, ancho: 295 });
  assert.deepEqual(libreDe(leerRuta(fila, texto)), { x: 405, y: 150, ancho: 295 });
  assert.equal((leerRuta(fila, [...imagen, "props", "ancho"]) as number), 295);
  // Horizontal sin ratio: cada uno con su ancho, seguidos.
  const seguidos = alinear(obra, a, b, { eje: "horizontal", ratio: null });
  assert.deepEqual(libreDe(leerRuta(seguidos, imagen)), { x: 100, y: 150, ancho: 200 });
  assert.deepEqual(libreDe(leerRuta(seguidos, texto)), { x: 310, y: 150, ancho: 300 });
  // Vertical: borde izquierdo y ancho de la referencia; el de más arriba (b) arriba y el otro debajo con el alto medido.
  const columna = alinear(obra, a, b, { eje: "vertical", ratio: [1, 2] });
  assert.deepEqual(libreDe(leerRuta(columna, imagen)), { x: 100, y: 150, ancho: 200 });
  assert.deepEqual(libreDe(leerRuta(columna, texto)), { x: 100, y: 150 + 120 + 10, ancho: 200 });
  // El ratio en vertical solo reparte el alto entre dos imágenes sueltas: aquí uno es texto y no se toca.
  assert.equal((leerRuta(columna, [...imagen, "props", "alto"]) as number), 237);
});
