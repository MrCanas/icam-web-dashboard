import type { TipoColumna } from "@/modules/portfolio/inversores/types";

/**
 * La FORMA del espejo: qué módulo de Zoho va a qué tabla y qué columnas tiene.
 *
 * La frontera con `inv_campo_catalogo` es deliberada:
 *
 *   · la FORMA es código — qué columnas existen, de qué tipo son y cuáles son
 *     imprescindibles. Eso es contrato de datos y cambiarlo es una migración.
 *   · la RESOLUCIÓN es dato — a qué `api_name` de Zoho corresponde cada
 *     columna. Eso lo decide el CRM y puede cambiar sin avisarnos.
 *
 * `pistas` solo sirve para PROPONER la resolución en
 * `scripts/inversores/zoho-descubrir.ts`. Nunca se usa en ejecución: una
 * heurística que acierta el 90 % escribe NULLs silenciosos en el 10 % restante.
 * La heurística propone, una persona confirma, la tabla recuerda.
 */

export interface ColumnaEspejo {
  columna: string;
  tipo: TipoColumna;
  /** Si no se resuelve, el sync no arranca. */
  obligatorio: boolean;
  /** Pistas para la propuesta automática, contra `field_label` y `api_name`. */
  pistas: RegExp[];
}

export interface EspejoZoho {
  moduloZoho: string;
  tabla: string;
  columnas: ColumnaEspejo[];
  /**
   * Espejo que puede no hacer falta. `Contacts` solo se baja si el módulo de
   * enlace no trae ya el correo; lo decide `validarMapeo`, no esta constante.
   */
  condicional?: boolean;
}

const RE = {
  nombre: [/^name$/i, /nombre/i, /denominaci/i],
  codigo: [/c[oó]digo/i, /^code$/i, /referencia/i],
  estado: [/estado|situaci[oó]n|status|stage/i],
  tipo: [/tipo|clase|categor/i],
  fecha: [/fecha|date/i],
  importe: [/importe|capital|cantidad|amount|euros?/i],
  email: [/email|correo|e-?mail/i],
  telefono: [/tel[eé]fono|phone|m[oó]vil/i],
  participacion: [/participaci|porcentaje|%|share|pct/i],
  cuenta: [/cuenta|inversi[oó]n|account/i],
  contacto: [/contacto|contact/i],
  promocion: [/promoci[oó]n|promotion|proyecto/i],
  concepto: [/concepto|descripci|detalle|observ/i],
} as const;

export const ESPEJOS: readonly EspejoZoho[] = [
  {
    moduloZoho: "Promociones",
    tabla: "inv_promociones",
    columnas: [
      { columna: "codigo", tipo: "text", obligatorio: false, pistas: [...RE.codigo] },
      { columna: "nombre", tipo: "text", obligatorio: true, pistas: [...RE.nombre] },
      { columna: "situacion", tipo: "picklist", obligatorio: false, pistas: [...RE.estado] },
      { columna: "tipologia", tipo: "picklist", obligatorio: false, pistas: [/tipolog/i, ...RE.tipo] },
    ],
  },
  {
    moduloZoho: "Cuentas_de_Inversi_n",
    tabla: "inv_cuentas",
    columnas: [
      { columna: "nombre", tipo: "text", obligatorio: true, pistas: [...RE.nombre] },
      { columna: "codigo", tipo: "text", obligatorio: false, pistas: [...RE.codigo] },
      { columna: "estado", tipo: "picklist", obligatorio: false, pistas: [...RE.estado] },
      { columna: "tipo", tipo: "picklist", obligatorio: false, pistas: [/tipo de cuenta|veh[ií]culo/i, ...RE.tipo] },
      { columna: "fecha_alta", tipo: "date", obligatorio: false, pistas: [/alta|constituci|apertura/i, ...RE.fecha] },
      {
        columna: "capital_comprometido",
        tipo: "number",
        obligatorio: false,
        pistas: [/comprometid|suscrito|compromiso/i, ...RE.importe],
      },
      { columna: "moneda", tipo: "picklist", obligatorio: false, pistas: [/moneda|divisa|currency/i] },
    ],
  },
  {
    // Solo si el enlace no trae ya el correo. Ver `validarMapeo`.
    moduloZoho: "Contacts",
    tabla: "inv_contactos",
    condicional: true,
    columnas: [
      { columna: "nombre", tipo: "text", obligatorio: false, pistas: [/^first_?name$/i, /nombre/i] },
      { columna: "apellidos", tipo: "text", obligatorio: false, pistas: [/^last_?name$/i, /apellido/i] },
      { columna: "nombre_completo", tipo: "text", obligatorio: true, pistas: [/^full_?name$/i, ...RE.nombre] },
      { columna: "email", tipo: "email", obligatorio: true, pistas: [...RE.email] },
      { columna: "email_secundario", tipo: "email", obligatorio: false, pistas: [/secondary|secundario/i] },
      { columna: "telefono", tipo: "text", obligatorio: false, pistas: [...RE.telefono] },
    ],
  },
  {
    moduloZoho: "Inversi_n_vs_Contactos",
    tabla: "inv_cuenta_contacto",
    columnas: [
      { columna: "cuenta_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [...RE.cuenta] },
      { columna: "cuenta_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [...RE.cuenta] },
      { columna: "contacto_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [...RE.contacto] },
      { columna: "contacto_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [...RE.contacto] },
      { columna: "contacto_email", tipo: "email", obligatorio: false, pistas: [...RE.email] },
      { columna: "contacto_telefono", tipo: "text", obligatorio: false, pistas: [...RE.telefono] },
      { columna: "rol", tipo: "picklist", obligatorio: false, pistas: [/rol|papel|relaci[oó]n|titular/i] },
      { columna: "participacion", tipo: "number", obligatorio: false, pistas: [...RE.participacion] },
    ],
  },
  {
    moduloZoho: "Inversi_n_vs_Promoci_n",
    tabla: "inv_cuenta_promocion",
    columnas: [
      { columna: "cuenta_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [...RE.cuenta] },
      { columna: "cuenta_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [...RE.cuenta] },
      { columna: "promocion_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [...RE.promocion] },
      { columna: "promocion_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [...RE.promocion] },
      {
        columna: "importe_comprometido",
        tipo: "number",
        obligatorio: false,
        pistas: [/comprometid|suscrito|compromiso/i, ...RE.importe],
      },
      {
        columna: "importe_aportado",
        tipo: "number",
        obligatorio: false,
        pistas: [/aportad|desembolsad|invertid/i, ...RE.importe],
      },
      { columna: "participacion", tipo: "number", obligatorio: false, pistas: [...RE.participacion] },
      { columna: "fecha", tipo: "date", obligatorio: false, pistas: [...RE.fecha] },
    ],
  },
  {
    moduloZoho: "Aportes_Repartos",
    tabla: "inv_flujos",
    columnas: [
      { columna: "cuenta_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [...RE.cuenta] },
      { columna: "promocion_zoho_id", tipo: "lookup_id", obligatorio: false, pistas: [...RE.promocion] },
      {
        columna: "tipo_zoho",
        tipo: "picklist",
        obligatorio: true,
        pistas: [/tipo de (movimiento|operaci)|aporte|reparto|naturaleza/i, ...RE.tipo],
      },
      { columna: "importe", tipo: "number", obligatorio: true, pistas: [...RE.importe] },
      { columna: "fecha", tipo: "date", obligatorio: true, pistas: [...RE.fecha] },
      { columna: "concepto", tipo: "text", obligatorio: false, pistas: [...RE.concepto] },
    ],
  },
];

/**
 * Orden de sincronización: PADRES antes que ENLACES.
 *
 * No es una preferencia, es parte del contrato. Al revés, cualquier ejecución
 * que se corte por la mitad deja una pestaña con enlaces cuyo padre no existe,
 * y el drill-down enseñaría cuentas sin nombre.
 *
 * `Contacts` es la excepción y va DESPUÉS de su enlace, a propósito: no
 * queremos la agenda entera del CRM copiada en nuestra base, solo las personas
 * que aparecen en una cuenta de inversión, y saber cuáles son exige haber leído
 * el enlace primero. El enlace no lo echa de menos porque ya trae el id y el
 * nombre del contacto denormalizados.
 */
export const ORDEN_SYNC: readonly string[] = [
  "Promociones",
  "Cuentas_de_Inversi_n",
  "Inversi_n_vs_Contactos",
  "Contacts",
  "Inversi_n_vs_Promoci_n",
  "Aportes_Repartos",
];

export function espejoDe(moduloZoho: string): EspejoZoho | undefined {
  return ESPEJOS.find((e) => e.moduloZoho === moduloZoho);
}

/** Los espejos en el orden en el que hay que sincronizarlos. */
export function espejosEnOrden(): EspejoZoho[] {
  return ORDEN_SYNC.map((m) => espejoDe(m)).filter((e): e is EspejoZoho => e !== undefined);
}
