import assert from "node:assert/strict";
import { test } from "node:test";

import { esTipoFuenteNoAdmitido, mensajeErrorBd, MENSAJE_SIN_MIGRACION_044 } from "@/modules/pm/informes/logic/errores";
import { montarPrompt, type PeticionClaude } from "@/modules/pm/informes/logic/peticiones";
import { bloqueNoReportar, fuentesTexto, noReportarTexto, type BloquePrompt, type MaterialInforme } from "@/modules/pm/informes/logic/prompts";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";
import type { Fuente } from "@/modules/pm/informes/types";

const RESTRICCION = "No mencionar la negociación con el operador Alfa";

function fuente(tipo: Fuente["tipo"], nombre: string, texto: string, extra: Partial<Fuente> = {}): Fuente {
  return { id: 1, tipo, nombre, texto, auto: false, orden: 100, incluida: true, actualizado: "", ...extra };
}

const slide: SlideJson = { id: "calendario", c: "DosColumnas", props: { titulo: "Calendario. Q2 2026" } };

function material(fuentes: Fuente[]): MaterialInforme {
  return {
    informe: { proyecto: "Santa Engracia 84", codigo: "SE84", arquetipo: "A", trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" },
    referencias: { recetas: "RECETAS", api: "API", reglas: "REGLAS" },
    biblioteca: [],
    fuentes,
    previoTexto: null,
    previo: { id: "SE84_Q2-2026", version: 1, meta: { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q2 2026" }, slides: [slide] },
    fotos: [],
    analisis: null,
  };
}

const conRestriccion = material([
  fuente("notas", "Notas del equipo", "El operador Alfa ha enviado una oferta."),
  fuente("no_reportar", "No reportar", RESTRICCION, { orden: 5 }),
]);

function bloques(p: BloquePrompt[] | string): BloquePrompt[] {
  assert.ok(Array.isArray(p), String(p));
  return p as BloquePrompt[];
}

test("«No reportar» es una instrucción, no una fuente del trimestre", () => {
  assert.equal(noReportarTexto(conRestriccion.fuentes), RESTRICCION);
  assert.ok(!fuentesTexto(conRestriccion.fuentes).includes(RESTRICCION));
  assert.ok(fuentesTexto(conRestriccion.fuentes).includes("oferta"));
  assert.match(bloqueNoReportar(conRestriccion.fuentes)!, /^== NO REPORTAR ==/);
  assert.equal(bloqueNoReportar([fuente("notas", "Notas", "algo")]), null);
  assert.equal(bloqueNoReportar([fuente("no_reportar", "No reportar", "   ")]), null);
});

test("todas las peticiones que redactan llevan «No reportar» en la tarea, sin tocar los bloques en caché", () => {
  const sin = material([fuente("notas", "Notas del equipo", "El operador Alfa ha enviado una oferta.")]);
  const peticiones: PeticionClaude[] = [
    { tipo: "slide", informeId: "SE84_Q3-2026", slideId: "calendario", modo: "actualizar" },
    { tipo: "slide", informeId: "SE84_Q3-2026", slideId: "resumen-de-proyecto", modo: "nueva" },
    { tipo: "ajuste", informeId: "SE84_Q3-2026", slide, medida: { desborde: true, ocupacion: 120, relleno: null } },
    { tipo: "resumen", informeId: "SE84_Q3-2026", slides: [slide] },
    { tipo: "correccion", informeId: "SE84_Q3-2026", slide, instruccion: "Acorta el texto" },
  ];
  for (const p of peticiones) {
    const con = bloques(montarPrompt(p, conRestriccion));
    const base = bloques(montarPrompt(p, sin));
    assert.equal(con.length, 3, p.tipo);
    assert.ok(!con[2]!.cachear && con[2]!.texto.includes(RESTRICCION), `${p.tipo}: falta en la tarea`);
    // Los dos bloques en caché no cambian al añadir o editar la restricción.
    assert.equal(con[0]!.texto, base[0]!.texto, p.tipo);
    assert.equal(con[1]!.texto, base[1]!.texto, p.tipo);
    assert.ok(!base[2]!.texto.includes("NO REPORTAR"), p.tipo);
  }
});

test("el análisis y la revisión de coherencia también reciben «No reportar»", () => {
  const analisis = bloques(montarPrompt({ tipo: "analisis", informeId: "SE84_Q3-2026" }, conRestriccion))[0]!.texto;
  assert.ok(analisis.includes(RESTRICCION));
  assert.ok(analisis.includes('no entra en "resumen", "hechos"'));
  // Solo se pide la lista de lo dejado fuera cuando hay indicaciones.
  assert.ok(analisis.includes('"omitidos":["…"]}'));
  const analisisSin = bloques(montarPrompt({ tipo: "analisis", informeId: "SE84_Q3-2026" }, material([])))[0]!.texto;
  assert.ok(!analisisSin.includes("omitidos") && !analisisSin.includes("NO REPORTAR"));
  const coherencia = bloques(montarPrompt({ tipo: "coherencia", informeId: "SE84_Q3-2026", slides: [slide] }, conRestriccion))[0]!.texto;
  assert.ok(coherencia.includes(RESTRICCION));
  assert.ok(coherencia.includes("Contenido que el equipo pidió no reportar"));
  const sin = bloques(montarPrompt({ tipo: "coherencia", informeId: "SE84_Q3-2026", slides: [slide] }, material([])))[0]!.texto;
  assert.ok(!sin.includes("NO REPORTAR"));
});

test("sin la migración 044, guardar «No reportar» da un mensaje que dice qué falta", () => {
  const error = { code: "23514", message: 'new row for relation "informe_fuente" violates check constraint "informe_fuente_tipo_chk"' };
  assert.ok(esTipoFuenteNoAdmitido(error));
  assert.equal(mensajeErrorBd(error), MENSAJE_SIN_MIGRACION_044);
  assert.ok(!esTipoFuenteNoAdmitido({ code: "23514", message: "otra restricción" }));
});
