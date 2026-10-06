/**
 * Tipos del módulo Comunicaciones.
 *
 * Como en Inversores, dos familias: las filas `Com*Row` tal como salen de
 * Supabase (solo las tocan `data/` y las acciones) y el modelo que consume la
 * UI. Escritos a mano: el repo no genera tipos desde Supabase.
 */

// ---------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------

export const TIPOS_COMUNICACION = ["reporte", "evento", "newsletter", "oportunidad", "otro"] as const;
export type TipoComunicacion = (typeof TIPOS_COMUNICACION)[number];

export const ETIQUETA_TIPO: Record<TipoComunicacion, string> = {
  reporte: "Reporte",
  evento: "Evento",
  newsletter: "Newsletter",
  oportunidad: "Oportunidad de inversión",
  otro: "Otro",
};

export const AUDIENCIAS = ["promocion", "toda_la_base", "inversores_directos"] as const;
export type Audiencia = (typeof AUDIENCIAS)[number];

export const ETIQUETA_AUDIENCIA: Record<Audiencia, string> = {
  promocion: "Promoción o fondo",
  toda_la_base: "Toda la base",
  inversores_directos: "Inversores directos",
};

/** Las cinco casillas de papel del CRM (`inv_cuenta_contacto.es_*`). */
export const ROLES_CONTACTO = [
  "principal",
  "secundario",
  "representante_legal",
  "abogado",
  "intermediario",
] as const;
export type RolContacto = (typeof ROLES_CONTACTO)[number];

export const ETIQUETA_ROL: Record<RolContacto, string> = {
  principal: "Contacto principal",
  secundario: "Contacto secundario",
  representante_legal: "Representante legal",
  abogado: "Abogado",
  intermediario: "Intermediario",
};

export type EstadoComunicacion =
  | "borrador"
  | "revisada"
  | "probada"
  | "enviando"
  | "pausada"
  | "enviada"
  | "cancelada";

export const ETIQUETA_ESTADO: Record<EstadoComunicacion, string> = {
  borrador: "Borrador",
  revisada: "Revisada",
  probada: "Probada",
  enviando: "Enviando",
  pausada: "Pausada",
  enviada: "Enviada",
  cancelada: "Cancelada",
};

/** Estados en los que todavía se puede tocar la lista o la plantilla. */
export const ESTADOS_EDITABLES: readonly EstadoComunicacion[] = ["borrador", "revisada", "probada"];

export type EstadoEnvio = "pendiente" | "sin_destinatario" | "enviando" | "enviado" | "error";

export const AVISOS = [
  "cuenta_de_prueba",
  "direccion_interna",
  "persona_repetida",
  "sin_destinatario",
  "dado_de_baja",
  "sin_correo",
] as const;
export type Aviso = (typeof AVISOS)[number];

export const ETIQUETA_AVISO: Record<Aviso, string> = {
  cuenta_de_prueba: "Cuenta de prueba",
  direccion_interna: "Dirección interna",
  persona_repetida: "Persona en varias cuentas",
  sin_destinatario: "Sin destinatario",
  dado_de_baja: "Contacto dado de baja",
  sin_correo: "Contacto sin correo",
};

// ---------------------------------------------------------------------------
// Filas
// ---------------------------------------------------------------------------

/** Una dirección dentro de «Para» o de copia. */
export interface Direccion {
  email: string;
  nombre: string;
  contactoZohoId: string | null;
  /** Papeles por los que entra: «Principal · Abogado». */
  rol: string;
}

export interface ComAjustesRow {
  envios_activados: boolean;
  modo: "pruebas" | "real";
  cuenta_pruebas_zoho_id: string | null;
  remitentes_permitidos: string[];
  dominios_internos: string[];
}

export interface ComComunicacionRow {
  id: string;
  nombre: string;
  tipo: TipoComunicacion;
  audiencia: Audiencia;
  promocion_zoho_id: string | null;
  promocion_nombre: string | null;
  roles_para: RolContacto[];
  roles_copia: RolContacto[];
  plantilla_id: string | null;
  plantilla_nombre: string | null;
  plantilla_modulo: string | null;
  remitente_email: string | null;
  estado: EstadoComunicacion;
  datos_zoho_at: string | null;
  creada_por: string | null;
  creada_por_email: string;
  revisada_por_email: string | null;
  revisada_at: string | null;
  revisada_n: number | null;
  probada_por_email: string | null;
  probada_at: string | null;
  probada_plantilla_id: string | null;
  confirmada_por_email: string | null;
  confirmada_at: string | null;
  confirmada_n: number | null;
  enviada_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComDestinatarioRow {
  id: string;
  comunicacion_id: string;
  cuenta_zoho_id: string;
  cuenta_nombre: string;
  para: Direccion[];
  copia: Direccion[];
  avisos: Aviso[];
  excluido: boolean;
  excluido_motivo: string | null;
  excluido_por_email: string | null;
  estado_envio: EstadoEnvio;
  zoho_message_id: string | null;
  error: string | null;
  enviado_at: string | null;
  intentos: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Modelo de pantalla
// ---------------------------------------------------------------------------

/** Lo que el cálculo de destinatarios produce para cada cuenta, antes de guardarse. */
export interface DestinatarioCalculado {
  cuentaZohoId: string;
  cuentaNombre: string;
  para: Direccion[];
  copia: Direccion[];
  avisos: Aviso[];
  /** Excluido de salida: cuenta de prueba o todas sus direcciones internas. */
  excluido: boolean;
  excluidoMotivo: string | null;
}

export interface ResumenDestinatarios {
  /** Filas de la comunicación, se vayan a enviar o no. */
  total: number;
  /** Correos que saldrían: ni excluidos ni sin destinatario. */
  aEnviar: number;
  excluidos: number;
  sinDestinatario: number;
  /** Direcciones distintas en «Para» entre los que se enviarían. */
  direcciones: number;
  /** De esas, las que no son de un dominio interno. */
  direccionesExternas: number;
}

export interface ComunicacionConResumen {
  comunicacion: ComComunicacionRow;
  resumen: ResumenDestinatarios;
}

export interface OpcionPromocion {
  zohoId: string;
  nombre: string;
  codigo: string | null;
  numCuentas: number;
}

/** Lo que la pantalla «Nueva» necesita para enseñar cuántas cuentas hay en cada audiencia. */
export interface RecuentoAudiencias {
  todaLaBase: number;
  inversoresDirectos: number;
  /** Cuentas cuyo «Tiene intermediario» aún no se ha sincronizado. */
  sinDatoIntermediario: number;
  promociones: OpcionPromocion[];
}
