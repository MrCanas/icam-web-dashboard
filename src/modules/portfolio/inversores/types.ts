/**
 * Tipos del área Inversores.
 *
 * Dos familias que conviene no mezclar:
 *
 *   · `Inv*Row` — la fila tal y como sale de Supabase, en snake_case y con los
 *     nulos que trae Zoho. Solo las tocan `data/` y el sync.
 *   · el resto — el modelo que consume la UI, ya agregado y sin nulos
 *     sorpresa. Lo construye `logic/inversoresModel.ts`.
 *
 * Escritos a mano: el repo no genera tipos desde Supabase.
 */

// ---------------------------------------------------------------------------
// Filas espejo
// ---------------------------------------------------------------------------

/** Metadatos de sincronización que comparten las seis tablas espejo. */
export interface InvFilaSync {
  sync_id: string | null;
  sincronizado_at: string;
  borrado_at: string | null;
}

export interface InvCuentaRow extends InvFilaSync {
  zoho_id: string;
  nombre: string;
  codigo: string | null;
  estado: string | null;
  tipo: string | null;
  fecha_alta: string | null;
  capital_comprometido: number | null;
  moneda: string;
  propietario_zoho_id: string | null;
  propietario_nombre: string | null;
  zoho_modified_at: string | null;
}

export interface InvContactoRow extends InvFilaSync {
  zoho_id: string;
  nombre: string | null;
  apellidos: string | null;
  nombre_completo: string;
  email: string | null;
  email_secundario: string | null;
  telefono: string | null;
  zoho_modified_at: string | null;
}

export interface InvCuentaContactoRow extends InvFilaSync {
  zoho_id: string;
  cuenta_zoho_id: string | null;
  cuenta_nombre: string | null;
  contacto_zoho_id: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  rol: string | null;
  participacion: number | null;
  zoho_modified_at: string | null;
}

export interface InvPromocionRow extends InvFilaSync {
  zoho_id: string;
  codigo: string | null;
  nombre: string;
  situacion: string | null;
  tipologia: string | null;
  zoho_modified_at: string | null;
}

export interface InvCuentaPromocionRow extends InvFilaSync {
  zoho_id: string;
  cuenta_zoho_id: string | null;
  cuenta_nombre: string | null;
  promocion_zoho_id: string | null;
  promocion_nombre: string | null;
  importe_comprometido: number | null;
  importe_aportado: number | null;
  participacion: number | null;
  fecha: string | null;
  zoho_modified_at: string | null;
}

export type TipoFlujo = "aporte" | "reparto" | "desconocido";

export interface InvFlujoRow extends InvFilaSync {
  zoho_id: string;
  cuenta_zoho_id: string | null;
  promocion_zoho_id: string | null;
  tipo: TipoFlujo;
  tipo_zoho: string | null;
  importe: number;
  moneda: string;
  fecha: string | null;
  concepto: string | null;
  zoho_modified_at: string | null;
}

// ---------------------------------------------------------------------------
// Catálogo de mapeo
// ---------------------------------------------------------------------------

export type TipoColumna =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "email"
  | "bool"
  | "picklist"
  /** Lookup de Zoho: en v8 llega como `{ id, name }` y aquí se guarda el `id`. */
  | "lookup_id"
  /** El mismo lookup, pero guardando el `name`. */
  | "lookup_nombre";

export interface InvCampoCatalogoRow {
  modulo: string;
  destino: string;
  zoho_api_name: string | null;
  zoho_label: string | null;
  zoho_data_type: string | null;
  tipo: TipoColumna;
  obligatorio: boolean;
  notas: Record<string, unknown> | null;
  confirmado_por: string | null;
  confirmado_at: string | null;
}

// ---------------------------------------------------------------------------
// Log de sincronización
// ---------------------------------------------------------------------------

export type EstadoSync = "en_curso" | "ok" | "parcial" | "error";
export type OrigenSync = "cron" | "manual" | "script";

export interface InvSyncModuloDetalle {
  modulo: string;
  tabla: string;
  leidos: number;
  escritos: number;
  lapidas: number;
  /** Enlaces cuyo padre no está en el espejo. Si no baja, hay algo que mirar. */
  huerfanos: number;
  ms: number;
  error: string | null;
}

export interface InvSyncLogRow {
  id: string;
  iniciado_at: string;
  terminado_at: string | null;
  duracion_ms: number | null;
  origen: OrigenSync;
  estado: EstadoSync;
  disparado_por: string | null;
  disparado_por_email: string | null;
  modulos: InvSyncModuloDetalle[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Modelo de pantalla
// ---------------------------------------------------------------------------

export interface ContactoInversor {
  zohoId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: string | null;
  /** Tanto por uno, no porcentaje: `fmtPct` ya multiplica. */
  participacion: number | null;
}

export interface PromocionDeCuenta {
  zohoId: string;
  nombre: string;
  situacion: string | null;
  comprometido: number | null;
  aportado: number;
  repartido: number;
}

export interface CuentaInversion {
  zohoId: string;
  nombre: string;
  codigo: string | null;
  estado: string | null;
  tipo: string | null;
  fechaAlta: string | null;
  /** Lo firmado. Si Zoho no lo trae, se deriva de los enlaces con promociones. */
  comprometido: number | null;
  aportado: number;
  repartido: number;
  /** aportado − repartido: cuánto sigue puesto. */
  neto: number;
  contactos: ContactoInversor[];
  promociones: PromocionDeCuenta[];
}

export interface KpisInversores {
  comprometido: number;
  aportado: number;
  repartido: number;
  /** comprometido − aportado. Nunca negativo: se recorta a 0. */
  pendiente: number;
  /** repartido ÷ aportado. `null` si no hay aportado. */
  dpi: number | null;
  numCuentas: number;
  numInversores: number;
  numPromociones: number;
}

export interface PuntoPromocion {
  zohoId: string;
  nombre: string;
  aportado: number;
  pendiente: number;
  comprometido: number;
  numCuentas: number;
}

export interface PuntoTrimestre {
  /** `2026-T1`, ordenable como texto. */
  periodo: string;
  aportes: number;
  /** Negativo, para pintarlo hacia abajo en una barra divergente. */
  repartos: number;
  netoAcumulado: number;
  numCuentas: number;
  /**
   * Cuentas con algún flujo en el trimestre. Va resuelto desde el servidor para
   * que el drill-down no necesite los flujos crudos en el navegador.
   */
  cuentaIds: string[];
}

export interface TramoInversion {
  /** `250k-500k`, estable para usar de key. */
  id: string;
  etiqueta: string;
  desde: number;
  hasta: number | null;
  numCuentas: number;
  total: number;
}

export interface EstadoSincronizacion {
  ultimoOk: string | null;
  ultimo: InvSyncLogRow | null;
}

export interface ModeloInversores {
  cuentas: CuentaInversion[];
  kpis: KpisInversores;
  porPromocion: PuntoPromocion[];
  porTrimestre: PuntoTrimestre[];
  tramos: TramoInversion[];
  topCuentas: CuentaInversion[];
}
