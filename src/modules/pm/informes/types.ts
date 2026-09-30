import type { InformeJson, Pie, SlideJson, MetaInforme } from "./slides/tipos";

/**
 * Informes trimestrales para inversores (src/modules/pm/informes).
 * Tablas en la migración 043; el informe en sí va en `contenido` con el
 * formato informe.json del skill (slides/tipos.ts).
 */

export type EstadoInforme = "datos" | "fuentes" | "analizado" | "generando" | "borrador" | "aprobado";
export type Arquetipo = "A" | "B" | "C" | "D" | "E";

export const ARQUETIPOS: { valor: Arquetipo; etiqueta: string }[] = [
  { valor: "A", etiqueta: "A · Hospitality / apartamentos" },
  { valor: "B", etiqueta: "B · Branded residences" },
  { valor: "C", etiqueta: "C · Mixto residencial + hotelero" },
  { valor: "D", etiqueta: "D · Value-add residencial" },
  { valor: "E", etiqueta: "E · Cartera / multi-activo" },
];

/** Proyecto para el paso 0: configurado para informe o activo PM todavía sin configurar. */
export interface ProyectoInforme {
  codigo: string;
  idActivo: string | null;
  nombre: string;
  arquetipo: Arquetipo | null;
  pie: Pie | null;
  /** false = activo de pm_activos sin fila en informe_proyecto: hay que pedir arquetipo y pie. */
  configurado: boolean;
}

export interface InformeResumen {
  id: string;
  codigo: string;
  proyecto: string;
  idActivo: string | null;
  trimestre: string;
  estado: EstadoInforme;
  version: number;
  actualizado: string;
}

export type BaseInforme =
  | { tipo: "estructurado"; id: string }
  | { tipo: "texto"; nombre: string }
  | { tipo: "ninguno" };

export type AccionEstructura = "mantener" | "actualizar" | "ocultar" | "nueva";

export interface EntradaEstructura {
  id: string;
  titulo: string;
  accion: AccionEstructura;
  motivo: string;
}

export interface Hecho {
  tipo: string;
  texto: string;
  fecha?: string;
  modulo?: string;
  fuente?: string;
}

export interface Analisis {
  resumen: string[];
  objetivosPrevios: { objetivo: string; estado: string; evidencia?: string }[];
  hechos: Hecho[];
  estructura: EntradaEstructura[];
  sugeridas: number[];
  faltan: string[];
  contradicciones: string[];
}

export interface Seleccion {
  estructura: EntradaEstructura[];
  anadir: number[];
}

export interface IncidenciaCoherencia {
  slide: string;
  problema: string;
  sugerencia?: string;
}

export interface QaInforme {
  coherencia: IncidenciaCoherencia[];
  fecha: string;
}

export interface Informe {
  id: string;
  codigo: string;
  proyecto: ProyectoInforme;
  trimestre: string;
  trimestreAnterior: string;
  siguiente: string;
  estado: EstadoInforme;
  version: number;
  base: BaseInforme | null;
  analisis: Analisis | null;
  seleccion: Seleccion | null;
  contenido: InformeJson | null;
  qa: QaInforme | null;
  actualizado: string;
}

export type TipoFuente = "notas" | "documento" | "actas" | "planificacion" | "previo" | "correccion";

export interface Fuente {
  id: number;
  tipo: TipoFuente;
  nombre: string;
  texto: string;
  auto: boolean;
  orden: number;
  incluida: boolean;
  actualizado: string;
}

export const CATEGORIAS_FOTO = ["Obra", "Portada", "Render", "Página de Finanzas", "Otra"] as const;
export type CategoriaFoto = (typeof CATEGORIAS_FOTO)[number];

/** Slides bloqueadas que pueden llevar una página aportada por Finanzas. */
export const PARA_FINANZAS: { id: string; etiqueta: string }[] = [
  { id: "resumen-financiero", etiqueta: "Resumen financiero" },
  { id: "varianzas", etiqueta: "Análisis de varianzas" },
  { id: "seguimiento-economico-obra", etiqueta: "Seguimiento económico de obra" },
];

export interface Foto {
  id: string;
  categoria: CategoriaFoto;
  para: string | null;
  pie: string | null;
  nombre: string | null;
  ancho: number | null;
  alto: number | null;
}

export interface Cambio {
  id: number;
  texto: string;
  fecha: string;
  autor: string | null;
}

export interface VersionGuardada {
  version: number;
  estado: string;
  fecha: string;
}

/** Informe anterior en estructurado (el del trimestre previo guardado en el portal). */
export interface PrevioEstructurado {
  id: string;
  version: number;
  meta: MetaInforme;
  slides: SlideJson[];
}

/** Tipo de petición a Claude, para desglosar el coste en informe_uso. */
export type TipoPeticionClaude = "analisis" | "slide" | "ajuste" | "resumen" | "correccion" | "coherencia";

/** Códigos de error de las peticiones a Claude que entiende la herramienta. */
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
  | "not_found"
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

export interface ResumenUso {
  peticiones: number;
  costeUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/** Fuente automática del paso 2 (actas y planificación del portal). */
export interface FuenteAutomatica {
  tipo: "actas" | "planificacion";
  nombre: string;
  texto: string;
}

export interface FuentesAutomaticasResultado {
  documentos: FuenteAutomatica[];
  avisos: string[];
}

/** Resultado de las acciones de servidor del módulo. */
export type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
