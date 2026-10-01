import type { SlideJson } from "../slides/tipos";
import type { TipoPeticionClaude } from "../types";
import {
  promptActualizar,
  promptAjuste,
  promptAnalisis,
  promptCoherencia,
  promptCorreccion,
  promptNueva,
  promptResumen,
  type BloquePrompt,
  type MaterialInforme,
  type MedidaAjuste,
} from "./prompts";

/**
 * Lo que el navegador pide al servidor: «redacta la slide X del informe Y».
 * El prompt se monta en el servidor con el informe, sus fuentes y las
 * referencias; del navegador solo llega lo que no está guardado todavía (el
 * slide que se ajusta o corrige, las marcas y los adjuntos).
 */
export type PeticionClaude =
  | { tipo: "analisis"; informeId: string }
  | { tipo: "slide"; informeId: string; slideId: string; modo: "actualizar" | "nueva" }
  | { tipo: "ajuste"; informeId: string; slide: SlideJson; medida: MedidaAjuste }
  | { tipo: "resumen"; informeId: string; slides: SlideJson[] }
  | {
      tipo: "correccion";
      informeId: string;
      slide: SlideJson;
      instruccion: string;
      marcas?: string;
      adjuntos?: string;
    }
  | { tipo: "coherencia"; informeId: string; slides: SlideJson[] };

const TIPOS: TipoPeticionClaude[] = ["analisis", "slide", "ajuste", "resumen", "correccion", "coherencia"];

function esSlide(v: unknown): v is SlideJson {
  return !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as SlideJson).id === "string";
}

/** Valida el cuerpo de la petición. Devuelve el error como texto si no vale. */
export function leerPeticion(raw: unknown): PeticionClaude | string {
  if (!raw || typeof raw !== "object") return "Cuerpo no válido";
  const b = raw as Record<string, unknown>;
  const tipo = b.tipo as TipoPeticionClaude;
  if (!TIPOS.includes(tipo)) return "Tipo de petición no válido";
  if (typeof b.informeId !== "string") return "Falta el informe";
  const informeId = b.informeId;
  switch (tipo) {
    case "analisis":
      return { tipo, informeId };
    case "slide":
      if (typeof b.slideId !== "string" || !b.slideId) return "Falta el slide";
      return { tipo, informeId, slideId: b.slideId, modo: b.modo === "actualizar" ? "actualizar" : "nueva" };
    case "ajuste": {
      const m = b.medida as MedidaAjuste | undefined;
      if (!esSlide(b.slide) || !m || typeof m.desborde !== "boolean") return "Falta el slide o su medida";
      return { tipo, informeId, slide: b.slide, medida: { desborde: m.desborde, ocupacion: m.ocupacion ?? null, relleno: m.relleno ?? null } };
    }
    case "resumen":
    case "coherencia":
      if (!Array.isArray(b.slides) || !b.slides.every(esSlide)) return "Faltan las slides";
      return { tipo, informeId, slides: b.slides as SlideJson[] };
    case "correccion":
      if (!esSlide(b.slide) || typeof b.instruccion !== "string" || !b.instruccion.trim()) return "Falta el slide o la instrucción";
      return {
        tipo,
        informeId,
        slide: b.slide,
        instruccion: b.instruccion.slice(0, 8000),
        marcas: typeof b.marcas === "string" ? b.marcas.slice(0, 20_000) : undefined,
        adjuntos: typeof b.adjuntos === "string" ? b.adjuntos : undefined,
      };
  }
}

/** Monta el prompt de una petición. Error (texto) si falta algo del informe. */
export function montarPrompt(p: PeticionClaude, m: MaterialInforme): BloquePrompt[] | string {
  switch (p.tipo) {
    case "analisis":
      return promptAnalisis(m);
    case "slide": {
      if (p.modo === "actualizar") {
        const prev = m.previo?.slides.find((s) => s.id === p.slideId);
        if (prev) return promptActualizar(m, prev);
      }
      return promptNueva(m, p.slideId);
    }
    case "ajuste":
      return promptAjuste(m, p.slide, p.medida);
    case "resumen":
      return promptResumen(m, p.slides, m.previo?.slides.find((s) => s.id === "resumen-ejecutivo") ?? null);
    case "correccion":
      return promptCorreccion(m, p.slide, p.instruccion, { marcas: p.marcas, adjuntos: p.adjuntos });
    case "coherencia":
      return promptCoherencia(m.informe, p.slides, m.fuentes);
  }
}
