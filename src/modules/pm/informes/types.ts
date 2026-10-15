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
  /** Lo que Claude ha dejado fuera por «No reportar». Solo para el equipo: no va a los prompts de slide. */
  omitidos?: string[];
  /**
   * Hitos del cronograma del informe anterior que el informe nuevo tiene que
   * conservar (logic/cronograma.ts). Con previo estructurado salen de sus
   * Timeline; con previo en PDF/PPTX los extrae Claude. El equipo los edita en
   * el paso 3: esta lista, si existe, es la que manda.
   */
  hitosPrevios?: HitoCronograma[];
  /** Comentarios del equipo por elemento (logic/analisis.ts: «resumen.3», «estructura.calendario», «general»…). */
  comentarios?: Record<string, string>;
  /** Cómo atendió Claude cada comentario en la última revisión (misma clave). */
  respuestas?: Record<string, string>;
  /** Claves de lo que el equipo ha editado a mano: en la revisión se respeta tal cual. */
  editados?: string[];
  /** Ronda de análisis (1 = el primero) y cuándo se hizo: las fuentes posteriores son «nuevas». */
  ronda?: number;
  fecha?: string;
}

export interface HitoCronograma {
  titulo: string;
  /** MM/AA, como Timeline. */
  fecha: string;
  hecho: boolean;
  /** Slide del informe anterior en la que estaba (para reponerlo en su sitio). */
  slide?: string;
}

export interface Seleccion {
  estructura: EntradaEstructura[];
  anadir: number[];
  /**
   * Fuentes dirigidas a slides concretas (logic/dirigidas.ts): id de la fuente →
   * slides a las que va y en cuáles ya se ha aplicado. Sin entrada, la fuente es
   * información general del trimestre.
   */
  dirigidas?: Record<string, { slides: string[]; aplicadas: string[] }>;
}

export interface IncidenciaCoherencia {
  slide: string;
  problema: string;
  sugerencia?: string;
  /** Desde que se pueden comentar y aplicar; las antiguas no lo tienen (logic/coherencia.ts lo pone al leer). */
  id?: string;
  estado?: "pendiente" | "aplicado" | "descartado";
  /** Lo que el equipo añade al aviso antes de aplicarlo. */
  comentario?: string;
  /** Otras slides afectadas por el mismo problema. */
  slides?: string[];
  /** De dónde viene: la revisión de coherencia, el aviso de una corrección o la comprobación del cronograma. */
  origen?: "coherencia" | "correccion" | "cronograma";
}

export interface QaInforme {
  coherencia: IncidenciaCoherencia[];
  fecha: string;
  /** Comentario general del equipo sobre la presentación, pendiente de aplicar. */
  comentarioGeneral?: string;
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

/** «no_reportar» no es material para redactar: es lo que el equipo pide dejar fuera del informe. */
export type TipoFuente = "notas" | "documento" | "actas" | "planificacion" | "previo" | "correccion" | "no_reportar";

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

/** Foto de la biblioteca del proyecto: cualquiera subida en alguno de sus informes. */
export interface FotoBiblioteca extends Foto {
  /** Informe en el que se subió; null si ese informe ya no existe. */
  informeId: string | null;
  trimestre: string | null;
  creada: string;
}

/** Lo que el validador señala antes de exportar: lo mismo que la revisión del editor, con una explicación. */
export interface IncidenciaExportacion {
  nivel: "error" | "aviso";
  slide: string;
  texto: string;
}

/** 'pdf': descarga hecha en el servidor · 'impresion': diálogo de impresión del navegador. */
export type MedioExportacion = "pdf" | "impresion";

/** Una exportación del informe: quién, cuándo, cómo y si tuvo que marcar «Estoy seguro». */
export interface Exportacion {
  id: number;
  fecha: string;
  usuario: string;
  email: string;
  medio: MedioExportacion;
  version: number;
  estado: string;
  incidencias: IncidenciaExportacion[];
  confirmado: boolean;
}

export interface Cambio {
  id: number;
  texto: string;
  fecha: string;
  autor: string | null;
}

/** Una revisión con Claude o una operación de estructura (desdoblar, fusionar…): lo que había y lo que quedó. */
export interface RevisionInforme {
  id: number;
  tipo: TipoRevision;
  instruccion: string;
  resumen: string;
  /** Slides afectadas antes y después (por id). */
  antes: SlideJson[];
  despues: SlideJson[];
  /** Orden de ids visible antes de la revisión, para deshacer altas y bajas. */
  ordenAntes: string[];
  fecha: string;
  autor: string | null;
  deshecha: boolean;
}

export type TipoRevision = "instruccion" | "correccion" | "coherencia" | "desdoblar" | "fusionar" | "duplicar" | "nueva" | "analisis";

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

/** Informe del portal que puede hacer de informe anterior: mismo proyecto, trimestre previo y con slides. */
export interface PrevioCandidato {
  id: string;
  trimestre: string;
  estado: EstadoInforme;
  version: number;
  slides: number;
  actualizado: string;
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
  | "invalid_key"
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

export type TipoFuenteAuto = FuenteAutomatica["tipo"];

export interface FuentesAutomaticasResultado {
  documentos: FuenteAutomatica[];
  avisos: string[];
}

/** Resultado de las acciones de servidor del módulo. */
export type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
