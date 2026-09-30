import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { parsearBiblioteca } from "@/modules/pm/informes/logic/biblioteca";
import { costeUsd, esfuerzoDesdeEnv, extraerJson, JsonNoValidoError } from "@/modules/pm/informes/logic/peticion-claude";
import { leerPeticion, montarPrompt } from "@/modules/pm/informes/logic/peticiones";
import { MAX_BYTES_FUENTES, bytes, promptActualizar, promptNueva, recortar, type MaterialInforme } from "@/modules/pm/informes/logic/prompts";
import type { Fuente } from "@/modules/pm/informes/types";

const REF = resolve(process.cwd(), "src/modules/pm/informes/referencia");
const biblioteca = parsearBiblioteca(readFileSync(resolve(REF, "biblioteca.md"), "utf8"));

function fuente(tipo: Fuente["tipo"], nombre: string, texto: string, extra: Partial<Fuente> = {}): Fuente {
  return { id: 1, tipo, nombre, texto, auto: false, orden: 100, incluida: true, actualizado: "", ...extra };
}

function material(fuentes: Fuente[]): MaterialInforme {
  return {
    informe: { proyecto: "Santa Engracia 84", codigo: "SE84", arquetipo: "A", trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" },
    referencias: { recetas: "RECETAS", api: "API", reglas: "REGLAS" },
    biblioteca,
    fuentes,
    previoTexto: null,
    previo: {
      id: "SE84_Q2-2026",
      version: 1,
      meta: { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q2 2026" },
      slides: [{ id: "calendario", c: "DosColumnas", props: { titulo: "Calendario. Q2 2026" } }],
    },
    fotos: [],
    analisis: null,
  };
}

test("la biblioteca tiene sus 39 slides con números estables", () => {
  assert.equal(biblioteca.length, 39);
  assert.deepEqual(biblioteca[0], {
    n: 1,
    nombre: "Portada",
    para: "Trimestre, proyecto y foto del edificio",
    sugerir: "Siempre",
    id: "portada",
    grupo: "Estructura (siempre presentes)",
  });
  assert.equal(biblioteca.find((b) => b.n === 29)?.id, "situacion-<tema>");
});

test("los prompts de slide cachean la parte estable y el material del trimestre, no la tarea", () => {
  const m = material([fuente("notas", "Notas", "Notas del trimestre")]);
  const a = promptActualizar(m, m.previo!.slides[0]!);
  const b = promptNueva(m, "sostenibilidad");
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((x) => x.cachear), [true, true, false]);
  // Las dos primeras partes son idénticas entre peticiones del mismo informe: es lo que se lee de caché.
  assert.equal(a[0]!.texto, b[0]!.texto);
  assert.equal(a[1]!.texto, b[1]!.texto);
  assert.match(a[2]!.texto, /^== TAREA ==/);
  assert.match(a[2]!.texto, /SLIDE ANTERIOR/);
  assert.match(b[2]!.texto, /biblioteca nº 21: Sostenibilidad BREEAM/);
});

test("las fuentes se recortan a un tope fijo, independiente de la tarea", () => {
  const larga = "x".repeat(MAX_BYTES_FUENTES * 2);
  const m = material([fuente("documento", "Largo", larga)]);
  const a = promptActualizar(m, m.previo!.slides[0]!);
  const b = promptNueva(m, "obra-1");
  assert.equal(a[1]!.texto, b[1]!.texto);
  assert.ok(bytes(a[1]!.texto) < MAX_BYTES_FUENTES + 2_000);
  assert.match(a[1]!.texto, /\[… recortado\]/);
});

test("las fuentes quitadas y el informe anterior en texto no van como fuentes del trimestre", () => {
  const m = material([
    fuente("actas", "Actas Q3", "ACTAS", { auto: true, orden: 0 }),
    fuente("documento", "Quitado", "NO DEBE SALIR", { incluida: false }),
    fuente("previo", "Informe Q2.pdf", "TEXTO PREVIO"),
  ]);
  const t = promptNueva(m, "obra-1")[1]!.texto;
  assert.match(t, /ACTAS/);
  assert.doesNotMatch(t, /NO DEBE SALIR/);
  assert.doesNotMatch(t, /TEXTO PREVIO/);
});

test("recortar no parte caracteres multibyte", () => {
  const r = recortar("ñ".repeat(100), 51);
  assert.ok(r.startsWith("ñ".repeat(25)));
  assert.doesNotMatch(r, /�/);
});

test("leerPeticion valida el cuerpo y montarPrompt usa el slide anterior al actualizar", () => {
  assert.equal(typeof leerPeticion({ tipo: "otra", informeId: "SE84_Q3-2026" }), "string");
  assert.equal(typeof leerPeticion({ tipo: "slide", informeId: "SE84_Q3-2026" }), "string");
  const p = leerPeticion({ tipo: "slide", informeId: "SE84_Q3-2026", slideId: "calendario", modo: "actualizar" });
  assert.equal(typeof p, "object");
  const bloques = montarPrompt(p as Exclude<typeof p, string>, material([]));
  assert.ok(Array.isArray(bloques));
  assert.match((bloques as { texto: string }[])[2]!.texto, /Actualiza al Q3 2026 el slide "calendario"/);
});

test("extraerJson tolera bloques de código y texto alrededor", () => {
  assert.deepEqual(extraerJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extraerJson('```json\n{"a":2}\n```'), { a: 2 });
  assert.deepEqual(extraerJson('Aquí va: [{"slide":"x"}] listo'), [{ slide: "x" }]);
  assert.throws(() => extraerJson("sin json"), JsonNoValidoError);
});

test("coste con la tarifa de Opus 5.5, caché incluida", () => {
  const c = costeUsd("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 100_000, cacheCreationTokens: 200_000, cacheReadTokens: 1_000_000 });
  // 4 + 2 + 1 + 0,2
  assert.equal(c, 7.2);
  assert.equal(costeUsd("modelo-desconocido", { inputTokens: 1_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }), 4);
});

test("el esfuerzo por defecto es high y solo acepta niveles válidos", () => {
  assert.equal(esfuerzoDesdeEnv(undefined), "high");
  assert.equal(esfuerzoDesdeEnv("xhigh"), "xhigh");
  assert.equal(esfuerzoDesdeEnv("mucho"), "high");
});
