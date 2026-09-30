/**
 * Informes trimestrales para inversores.
 *
 * La app del informe (public/informes-app, generada desde el repo del motor de
 * informes) es la dueña de la forma de sus documentos y la comparte con el
 * artifact de claude.ai. El portal solo los guarda y los sirve: por eso aquí
 * se tipan como `DocumentoApp` (jsonb opaco) y solo se extraen los campos por
 * los que se lista o se filtra.
 */

/** Documento tal y como lo escribe la app. */
export type DocumentoApp = Record<string, unknown>;

/** Colecciones que usa la app (mismos nombres que en el artifact). */
export type ColeccionInforme = "proyectos" | "informes" | "fuentes" | "versiones";

export interface DocumentoConId {
  id: string;
  datos: DocumentoApp;
}

/** Tipo de petición a Claude, para desglosar el coste en informe_uso. */
export type TipoPeticionClaude =
  | "analisis"
  | "slide"
  | "ajuste"
  | "resumen"
  | "correccion"
  | "coherencia"
  | "otra";

/** Códigos de error que entiende la app (los mismos que devolvía `sample`). */
export type CodigoErrorClaude =
  | "not_granted"
  | "rate_limited"
  | "prompt_too_large"
  | "invalid_json"
  | "cancelled"
  | "session_expired"
  | "refused"
  | "max_tokens"
  | "not_configured"
  | "api_error";

export interface UsoClaude {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface RegistroUso extends UsoClaude {
  informeId: string | null;
  tipo: TipoPeticionClaude;
  modelo: string;
  costeUsd: number;
  stopReason: string | null;
  duracionMs: number;
}

/** Fuente automática que el portal aporta al paso 2 de la app. */
export interface FuenteAutomatica {
  /** Clave estable: la app sustituye la fuente con la misma clave al recargar. */
  clave: "actas" | "planificacion";
  nombre: string;
  texto: string;
  auto: true;
}

export interface FuentesAutomaticasResultado {
  documentos: FuenteAutomatica[];
  /** Avisos para la PM (p. ej. «el proyecto no tiene actas vinculadas»). */
  avisos: string[];
}
