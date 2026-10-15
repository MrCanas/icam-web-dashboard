import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { cerrarRonda, comentar, fuentesNuevas, leerRespuestas, marcarEditado, normalizarAnalisis } from "@/modules/pm/informes/logic/analisis";
import { parsearBiblioteca } from "@/modules/pm/informes/logic/biblioteca";
import { instruccionDeAvisos, marcar, normalizarCoherencia, nuevaRevision, resolverSlides } from "@/modules/pm/informes/logic/coherencia";
import { leerPeticion, montarPrompt, tipoUso } from "@/modules/pm/informes/logic/peticiones";
import { promptAnalisis, promptCoherencia, type MaterialInforme } from "@/modules/pm/informes/logic/prompts";
import type { Analisis, Fuente } from "@/modules/pm/informes/types";

const REF = resolve(process.cwd(), "src/modules/pm/informes/referencia");
const biblioteca = parsearBiblioteca(readFileSync(resolve(REF, "biblioteca.md"), "utf8"));

function fuente(id: number, nombre: string, actualizado: string, extra: Partial<Fuente> = {}): Fuente {
  return { id, tipo: "documento", nombre, texto: `texto de ${nombre}`, auto: false, orden: 100, incluida: true, actualizado, ...extra };
}

function material(analisis: Analisis | null, fuentes: Fuente[], previoTexto: string | null = null): MaterialInforme {
  return {
    informe: { proyecto: "Santa Engracia 84", codigo: "SE84", arquetipo: "A", trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" },
    referencias: { recetas: "RECETAS", api: "API", reglas: "REGLAS" },
    biblioteca,
    fuentes,
    previoTexto,
    previo: null,
    fotos: [],
    analisis,
  };
}

const base = (): Analisis =>
  normalizarAnalisis(
    {
      resumen: ["Se obtuvo la licencia", 7, ""],
      hechos: [{ tipo: "hito", texto: "Licencia", fecha: "07/26" }, { tipo: "x" }],
      estructura: [{ id: "calendario", titulo: "Calendario", accion: "actualizar", motivo: "" }],
      comentarios: { resumen: "no es mío" },
    },
    { previo: null, hayNoReportar: false },
  );

test("normalizar: listas que faltan, textos, hechos sin texto fuera y comentarios que no son de Claude", () => {
  const a = base();
  assert.deepEqual(a.resumen, ["Se obtuvo la licencia", "7"]);
  assert.equal(a.hechos.length, 1);
  assert.deepEqual(a.faltan, []);
  assert.equal(a.omitidos, undefined);
  assert.equal(a.comentarios, undefined);
  // Estructura obligatoria: portada, índice, resumen, disclaimer y cierre.
  assert.deepEqual(
    a.estructura.map((e) => e.id),
    ["portada", "indice", "resumen-ejecutivo", "calendario", "disclaimer", "cierre"],
  );
});

test("comentar, editar y cerrar una ronda", () => {
  let a: Analisis = { ...base(), ronda: 1, fecha: "2026-10-01T10:00:00Z" };
  a = comentar(a, "resumen.0", "Di la fecha exacta");
  a = comentar(a, "general", "  ");
  a = marcarEditado(marcarEditado(a, "hechos.0"), "hechos.0");
  assert.deepEqual(a.comentarios, { "resumen.0": "Di la fecha exacta" });
  assert.deepEqual(a.editados, ["hechos.0"]);
  const r = leerRespuestas({ respuestas: [{ clave: "resumen.0", respuesta: "Puesta: 14/07/2026" }, { nada: 1 }] });
  const b = cerrarRonda(a, base(), r, "2026-10-02T10:00:00Z");
  assert.equal(b.ronda, 2);
  assert.deepEqual(b.comentarios, {});
  assert.deepEqual(b.respuestas, { "resumen.0": "Puesta: 14/07/2026" });
  assert.deepEqual(b.editados, ["hechos.0"]);
});

test("fuentes nuevas: las aportadas o cambiadas después de la ronda", () => {
  const a = { ...base(), fecha: "2026-10-01T10:00:00Z" };
  const fs = [fuente(1, "viejo.pdf", "2026-09-30T10:00:00Z"), fuente(2, "nuevo.pdf", "2026-10-03T10:00:00Z"), fuente(3, "quitado.pdf", "2026-10-03T10:00:00Z", { incluida: false })];
  assert.deepEqual(fuentesNuevas(fs, a).map((f) => f.nombre), ["nuevo.pdf"]);
  assert.deepEqual(fuentesNuevas(fs, { ...a, fecha: undefined }), []);
});

test("la revisión del análisis lleva lo editado, los comentarios y lo nuevo", () => {
  let a: Analisis = { ...base(), ronda: 1, fecha: "2026-10-01T10:00:00Z" };
  a = comentar(marcarEditado(a, "resumen.0"), "estructura.calendario", "Mantén los hitos de 2025");
  const fs = [fuente(1, "viejo.pdf", "2026-09-30T10:00:00Z"), fuente(2, "acta-octubre.pdf", "2026-10-03T10:00:00Z")];
  const p = leerPeticion({ tipo: "analisis", informeId: "SE84_Q3-2026", modo: "revision" });
  assert.ok(typeof p !== "string");
  const bloques = montarPrompt(p, material(a, fs));
  assert.ok(typeof bloques !== "string");
  const t = bloques.map((b) => b.texto).join("\n");
  assert.match(t, /EDITADO A MANO POR EL EQUIPO[\s\S]*- resumen\.0/);
  assert.match(t, /\[estructura\.calendario\] Mantén los hitos de 2025/);
  assert.match(t, /INFORMACIÓN NUEVA DESDE LA RONDA ANTERIOR ==\n- acta-octubre\.pdf\n/);
  assert.match(t, /"respuestas"/);
  // Sin análisis no hay revisión.
  assert.equal(typeof montarPrompt(p, material(null, fs)), "string");
});

test("con informe anterior en texto, el análisis pide los hitos del cronograma", () => {
  const t = promptAnalisis(material(null, [], "Calendario: licencia 03/26…"))[0]!.texto;
  assert.match(t, /"hitosPrevios"/);
  assert.doesNotMatch(promptAnalisis(material(null, []))[0]!.texto, /hitosPrevios/);
});

test("la petición de revisión del informe se valida y su coste cuenta como corrección", () => {
  assert.equal(typeof leerPeticion({ tipo: "revision", informeId: "X", slides: [], instruccion: " " }), "string");
  const p = leerPeticion({ tipo: "revision", informeId: "X", slides: [{ id: "a" }], instruccion: "Desdobla la slide 1", ambito: ["a", 3] });
  assert.ok(typeof p !== "string" && p.tipo === "revision");
  if (typeof p !== "string" && p.tipo === "revision") assert.deepEqual(p.ambito, ["a"]);
  assert.equal(tipoUso("revision"), "correccion");
  assert.equal(tipoUso("slide"), "slide");
});

test("la coherencia numera los slides y los avisos se pueden comentar y aplicar", () => {
  const t = promptCoherencia(material(null, []).informe, [{ id: "a", c: "X", oculto: true }, { id: "b", c: "X", props: { titulo: "B" } }])[0]!.texto;
  assert.match(t, /### Slide 1 · b · B/);
  const avisos = normalizarCoherencia([{ slide: "b", problema: "Fecha distinta", sugerencia: "Pon 11/26" }, { nada: 1 }]);
  assert.equal(avisos.length, 1);
  assert.equal(avisos[0]!.estado, "pendiente");
  assert.ok(avisos[0]!.id);
  const qa = marcar({ coherencia: avisos, fecha: "" }, [avisos[0]!.id!], { comentario: "Es 12/26" });
  const instr = instruccionDeAvisos(qa.coherencia, "Tono más sobrio", () => "Slide 4");
  assert.match(instr, /\[Slide 4\] Fecha distinta/);
  assert.match(instr, /prevalece sobre la sugerencia\): Es 12\/26/);
  assert.match(instr, /Tono más sobrio/);
  // Una revisión nueva sustituye los pendientes de la anterior, pero no los avisos de correcciones.
  const conCorreccion = { coherencia: [...qa.coherencia, ...normalizarCoherencia([{ slide: "c", problema: "x" }], "correccion")], fecha: "" };
  assert.deepEqual(nuevaRevision(conCorreccion, [], "f").coherencia.map((x) => x.origen), ["correccion"]);
});

test("los avisos que citan la slide por su número se traducen a su id", () => {
  const porNumero = new Map([
    [8, "calendario"],
    [9, "kpis"],
  ]);
  const ids = new Set(["calendario", "kpis", "obra"]);
  const [a, b, c] = resolverSlides(
    normalizarCoherencia([
      { slide: "8", slides: ["9", "8", "obra"], problema: "x" },
      { slide: "Slide 9", problema: "y" },
      { slide: "obra", problema: "z" },
    ]),
    porNumero,
    ids,
  );
  assert.equal(a!.slide, "calendario");
  assert.deepEqual(a!.slides, ["kpis", "obra"]);
  assert.equal(b!.slide, "kpis");
  assert.equal(c!.slide, "obra");
});
