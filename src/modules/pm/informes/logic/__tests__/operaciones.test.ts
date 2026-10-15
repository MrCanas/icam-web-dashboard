import assert from "node:assert/strict";
import { test } from "node:test";

import { deshacerRevision, duplicarSlide, aplicarResultado, idDerivado, leerResultado, mapaNumeros, slidesCitadas } from "@/modules/pm/informes/logic/operaciones";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const slide = (id: string, titulo = id, extra: Partial<SlideJson> = {}): SlideJson => ({ id, c: "DosColumnas", props: { titulo }, ...extra });

const informe = (): SlideJson[] => [
  { id: "portada", c: "Portada", props: {} },
  { id: "indice", c: "Indice", props: { secciones: [] } },
  slide("resumen-ejecutivo", "Resumen"),
  slide("calendario", "Calendario"),
  slide("situacion-licencia", "Licencia"),
  slide("obra", "Obra"),
  slide("obra-2", "Obra 2", { oculto: true }),
  slide("obra-3", "Obra 3"),
  { id: "disclaimer", c: "Disclaimer" },
  { id: "cierre", c: "Cierre" },
];

const validar = (o: unknown, id: string): SlideJson => {
  if (!o || typeof o !== "object") throw new Error("no es un slide");
  return { ...(o as SlideJson), id };
};

test("los números visibles saltan las ocultas", () => {
  const { porId, porNumero } = mapaNumeros(informe());
  assert.equal(porId.get("obra"), 6);
  assert.equal(porId.get("obra-2"), undefined);
  assert.equal(porNumero.get(7), "obra-3");
});

test("las slides citadas por número: «slide 5», listas, rangos y «la 7 y la 8»", () => {
  const s = informe();
  assert.deepEqual(slidesCitadas("Slide 5: desdóblala", s), ["situacion-licencia"]);
  assert.deepEqual(slidesCitadas("junta la 6 y la 7", s), ["obra", "obra-3"]);
  assert.deepEqual(slidesCitadas("revisa las slides 3, 4 y 6", s), ["resumen-ejecutivo", "calendario", "obra"]);
  assert.deepEqual(slidesCitadas("diapositivas de la 3 a la 5", s), ["resumen-ejecutivo", "calendario", "situacion-licencia"]);
  // Números que no son slides (fechas, importes) no cuentan.
  assert.deepEqual(slidesCitadas("la entrega es en 2026 y cuesta 3 M€", s), []);
  assert.deepEqual(slidesCitadas("slide 40", s), []);
});

test("los ids derivados conservan el prefijo (y la sección)", () => {
  const s = informe();
  assert.equal(idDerivado("obra", s), "obra-b");
  assert.equal(idDerivado("obra-b", [...s, { id: "obra-b" }]), "obra-c");
});

test("desdoblar: una slide pasa a dos, la primera conserva id e imágenes puestas a mano", () => {
  const s = informe();
  s[5]!.flotantes = [{ id: "f1", src: "/api/informes/fotos/x", x: 1, y: 1, ancho: 10, alto: 10 }];
  const r = aplicarResultado(
    s,
    leerResultado({ reemplazos: [{ id: "obra", slides: [slide("x", "Obra (1/2)"), slide("y", "Obra (2/2)")] }], resumen: "Slide 6 en dos" }),
    validar,
  );
  assert.deepEqual(r.rechazos, []);
  const ids = r.slides.map((x) => x.id);
  assert.deepEqual(ids.slice(5, 8), ["obra", "obra-b", "obra-2"]);
  assert.equal(r.slides[5]!.flotantes?.length, 1);
  assert.equal(r.slides[6]!.origen, "nueva");
  assert.deepEqual(r.despues, ["obra", "obra-b"]);
  assert.deepEqual(r.antes.map((x) => x.id), ["obra"]);
  // No muta lo de entrada.
  assert.equal(s.length, 10);
});

test("fusionar: la primera recoge el contenido y la segunda desaparece", () => {
  const r = aplicarResultado(informe(), leerResultado({ reemplazos: [{ id: "obra", slides: [slide("obra", "Obra")] }], eliminar: ["obra-3"] }), validar);
  assert.ok(!r.slides.some((x) => x.id === "obra-3"));
  assert.deepEqual(r.antes.map((x) => x.id), ["obra", "obra-3"]);
});

test("las cerradas, la portada y el disclaimer no se tocan", () => {
  const s = informe();
  s[3]!.cerrada = true;
  const r = aplicarResultado(
    s,
    leerResultado({ reemplazos: [{ id: "calendario", slides: [slide("calendario", "Otro")] }], eliminar: ["disclaimer"] }),
    validar,
  );
  assert.equal(r.rechazos.length, 2);
  assert.equal((r.slides[3]!.props as { titulo: string }).titulo, "Calendario");
  assert.ok(r.slides.some((x) => x.id === "disclaimer"));
});

test("slide nueva tras otra, con id libre", () => {
  const r = aplicarResultado(informe(), leerResultado({ nuevas: [{ despuesDe: "calendario", slide: slide("calendario", "Hitos 2027") }] }), validar);
  assert.equal(r.slides[4]!.id, "calendario-b");
  assert.equal(r.slides[4]!.origen, "nueva");
});

test("una respuesta no válida se rechaza sin romper el resto", () => {
  const r = aplicarResultado(
    informe(),
    leerResultado({ reemplazos: [{ id: "obra", slides: ["basura"] }, { id: "obra-3", slides: [slide("obra-3", "Bien")] }] }),
    validar,
  );
  assert.equal(r.rechazos.length, 1);
  assert.equal((r.slides.find((x) => x.id === "obra-3")!.props as { titulo: string }).titulo, "Bien");
});

test("duplicar copia detrás con id nuevo y sin cerrar", () => {
  const s = informe();
  s[5]!.cerrada = true;
  const d = duplicarSlide(s, "obra")!;
  assert.equal(d.nueva, "obra-b");
  assert.equal(d.slides[6]!.id, "obra-b");
  assert.equal(d.slides[6]!.cerrada, undefined);
  assert.equal(duplicarSlide(s, "portada"), null);
});

test("deshacer una revisión repone lo de antes y quita lo creado", () => {
  const s = informe();
  const r = aplicarResultado(
    s,
    leerResultado({ reemplazos: [{ id: "obra", slides: [slide("a", "1"), slide("b", "2")] }], eliminar: ["obra-3"] }),
    validar,
  );
  const despues = r.despues.map((id) => r.slides.find((x) => x.id === id)!);
  const d = deshacerRevision(r.slides, { antes: r.antes, despues, ordenAntes: s.map((x) => x.id) });
  assert.ok("slides" in d);
  if ("slides" in d) assert.deepEqual(d.slides.map((x) => x.id), s.map((x) => x.id));
  // Si lo creado ha cambiado después, no se deshace.
  const tocadas = r.slides.map((x) => (x.id === "obra-b" ? { ...x, props: { titulo: "otra" } } : x));
  assert.ok("error" in deshacerRevision(tocadas, { antes: r.antes, despues, ordenAntes: s.map((x) => x.id) }));
});
