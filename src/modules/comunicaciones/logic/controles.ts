import { normalizarEmail } from "@/modules/comunicaciones/logic/candado";
import type {
  ComAjustesRow,
  ComComunicacionRow,
  ResumenDestinatarios,
} from "@/modules/comunicaciones/types";

/**
 * Los controles del envío: qué paso se puede dar y, si no, por qué.
 *
 * Una comunicación solo sale si ha pasado, en orden, por revisión, prueba y
 * confirmación. Cada función contesta `null` (se puede) o el motivo por el que
 * no. Las acciones del servidor las llaman SIEMPRE antes de hacer nada; la
 * pantalla las usa para explicar qué falta, pero un botón apagado no es un
 * control.
 *
 * Puro: recibe el estado y contesta. Es lo que se prueba control a control.
 */

export type RolZona = "admin" | "editor" | "lector" | null;

export interface ContextoControles {
  comunicacion: ComComunicacionRow;
  resumen: ResumenDestinatarios;
  ajustes: ComAjustesRow;
  rol: RolZona;
}

export const ENVIOS_DESACTIVADOS =
  "Los envíos están desactivados. Los activa un administrador de la zona en Ajustes.";

function sinPermiso(rol: RolZona): string | null {
  return rol === "admin" || rol === "editor" ? null : "Hace falta rol de editor o administrador.";
}

/** ¿Las dos fechas caen en el mismo día de Madrid? */
export function mismoDia(iso: string | null | undefined, ahora: Date): boolean {
  if (!iso) return false;
  const dia = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
  return dia(new Date(iso)) === dia(ahora);
}

/** Control 2 — «He revisado los N destinatarios». */
export function puedeRevisar(ctx: ContextoControles, numeroRevisado: number): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  if (ctx.comunicacion.estado !== "borrador") return "Esta comunicación ya está revisada o no se puede modificar.";
  if (ctx.resumen.aEnviar === 0) return "No hay ningún correo que enviar: todos los destinatarios están excluidos o sin dirección.";
  if (numeroRevisado !== ctx.resumen.aEnviar) {
    return `La lista ha cambiado: ahora son ${ctx.resumen.aEnviar} correos. Vuelve a cargar la página y revísala.`;
  }
  return null;
}

/** Control 3 (primera mitad) — enviar la prueba a quien ha iniciado sesión. */
export function puedeEnviarPrueba(ctx: ContextoControles, remitente: string): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  const { comunicacion, ajustes } = ctx;
  if (comunicacion.estado !== "revisada" && comunicacion.estado !== "probada") {
    return "Antes de la prueba hay que revisar los destinatarios.";
  }
  if (!comunicacion.plantilla_id) return "Elige antes una plantilla.";
  if (!ajustes.envios_activados) return ENVIOS_DESACTIVADOS;
  const permitidos = ajustes.remitentes_permitidos.map(normalizarEmail);
  if (!remitente.trim()) return "Elige el remitente.";
  if (!permitidos.includes(normalizarEmail(remitente))) {
    return `${remitente} no está entre los remitentes permitidos. Los fija un administrador en Ajustes.`;
  }
  return null;
}

/** ¿Hay una prueba enviada con la plantilla que está elegida ahora? */
export function pruebaVigente(comunicacion: ComComunicacionRow): boolean {
  return (
    Boolean(comunicacion.prueba_enviada_at) &&
    Boolean(comunicacion.plantilla_id) &&
    comunicacion.prueba_enviada_plantilla_id === comunicacion.plantilla_id
  );
}

/** Control 3 (segunda mitad) — «he recibido la prueba y está bien». */
export function puedeMarcarPrueba(ctx: ContextoControles): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  if (ctx.comunicacion.estado !== "revisada") {
    return ctx.comunicacion.estado === "probada"
      ? "La prueba ya está marcada como vista."
      : "Antes de la prueba hay que revisar los destinatarios.";
  }
  if (!pruebaVigente(ctx.comunicacion)) return "Todavía no se ha enviado ninguna prueba con esta plantilla.";
  return null;
}

/**
 * Control 1 y lo que tiene que ser cierto para ENSAYAR el envío: montar todos
 * los correos sin enviar ninguno.
 */
export function puedeEnsayar(ctx: ContextoControles, ahora: Date = new Date()): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  const { comunicacion, resumen, ajustes } = ctx;

  if (comunicacion.estado !== "probada") {
    return "Faltan pasos: hay que revisar los destinatarios y dar por buena la prueba.";
  }
  if (!ajustes.envios_activados) return ENVIOS_DESACTIVADOS;
  if (!mismoDia(comunicacion.datos_zoho_at, ahora)) {
    return "Esta comunicación se preparó con datos de Zoho de otro día. Prepara una nueva con los datos de hoy.";
  }
  if (!comunicacion.plantilla_id || comunicacion.probada_plantilla_id !== comunicacion.plantilla_id) {
    return "La prueba se hizo con otra plantilla. Envía una prueba con la plantilla elegida.";
  }
  if (!comunicacion.remitente_email) return "La comunicación no tiene remitente. Envía la prueba otra vez.";
  if (resumen.aEnviar === 0) return "No hay ningún correo que enviar.";
  if (comunicacion.revisada_n !== resumen.aEnviar) {
    return "La lista ha cambiado desde que se revisó. Hay que revisarla otra vez.";
  }
  return null;
}

/** Cuánto vale un ensayo. Pasado este tiempo hay que repetirlo. */
export const VIGENCIA_DEL_ENSAYO_MIN = 30;

/**
 * ¿Hay un ensayo general que valga para lo que se va a enviar ahora?
 *
 * Tiene que ser reciente, haberse hecho en el modo en que se va a enviar (en
 * modo pruebas los destinatarios son otros) y haber contado los mismos correos.
 */
export function ensayoVigente(ctx: ContextoControles, ahora: Date = new Date()): string | null {
  const { comunicacion, resumen, ajustes } = ctx;
  const ensayo = comunicacion.ensayo_resumen;
  if (!comunicacion.ensayo_at || !ensayo) return "Falta el ensayo general: monta todos los correos antes de confirmar.";
  const minutos = (ahora.getTime() - new Date(comunicacion.ensayo_at).getTime()) / 60_000;
  if (minutos > VIGENCIA_DEL_ENSAYO_MIN || minutos < 0) {
    return `El ensayo general es de hace más de ${VIGENCIA_DEL_ENSAYO_MIN} minutos. Repítelo.`;
  }
  if (ensayo.modo !== ajustes.modo) {
    return "El ensayo se hizo en otro modo de envío. Repítelo.";
  }
  if (ensayo.correos + ensayo.omitidos !== resumen.aEnviar) {
    return "La lista ha cambiado desde el ensayo general. Repítelo.";
  }
  return null;
}

/**
 * Controles 4 y 5 — todo lo que tiene que ser cierto para empezar a enviar: lo
 * del ensayo, un ensayo vigente y el número de correos tecleado a mano.
 */
export function puedeConfirmar(
  ctx: ContextoControles,
  numeroTecleado: number,
  ahora: Date = new Date(),
): string | null {
  const previo = puedeEnsayar(ctx, ahora) ?? ensayoVigente(ctx, ahora);
  if (previo) return previo;
  if (!Number.isInteger(numeroTecleado) || numeroTecleado !== ctx.resumen.aEnviar) {
    return `El número no coincide: van a salir ${ctx.resumen.aEnviar} correos.`;
  }
  return null;
}

/**
 * El tope diario. Devuelve el motivo si `nuevos` correos reales no caben en lo
 * que queda del día.
 */
export function cabeEnElDia(enviadosHoy: number, nuevos: number, limite: number): string | null {
  const quedan = Math.max(0, limite - enviadosHoy);
  if (nuevos <= quedan) return null;
  return (
    `Tope diario: hoy se han enviado ${enviadosHoy} correos de un máximo de ${limite}, ` +
    `quedan ${quedan} y esta comunicación necesita ${nuevos}.`
  );
}

/** Controles 6 y 7 — se consultan antes de CADA correo, no una vez al empezar. */
export function puedeSeguirEnviando(
  ctx: Pick<ContextoControles, "comunicacion" | "ajustes" | "rol">,
): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  if (!ctx.ajustes.envios_activados) return ENVIOS_DESACTIVADOS;
  if (ctx.comunicacion.estado === "pausada") return "El envío está detenido.";
  if (ctx.comunicacion.estado !== "enviando") return "Esta comunicación no se está enviando.";
  return null;
}

export function puedeDetener(ctx: Pick<ContextoControles, "comunicacion" | "rol">): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  return ctx.comunicacion.estado === "enviando" ? null : "Esta comunicación no se está enviando.";
}

export function puedeReanudar(
  ctx: Pick<ContextoControles, "comunicacion" | "ajustes" | "rol">,
): string | null {
  const permiso = sinPermiso(ctx.rol);
  if (permiso) return permiso;
  if (ctx.comunicacion.estado !== "pausada") return "Esta comunicación no está detenida.";
  if (!ctx.ajustes.envios_activados) return ENVIOS_DESACTIVADOS;
  return null;
}

/** El interruptor general y el modo real son cosa del administrador de la zona. */
export function puedeCambiarAjustes(rol: RolZona): string | null {
  return rol === "admin" ? null : "Solo un administrador de la zona puede cambiar los ajustes de envío.";
}
