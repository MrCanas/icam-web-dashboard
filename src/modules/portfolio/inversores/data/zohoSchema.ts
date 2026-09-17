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
 * `scripts/inversores/zoho-descubrir.ts`. Nunca se usa en ejecución, y con
 * razón: contra el CRM real la heurística resolvió sola `participacion` →
 * «Sharepoint doc inversión vs promoción» (un campo de tipo website) porque
 * «Sharepoint» contiene «share». La heurística propone, una persona confirma,
 * la tabla recuerda.
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
}

const RE = {
  nombre: [/^name$/i, /nombre/i, /denominaci/i],
  codigo: [/c[oó]digo/i, /^code$/i, /referencia/i],
  estado: [/estado|situaci[oó]n|status|stage/i],
  tipo: [/tipo|clase|categor/i],
  fecha: [/fecha|date/i],
  importe: [/importe|monto|capital|cantidad|amount|euros?/i],
  email: [/email|correo|e-?mail/i],
  telefono: [/tel[eé]fono|phone|m[oó]vil/i],
  // Sin `share`: casaba con «Sharepoint» y resolvía la participación a un campo
  // de tipo website.
  participacion: [/participaci|porcentaje|\bpct\b/i],
  cuenta: [/cuenta|account/i],
  contacto: [/contacto|contact/i],
  promocion: [/promoci[oó]n|promotion|proyecto/i],
  concepto: [/concepto|descripci|detalle|observ/i],
} as const;

export const ESPEJOS: readonly EspejoZoho[] = [
  {
    moduloZoho: "Promociones",
    tabla: "inv_promociones",
    columnas: [
      // OJO: en este módulo las etiquetas están cruzadas respecto a los
      // api_name. `Name` se llama «Código de Promoción» y
      // `C_digo_de_Promoci_n` se llama «Nombre Promoción».
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
      { columna: "tipo", tipo: "picklist", obligatorio: false, pistas: [/tipo de cuenta/i] },
      { columna: "fecha_alta", tipo: "date", obligatorio: false, pistas: [/alta|constituci|apertura/i] },
      { columna: "email", tipo: "email", obligatorio: false, pistas: [...RE.email] },
      { columna: "telefono", tipo: "text", obligatorio: false, pistas: [...RE.telefono] },
      { columna: "capital_comprometido", tipo: "number", obligatorio: false, pistas: [/comprometid|suscrito/i] },
      { columna: "moneda", tipo: "picklist", obligatorio: false, pistas: [/moneda|divisa|currency/i] },
    ],
  },
  {
    // La ÚNICA fuente de los correos.
    //
    // `Inversi_n_vs_Contactos` tiene su propio campo `Email` y durante un rato
    // pareció que bastaba con el enlace, evitando copiar la agenda del CRM. El
    // primer sync real lo desmintió: ese campo viene vacío en los 535 enlaces.
    // Que un campo exista no quiere decir que nadie lo rellene.
    //
    // El sync filtra a los contactos REFERENCIADOS desde una cuenta, así que
    // sigue sin copiarse la agenda entera.
    moduloZoho: "Contacts",
    tabla: "inv_contactos",
    columnas: [
      { columna: "nombre", tipo: "text", obligatorio: false, pistas: [/^first_?name$/i] },
      { columna: "apellidos", tipo: "text", obligatorio: false, pistas: [/^last_?name$/i] },
      { columna: "nombre_completo", tipo: "text", obligatorio: true, pistas: [/^full_?name$/i] },
      { columna: "email", tipo: "email", obligatorio: true, pistas: [/^email$/i] },
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
      { columna: "contacto_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [/contactos asociados/i] },
      { columna: "contacto_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [/contactos asociados/i] },
      { columna: "contacto_email", tipo: "email", obligatorio: false, pistas: [/^email$/i] },
      { columna: "contacto_telefono", tipo: "text", obligatorio: false, pistas: [...RE.telefono] },
      // El papel de la persona en la cuenta son CINCO casillas, no un
      // desplegable, y se pueden dar a la vez. El texto legible se compone en
      // `logic/inversoresModel.ts`.
      { columna: "es_principal", tipo: "bool", obligatorio: false, pistas: [/contacto principal/i] },
      { columna: "es_secundario", tipo: "bool", obligatorio: false, pistas: [/contacto secundario/i] },
      { columna: "es_representante_legal", tipo: "bool", obligatorio: false, pistas: [/representante legal/i] },
      { columna: "es_abogado", tipo: "bool", obligatorio: false, pistas: [/abogado/i] },
      { columna: "es_intermediario", tipo: "bool", obligatorio: false, pistas: [/^intermediario$/i] },
      { columna: "concepto_representante", tipo: "picklist", obligatorio: false, pistas: [/concepto representante/i] },
      { columna: "rol", tipo: "text", obligatorio: false, pistas: [] },
      { columna: "participacion", tipo: "number", obligatorio: false, pistas: [...RE.participacion] },
    ],
  },
  {
    moduloZoho: "Inversi_n_vs_Promoci_n",
    tabla: "inv_cuenta_promocion",
    columnas: [
      // OJO: `Promociones_Invertidas_linking` NO es la promoción. Su etiqueta
      // es «Cuenta que invierte». La promoción es `Promociones_Invertidas_2`.
      { columna: "cuenta_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [/cuenta que invierte/i] },
      { columna: "cuenta_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [/cuenta que invierte/i] },
      { columna: "promocion_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [/promoci[oó]n invertida/i] },
      { columna: "promocion_nombre", tipo: "lookup_nombre", obligatorio: false, pistas: [/promoci[oó]n invertida/i] },
      { columna: "importe_comprometido", tipo: "number", obligatorio: false, pistas: [/capital suscrito|comprometid/i] },
      { columna: "importe_aportado", tipo: "number", obligatorio: false, pistas: [/aportad|desembolsad/i] },
      { columna: "participacion", tipo: "number", obligatorio: false, pistas: [...RE.participacion] },
      { columna: "fecha", tipo: "date", obligatorio: false, pistas: [...RE.fecha] },
      // Este módulo es un EMBUDO COMERCIAL. Sin el status, sumar el capital
      // suscrito de todas las filas cuenta como comprometido a quien solo ha
      // recibido un dossier.
      { columna: "status", tipo: "picklist", obligatorio: false, pistas: [/^status$/i] },
      { columna: "coste_vehiculo_intermedio", tipo: "number", obligatorio: false, pistas: [/veh[ií]culo intermedio/i] },
    ],
  },
  {
    moduloZoho: "Aportes_Repartos",
    tabla: "inv_flujos",
    columnas: [
      { columna: "cuenta_zoho_id", tipo: "lookup_id", obligatorio: true, pistas: [/cuenta de inversi/i] },
      { columna: "promocion_zoho_id", tipo: "lookup_id", obligatorio: false, pistas: [...RE.promocion] },
      { columna: "tipo_zoho", tipo: "picklist", obligatorio: true, pistas: [/tipo de movimiento/i] },
      { columna: "importe", tipo: "number", obligatorio: true, pistas: [/^monto$/i, ...RE.importe] },
      { columna: "retencion", tipo: "number", obligatorio: false, pistas: [/retenci/i] },
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
