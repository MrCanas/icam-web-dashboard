import {
  MODULO_CONTACTOS,
  MODULO_CUENTAS,
  normalizarEmail,
  verificarCandado,
  type CorreoParaCandado,
  type PermitidosCandado,
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

/**
 * El correo ya montado por el portal: asunto y cuerpo con los campos combinados
 * resueltos, la imagen de apertura y los enlaces rastreados.
 */
export interface ContenidoDeCorreo {
  asunto: string;
  html: string;
  /** Identificadores de fichero de Zoho de los adjuntos de la plantilla. */
  adjuntos: string[];
}

/** Un correo listo para la pasarela. */
export interface CorreoSaliente extends CorreoParaCandado {
  plantillaId: string;
  /**
   * Con contenido, Zoho envía exactamente esto. Sin él, monta el correo a
   * partir de la plantilla, y entonces no hay seguimiento propio.
   */
  contenido?: ContenidoDeCorreo;
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

export interface SimulacionDeCandado {
  /** Los correos que saldrían, con sus direcciones exactas. */
  permitidos: { cuenta: string; correo: CorreoSaliente }[];
  /** Los que el candado no deja salir, o que no se pueden montar, y por qué. */
  rechazados: { cuenta: string; motivo: string }[];
  /** Los que no se enviarían porque sus direcciones ya recibirían el correo por otra cuenta. */
  omitidos: { cuenta: string; motivo: string }[];
}

/**
 * Lo que pasaría con cada correo pendiente de una comunicación, SIN enviar nada.
 *
 * Recorre los destinatarios en el mismo orden y con las mismas funciones que el
 * envío de verdad (`montarCorreo` + `verificarCandado`), así que lo que dice es
 * lo que haría el envío. Se usa para enseñarlo en pantalla antes de empezar,
 * para negarse al confirmar y para comprobarlo desde la consola.
 */
export function simularCandado(
  comunicacion: Pick<ComComunicacionRow, "plantilla_id" | "plantilla_modulo">,
  destinatarios: readonly Pick<
    ComDestinatarioRow,
    "cuenta_zoho_id" | "cuenta_nombre" | "para" | "copia" | "excluido" | "estado_envio"
  >[],
  opciones: { modo: ModoEnvio; usuarioEmail: string; remitente: string },
  permitidos: PermitidosCandado,
): SimulacionDeCandado {
  const yaEnviadas = direccionesYaEnviadas(destinatarios);
  const simulacion: SimulacionDeCandado = { permitidos: [], rechazados: [], omitidos: [] };

  for (const destinatario of destinatarios) {
    if (destinatario.excluido || destinatario.para.length === 0) continue;
    if (destinatario.estado_envio !== "pendiente") continue;
    const cuenta = destinatario.cuenta_nombre;
    const montado = montarCorreo({ comunicacion, destinatario, ...opciones, yaEnviadas });

    if (montado.tipo === "omitido") {
      simulacion.omitidos.push({ cuenta, motivo: montado.motivo });
      continue;
    }
    if (montado.tipo === "error") {
      simulacion.rechazados.push({ cuenta, motivo: montado.motivo });
      continue;
    }
    const veredicto = verificarCandado(montado.correo, permitidos);
    if (veredicto.ok) {
      simulacion.permitidos.push({ cuenta, correo: montado.correo });
      // Solo lo que saldría cuenta como enviado para el siguiente.
      for (const direccion of montado.direccionesReales) yaEnviadas.add(direccion);
    } else {
      simulacion.rechazados.push({ cuenta, motivo: veredicto.motivo });
    }
  }
  return simulacion;
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
