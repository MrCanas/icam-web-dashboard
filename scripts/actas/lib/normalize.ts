/** Normalización para comparar títulos Monday ↔ catálogo maestro. */

const GROUP_ALIASES: Record<string, string> = {
  "FICC - SOCIETARIO": "SOCIETARIO",
  "FICC-SOCIETARIO": "SOCIETARIO",
  "SITACIÓN FINANCIERA": "SITUACIÓN FINANCIERA",
  "SOLAR ALFONSO XIII": "ACTIVO ACCESORIO VINCULADO",
  MARRIOTT: "OPERADOR HOTELERO",
  "SMAC Iman": "Procedimientos judiciales",
};

const ELEMENT_ALIASES: Record<string, string> = {
  "Tramitación licencia": "Tramitación de licencias",
  "Proyecto de Arquitectura": "Proyecto Arquitectura",
  "Licitación de Obra": "Licitación de obra",
  "Inicio actuaciones previas": "Trabajos previos",
  "Planificación": "Planificación",
  "Contrataciones": "Contrataciones",
  "Control Medioambiental (CM)": "Control Medioambiental (CM)",
  "Comunidad de propietarios": "Comunidad de Propietarios",
  "Inquilino existente": "Inquilino existente",
  "Operador (técnico)": "Operador (técnico)",
  "Situación de rentas": "Situación de rentas",
  "Procedimientos judiciales": "Procedimientos judiciales",
};

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

export function normalizeKey(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .trim();
}

const MATCH_STOPWORDS = /\b(de|del|la|las|el|los|y|e)\b/giu;

/** Normalización agresiva para el paso `normalized` del matcher de elementos. */
export function normalizeForMatch(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s|]/gu, " ")
    .replace(MATCH_STOPWORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveGroupAlias(title: string): string {
  const trimmed = title.trim();
  return GROUP_ALIASES[trimmed] ?? GROUP_ALIASES[normalizeKey(trimmed)] ?? trimmed;
}

export function resolveElementAlias(name: string): string {
  const trimmed = name.trim();
  return ELEMENT_ALIASES[trimmed] ?? ELEMENT_ALIASES[normalizeKey(trimmed)] ?? trimmed;
}

export function isOwnerColumn(title: string, type: string): boolean {
  const t = normalizeKey(title);
  return type === "people" && (t === "owner" || t.includes("owner") || t === "responsable");
}
