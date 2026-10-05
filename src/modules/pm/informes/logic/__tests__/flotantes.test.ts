import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { desplegar } from "@/modules/pm/informes/logic/edicion";
import {
  anadirFlotante,
  cambiarFotoFlotante,
  colocarFlotante,
  confirmarFlotante,
  conFlotantesDe,
  flotantesAlHeredar,
  flotantesValidos,
  limitarCaja,
  quitarFlotante,
  reencuadrarFlotante,
  sinFlotantes,
} from "@/modules/pm/informes/logic/flotantes";
import { qaMecanico, slideDeterminista, textos, validarSlide } from "@/modules/pm/informes/logic/informe";
import { elemento } from "@/modules/pm/informes/slides/elemento";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const meta = { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q3 2026" };
// Sin los <link rel="preload"> que React añade al pintar en servidor por cada imagen: en el navegador no existen.
const pintar = (s: SlideJson) => renderToStaticMarkup(elemento(s, 7, meta)).replace(/<link rel="preload"[^>]*\/>/g, "");

const portada: SlideJson = { id: "portada", c: "Portada", props: { trimestre: "Q3 2026", proyecto: "SE84" } };
const resumen: SlideJson = {
  id: "resumen-ejecutivo",
  c: "ResumenEjecutivo",
  props: { trimestre: "Q3 2026", situacion: "Situación.", logros: ["Uno"], objetivos: ["Dos"], hitos: ["Tres"] },
};

test("limitarCaja: medidas enteras, tamaño mínimo y siempre dentro de la slide", () => {
  assert.deepEqual(limitarCaja({ x: 10.4, y: 20.6, ancho: 100.5, alto: 50.2 }), { x: 10, y: 21, ancho: 101, alto: 50 });
  assert.deepEqual(limitarCaja({ x: -30, y: 530, ancho: 5, alto: 5 }), { x: 0, y: 516, ancho: 24, alto: 24 });
  assert.deepEqual(limitarCaja({ x: 900, y: 500, ancho: 2000, alto: 2000 }), { x: 0, y: 0, ancho: 960, alto: 540 });
  assert.deepEqual(limitarCaja({ x: 900, y: 100, ancho: 200, alto: 100 }), { x: 760, y: 100, ancho: 200, alto: 100 });
});

test("imágenes flotantes: añadir, mover, redimensionar, reencuadrar, cambiar y quitar sin tocar el original", () => {
  const a = anadirFlotante(portada, "/api/informes/fotos/a", { x: 100.3, y: 50, ancho: 300, alto: 200 });
  assert.equal(a.id, "f1");
  assert.deepEqual(a.slide.flotantes, [{ id: "f1", src: "/api/informes/fotos/a", x: 100, y: 50, ancho: 300, alto: 200 }]);
  assert.equal(portada.flotantes, undefined);
  assert.deepEqual(a.slide.props, portada.props);

  const b = anadirFlotante(a.slide, "/api/informes/fotos/b", { x: 0, y: 0, ancho: 50, alto: 50 });
  assert.equal(b.id, "f2");
  // Un id que quedó libre al quitar otra no se repite mientras haya una con él.
  assert.equal(anadirFlotante(quitarFlotante(b.slide, "f1"), "/x", { x: 0, y: 0, ancho: 50, alto: 50 }).id, "f3");

  const movida = colocarFlotante(b.slide, "f1", { x: 800, y: 400, ancho: 300, alto: 200 });
  assert.deepEqual(movida.flotantes![0], { id: "f1", src: "/api/informes/fotos/a", x: 660, y: 340, ancho: 300, alto: 200 });
  assert.equal(b.slide.flotantes![0]!.x, 100);
  assert.throws(() => colocarFlotante(b.slide, "no-existe", { x: 0, y: 0, ancho: 50, alto: 50 }));

  const encuadrada = reencuadrarFlotante(movida, "f1", 0.256, 1.7);
  assert.deepEqual([encuadrada.flotantes![0]!.focalX, encuadrada.flotantes![0]!.focalY], [0.26, 1]);
  const cambiada = cambiarFotoFlotante(encuadrada, "f1", "/api/informes/fotos/c");
  assert.deepEqual(cambiada.flotantes![0], { id: "f1", src: "/api/informes/fotos/c", x: 660, y: 340, ancho: 300, alto: 200 });

  assert.deepEqual(quitarFlotante(quitarFlotante(b.slide, "f1"), "f2"), portada);
  assert.deepEqual(sinFlotantes(b.slide), portada);
});

test("flotantesValidos: lo mal formado se ignora y no rompe el pintado", () => {
  const malos = [null, "x", { id: "f1" }, { id: "f2", src: "", x: 0, y: 0, ancho: 10, alto: 10 }, { id: "f3", src: "/a", x: "0", y: 0, ancho: 10, alto: 10 }];
  assert.deepEqual(flotantesValidos(malos), []);
  assert.deepEqual(flotantesValidos("nada"), []);
  assert.equal(pintar({ ...portada, flotantes: malos as never }), pintar(portada));
});

test("pintado: sin flotantes sale lo mismo que la plantilla; con ellas, una capa encima con cada imagen en su área", () => {
  for (const slide of [portada, resumen, desplegar(resumen), { id: "cierre", c: "Cierre" } as SlideJson]) {
    assert.equal(pintar({ ...slide, flotantes: [] }), pintar(slide));
    const con = anadirFlotante(slide, "/api/informes/fotos/a", { x: 40, y: 60, ancho: 320, alto: 180 }).slide;
    const html = pintar(reencuadrarFlotante(con, "f1", 0.25, 0.75));
    assert.ok(html.startsWith(pintar(slide)), slide.id);
    assert.equal(
      html.slice(pintar(slide).length),
      '<div class="iq-flotantes"><img class="iq-img iq-flotante" data-flotante="f1" src="/api/informes/fotos/a" alt="" ' +
        'style="left:40px;top:60px;width:320px;height:180px;object-position:25% 75%"/></div>',
    );
    // Desplegar la plantilla para reorganizarla no las pierde.
    assert.deepEqual(desplegar(con).flotantes, con.flotantes);
  }
});

test("lo que rehace Claude o la generación conserva las imágenes colocadas a mano", () => {
  const con = anadirFlotante(resumen, "/api/informes/fotos/a", { x: 40, y: 60, ancho: 320, alto: 180 }).slide;
  // Claude no las ve (no hay texto suyo en lo que se le resume) y lo que devuelva con ese nombre se descarta.
  assert.equal(textos(con), textos(resumen));
  const deClaude = validarSlide({ slide: { c: "DosColumnas", props: {}, flotantes: [{ id: "x", src: "/inventada", x: 0, y: 0, ancho: 9, alto: 9 }] } }, con.id, ["DosColumnas"]);
  assert.equal(deClaude.flotantes, undefined);
  assert.deepEqual(conFlotantesDe(con, deClaude).flotantes, con.flotantes);
  assert.equal(conFlotantesDe(resumen, { ...deClaude, flotantes: con.flotantes }).flotantes, undefined);
  assert.equal(conFlotantesDe(null, deClaude).flotantes, undefined);

  const d = { trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026", proyecto: "Santa Engracia 84" };
  const url = (id: string) => `/api/informes/fotos/${id}`;
  const flotantes = con.flotantes;
  for (const id of ["portada", "indice", "disclaimer", "cierre", "varianzas"]) {
    assert.deepEqual(slideDeterminista({ id, accion: "actualizar" }, { id, flotantes }, d, [], url)!.flotantes, flotantes, id);
    assert.equal(slideDeterminista({ id, accion: "actualizar" }, { id }, d, [], url)!.flotantes, undefined, id);
  }
  assert.deepEqual(slideDeterminista({ id: "colaboradores", accion: "mantener" }, { id: "colaboradores", c: "Colaboradores", flotantes }, d, [], url)!.flotantes, flotantes);
});

test("herencia al trimestre siguiente: solo donde el contenido no cambia, y marcadas para revisarlas", () => {
  const prev = anadirFlotante(portada, "/api/informes/fotos/a", { x: 40, y: 60, ancho: 320, alto: 180 }).slide;
  const heredadas = [{ ...prev.flotantes![0]!, heredada: true }];
  assert.deepEqual(flotantesAlHeredar("actualizar", "portada", prev), heredadas);
  assert.deepEqual(flotantesAlHeredar("mantener", "obra-1", prev), heredadas);
  assert.deepEqual(flotantesAlHeredar("actualizar", "obra-1", prev), []);
  assert.deepEqual(flotantesAlHeredar("nueva", "indice", prev), []);
  assert.deepEqual(flotantesAlHeredar("mantener", "cierre", null), []);
  assert.equal(prev.flotantes![0]!.heredada, undefined);

  // La revisión avisa (sin bloquear) hasta que alguien la toca o la da por buena.
  const periodo = { trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" };
  const slide: SlideJson = { ...portada, flotantes: heredadas };
  const avisos = (s: SlideJson) => qaMecanico([s, { id: "disclaimer", c: "Disclaimer" }], {}, periodo).filter((x) => x.slide === "portada");
  assert.deepEqual(avisos(slide).map((x) => x.nivel), ["aviso"]);
  assert.deepEqual(avisos(confirmarFlotante(slide, "f1")), []);
  assert.deepEqual(avisos(colocarFlotante(slide, "f1", { x: 0, y: 0, ancho: 100, alto: 100 })), []);
  assert.deepEqual(confirmarFlotante(slide, "f1").flotantes, prev.flotantes);
});
