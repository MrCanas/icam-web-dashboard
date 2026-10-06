"use server";

import { revalidatePath } from "next/cache";

import type { UserContext } from "@/lib/auth/currentUser";
import type { ResultadoAccion } from "@/modules/comunicaciones/actions/comunicaciones";
import {
  cargarMaterial,
  componerYValidar,
  montarParaDestinatario,
  nuevoToken,
  type Material,
  type Montado,
} from "@/modules/comunicaciones/actions/montaje";
import { rolEnLaZona, usuarioConEscritura } from "@/modules/comunicaciones/actions/permisos";
import {
  anotarLoQueDiceZoho,
  anotarResultado,
  cerrarEnvio,
  confirmarEnvio,
  contarEnviadosHoy,
  FALTA_MIGRACION_048,
  guardarAjustes,
  guardarEnsayo,
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
import { leerCorreoEnviado } from "@/modules/comunicaciones/data/zohoCorreos";
import {
  calcularPermitidos,
  normalizarEmail,
  verificarCandado,
  type PermitidosCandado,
} from "@/modules/comunicaciones/logic/candado";
import {
  cabeEnElDia,
  puedeCambiarAjustes,
  puedeConfirmar,
  puedeDetener,
  puedeEnsayar,
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
  montarCorreoDePrueba,
  TANDA,
  type Progreso,
} from "@/modules/comunicaciones/logic/envio";
import { HUELLA_DE_OMITIDO, huellaDeCorreo } from "@/modules/comunicaciones/logic/huella";
import {
  AJUSTES_ROUTE_KEY,
  COMUNICACIONES_AJUSTES_PATH,
  COMUNICACIONES_PATH,
  comunicacionPath,
  HISTORIAL_ROUTE_KEY,
} from "@/modules/comunicaciones/logic/paths";
import {
  LIMITE_DIARIO_ZOHO,
  type ComAjustesRow,
  type ComDestinatarioRow,
  type EstadoComunicacion,
  type ImagenApertura,
  type ModoEnvio,
  type NombrePasarela,
  type ResumenDeEnsayo,
} from "@/modules/comunicaciones/types";
import { cargarEspejosDeContacto } from "@/modules/portfolio/inversores/data/inversoresRepository";

/**
 * Las acciones que pueden acabar en un correo.
 *
 * Cada una vuelve a comprobar, en el servidor, los permisos y el control que le
 * toca (`logic/controles.ts`): que la pantalla no ofrezca un botón no es lo que
 * impide pulsarlo. Y ninguna habla con Zoho para enviar por su cuenta: lo que
 * sale, sale por `enviarConCandado`.
 *
 * El correo lo monta el portal (`actions/montaje.ts`), igual en la prueba, en
 * el ensayo y en el envío, y pasa por `validarCorreo` antes de llegar al
 * candado.
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

function limiteDe(ajustes: ComAjustesRow): number {
  return Math.min(ajustes.limite_diario ?? LIMITE_DIARIO_ZOHO, LIMITE_DIARIO_ZOHO);
}

/** Solo los correos que salen por Zoho gastan del tope diario. */
function gastaDelTope(): boolean {
  return nombreDePasarelaActiva() === "zoho";
}

function pendientesDe(destinatarios: readonly ComDestinatarioRow[]): ComDestinatarioRow[] {
  return destinatarios.filter((d) => !d.excluido && d.para.length > 0 && d.estado_envio === "pendiente");
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
 * Envía el correo de verdad, montado por el portal, solo a quien ha iniciado
 * sesión.
 *
 * Sale sobre la cuenta de pruebas designada en los ajustes, no sobre un
 * destinatario de la lista, y con su propio seguimiento, que no entra en las
 * cifras.
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

    if (gastaDelTope()) {
      const tope = cabeEnElDia(await contarEnviadosHoy(user), 1, limiteDe(ctx.ajustes));
      if (tope) return { ok: false, mensaje: tope };
    }

    const cargado = await cargarMaterial(ctx.completa.comunicacion);
    if (!cargado.ok) return { ok: false, mensaje: cargado.motivo };
    const { material } = cargado;

    const espejos = await cargarEspejosDeContacto(user);
    if (espejos.sinMigracion) return { ok: false, mensaje: "Faltan las tablas de Inversores (migración 040)." };
    const permitidos = calcularPermitidos(espejos);

    const cuentaPruebas = ctx.ajustes.cuenta_pruebas_zoho_id;
    const contactoPruebas =
      espejos.cuentaContacto.find(
        (e) => e.cuenta_zoho_id === cuentaPruebas && e.es_principal === true && e.contacto_zoho_id,
      )?.contacto_zoho_id ?? null;

    const direcciones = montarCorreoDePrueba({
      comunicacion: { plantilla_id: material.plantilla.id, plantilla_modulo: material.modulo },
      cuentaPruebasZohoId: cuentaPruebas,
      contactoPruebasZohoId: contactoPruebas,
      usuarioEmail: user.email,
      remitente,
    });
    if (!direcciones.ok) return { ok: false, mensaje: direcciones.motivo };

    const token = nuevoToken();
    const montado = await componerYValidar(material, direcciones.correo, token);
    if (montado.tipo !== "correo") return { ok: false, mensaje: montado.motivo };
    if (montado.problemas.length > 0) {
      return { ok: false, mensaje: `La prueba no se envía: ${montado.problemas.join(" ")}` };
    }

    const envio = await enviarConCandado(montado.correo, permitidos);
    if (!envio.ok) return { ok: false, mensaje: envio.error };

    const r = await registrarPruebaEnviada(user, comunicacionId, {
      plantillaId: montado.correo.plantillaId,
      messageId: envio.messageId,
      pasarela: envio.pasarela,
      remitente: montado.correo.remitente,
      para: [...montado.correo.para],
      token,
      enlaces: montado.enlaces,
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
// El ensayo general — montar todos los correos sin enviar ninguno
// ---------------------------------------------------------------------------

export interface InformeDeEnsayo {
  /** Vacío = todos los correos pueden salir. Si hay uno, no se empieza. */
  problemas: { cuenta: string; problema: string }[];
  resumen: ResumenDeEnsayo;
  enviadosHoy: number;
  limiteDiario: number;
  pasarela: NombrePasarela;
}

const MONTAJES_A_LA_VEZ = 4;

/**
 * Monta TODOS los correos pendientes de la comunicación, los valida y los pasa
 * por el candado, sin enviar ninguno.
 *
 * Si todos están bien, guarda de cada uno su seguimiento, los destinos de sus
 * enlaces y su huella: al enviar se volverá a montar y tendrá que coincidir.
 * Si uno solo falla, no se guarda nada y se enseña qué falla.
 */
export async function ensayarEnvioAction(
  comunicacionId: string,
): Promise<ResultadoAccion<{ informe: InformeDeEnsayo }>> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const ctx = await cargar(user, comunicacionId);
    if (typeof ctx === "string") return { ok: false, mensaje: ctx };
    const motivo = puedeEnsayar(ctx.controles);
    if (motivo) return { ok: false, mensaje: motivo };

    const { comunicacion, destinatarios } = ctx.completa;
    const cargado = await cargarMaterial(comunicacion);
    if (!cargado.ok) return { ok: false, mensaje: cargado.motivo };
    const { material } = cargado;
    const permitidos = await permitidosAhora(user);
    const modo = ctx.ajustes.modo;
    const remitente = comunicacion.remitente_email ?? "";

    // 1. A quién va cada uno. En orden y de uno en uno: quién se omite por
    //    dirección repetida depende de los anteriores.
    const pendientes = pendientesDe(destinatarios);
    const yaEnviadas = direccionesYaEnviadas(destinatarios);
    const turnos: { destinatario: ComDestinatarioRow; token: string; yaEnviadas: Set<string> }[] = [];
    for (const destinatario of pendientes) {
      const reales = [...destinatario.para, ...destinatario.copia]
        .map((d) => normalizarEmail(d.email))
        .filter((e) => !yaEnviadas.has(e));
      const paraReal = destinatario.para.map((d) => normalizarEmail(d.email)).filter((e) => !yaEnviadas.has(e));
      turnos.push({
        destinatario,
        token: destinatario.seguimiento_token ?? nuevoToken(),
        yaEnviadas: new Set(yaEnviadas),
      });
      if (paraReal.length > 0) for (const e of reales) yaEnviadas.add(e);
    }

    // 2. Montar y validar cada correo. Aquí sí en paralelo: cada uno lee su
    //    registro de Zoho y no depende de los demás.
    const montados = new Map<string, Montado>();
    const cola = [...turnos];
    const obrero = async () => {
      for (;;) {
        const turno = cola.shift();
        if (!turno) return;
        try {
          montados.set(
            turno.destinatario.id,
            await montarParaDestinatario(material, comunicacion, turno.destinatario, {
              modo,
              usuarioEmail: user.email,
              remitente,
              yaEnviadas: turno.yaEnviadas,
              token: turno.token,
            }),
          );
        } catch (err) {
          montados.set(turno.destinatario.id, {
            tipo: "error",
            motivo: err instanceof Error ? err.message : "No se pudo montar el correo.",
          });
        }
      }
    };
    await Promise.all(Array.from({ length: MONTAJES_A_LA_VEZ }, obrero));

    // 3. El informe.
    const problemas: InformeDeEnsayo["problemas"] = [];
    const direcciones = new Set<string>();
    const conCamposVacios: ResumenDeEnsayo["conCamposVacios"] = [];
    const correos: { destinatarioId: string; token: string; enlaces: string[]; huella: string }[] = [];
    const omitidosEnsayados: typeof correos = [];
    let imagen: ImagenApertura = "pixel";

    for (const turno of turnos) {
      const cuenta = turno.destinatario.cuenta_nombre;
      const montado = montados.get(turno.destinatario.id);
      if (!montado) {
        problemas.push({ cuenta, problema: "No se llegó a montar." });
        continue;
      }
      if (montado.tipo === "omitido") {
        // También queda ensayado: como alguien que no recibe nada.
        omitidosEnsayados.push({
          destinatarioId: turno.destinatario.id,
          token: turno.token,
          enlaces: [],
          huella: HUELLA_DE_OMITIDO,
        });
        continue;
      }
      if (montado.tipo === "error") {
        problemas.push({ cuenta, problema: montado.motivo });
        continue;
      }
      for (const problema of montado.problemas) problemas.push({ cuenta, problema });
      const veredicto = verificarCandado(montado.correo, permitidos);
      if (!veredicto.ok) problemas.push({ cuenta, problema: `Candado de destinatarios: ${veredicto.motivo}.` });

      for (const d of [...montado.correo.para, ...montado.correo.copia, ...montado.correo.copiaOculta]) {
        direcciones.add(normalizarEmail(d));
      }
      if (montado.vacios.length > 0) conCamposVacios.push({ cuenta, campos: montado.vacios });
      imagen = montado.imagen;
      correos.push({
        destinatarioId: turno.destinatario.id,
        token: turno.token,
        enlaces: montado.enlaces,
        huella: await huellaDeCorreo(montado.correo),
      });
    }

    const enviadosHoy = gastaDelTope() ? await contarEnviadosHoy(user) : 0;
    const limiteDiario = limiteDe(ctx.ajustes);
    if (gastaDelTope()) {
      const tope = cabeEnElDia(enviadosHoy, correos.length, limiteDiario);
      if (tope) problemas.push({ cuenta: "Toda la comunicación", problema: tope });
    }
    if (correos.length === 0 && problemas.length === 0) {
      problemas.push({ cuenta: "Toda la comunicación", problema: "No saldría ningún correo." });
    }

    const resumen: ResumenDeEnsayo = {
      asunto: material.plantilla.asunto ?? "",
      correos: correos.length,
      omitidos: omitidosEnsayados.length,
      direcciones: [...direcciones].sort(),
      conCamposVacios,
      enlaces: material.enlaces.length,
      adjuntos: material.plantilla.adjuntos.map((a) => a.nombre),
      imagen,
      modo,
    };
    const informe: InformeDeEnsayo = {
      problemas,
      resumen,
      enviadosHoy,
      limiteDiario,
      pasarela: nombreDePasarelaActiva(),
    };

    if (problemas.length === 0) {
      const r = await guardarEnsayo(user, comunicacionId, {
        resumen,
        imagen,
        enlacesDePlantilla: material.enlaces,
        correos: [...correos, ...omitidosEnsayados],
      });
      if (!r.ok) return { ok: false, mensaje: r.error };
      refrescar(comunicacionId);
    }
    return { ok: true, informe };
  } catch (err) {
    return fallo(err, "No se pudo hacer el ensayo general.");
  }
}

// ---------------------------------------------------------------------------
// Controles 4 y 5 — resumen y confirmación
// ---------------------------------------------------------------------------

/**
 * La confirmación: teclear el número de correos que van a salir.
 *
 * Exige un ensayo general vigente. No envía nada todavía: deja la comunicación
 * «enviando» y es la pantalla la que va pidiendo las tandas.
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

    const { comunicacion, destinatarios } = ctx.completa;
    const pendientes = pendientesDe(destinatarios);
    // Todos los que van a salir tienen que venir del ensayo, con su huella.
    const sinEnsayar = pendientes.filter((d) => !d.seguimiento_token);
    if (sinEnsayar.length > 0) {
      return { ok: false, mensaje: "Hay destinatarios sin ensayar. Repite el ensayo general." };
    }

    if (gastaDelTope()) {
      const tope = cabeEnElDia(
        await contarEnviadosHoy(user),
        comunicacion.ensayo_resumen?.correos ?? pendientes.length,
        limiteDe(ctx.ajustes),
      );
      if (tope) return { ok: false, mensaje: tope };
    }

    const pasarela = nombreDePasarelaActiva();
    const r = await confirmarEnvio(user, comunicacionId, {
      numero: numeroTecleado,
      pasarela,
      modo: ctx.ajustes.modo,
      asunto: comunicacion.ensayo_resumen?.asunto ?? null,
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

/** Detiene el envío y deja dicho por qué. */
async function detenerPor(
  user: UserContext,
  comunicacionId: string,
  motivo: string,
): Promise<{ ok: false; mensaje: string }> {
  await pausarEnvio(user, comunicacionId);
  refrescar(comunicacionId);
  return { ok: false, mensaje: `El envío se ha detenido. ${motivo}` };
}

/**
 * Envía, como mucho, una tanda.
 *
 * Antes de CADA correo vuelve a leer el interruptor general, el estado y el
 * tope diario. Cada destinatario se marca «enviando» antes de enviarle; su
 * correo se vuelve a montar y tiene que coincidir con el que se ensayó. Si no
 * coincide, si no pasa la validación o si no se puede anotar el resultado, el
 * envío se detiene.
 *
 * Al acabar la tanda se le pregunta a Zoho, donde lo expone, a quién dice que
 * mandó cada correo. Si no coincide con lo que tenía que ser, también se
 * detiene.
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
    // El modo es el del ensayo. Si alguien lo cambia a mitad, no se sigue.
    const modo = comunicacion.modo_envio ?? ctx.ajustes.modo;
    const cargado = await cargarMaterial(comunicacion);
    if (!cargado.ok) return detenerPor(user, comunicacionId, cargado.motivo);
    const material: Material = cargado.material;
    const permitidos = await permitidosAhora(user);
    const yaEnviadas = direccionesYaEnviadas(destinatarios);
    const tanda = pendientesDe(destinatarios).slice(0, TANDA);
    const limite = limiteDe(ctx.ajustes);
    let enviadosHoy = gastaDelTope() ? await contarEnviadosHoy(user) : 0;

    const porVerificar: { destinatario: ComDestinatarioRow; messageId: string; para: string[]; registro: { modulo: string; id: string } }[] = [];
    let detenidoPor: string | null = null;

    for (const destinatario of tanda) {
      const [ajustes, estado] = await Promise.all([leerAjustes(user), leerEstado(user, comunicacionId)]);
      detenidoPor = puedeSeguirEnviando({
        comunicacion: { ...comunicacion, estado: estado ?? "cancelada" },
        ajustes,
        rol,
      });
      if (!detenidoPor && ajustes.modo !== modo) {
        detenidoPor = "El modo de envío ha cambiado desde el ensayo general.";
      }
      if (!detenidoPor && gastaDelTope()) detenidoPor = cabeEnElDia(enviadosHoy, 1, limite);
      if (detenidoPor) break;

      if (!destinatario.seguimiento_token || !destinatario.huella) {
        return detenerPor(user, comunicacionId, `${destinatario.cuenta_nombre} no pasó por el ensayo general.`);
      }
      if (!(await reclamarDestinatario(user, comunicacionId, destinatario))) continue;

      const montado = await montarParaDestinatario(material, comunicacion, destinatario, {
        modo,
        usuarioEmail: user.email,
        remitente: comunicacion.remitente_email ?? "",
        yaEnviadas,
        token: destinatario.seguimiento_token,
      });

      let anotado;
      if (montado.tipo === "omitido") {
        anotado = await anotarResultado(user, comunicacionId, destinatario.id, {
          estado: "omitido",
          motivo: montado.motivo,
        });
      } else if (destinatario.huella === HUELLA_DE_OMITIDO) {
        // En el ensayo no recibía nada, y ahora sí saldría (el correo que
        // llevaba su dirección no llegó a salir). Sin ensayar no sale.
        anotado = await anotarResultado(user, comunicacionId, destinatario.id, {
          estado: "omitido",
          motivo:
            "En el ensayo general se omitía por dirección repetida, y el correo que llevaba esa dirección no ha salido. No se envía sin ensayar: prepara un reenvío.",
        });
      } else if (montado.tipo === "error" || montado.problemas.length > 0) {
        const error = montado.tipo === "error" ? montado.motivo : montado.problemas.join(" ");
        await anotarResultado(user, comunicacionId, destinatario.id, {
          estado: "error",
          error,
          enviadoPara: null,
          pasarela: null,
        });
        // Un correo que no se puede montar bien no es un caso aislado: se para.
        return detenerPor(user, comunicacionId, `${destinatario.cuenta_nombre}: ${error}`);
      } else if ((await huellaDeCorreo(montado.correo)) !== destinatario.huella) {
        const error = "El correo ya no es el que se ensayó: algo ha cambiado en Zoho o en la plantilla. No se ha enviado.";
        await anotarResultado(user, comunicacionId, destinatario.id, {
          estado: "error",
          error,
          enviadoPara: null,
          pasarela: null,
        });
        return detenerPor(user, comunicacionId, `${destinatario.cuenta_nombre}: ${error} Repite el ensayo general.`);
      } else {
        const envio = await enviarConCandado(montado.correo, permitidos);
        if (envio.ok) {
          for (const direccion of montado.direccionesReales) yaEnviadas.add(normalizarEmail(direccion));
          if (envio.pasarela === "zoho") {
            enviadosHoy++;
            porVerificar.push({
              destinatario,
              messageId: envio.messageId,
              para: [...montado.correo.para],
              registro: montado.correo.registro,
            });
          }
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
          if (envio.bloqueadoPorCandado) {
            // El ensayo dijo que podía salir y el candado dice que no: algo va mal.
            return detenerPor(user, comunicacionId, `${destinatario.cuenta_nombre}: ${envio.error}`);
          }
        }
      }

      if (!anotado.ok) {
        // Sin poder anotar no se sigue: el siguiente correo saldría a ciegas.
        return detenerPor(
          user,
          comunicacionId,
          `No se pudo anotar un resultado (${destinatario.cuenta_nombre}): ${anotado.error}`,
        );
      }
    }

    // A quién dice Zoho que mandó cada correo de esta tanda.
    if (porVerificar.length > 0) {
      await new Promise((resolver) => setTimeout(resolver, 4000));
      for (const v of porVerificar) {
        let verificado: "coincide" | "no_coincide" | "sin_dato" = "sin_dato";
        try {
          const enZoho = await leerCorreoEnviado(v.registro.modulo, v.registro.id, v.messageId);
          if (enZoho.soportado && enZoho.para.length > 0) {
            const esperado = v.para.map(normalizarEmail).sort().join(",");
            verificado = [...enZoho.para].sort().join(",") === esperado ? "coincide" : "no_coincide";
          }
        } catch {
          verificado = "sin_dato";
        }
        await anotarLoQueDiceZoho(user, v.destinatario.id, { verificado });
        if (verificado === "no_coincide") {
          return detenerPor(
            user,
            comunicacionId,
            `Zoho dice haber enviado el correo de ${v.destinatario.cuenta_nombre} a otras direcciones. Revísalo en su ficha antes de seguir.`,
          );
        }
      }
    }

    let despues = await leerComunicacion(user, comunicacionId);
    if (!despues) return { ok: false, mensaje: "La comunicación ha dejado de existir." };
    let progreso = calcularProgreso(despues.destinatarios);

    if (detenidoPor && despues.comunicacion.estado === "enviando" && detenidoPor.startsWith("Tope diario")) {
      // Mañana se podrá reanudar; hoy no tiene sentido seguir pidiendo tandas.
      await pausarEnvio(user, comunicacionId);
      despues = (await leerComunicacion(user, comunicacionId)) ?? despues;
    }
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
  limiteDiario: number;
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
  const limite = Number(entrada.limiteDiario);
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_DIARIO_ZOHO) {
    return {
      ok: false,
      mensaje: `El tope diario tiene que estar entre 1 y ${LIMITE_DIARIO_ZOHO}, que es el límite de Zoho.`,
    };
  }

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
      limite_diario: limite,
    });
    if (!r.ok) return { ok: false, mensaje: r.error };
    revalidatePath(COMUNICACIONES_AJUSTES_PATH);
    revalidatePath(COMUNICACIONES_PATH, "layout");
    return { ok: true };
  } catch (err) {
    return fallo(err, "No se pudieron guardar los ajustes.");
  }
}
