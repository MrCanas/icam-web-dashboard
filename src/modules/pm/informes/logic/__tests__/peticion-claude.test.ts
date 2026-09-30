import assert from "node:assert/strict";
import { test } from "node:test";

import {
  costeUsd,
  esfuerzoDesdeEnv,
  extraerJson,
  JsonNoValidoError,
  tipoDePrompt,
  trocearPrompt,
} from "../peticion-claude";

const PROMPT_SLIDE = [
  "Eres el redactor y maquetador de los informes trimestrales para inversores de Impar Capital.",
  "PROYECTO: Santa Engracia 84 (SE84), tipo A.",
  "== FORMATO DE informe.json Y CATÁLOGO DE LAYOUTS ==\n…",
  '== TAREA ==\nActualiza al Q3 2026 el slide "obra-1" del informe Q2 2026.',
  "== REGLAS DE SALIDA ==\n…",
].join("\n\n");

test("trocearPrompt separa la parte estable de la tarea y solo cachea la primera", () => {
  const trozos = trocearPrompt(PROMPT_SLIDE);
  assert.equal(trozos.length, 2);
  assert.equal(trozos[0]!.cachear, true);
  assert.ok(trozos[0]!.texto.endsWith("…"));
  assert.ok(trozos[1]!.texto.startsWith("== TAREA =="));
  assert.equal(trozos[0]!.texto + "\n\n" + trozos[1]!.texto, PROMPT_SLIDE);
});

test("trocearPrompt deja entero un prompt sin tarea", () => {
  const trozos = trocearPrompt("Revisa la coherencia de este informe…");
  assert.deepEqual(trozos, [{ texto: "Revisa la coherencia de este informe…", cachear: false }]);
});

test("tipoDePrompt reconoce las peticiones de la app", () => {
  assert.equal(tipoDePrompt("Eres el asistente de reporting de Impar Capital. Analiza…"), "analisis");
  assert.equal(tipoDePrompt("Revisa la coherencia de este informe"), "coherencia");
  assert.equal(tipoDePrompt(PROMPT_SLIDE), "slide");
  assert.equal(
    tipoDePrompt(PROMPT_SLIDE.replace("Actualiza al Q3 2026", 'Redacta el slide "resumen-ejecutivo"')),
    "resumen",
  );
  assert.equal(
    tipoDePrompt(PROMPT_SLIDE.replace("Actualiza al Q3 2026", 'El slide "obra-1" DESBORDA')),
    "ajuste",
  );
  assert.equal(
    tipoDePrompt(PROMPT_SLIDE.replace("Actualiza al Q3 2026", "Aplica esta corrección del equipo")),
    "correccion",
  );
  assert.equal(tipoDePrompt("Otra cosa"), "otra");
});

test("extraerJson lee JSON limpio, en bloque de código o con texto alrededor", () => {
  assert.deepEqual(extraerJson('{"a":1}'), { a: 1 });
  assert.deepEqual(extraerJson('```json\n{"a":[1,2]}\n```'), { a: [1, 2] });
  assert.deepEqual(extraerJson('Aquí va:\n[{"slide":"x"}]\nListo.'), [{ slide: "x" }]);
  assert.throws(() => extraerJson("no hay json"), JsonNoValidoError);
});

test("costeUsd aplica la tarifa de Opus 5.5 con caché", () => {
  const coste = costeUsd("claude-opus-5-5", {
    inputTokens: 10_000,
    outputTokens: 2_000,
    cacheCreationTokens: 6_000,
    cacheReadTokens: 0,
  });
  // 10k×4 + 2k×20 + 6k×5 = 40 000 + 40 000 + 30 000 → 0,11 $
  assert.equal(coste, 0.11);
  const conCache = costeUsd("claude-opus-5-5", {
    inputTokens: 10_000,
    outputTokens: 2_000,
    cacheCreationTokens: 0,
    cacheReadTokens: 6_000,
  });
  assert.equal(conCache, 0.0812);
});

test("esfuerzoDesdeEnv solo acepta niveles válidos", () => {
  assert.equal(esfuerzoDesdeEnv("medium"), "medium");
  assert.equal(esfuerzoDesdeEnv("turbo"), "high");
  assert.equal(esfuerzoDesdeEnv(undefined), "high");
});
