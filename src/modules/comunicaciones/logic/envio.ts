import {
  MODULO_CONTACTOS,
  MODULO_CUENTAS,
  normalizarEmail,
  type CorreoParaCandado,
} from "@/modules/comunicaciones/logic/candado";
import type {
  ComComunicacionRow,
  ComDestinatarioRow,
  EnviadoPara,
  ModoEnvio,
} from "@/modules/comunicaciones/types";

/**
 * Cómo se monta cada correo a partir de la foto de destinatarios.
 *
 * Puro: aquí se decide a qué direcciones va un correo y sobre qué registro de
 * Zoho se envía, sin llamar a nadie. Es lo que se prueba sin base de datos.
 */

/** Correos por tanda. Entre tanda y tanda se puede detener. */
export const TANDA = 10;

/** Un correo listo para la pasarela. */
export interface CorreoSaliente extends CorreoParaCandado {
  plantillaId: string;
}

export function enviadoPara(correo: CorreoSaliente): EnviadoPara {
  return {
    remitente: correo.remitente,
    para: [...correo.para],
    copia: [...correo.copia],
    copiaOculta: [...correo.copiaOculta],
  };
}

type Montado =
  | {
      tipo: "correo";
      correo: CorreoSaliente;
      /** Las direcciones de la lista a las que corresponde este correo, vayan redirigidas o no. */
      direccionesReales: string[];
    }
  | { tipo: "omitido"; motivo: string }
  | { tipo: "error"; motivo: string };

function sinRepetir(emails: readonly string[]): string[] {
  return [...new Set(emails.map(normalizarEmail).filter(Boolean))];
}

/** El módulo de la plantilla decide sobre qué registro se envía. */
export function moduloDePlantilla(comunicacion: Pick<ComComunicacionRow, "plantilla_modulo">): string {
  return comunicacion.plantilla_modulo?.trim() || MODULO_CUENTAS;
}

export interface MontarCorreoEntrada {
  comunicacion: Pick<ComComunicacionRow, "plantilla_id" | "plantilla_modulo">;
  destinatario: Pick<ComDestinatarioRow, "cuenta_zoho_id" | "para" | "copia">;
  modo: ModoEnvio;
  /** Quien ha iniciado sesión: en modo pruebas recibe él todos los correos. */
  usuarioEmail: string;
  remitente: string;
  /** Direcciones de la lista que ya han recibido este correo por otra cuenta. */
  yaEnviadas: ReadonlySet<string>;
}

/**
 * El correo de un destinatario.
 *
 * - Una dirección recibe UN correo por comunicación. Quien ya lo recibió por
 *   otra cuenta se quita de este; si no queda nadie en «Para», el destinatario
 *   se omite, y se dice.
 * - En modo pruebas las direcciones de la lista se sustituyen por la de quien
 *   envía, pero DESPUÉS de aplicar la regla anterior: la prueba omite
 *   exactamente lo que omitiría el envío real.
 * - En modo real el remitente va además en copia oculta, para que el correo le
 *   quede en su buzón, como hace el kiosk «Emails a Fondos/Promos».
 */
export function montarCorreo(entrada: MontarCorreoEntrada): Montado {
  const { comunicacion, destinatario, modo, yaEnviadas } = entrada;
  const usuarioEmail = normalizarEmail(entrada.usuarioEmail);
  const remitente = normalizarEmail(entrada.remitente);

  if (!comunicacion.plantilla_id) return { tipo: "error", motivo: "La comunicación no tiene plantilla." };
  if (!remitente) return { tipo: "error", motivo: "La comunicación no tiene remitente." };

  const modulo = moduloDePlantilla(comunicacion);
  const registroId =
    modulo === MODULO_CONTACTOS ? destinatario.para[0]?.contactoZohoId : destinatario.cuenta_zoho_id;
  if (!registroId) {
    return { tipo: "error", motivo: `No hay registro de ${modulo} sobre el que enviar.` };
  }

  const para = sinRepetir(destinatario.para.map((d) => d.email)).filter((e) => !yaEnviadas.has(e));
  if (para.length === 0) {
    return {
      tipo: "omitido",
      motivo:
        destinatario.para.length === 0
          ? "No tiene a nadie en «Para»."
          : "Todas sus direcciones ya han recibido este correo por otra cuenta.",
    };
  }
  const copia = sinRepetir(destinatario.copia.map((d) => d.email)).filter(
    (e) => !yaEnviadas.has(e) && !para.includes(e),
  );
  const direccionesReales = [...para, ...copia];

  const base = { registro: { modulo, id: registroId }, remitente, plantillaId: comunicacion.plantilla_id };

  if (modo === "pruebas") {
    if (!usuarioEmail) return { tipo: "error", motivo: "No se sabe a quién redirigir el correo de pruebas." };
    return {
      tipo: "correo",
      correo: { ...base, para: [usuarioEmail], copia: [], copiaOculta: [] },
      direccionesReales,
    };
  }

  return {
    tipo: "correo",
    correo: {
      ...base,
      para,
      copia,
      copiaOculta: para.includes(remitente) || copia.includes(remitente) ? [] : [remitente],
    },
    direccionesReales,
  };
}

export interface MontarPruebaEntrada {
  comunicacion: Pick<ComComunicacionRow, "plantilla_id" | "plantilla_modulo">;
  /** La cuenta de pruebas designada en los ajustes. */
  cuentaPruebasZohoId: string | null;
  /** Su contacto principal, para las plantillas del módulo Contactos. */
  contactoPruebasZohoId: string | null;
  usuarioEmail: string;
  remitente: string;
}

/**
 * El correo de prueba: la plantilla de verdad, enviada solo a quien prueba.
 *
 * Se envía sobre la cuenta de pruebas designada y no sobre un destinatario de
 * la lista, para no dejar correos de prueba en la ficha de un inversor.
 */
export function montarCorreoDePrueba(
  entrada: MontarPruebaEntrada,
): { ok: true; correo: CorreoSaliente } | { ok: false; motivo: string } {
  const usuarioEmail = normalizarEmail(entrada.usuarioEmail);
  const remitente = normalizarEmail(entrada.remitente);
  if (!entrada.comunicacion.plantilla_id) return { ok: false, motivo: "Elige antes una plantilla." };
  if (!usuarioEmail) return { ok: false, motivo: "No se sabe a quién enviar la prueba." };
  if (!remitente) return { ok: false, motivo: "Elige el remitente." };

  const modulo = moduloDePlantilla(entrada.comunicacion);
  const id = modulo === MODULO_CONTACTOS ? entrada.contactoPruebasZohoId : entrada.cuentaPruebasZohoId;
  if (!id) {
    return {
      ok: false,
      motivo:
        modulo === MODULO_CONTACTOS
          ? "La cuenta de pruebas no tiene un contacto principal sobre el que enviar la prueba."
          : "No hay cuenta de pruebas designada. La elige un administrador en Ajustes.",
    };
  }

  return {
    ok: true,
    correo: {
      registro: { modulo, id },
      remitente,
      para: [usuarioEmail],
      copia: [],
      copiaOculta: [],
      plantillaId: entrada.comunicacion.plantilla_id,
    },
  };
}

/** Las direcciones de la lista que ya han recibido el correo de esta comunicación. */
export function direccionesYaEnviadas(
  destinatarios: readonly Pick<ComDestinatarioRow, "estado_envio" | "para" | "copia">[],
): Set<string> {
  const enviadas = new Set<string>();
  for (const d of destinatarios) {
    if (d.estado_envio !== "enviado") continue;
    for (const dir of [...d.para, ...d.copia]) enviadas.add(normalizarEmail(dir.email));
  }
  return enviadas;
}

export interface Progreso {
  /** Correos que tenían que salir: ni excluidos ni sin destinatario. */
  total: number;
  enviados: number;
  errores: number;
  omitidos: number;
  /** Marcados como «enviando»: en vuelo, o a medias si algo se cortó. */
  enCurso: number;
  pendientes: number;
}

export function calcularProgreso(
  destinatarios: readonly Pick<ComDestinatarioRow, "estado_envio" | "excluido" | "para">[],
): Progreso {
  const p: Progreso = { total: 0, enviados: 0, errores: 0, omitidos: 0, enCurso: 0, pendientes: 0 };
  for (const d of destinatarios) {
    if (d.excluido || d.para.length === 0) continue;
    p.total++;
    if (d.estado_envio === "enviado") p.enviados++;
    else if (d.estado_envio === "error") p.errores++;
    else if (d.estado_envio === "omitido") p.omitidos++;
    else if (d.estado_envio === "enviando") p.enCurso++;
    else p.pendientes++;
  }
  return p;
}
