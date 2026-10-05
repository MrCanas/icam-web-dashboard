import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dirigirFuente,
  fuentesParaSlide,
  mapaDirigidas,
  marcarAplicadas,
  pendientesDirigidas,
  seleccionBase,
  sinFuentesBorradas,
  slidesDeFuente,
} from "@/modules/pm/informes/logic/dirigidas";
import { leerPeticion, montarPrompt } from "@/modules/pm/informes/logic/peticiones";
import { bloqueDirigido, fuentesGenerales, type BloquePrompt, type MaterialInforme } from "@/modules/pm/informes/logic/prompts";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";
import type { Fuente, Seleccion } from "@/modules/pm/informes/types";

function fuente(id: number, nombre: string, texto: string, extra: Partial<Fuente> = {}): Fuente {
  return { id, tipo: "documento", nombre, texto, auto: false, orden: 100, incluida: true, actualizado: "", ...extra };
}

const fuentes = [
  fuente(1, "Notas del equipo", "El operador entra en octubre.", { tipo: "notas" }),
  fuente(2, "informe-financiero.pdf", "TIR 12,4 % · NOI 1.250.000 € · Varianza de obra -35.200 €"),
  fuente(3, "acta-licencia.pdf", "Licencia concedida el 03/09."),
];

const slides: SlideJson[] = [
  { id: "portada", c: "Portada", props: {} },
  { id: "resumen-financiero", c: "SlideBloqueado", origen: "bloqueada", props: { titulo: "Resumen Ejecutivo. Financiero Q3 2026", estado: "Pendiente de Finanzas" } },
  { id: "varianzas", c: "SlideBloqueado", origen: "bloqueada", props: { titulo: "Análisis de Varianzas. Financiero Q3 2026" } },
  { id: "oculta", oculto: true, compuesto: { titulo: "Oculta" } },
  { id: "situacion-licencia", compuesto: { titulo: "Situación de Proyecto. Licencia", contenido: [] } },
];

const base: Seleccion = { estructura: [], anadir: [] };

function material(seleccion: Seleccion): MaterialInforme {
  return {
    informe: { proyecto: "Santa Engracia 84", codigo: "SE84", arquetipo: "A", trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" },
    referencias: { recetas: "RECETAS", api: "API", reglas: "REGLAS" },
    biblioteca: [],
    fuentes,
    dirigidas: mapaDirigidas(seleccion),
    previoTexto: null,
    previo: null,
    fotos: [],
    analisis: null,
  };
}

function bloques(p: BloquePrompt[] | string): BloquePrompt[] {
  assert.ok(Array.isArray(p), String(p));
  return p as BloquePrompt[];
}

test("dirigir una fuente a unas slides, marcar lo aplicado y saber qué queda pendiente", () => {
  const dirigida = dirigirFuente(base, 2, ["resumen-financiero", "varianzas", "varianzas", "oculta"]);
  assert.deepEqual(slidesDeFuente(dirigida, 2), ["resumen-financiero", "varianzas", "oculta"]);
  assert.deepEqual(slidesDeFuente(dirigida, 3), []);
  // El original no cambia.
  assert.equal(base.dirigidas, undefined);

  // Pendientes: solo slides visibles, en el orden del informe y con su número de página.
  let pendientes = pendientesDirigidas(dirigida, fuentes, slides);
  assert.deepEqual(pendientes.map((p) => [p.slide.id, p.pagina, p.fuentes.map((f) => f.id)]), [
    ["resumen-financiero", 2, [2]],
    ["varianzas", 3, [2]],
  ]);
  const aplicada = marcarAplicadas(dirigida, ["varianzas", "situacion-licencia"]);
  assert.deepEqual(aplicada.dirigidas?.["2"], { slides: ["resumen-financiero", "varianzas", "oculta"], aplicadas: ["varianzas"] });
  pendientes = pendientesDirigidas(aplicada, fuentes, slides);
  assert.deepEqual(pendientes.map((p) => p.slide.id), ["resumen-financiero"]);

  // Al cambiar el destino se conserva lo ya aplicado que siga en la lista; sin slides, vuelve a ser general.
  assert.deepEqual(dirigirFuente(aplicada, 2, ["varianzas", "situacion-licencia"]).dirigidas?.["2"], { slides: ["varianzas", "situacion-licencia"], aplicadas: ["varianzas"] });
  assert.deepEqual(dirigirFuente(aplicada, 2, []).dirigidas, {});
  // Una fuente quitada o excluida no deja pendientes.
  assert.deepEqual(pendientesDirigidas(dirigida, [fuentes[0]!, { ...fuentes[1]!, incluida: false }], slides), []);
  assert.deepEqual(sinFuentesBorradas(dirigida, [fuentes[0]!]).dirigidas, {});
  assert.deepEqual(seleccionBase(null, { estructura: [{ id: "portada", titulo: "Portada", accion: "mantener", motivo: "" }] } as never).estructura.length, 1);
});

test("la información dirigida solo la ven las peticiones de sus slides", () => {
  const m = material(dirigirFuente(base, 2, ["resumen-financiero", "varianzas"]));
  assert.deepEqual(fuentesGenerales(m).map((f) => f.id), [1, 3]);
  assert.deepEqual(fuentesParaSlide(m.dirigidas!, fuentes, "varianzas").map((f) => f.id), [2]);
  assert.equal(bloqueDirigido(m, "situacion-licencia"), null);
  const bloque = bloqueDirigido(m, "varianzas")!;
  assert.ok(bloque.includes("TIR 12,4 %") && bloque.includes("va también a los slides: resumen-financiero"));

  // Otra slide: ni en el material en caché ni en la tarea.
  const otra = bloques(montarPrompt({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "situacion-licencia", modo: "nueva" }, m));
  assert.ok(!otra.some((b) => b.texto.includes("TIR 12,4 %")));
  assert.ok(otra[1]!.texto.includes("Licencia concedida"));
  // El análisis tampoco la toma como hecho general del trimestre.
  assert.ok(!bloques(montarPrompt({ tipo: "analisis", informeId: "SE84_Q3-2026" }, m))[0]!.texto.includes("TIR 12,4 %"));
});

test("montar un slide con su información dirigida: slide completo, cifras copiadas y sin tocar la caché", () => {
  const m = material(dirigirFuente(base, 2, ["resumen-financiero", "varianzas"]));
  const slide = slides[2]!;
  const peticion = leerPeticion({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "varianzas", modo: "dirigida", slide });
  assert.ok(typeof peticion !== "string");
  const b = bloques(montarPrompt(peticion as Exclude<typeof peticion, string>, m));
  assert.equal(b.length, 3);
  const tarea = b[2]!.texto;
  assert.ok(!b[2]!.cachear);
  assert.ok(tarea.includes('Rehaz por completo el slide "varianzas"'));
  assert.ok(tarea.includes("cópialas tal cual") && tarea.includes("No calcules"));
  assert.ok(tarea.includes("== INFORMACIÓN DIRIGIDA A ESTE SLIDE ==") && tarea.includes("Varianza de obra -35.200 €"));
  assert.ok(tarea.includes('"c":"SlideBloqueado"'));
  // Los bloques en caché son los mismos que en cualquier otra petición de slide.
  const otra = bloques(montarPrompt({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "situacion-licencia", modo: "nueva" }, m));
  assert.equal(b[0]!.texto, otra[0]!.texto);
  assert.equal(b[1]!.texto, otra[1]!.texto);

  // Sin información dirigida a ese slide, o sin el slide, la petición no se monta.
  assert.equal(montarPrompt({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "situacion-licencia", modo: "dirigida", slide: slides[4]! }, m), "No hay información dirigida a ese slide");
  assert.equal(leerPeticion({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "varianzas", modo: "dirigida" }), "Falta el slide");
  assert.equal(leerPeticion({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "varianzas", modo: "dirigida", slide: slides[1] }), "Falta el slide");

  // Una corrección posterior de ese slide también ve el documento.
  const correccion = bloques(montarPrompt({ tipo: "correccion", informeId: "SE84_Q3-2026", slide, instruccion: "Añade la fila de obra" }, m));
  assert.ok(correccion[2]!.texto.includes("Varianza de obra -35.200 €"));
  const correccionOtra = bloques(montarPrompt({ tipo: "correccion", informeId: "SE84_Q3-2026", slide: slides[4]!, instruccion: "Acorta" }, m));
  assert.ok(!correccionOtra[2]!.texto.includes("INFORMACIÓN DIRIGIDA"));
});
