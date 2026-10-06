"use server";

import { revalidatePath } from "next/cache";

import type { UserContext } from "@/lib/auth/currentUser";
import type { ResultadoAccion } from "@/modules/comunicaciones/actions/comunicaciones";
import { rolEnLaZona, usuarioConEscritura } from "@/modules/comunicaciones/actions/permisos";
import {
  anotarResultado,
  cerrarEnvio,
  confirmarEnvio,
  FALTA_MIGRACION_048,
  guardarAjustes,
  hayColumnasDeEnvio,
  leerAjustes,
  leerComunicacion,
  leerEstado,
  marcarProbada,
  marcarRevisada,
  pausarEnvio,
  reanudarEnvio,
  reclamarDestinatario,
  registrarPruebaEnviada,
  type ComunicacionCompleta,
} from "@/modules/comunicaciones/data/comunicacionesRepository";
import { enviarConCandado, nombreDePasarelaActiva } from "@/modules/comunicaciones/data/pasarela";
import {
  calcularPermitidos,
  normalizarEmail,
  verificarCandado,
  type PermitidosCandado,
} from "@/modules/comunicaciones/logic/candado";
import {
  puedeCambiarAjustes,
  puedeConfirmar,
  puedeDetener,
  puedeEnviarPrueba,
  puedeMarcarPrueba,
  puedeReanudar,
  puedeRevisar,
  puedeSeguirEnviando,
  type ContextoControles,
} from "@/modules/comunicaciones/logic/controles";
import { resumirDestinatarios } from "@/modules/comunicaciones/logic/destinatarios";
import {
  calcularProgreso,
  direccionesYaEnviadas,
  enviadoPara,
  montarCorreo,
  montarCorreoDePrueba,
  TANDA,
  type Progreso,
} from "@/modules/comunicaciones/logic/envio";
import {
  AJUSTES_ROUTE_KEY,
  COMUNICACIONES_AJUSTES_PATH,
  COMUNICACIONES_PATH,
  comunicacionPath,
  HISTORIAL_ROUTE_KEY,
} from "@/modules/comunicaciones/logic/paths";
import type {
  ComAjustesRow,
  EstadoComunicacion,
  ModoEnvio,
  NombrePasarela,
} from "@/modules/comunicaciones/types";
import { cargarEspejosDeContacto } from "@/modules/portfolio/inversores/data/inversoresRepository";

/**
 * Las acciones que pueden acabar en un correo.
 *
 * Cada una vuelve a comprobar, en el servidor, los permisos y el control que le
 * toca (`logic/controles.ts`): que la pantalla no ofrezca un botón no es lo que
 * impide pulsarlo. Y ninguna habla con Zoho por su cuenta: lo que sale, sale
 * por `enviarConCandado`.
 */

function fallo(err: unknown, porDefecto: string): { ok: false; mensaje: string } {
  return { ok: false, mensaje: err instanceof Error ? err.message : porDefecto };
}

interface Contexto {
  completa: ComunicacionCompleta;
  ajustes: ComAjustesRow;
  controles: ContextoControles;
}

/** La comunicación, sus destinatarios y lo que los controles necesitan saber, leído ahora. */
async function cargar(user: UserContext, comunicacionId: string): Promise<Contexto | string> {
  const [completa, ajustes] = await Promise.all([leerComunicacion(user, comunicacionId), leerAjustes(user)]);
  if (!completa) return "La comunicación no existe.";
  return {
    completa,
    ajustes,
    controles: {
      comunicacion: completa.comunicacion,
      resumen: resumirDestinatarios(completa.destinatarios, ajustes.dominios_internos),
      ajustes,
      rol: rolEnLaZona(user),
    },
  };
}

async function permitidosAhora(user: UserContext): Promise<PermitidosCandado> {
  const espejos = await cargarEspejosDeContacto(user);
  if (espejos.sinMigracion) throw new Error("Faltan las tablas de Inversores (migración 040).");
  return calcularPermitidos(espejos);
}

function refrescar(comunicacionId: string): void {
  revalidatePath(COMUNICACIONES_PATH);
  revalidatePath(comunicacionPath(comunicacionId));
}

// ---------------------------------------------------------------------------
// Control 2 — revisión de destinatarios
// ---------------------------------------------------------------------------

export async function revisarDestinatariosAction(
  comunicacionId: string,
  numeroRevisado: number,
): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeRevisar(ctx.controles, numeroRevisado);
    if (motivo) return { ok: false, mensaje: motivo };

    const r = await marcarRevisada(user, comunicacionId, numeroRevisado);
    if (!r.ok) return { ok: false, mensaje: r.error };
    refrescar(comunicacionId);
    return { ok: true };
  } catch (err) {
    return fallo(err, "No se pudo marcar la revisión.");
  }
}

// ---------------------------------------------------------------------------
// Control 3 — la prueba
// ---------------------------------------------------------------------------

/**
 * Envía la plantilla de verdad, solo a quien ha iniciado sesión.
 *
 * Sale sobre la cuenta de pruebas designada en los ajustes, no sobre un
 * destinatario de la lista.
 */
export async function enviarPruebaAction(
  comunicacionId: string,
  remitente: string,
): Promise<ResultadoAccion<{ para: string; pasarela: NombrePasarela }>> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeEnviarPrueba(ctx.controles, remitente);
    if (motivo) return { ok: false, mensaje: motivo };
    if (!(await hayColumnasDeEnvio(user))) return { ok: false, mensaje: FALTA_MIGRACION_048 };

    const espejos = await cargarEspejosDeContacto(user);
    if (espejos.sinMigracion) return { ok: false, mensaje: "Faltan las tablas de Inversores (migración 040)." };
    const permitidos = calcularPermitidos(espejos);

    const cuentaPruebas = ctx.ajustes.cuenta_pruebas_zoho_id;
    const contactoPruebas =
      espejos.cuentaContacto.find(
        (e) => e.cuenta_zoho_id === cuentaPruebas && e.es_principal === true && e.contacto_zoho_id,
      )?.contacto_zoho_id ?? null;

    const montado = montarCorreoDePrueba({
      comunicacion: ctx.completa.comunicacion,
      cuentaPruebasZohoId: cuentaPruebas,
      contactoPruebasZohoId: contactoPruebas,
      usuarioEmail: user.email,
      remitente,
    });
    if (!montado.ok) return { ok: false, mensaje: montado.motivo };

    const envio = await enviarConCandado(montado.correo, permitidos);
    if (!envio.ok) return { ok: false, mensaje: envio.error };

    const r = await registrarPruebaEnviada(user, comunicacionId, {
      plantillaId: montado.correo.plantillaId,
      messageId: envio.messageId,
      pasarela: envio.pasarela,
      remitente: montado.correo.remitente,
      para: [...montado.correo.para],
    });
    if (!r.ok) return { ok: false, mensaje: `La prueba salió, pero no se pudo anotar: ${r.error}` };

    refrescar(comunicacionId);
    return { ok: true, para: montado.correo.para[0] ?? "", pasarela: envio.pasarela };
  } catch (err) {
    return fallo(err, "No se pudo enviar la prueba.");
  }
}

export async function marcarPruebaVistaAction(comunicacionId: string): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeMarcarPrueba(ctx.controles);
    if (motivo) return { ok: false, mensaje: motivo };

    const r = await marcarProbada(user, comunicacionId, ctx.completa.comunicacion.plantilla_id ?? "");
    if (!r.ok) return { ok: false, mensaje: r.error };
    refrescar(comunicacionId);
    return { ok: true };
  } catch (err) {
    return fallo(err, "No se pudo marcar la prueba.");
  }
}

// ---------------------------------------------------------------------------
// Controles 4 y 5 — resumen y confirmación
// ---------------------------------------------------------------------------

/**
 * Lo que el candado diría de cada correo de la comunicación, sin enviar nada.
 *
 * Se hace al confirmar para que el «no» llegue antes de empezar y explique por
 * qué. El candado de verdad sigue estando en `enviarConCandado`.
 */
function rechazosDelCandado(
  ctx: Contexto,
  permitidos: PermitidosCandado,
  usuarioEmail: string,
): { cuenta: string; motivo: string }[] {
  const { comunicacion, destinatarios } = ctx.completa;
  const yaEnviadas = direccionesYaEnviadas(destinatarios);
  const rechazos: { cuenta: string; motivo: string }[] = [];

  for (const destinatario of destinatarios) {
    if (destinatario.excluido || destinatario.para.length === 0) continue;
    if (destinatario.estado_envio !== "pendiente") continue;
    const montado = montarCorreo({
      comunicacion,
      destinatario,
      modo: ctx.ajustes.modo,
      usuarioEmail,
      remitente: comunicacion.remitente_email ?? "",
      yaEnviadas,
    });
    if (montado.tipo === "omitido") continue;
    if (montado.tipo === "error") {
      rechazos.push({ cuenta: destinatario.cuenta_nombre, motivo: montado.motivo });
      continue;
    }
    const veredicto = verificarCandado(montado.correo, permitidos);
    if (!veredicto.ok) rechazos.push({ cuenta: destinatario.cuenta_nombre, motivo: veredicto.motivo });
    for (const direccion of montado.direccionesReales) yaEnviadas.add(direccion);
  }
  return rechazos;
}

/**
 * La confirmación: teclear el número de correos que van a salir.
 *
 * No envía nada todavía. Deja la comunicación «enviando» y es la pantalla la
 * que va pidiendo las tandas.
 */
export async function confirmarEnvioAction(
  comunicacionId: string,
  numeroTecleado: number,
): Promise<ResultadoAccion<{ modo: ModoEnvio; pasarela: NombrePasarela }>> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeConfirmar(ctx.controles, numeroTecleado);
    if (motivo) return { ok: false, mensaje: motivo };
    if (!(await hayColumnasDeEnvio(user))) return { ok: false, mensaje: FALTA_MIGRACION_048 };

    const rechazos = rechazosDelCandado(ctx, await permitidosAhora(user), user.email);
    if (rechazos.length > 0) {
      const primero = rechazos[0]!;
      return {
        ok: false,
        mensaje:
          `Candado de destinatarios: ${rechazos.length} de ${ctx.controles.resumen.aEnviar} correos no pueden salir. ` +
          `${primero.cuenta}: ${primero.motivo}.`,
      };
    }

    const pasarela = nombreDePasarelaActiva();
    const r = await confirmarEnvio(user, comunicacionId, {
      numero: numeroTecleado,
      pasarela,
      modo: ctx.ajustes.modo,
    });
    if (!r.ok) return { ok: false, mensaje: r.error };
    refrescar(comunicacionId);
    return { ok: true, modo: ctx.ajustes.modo, pasarela };
  } catch (err) {
    return fallo(err, "No se pudo confirmar el envío.");
  }
}

// ---------------------------------------------------------------------------
// Controles 6, 7 y 8 — tandas, interruptor y sin duplicados
// ---------------------------------------------------------------------------

export interface EstadoDeTanda {
  progreso: Progreso;
  estado: EstadoComunicacion;
  /** Por qué se ha parado antes de acabar la tanda, si se ha parado. */
  detenidoPor: string | null;
}

/**
 * Envía, como mucho, una tanda.
 *
 * Antes de CADA correo vuelve a leer el interruptor general y el estado: si
 * alguien pulsa Detener o apaga los envíos a mitad de tanda, el siguiente
 * correo ya no sale. Cada destinatario se marca «enviando» antes de enviarle y
 * se anota lo que pasó después; si no se puede anotar, la tanda se corta.
 */
export async function enviarTandaAction(comunicacionId: string): Promise<ResultadoAccion<EstadoDeTanda>> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const rol = rolEnLaZona(user);
    const motivoInicial = puedeSeguirEnviando(ctx.controles);
    if (motivoInicial) return { ok: false, mensaje: motivoInicial };

    const { comunicacion, destinatarios } = ctx.completa;
    const permitidos = await permitidosAhora(user);
    const yaEnviadas = direccionesYaEnviadas(destinatarios);
    const tanda = destinatarios
      .filter((d) => !d.excluido && d.para.length > 0 && d.estado_envio === "pendiente")
      .slice(0, TANDA);

    let detenidoPor: string | null = null;
    for (const destinatario of tanda) {
      const [ajustes, estado] = await Promise.all([leerAjustes(user), leerEstado(user, comunicacionId)]);
      detenidoPor = puedeSeguirEnviando({
        comunicacion: { ...comunicacion, estado: estado ?? "cancelada" },
        ajustes,
        rol,
      });
      if (detenidoPor) break;

      if (!(await reclamarDestinatario(user, comunicacionId, destinatario))) continue;

      const montado = montarCorreo({
        comunicacion,
        destinatario,
        modo: ajustes.modo,
        usuarioEmail: user.email,
        remitente: comunicacion.remitente_email ?? "",
        yaEnviadas,
      });

      let anotado;
      if (montado.tipo === "omitido") {
        anotado = await anotarResultado(user, comunicacionId, destinatario.id, {
          estado: "omitido",
          motivo: montado.motivo,
        });
      } else if (montado.tipo === "error") {
        anotado = await anotarResultado(user, comunicacionId, destinatario.id, {
          estado: "error",
          error: montado.motivo,
          enviadoPara: null,
          pasarela: null,
        });
      } else {
        const envio = await enviarConCandado(montado.correo, permitidos);
        if (envio.ok) {
          for (const direccion of montado.direccionesReales) yaEnviadas.add(normalizarEmail(direccion));
          anotado = await anotarResultado(user, comunicacionId, destinatario.id, {
            estado: "enviado",
            messageId: envio.messageId,
            enviadoPara: enviadoPara(montado.correo),
            pasarela: envio.pasarela,
          });
        } else {
          anotado = await anotarResultado(user, comunicacionId, destinatario.id, {
            estado: "error",
            error: envio.error,
            // Lo que paró el candado no llegó a ninguna pasarela.
            enviadoPara: envio.bloqueadoPorCandado ? null : enviadoPara(montado.correo),
            pasarela: envio.bloqueadoPorCandado ? null : envio.pasarela,
          });
        }
      }

      if (!anotado.ok) {
        // Sin poder anotar no se sigue: el siguiente correo saldría a ciegas.
        await pausarEnvio(user, comunicacionId);
        refrescar(comunicacionId);
        return {
          ok: false,
          mensaje: `El envío se ha detenido porque no se pudo anotar un resultado (${destinatario.cuenta_nombre}): ${anotado.error}`,
        };
      }
    }

    let despues = await leerComunicacion(user, comunicacionId);
    if (!despues) return { ok: false, mensaje: "La comunicación ha dejado de existir." };
    let progreso = calcularProgreso(despues.destinatarios);

    if (!detenidoPor && progreso.pendientes === 0 && despues.comunicacion.estado === "enviando") {
      const cierre = await cerrarEnvio(user, comunicacionId);
      if (!cierre.ok) return { ok: false, mensaje: cierre.error };
      despues = (await leerComunicacion(user, comunicacionId)) ?? despues;
      progreso = calcularProgreso(despues.destinatarios);
    }

    refrescar(comunicacionId);
    return { ok: true, progreso, estado: despues.comunicacion.estado, detenidoPor };
  } catch (err) {
    return fallo(err, "No se pudo enviar la tanda.");
  }
}

export async function detenerEnvioAction(comunicacionId: string): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeDetener(ctx.controles);
    if (motivo) return { ok: false, mensaje: motivo };

    const r = await pausarEnvio(user, comunicacionId);
    if (!r.ok) return { ok: false, mensaje: r.error };
    refrescar(comunicacionId);
    return { ok: true };
  } catch (err) {
    return fallo(err, "No se pudo detener el envío.");
  }
}

export async function reanudarEnvioAction(comunicacionId: string): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeReanudar(ctx.controles);
    if (motivo) return { ok: false, mensaje: motivo };

    const r = await reanudarEnvio(user, comunicacionId);
    if (!r.ok) return { ok: false, mensaje: r.error };
    refrescar(comunicacionId);
    return { ok: true };
  } catch (err) {
    return fallo(err, "No se pudo reanudar el envío.");
  }
}

// ---------------------------------------------------------------------------
// Control 7 — ajustes (solo administradores de la zona)
// ---------------------------------------------------------------------------

export interface AjustesEntrada {
  enviosActivados: boolean;
  modo: string;
  cuentaPruebasZohoId: string | null;
  remitentesPermitidos: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function guardarAjustesAction(entrada: AjustesEntrada): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(AJUSTES_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };
  const motivo = puedeCambiarAjustes(rolEnLaZona(user));
  if (motivo) return { ok: false, mensaje: motivo };

  if (entrada.modo !== "pruebas" && entrada.modo !== "real") {
    return { ok: false, mensaje: "El modo tiene que ser «pruebas» o «real»." };
  }
  const remitentes = [...new Set((entrada.remitentesPermitidos ?? []).map(normalizarEmail).filter(Boolean))];
  const malos = remitentes.filter((r) => !EMAIL_RE.test(r));
  if (malos.length > 0) return { ok: false, mensaje: `No es una dirección de correo: ${malos.join(", ")}.` };
  const cuentaPruebas = entrada.cuentaPruebasZohoId?.trim() || null;

  try {
    if (cuentaPruebas) {
      const permitidos = await permitidosAhora(user);
      if (!permitidos.cuentasZohoId.has(cuentaPruebas)) {
        return {
          ok: false,
          mensaje: "Candado de destinatarios: la cuenta de pruebas tiene que ser una cuenta de prueba de la promoción de pruebas.",
        };
      }
    }

    const r = await guardarAjustes(user, {
      envios_activados: entrada.enviosActivados === true,
      modo: entrada.modo,
      cuenta_pruebas_zoho_id: cuentaPruebas,
      remitentes_permitidos: remitentes,
    });
    if (!r.ok) return { ok: false, mensaje: r.error };
    revalidatePath(COMUNICACIONES_AJUSTES_PATH);
    revalidatePath(COMUNICACIONES_PATH, "layout");
    return { ok: true };
  } catch (err) {
    return fallo(err, "No se pudieron guardar los ajustes.");
  }
}
