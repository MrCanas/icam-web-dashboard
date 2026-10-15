import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { parsearBiblioteca } from "@/modules/pm/informes/logic/biblioteca";
import { reponerHitos } from "@/modules/pm/informes/logic/cronograma";
import {
  conservaEstructura,
  defFija,
  ESTRUCTURA_FIJA,
  huecosDelAnterior,
  huecosPendientes,
  huecosVacios,
  IDS_FIJOS,
  montarFija,
  PENDIENTE_FIJO,
  slideDesdeClaude,
  traerDelAnterior,
} from "@/modules/pm/informes/logic/estructuraFija";
import { ordenar, qaMecanico, slideDeterminista, validarSlide } from "@/modules/pm/informes/logic/informe";
import { promptActualizar, promptAjuste, promptCorreccion, promptNueva, type MaterialInforme } from "@/modules/pm/informes/logic/prompts";
import { componentesPermitidos } from "@/modules/pm/informes/slides/components";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const ctx = { trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" };
const permitidos = componentesPermitidos();
const conHuecos = ESTRUCTURA_FIJA.filter((d) => d.modo === "claude");
const FOTO = "/api/informes/fotos/abc";

/** Huecos con contenido de ejemplo para cada fija. */
function ejemplo(id: string): Record<string, unknown> {
  const hitos = [
    { titulo: "Compra del inmueble", fecha: "06/2025", hecho: true },
    { titulo: "Inicio de obra", fecha: "09/2026", hecho: false },
  ];
  const e: Record<string, Record<string, unknown>> = {
    "resumen-ejecutivo": { situacion: ["El proyecto avanza."], compraventa: ["Adquisición: **13,5 M€**"], operacion: ["Operador: Limehome"], logros: ["Acta favorable 06/2026"] },
    "estrategia-compraventa": { estrategia: ["Demolición y obra nueva."], compraventa: ["Arras en marzo de 2025."], imagenes: [{ src: FOTO, pie: "Fachada" }] },
    calendario: { anterior: ["Se presentó el proyecto refundido."], actual: ["Se obtuvo el acta favorable."] },
    "calendario-timeline": { intro: ["36 meses desde la compra."], hitos },
    "kpis-riesgos-objetivos": {
      kpis: [{ indicador: "% Avance técnico", actual: "64 %", objetivo: "Proyecto de ejecución" }],
      riesgos: [{ riesgo: "Retraso de licencia", mitigacion: "Seguimiento con la ADA" }],
      objetivos: ["Obtener la licencia"],
    },
    "situacion-cm-pm": { cm: ["El CM coordina la obra."], pm: ["Impar supervisa plazos y costes."], nota: "" },
    sostenibilidad: {
      texto: ["Estrategia de sostenibilidad."],
      intro: "Puntuación objetivo y avance.",
      breeam: { estrellas: 4, calificacion: "Muy Bueno", rango: "55-70%" },
      consolidacion: [],
      categorias: [{ nombre: "Energía", objetivo: 60, avance: 40 }],
    },
    "sostenibilidad-seguimiento": { texto: ["Reuniones de coordinación."], hitos, nota: "Nota: informe en el portal." },
    colaboradores: { intro: "Impar supervisa el proyecto.", roles: [{ rol: "INGENIERÍA", parrafos: ["**PGI Engineering**"] }], logos: [{ nombre: "PGI" }] },
    vehiculo: { detalles: ["Sociedad constituida el 13 de enero de 2025."], fichas: { aeat: "AL CORRIENTE", cda: "Q4 2026", rm: "29/01/2025", informe: "ENERO 2027" } },
  };
  return e[id]!;
}

test("la estructura fija: 16 slides, ids únicos, en el orden canónico", () => {
  assert.equal(IDS_FIJOS.length, 16);
  assert.equal(new Set(IDS_FIJOS).size, IDS_FIJOS.length);
  const desordenadas: SlideJson[] = [...IDS_FIJOS].reverse().map((id) => ({ id }));
  assert.deepEqual(
    ordenar(desordenadas).map((s) => s.id),
    IDS_FIJOS,
  );
  // Las opcionales de Situación van entre CM/PM y Sostenibilidad.
  assert.deepEqual(
    ordenar([{ id: "sostenibilidad" }, { id: "situacion-licencia" }, { id: "situacion-cm-pm-2" }, { id: "situacion-cm-pm" }]).map((s) => s.id),
    ["situacion-cm-pm", "situacion-cm-pm-2", "situacion-licencia", "sostenibilidad"],
  );
});

test("la biblioteca conoce todas las fijas", () => {
  const bib = parsearBiblioteca(readFileSync(resolve(process.cwd(), "src/modules/pm/informes/referencia/biblioteca.md"), "utf8"));
  for (const id of IDS_FIJOS) assert.ok(bib.some((b) => b.id === id), id);
});

test("montar sin información: pasa la validación y cada bloque obligatorio dice «Pendiente»", () => {
  for (const def of conHuecos) {
    const slides = montarFija(def, huecosVacios(def), ctx, permitidos);
    assert.ok(slides.length >= 1, def.id);
    slides.forEach((s) => validarSlide(s, s.id, permitidos));
    assert.ok(huecosPendientes(slides[0]!) > 0, `${def.id} sin Pendiente`);
    assert.equal(slides[0]!.id, def.id);
  }
});

test("montar y extraer: ida y vuelta con los mismos huecos y sin «Pendiente»", () => {
  for (const def of conHuecos) {
    const h = ejemplo(def.id);
    const slides = montarFija(def, h, ctx, permitidos);
    assert.equal(huecosPendientes(slides[0]!), 0, def.id);
    const vuelta = def.extraer!(slides[0]!, slides);
    assert.ok(vuelta, def.id);
    for (const [k, v] of Object.entries(h)) {
      if (k === "nota" && !v) continue;
      assert.deepEqual(JSON.parse(JSON.stringify((vuelta as Record<string, unknown>)[k])), JSON.parse(JSON.stringify(v)), `${def.id}.${k}`);
    }
    assert.ok(conservaEstructura(slides[0]!, slides), def.id);
  }
});

test("CM/PM: una slide si cabe, dos si hay mucho contenido (o si se pide partir)", () => {
  const def = defFija("situacion-cm-pm")!;
  assert.equal(montarFija(def, ejemplo("situacion-cm-pm"), ctx).length, 1);
  const largo = { cm: Array(6).fill("x".repeat(300)), pm: Array(6).fill("y".repeat(300)) };
  const dos = montarFija(def, largo, ctx, permitidos);
  assert.deepEqual(
    dos.map((s) => s.id),
    ["situacion-cm-pm", "situacion-cm-pm-2"],
  );
  assert.equal(montarFija(def, ejemplo("situacion-cm-pm"), { ...ctx, dividir: true }).length, 2);
  // Y se lee igual repartida en dos.
  const h = def.extraer!(dos[0]!, dos)!;
  assert.equal((h.cm as string[]).length, 6);
  assert.equal((h.pm as string[]).length, 6);
});

test("los huecos se sanean: sin fotos inventadas, tipos coercidos y claves desconocidas fuera", () => {
  const [s] = slideDesdeClaude(
    { huecos: { estrategia: "Un solo párrafo", compraventa: [], imagenes: [{ src: "fotos/inventada.jpg" }, { src: FOTO }], otra: "x" }, fuentes: "informe Q2" },
    "estrategia-compraventa",
    permitidos,
    ctx,
  );
  const h = defFija("estrategia-compraventa")!.extraer!(s!)!;
  assert.deepEqual(h.estrategia, ["Un solo párrafo"]);
  assert.deepEqual(h.compraventa, []);
  assert.deepEqual(h.imagenes, [{ src: FOTO, pie: undefined }]);
  assert.equal(s!.fuentes, "informe Q2");
  assert.ok(!JSON.stringify(s).includes("inventada"));
});

test("si Claude devuelve el slide entero, se vuelve a montar con su estructura", () => {
  const entero = {
    id: "kpis-riesgos-objetivos",
    c: "SlideKpisRiesgosObjetivos",
    props: { trimestre: "Q3 2026", siguiente: "Q4 2026", kpis: [{ indicador: "Licencia", actual: "86 %", objetivo: "Obtenerla" }], riesgos: [], objetivos: ["Licencia"] },
  };
  const [s] = slideDesdeClaude(entero, "kpis-riesgos-objetivos", permitidos, ctx);
  const riesgos = (s!.props as { riesgos: { riesgo: string }[] }).riesgos;
  assert.equal(riesgos[0]!.riesgo, PENDIENTE_FIJO);
  // Fuera de la estructura fija, como siempre.
  const [libre] = slideDesdeClaude({ id: "x", compuesto: { titulo: "Licencia" } }, "situacion-licencia", permitidos, ctx);
  assert.equal(libre!.compuesto!.titulo, "Licencia");
});

/* ---------- informes anteriores ---------- */

const estrategiaVieja: SlideJson = {
  id: "estrategia",
  compuesto: {
    titulo: "Resumen de Proyecto. Estrategia",
    clase: "iq-cols",
    contenido: [
      { c: "div", hijos: [{ c: "Subtitulo", hijos: ["ESTRATEGIA DE PROYECTO"] }, { c: "Texto", props: { parrafos: ["Hotel de 61 unidades."] } }] },
      { c: "MapaLateral", props: { rotulo: "Madrid", foto: FOTO } },
    ],
  },
};
const compraventaVieja: SlideJson = {
  id: "compraventa-financiacion",
  c: "DosColumnas",
  props: { titulo: "Compraventa", izquierda: { c: "Texto", props: { parrafos: ["Compra por 13,9 M€."] } }, derecha: { c: "Vinetas", props: { items: ["Seguro decenal"] } } },
};
const calendarioViejo: SlideJson = {
  id: "calendario",
  compuesto: {
    titulo: "Resumen de Proyecto. Calendario",
    contenido: [
      { c: "AntecedentesNovedades", props: { titulo: "CALENDARIO", anterior: { trimestre: "Q1 2026", parrafos: ["Antes"] }, actual: { trimestre: "Q2 2026", parrafos: ["Novedad Q2"] } } },
      { c: "Timeline", props: { hitos: [{ titulo: "Licencia", fecha: "09/2026", hecho: false }] } },
    ],
  },
};

test("del informe anterior: estrategia + compraventa viejas alimentan la slide fusionada", () => {
  const h = huecosDelAnterior(defFija("estrategia-compraventa")!, [estrategiaVieja, compraventaVieja])!;
  assert.deepEqual(h.estrategia, ["Hotel de 61 unidades."]);
  assert.deepEqual(h.compraventa, ["Compra por 13,9 M€.", "Seguro decenal"]);
  assert.deepEqual(h.imagenes, [{ src: FOTO, pie: undefined }]);
});

test("del informe anterior: el calendario viejo se reparte en texto y cronograma", () => {
  const texto = huecosDelAnterior(defFija("calendario")!, [calendarioViejo])!;
  assert.deepEqual(texto.actual, ["Novedad Q2"]);
  const crono = huecosDelAnterior(defFija("calendario-timeline")!, [calendarioViejo])!;
  assert.deepEqual(crono.hitos, [{ titulo: "Licencia", fecha: "09/2026", hecho: false }]);
});

test("traer del anterior: al periodo actual, las Novedades pasan a Antecedentes y se conservan las imágenes libres", () => {
  const flot = { id: "f1", src: FOTO, x: 10, y: 10, ancho: 100, alto: 80 };
  const [cal] = traerDelAnterior("calendario", [calendarioViejo], { id: "calendario", flotantes: [flot] }, ctx)!;
  const an = (cal!.compuesto!.contenido![0] as { props: { anterior: { trimestre: string; parrafos: string[] }; actual: { trimestre: string; parrafos: string[] } } }).props;
  assert.equal(an.anterior.trimestre, "Q2 2026");
  assert.deepEqual(an.anterior.parrafos, ["Novedad Q2"]);
  assert.equal(an.actual.trimestre, "Q3 2026");
  assert.deepEqual(an.actual.parrafos, [PENDIENTE_FIJO]);
  assert.equal(cal!.origen, "heredada");
  assert.deepEqual(cal!.flotantes, [flot]);
  // Una no fija: copia al periodo actual. Y nada si el anterior no la tenía.
  const [lic] = traerDelAnterior("situacion-licencia", [{ id: "situacion-licencia", compuesto: { titulo: "Licencia. Q2 2026" } }], null, ctx)!;
  assert.equal(lic!.compuesto!.titulo, "Licencia. Q3 2026");
  assert.equal(traerDelAnterior("situacion-licencia", [], null, ctx), null);
  // La fusionada, desde las dos viejas.
  const [ec] = traerDelAnterior("estrategia-compraventa", [estrategiaVieja, compraventaVieja], null, ctx)!;
  assert.equal(huecosPendientes(ec!), 0);
});

test("«mantener» una fija la vuelve a montar con lo que tenía", () => {
  const prev = montarFija(defFija("vehiculo")!, ejemplo("vehiculo"), { ...ctx, trimestre: "Q2 2026", trimestreAnterior: "Q1 2026", siguiente: "Q3 2026" })[0]!;
  const s = slideDeterminista({ id: "vehiculo", accion: "mantener" }, prev, { ...ctx, proyecto: "CSP 10" }, [], (id) => id)!;
  assert.equal(s.c, "VehiculoInversion");
  assert.equal(s.origen, "heredada");
});

test("el cronograma del calendario viejo se repone en «calendario-timeline»", () => {
  const def = defFija("calendario-timeline")!;
  const slides = [
    montarFija(defFija("calendario")!, ejemplo("calendario"), ctx)[0]!,
    montarFija(def, { intro: ["x"], hitos: [] }, ctx)[0]!,
    montarFija(defFija("sostenibilidad-seguimiento")!, ejemplo("sostenibilidad-seguimiento"), ctx)[0]!,
  ];
  const r = reponerHitos(slides, [{ titulo: "Licencia", fecha: "09/2026", hecho: false, slide: "calendario" }]);
  assert.deepEqual(
    r.cambios.map((c) => c.slide),
    ["calendario-timeline"],
  );
});

test("QA: los «Pendiente» y las fijas que faltan son avisos, no bloquean", () => {
  const slides: SlideJson[] = [
    { id: "disclaimer", c: "Disclaimer" },
    montarFija(defFija("estrategia-compraventa")!, {}, ctx)[0]!,
  ];
  const qa = qaMecanico(slides, { "estrategia-compraventa": { relleno: 40 } }, ctx);
  assert.ok(qa.every((i) => i.nivel === "aviso"));
  assert.ok(qa.some((i) => /Pendiente/.test(i.texto)));
  assert.ok(qa.some((i) => /Falta la slide fija/.test(i.texto)));
  // Con «Pendiente» no se avisa de que queda hueco.
  assert.ok(!qa.some((i) => /Relleno/.test(i.texto)));
  // Un informe anterior a la estructura fija no recibe esos avisos.
  assert.deepEqual(qaMecanico([{ id: "disclaimer", c: "Disclaimer" }], {}, ctx), []);
});

/* ---------- prompts ---------- */

function material(previo: SlideJson[]): MaterialInforme {
  return {
    informe: { proyecto: "CSP 10", codigo: "CSP10", arquetipo: "A", trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" },
    referencias: { recetas: "RECETAS", api: "API", reglas: "REGLAS" },
    biblioteca: [],
    fuentes: [],
    previoTexto: null,
    previo: { id: "CSP10_Q2-2026", version: 1, meta: { proyecto: "CSP 10", codigo: "CSP10", trimestre: "Q2 2026" }, slides: previo },
    fotos: [],
    analisis: null,
  };
}
const tarea = (b: { texto: string }[]) => b[b.length - 1]!.texto;

test("prompts: una fija pide sus huecos con los del informe anterior; una corrección pide conservarla", () => {
  const m = material([estrategiaVieja, compraventaVieja, calendarioViejo]);
  const nueva = tarea(promptNueva(m, "estrategia-compraventa"));
  assert.match(nueva, /"huecos"/);
  assert.match(nueva, /HUECOS DEL INFORME ANTERIOR/);
  assert.match(nueva, /Hotel de 61 unidades/);
  // El calendario ya no lleva cronograma; «calendario-timeline» sí, con los hitos del calendario viejo.
  const cal = tarea(promptActualizar(m, calendarioViejo));
  assert.doesNotMatch(cal, /CRONOGRAMA QUE SE CONSERVA/);
  assert.match(tarea(promptNueva(m, "calendario-timeline")), /CRONOGRAMA QUE SE CONSERVA[\s\S]*Licencia/);
  // Ajuste: con sus huecos actuales.
  const montada = montarFija(defFija("calendario")!, ejemplo("calendario"), ctx)[0]!;
  assert.match(tarea(promptAjuste(m, montada, { desborde: true, ocupacion: 110, relleno: null })), /HUECOS ACTUALES/);
  // Corrección del equipo: el slide entero, sin perder bloques.
  const corr = tarea(promptCorreccion(m, montada, "Acorta", {}));
  assert.match(corr, /conserva todos sus bloques/);
  assert.doesNotMatch(corr, /NO devuelvas el slide/);
  // Las no fijas, como siempre.
  assert.doesNotMatch(tarea(promptNueva(m, "situacion-licencia")), /"huecos"/);
  // La estructura va en el bloque cacheado.
  assert.match(promptNueva(m, "situacion-licencia")[0]!.texto, /ESTRUCTURA FIJA DEL INFORME/);
});
