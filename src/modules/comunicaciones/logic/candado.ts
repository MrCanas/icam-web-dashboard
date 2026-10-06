import type {
  InvContactoRow,
  InvCuentaContactoRow,
  InvCuentaPromocionRow,
  InvCuentaRow,
  InvPromocionRow,
} from "@/modules/portfolio/inversores/types";

/**
 * El candado de destinatarios.
 *
 * Mientras exista, este módulo solo puede escribir a las direcciones de una
 * lista CERRADA, escrita aquí abajo, y solo sobre las cuentas de prueba de la
 * promoción de pruebas del CRM. No es un ajuste ni una variable de entorno: es
 * código, y abrirlo a inversores reales es una PR aparte, decidida por una
 * persona.
 *
 * La lista de direcciones no se calcula a partir del CRM a propósito: si mañana
 * alguien marca a otra persona como contacto principal de una cuenta de prueba,
 * esa persona NO pasa a poder recibir correo. Nada que se toque en Zoho puede
 * ensanchar a quién se escribe.
 *
 * Por qué existe: el 2026-10-05 un kiosk de Zoho envió 60 correos a inversores
 * reales por error. Los controles del envío (revisión, prueba, confirmación)
 * dependen de que alguien los pase bien; el candado no depende de nadie. Aunque
 * todos los controles fallaran a la vez, un correo a una dirección de fuera no
 * sale.
 *
 * Puro: recibe las filas del espejo de Inversores y un correo, y contesta.
 */

export const CANDADO = {
  /**
   * Las ÚNICAS direcciones que pueden recibir un correo de este módulo, en
   * «Para», en copia o en copia oculta. Lista cerrada: añadir una es tocar esta
   * línea, en una PR.
   */
  emailsPermitidos: ["javiercanas@imparcapital.com", "iranzuvicente@imparcapital.com"],
  /**
   * La promoción de pruebas del CRM, que decide sobre qué REGISTROS se puede
   * enviar. Se exigen el id Y el código: si alguien renombra la promoción o
   * reutiliza el código en otra, no queda ningún registro sobre el que enviar.
   */
  promocionZohoId: "261199000045049136",
  promocionCodigo: "PROMOCIONTEST",
} as const;

/** Módulos de Zoho sobre cuyos registros se sabe comprobar un envío. */
export const MODULO_CUENTAS = "Cuentas_de_Inversi_n";
export const MODULO_CONTACTOS = "Contacts";

export interface EspejosParaCandado {
  cuentas: readonly InvCuentaRow[];
  contactos: readonly InvContactoRow[];
  cuentaContacto: readonly InvCuentaContactoRow[];
  promociones: readonly InvPromocionRow[];
  cuentaPromocion: readonly InvCuentaPromocionRow[];
}

export interface PermitidosCandado {
  /** Las direcciones de la lista cerrada, en minúsculas. Nunca más que esas. */
  emails: ReadonlySet<string>;
  /** Cuentas de Inversión sobre las que se puede enviar. */
  cuentasZohoId: ReadonlySet<string>;
  /** Contactos sobre los que se puede enviar (plantillas del módulo Contactos). */
  contactosZohoId: ReadonlySet<string>;
  /** Las mismas cuentas, con nombre, para decirlo en pantalla. */
  cuentas: { zohoId: string; nombre: string }[];
  /** false = la promoción de pruebas no está, o no es la que se esperaba. */
  promocionEncontrada: boolean;
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function viva(fila: { borrado_at?: string | null }): boolean {
  return !fila.borrado_at;
}

/**
 * A quién se puede escribir y sobre qué registros, hoy.
 *
 * Las DIRECCIONES son siempre las de `CANDADO.emailsPermitidos`: el espejo no
 * añade ninguna.
 *
 * Del espejo salen solo los REGISTROS sobre los que se puede enviar. Una cuenta
 * entra si está suscrita a la promoción de pruebas Y marcada como cuenta de
 * prueba (`inv_cuentas.excluida`): suscribir por error a un inversor real a
 * PROMOCIONTEST no la convierte en registro válido. Un contacto entra si es
 * contacto principal de una de esas cuentas Y su dirección está en la lista.
 */
export function calcularPermitidos(espejos: EspejosParaCandado): PermitidosCandado {
  const emails = new Set<string>(CANDADO.emailsPermitidos.map(normalizarEmail));
  const cuentasZohoId = new Set<string>();
  const contactosZohoId = new Set<string>();
  const cuentas: { zohoId: string; nombre: string }[] = [];

  const promocion = espejos.promociones.find(
    (p) => viva(p) && p.zoho_id === CANDADO.promocionZohoId && p.codigo === CANDADO.promocionCodigo,
  );
  if (!promocion) {
    return { emails, cuentasZohoId, contactosZohoId, cuentas, promocionEncontrada: false };
  }

  const suscritas = new Set<string>();
  for (const enlace of espejos.cuentaPromocion) {
    if (viva(enlace) && enlace.promocion_zoho_id === promocion.zoho_id && enlace.cuenta_zoho_id) {
      suscritas.add(enlace.cuenta_zoho_id);
    }
  }
  for (const cuenta of espejos.cuentas) {
    if (viva(cuenta) && suscritas.has(cuenta.zoho_id) && cuenta.excluida === true) {
      cuentasZohoId.add(cuenta.zoho_id);
      cuentas.push({ zohoId: cuenta.zoho_id, nombre: cuenta.nombre });
    }
  }

  const contactoPorId = new Map(espejos.contactos.filter(viva).map((c) => [c.zoho_id, c]));
  for (const enlace of espejos.cuentaContacto) {
    if (!viva(enlace) || enlace.es_principal !== true) continue;
    if (!enlace.cuenta_zoho_id || !cuentasZohoId.has(enlace.cuenta_zoho_id)) continue;
    const contacto = enlace.contacto_zoho_id ? contactoPorId.get(enlace.contacto_zoho_id) : undefined;
    const email = contacto?.email ? normalizarEmail(contacto.email) : "";
    // La dirección tiene que estar YA en la lista cerrada: aquí no se añade ninguna.
    if (!contacto || !emails.has(email)) continue;
    contactosZohoId.add(contacto.zoho_id);
  }

  cuentas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
  return { emails, cuentasZohoId, contactosZohoId, cuentas, promocionEncontrada: true };
}

/** Lo que el candado necesita saber de un correo para dejarlo pasar o no. */
export interface CorreoParaCandado {
  registro: { modulo: string; id: string };
  remitente: string;
  para: readonly string[];
  copia: readonly string[];
  copiaOculta: readonly string[];
}

export type VeredictoCandado = { ok: true } | { ok: false; motivo: string };

/**
 * ¿Puede salir este correo?
 *
 * Mira TODAS las direcciones —«Para», copia y copia oculta— y además el
 * registro de Zoho sobre el que se envía: Zoho archiva el correo en la ficha de
 * ese registro, y un correo de pruebas no pinta nada en la de un inversor real.
 *
 * Rechaza el correo entero. No quita las direcciones que sobran y envía el
 * resto: un filtro silencioso es justo lo que este módulo vino a quitar.
 */
export function verificarCandado(
  correo: CorreoParaCandado,
  permitidos: PermitidosCandado,
): VeredictoCandado {
  if (correo.para.length === 0) {
    return { ok: false, motivo: "el correo no tiene ningún destinatario en «Para»" };
  }

  const fuera = [...correo.para, ...correo.copia, ...correo.copiaOculta]
    .map(normalizarEmail)
    .filter((email) => !permitidos.emails.has(email));
  if (fuera.length > 0) {
    return {
      ok: false,
      motivo: `${[...new Set(fuera)].join(", ")} no está entre las direcciones permitidas`,
    };
  }

  const { modulo, id } = correo.registro;
  if (modulo === MODULO_CUENTAS) {
    if (!permitidos.cuentasZohoId.has(id)) {
      return { ok: false, motivo: "la cuenta de inversión no es una cuenta de prueba de la promoción de pruebas" };
    }
  } else if (modulo === MODULO_CONTACTOS) {
    if (!permitidos.contactosZohoId.has(id)) {
      return { ok: false, motivo: "el contacto no es un contacto principal de una cuenta de prueba" };
    }
  } else {
    return { ok: false, motivo: `no se sabe comprobar un envío sobre el módulo ${modulo || "(vacío)"}` };
  }

  return { ok: true };
}
