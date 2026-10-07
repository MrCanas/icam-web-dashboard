"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/withAudit";
import { usuarioConEscritura, usuarioConLectura } from "@/modules/comunicaciones/actions/permisos";
import {
  cambiarExclusion,
  cancelarComunicacion,
  crearComunicacion,
  guardarPlantilla,
  leerAjustes,
  leerComunicacion,
} from "@/modules/comunicaciones/data/comunicacionesRepository";
import {
  leerPlantilla,
  listarPlantillas,
  MODULOS_DE_PLANTILLA,
} from "@/modules/comunicaciones/data/zohoPlantillas";
import { leerRegistro } from "@/modules/comunicaciones/data/zohoRegistros";
import { resolverDestinatariosConDns } from "@/modules/comunicaciones/actions/resolver";
import { adjuntosDePlantilla } from "@/modules/comunicaciones/logic/composicion";
import { mismoDia } from "@/modules/comunicaciones/logic/controles";
import { instrumentarParaVistaPrevia } from "@/modules/comunicaciones/logic/seguimiento";
import { cuentasDeAudiencia } from "@/modules/comunicaciones/logic/destinatarios";
import {
  COMUNICACIONES_NUEVA_PATH,
  COMUNICACIONES_PATH,
  comunicacionPath,
  HISTORIAL_ROUTE_KEY,
  NUEVA_ROUTE_KEY,
} from "@/modules/comunicaciones/logic/paths";
import { renderizarPlantilla, type VistaPrevia } from "@/modules/comunicaciones/logic/plantilla";
import {
  AUDIENCIAS,
  ETIQUETA_AUDIENCIA,
  ETIQUETA_TIPO,
  ROLES_CONTACTO,
  TIPOS_COMUNICACION,
  type Audiencia,
  type RolContacto,
  type TipoComunicacion,
} from "@/modules/comunicaciones/types";
import {
  cargarEspejosDeContacto,
  ultimoSyncOk,
} from "@/modules/portfolio/inversores/data/inversoresRepository";
import { sincronizarInversores } from "@/modules/portfolio/inversores/logic/inversoresSync";
import { isZohoConfigured, listarCampos } from "@/lib/zoho/client";

/**
 * Acciones de preparación del módulo Comunicaciones.
 *
 * NINGUNA de este fichero envía un correo. Preparan la comunicación, guardan la
 * foto de sus destinatarios y enseñan la plantilla. El envío, con sus
 * controles, está en `actions/envio.ts`.
 *
 * Todas repiten el corte de permisos: una Server Action es alcanzable por POST
 * directo, no solo desde su botón. Y ninguna lanza: devuelven el resultado y la
 * pantalla lo pinta.
 */

export type ResultadoAccion<T = object> = ({ ok: true } & T) | { ok: false; mensaje: string };

function esUno<T extends string>(valor: unknown, validos: readonly T[]): valor is T {
  return typeof valor === "string" && (validos as readonly string[]).includes(valor);
}

function soloRoles(valores: unknown): RolContacto[] {
  if (!Array.isArray(valores)) return [];
  return ROLES_CONTACTO.filter((r) => valores.includes(r));
}

// ---------------------------------------------------------------------------
// Preparar
// ---------------------------------------------------------------------------

export interface PrepararEntrada {
  tipo: string;
  audiencia: string;
  promocionZohoId?: string | null;
  rolesPara: string[];
  rolesCopia: string[];
}

/**
 * Calcula los destinatarios de una audiencia y los guarda como foto fija.
 *
 * No envía nada y no deja nada «listo para enviar»: la comunicación nace en
 * borrador y lo siguiente es revisarla.
 */
export async function prepararComunicacionAction(
  entrada: PrepararEntrada,
): Promise<ResultadoAccion<{ id: string; path: string }>> {
  const user = await usuarioConEscritura(NUEVA_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  if (!esUno<TipoComunicacion>(entrada.tipo, TIPOS_COMUNICACION)) {
    return { ok: false, mensaje: "Elige el tipo de comunicación." };
  }
  if (!esUno<Audiencia>(entrada.audiencia, AUDIENCIAS)) {
    return { ok: false, mensaje: "Elige a quién va dirigida." };
  }
  const tipo = entrada.tipo;
  const audiencia = entrada.audiencia;
  const rolesPara = soloRoles(entrada.rolesPara);
  const rolesCopia = soloRoles(entrada.rolesCopia).filter((r) => !rolesPara.includes(r));
  if (rolesPara.length === 0) {
    return { ok: false, mensaje: "Elige al menos un papel de contacto para «Para»." };
  }
  const promocionZohoId = audiencia === "promocion" ? (entrada.promocionZohoId ?? "").trim() : "";
  if (audiencia === "promocion" && !promocionZohoId) {
    return { ok: false, mensaje: "Elige la promoción o el fondo." };
  }

  try {
    const [espejos, datosZohoAt, ajustes] = await Promise.all([
      cargarEspejosDeContacto(user),
      ultimoSyncOk(user),
      leerAjustes(user),
    ]);
    if (espejos.sinMigracion) {
      return { ok: false, mensaje: "Faltan las tablas de Inversores (migración 040)." };
    }
    if (!mismoDia(datosZohoAt, new Date())) {
      return {
        ok: false,
        mensaje: "Los datos de Zoho no son de hoy. Pulsa «Actualizar datos de Zoho» antes de preparar.",
      };
    }

    const promocion =
      audiencia === "promocion" ? espejos.promociones.find((p) => p.zoho_id === promocionZohoId) : undefined;
    if (audiencia === "promocion" && !promocion) {
      return { ok: false, mensaje: "La promoción elegida ya no está en los datos de Zoho." };
    }

    const cuentas = cuentasDeAudiencia(espejos, { audiencia, promocionZohoId });
    if (cuentas.length === 0) {
      return { ok: false, mensaje: "Esa audiencia no tiene ninguna cuenta de inversión." };
    }
    // Se le pregunta al DNS si cada dominio de la audiencia recibe correo. Si
    // no contesta, no se excluye a nadie por ello.
    const destinatarios = await resolverDestinatariosConDns(cuentas, espejos, {
      rolesPara,
      rolesCopia,
      dominiosInternos: ajustes.dominios_internos,
    });

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    const destino = promocion ? (promocion.codigo ?? promocion.nombre) : ETIQUETA_AUDIENCIA[audiencia];
    const creada = await crearComunicacion(
      user,
      {
        nombre: `${ETIQUETA_TIPO[tipo]} · ${destino} · ${hoy}`,
        tipo,
        audiencia,
        promocionZohoId: promocion?.zoho_id ?? null,
        promocionNombre: promocion?.nombre ?? null,
        rolesPara,
        rolesCopia,
        datosZohoAt,
      },
      destinatarios,
    );
    if (!creada.ok) return { ok: false, mensaje: creada.error };

    revalidatePath(COMUNICACIONES_PATH);
    return { ok: true, id: creada.id, path: comunicacionPath(creada.id) };
  } catch (err) {
    return {
      ok: false,
      mensaje: err instanceof Error ? err.message : "No se pudo preparar la comunicación.",
    };
  }
}

// ---------------------------------------------------------------------------
// Datos de Zoho
// ---------------------------------------------------------------------------

/**
 * Trae de Zoho los datos de inversores, como el botón de la pestaña Inversores.
 *
 * Es la misma sincronización (solo lectura contra Zoho), con el permiso de esta
 * zona: quien prepara comunicaciones no tiene por qué tener Financiero.
 */
export async function actualizarDatosZohoAction(): Promise<ResultadoAccion<{ mensaje: string }>> {
  const user = await usuarioConEscritura(NUEVA_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  const resultado = await withAudit(
    user,
    "comunicaciones.inversores.sync",
    { resourceType: "inv_cuentas", payload: { origen: "manual" } },
    () => sincronizarInversores(user, { origen: "manual" }),
  );
  if (!resultado.ok) return { ok: false, mensaje: resultado.error };

  revalidatePath(COMUNICACIONES_NUEVA_PATH);
  const fallidos = resultado.modulos.filter((m) => m.error);
  if (resultado.estado === "parcial") {
    return {
      ok: false,
      mensaje: `Sincronización parcial: falló ${fallidos.map((m) => m.modulo).join(", ")}.`,
    };
  }
  const leidos = resultado.modulos.reduce((acc, m) => acc + m.leidos, 0);
  return { ok: true, mensaje: `Datos actualizados: ${leidos} registros de Zoho.` };
}

// ---------------------------------------------------------------------------
// Lista de destinatarios
// ---------------------------------------------------------------------------

export async function cambiarExclusionAction(
  comunicacionId: string,
  destinatarioId: string,
  excluido: boolean,
): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  const r = await cambiarExclusion(user, comunicacionId, destinatarioId, excluido, null);
  if (!r.ok) return { ok: false, mensaje: r.error };
  revalidatePath(comunicacionPath(comunicacionId));
  return { ok: true };
}

export async function cancelarComunicacionAction(comunicacionId: string): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  const r = await cancelarComunicacion(user, comunicacionId);
  if (!r.ok) return { ok: false, mensaje: r.error };
  revalidatePath(COMUNICACIONES_PATH);
  revalidatePath(comunicacionPath(comunicacionId));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plantilla
// ---------------------------------------------------------------------------

export interface OpcionPlantilla {
  id: string;
  nombre: string;
  modulo: string | null;
  asunto: string | null;
  carpeta: string | null;
}

/** Las plantillas del CRM entre las que elegir. Se leen de Zoho en vivo. */
export async function listarPlantillasAction(): Promise<ResultadoAccion<{ plantillas: OpcionPlantilla[] }>> {
  const user = await usuarioConLectura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };
  if (!isZohoConfigured({ conModulo: false })) {
    return { ok: false, mensaje: "La integración con Zoho no está configurada." };
  }

  try {
    const plantillas: OpcionPlantilla[] = [];
    // En serie: son llamadas a /settings y Zoho limita por minuto.
    for (const modulo of MODULOS_DE_PLANTILLA) {
      for (const p of await listarPlantillas(modulo)) {
        plantillas.push({ id: p.id, nombre: p.nombre, modulo: p.modulo ?? modulo, asunto: p.asunto, carpeta: p.carpeta });
      }
    }
    return { ok: true, plantillas };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : "No se pudieron leer las plantillas." };
  }
}

export async function elegirPlantillaAction(
  comunicacionId: string,
  plantillaId: string,
): Promise<ResultadoAccion> {
  const user = await usuarioConEscritura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    // Se vuelve a leer de Zoho: el nombre y el módulo no se aceptan del navegador.
    const plantilla = await leerPlantilla(plantillaId);
    const r = await guardarPlantilla(user, comunicacionId, {
      id: plantilla.id,
      nombre: plantilla.nombre,
      modulo: plantilla.modulo,
    });
    if (!r.ok) return { ok: false, mensaje: r.error };
    revalidatePath(comunicacionPath(comunicacionId));
    return { ok: true };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : "No se pudo guardar la plantilla." };
  }
}

export interface VistaPreviaDeDestinatario extends VistaPrevia {
  plantillaNombre: string;
  /** Sobre qué registro se han resuelto los campos. */
  registroNombre: string;
  para: string[];
  copia: string[];
  /** Los adjuntos de la plantilla, que viajarán con el correo. */
  adjuntos: string[];
  /** Qué imagen se añade para saber si se abre: una invisible o el logotipo. */
  imagen: "pixel" | "logo";
}

/**
 * La plantilla elegida, con los campos combinados de un destinatario concreto.
 *
 * Lee la plantilla y el registro de Zoho en vivo. Es una imitación de lo que
 * hará Zoho al enviar, no el correo real.
 */
export async function vistaPreviaAction(
  comunicacionId: string,
  destinatarioId: string,
): Promise<ResultadoAccion<{ vista: VistaPreviaDeDestinatario }>> {
  const user = await usuarioConLectura(HISTORIAL_ROUTE_KEY);
  if (typeof user === "string") return { ok: false, mensaje: user };

  try {
    const completa = await leerComunicacion(user, comunicacionId);
    if (!completa) return { ok: false, mensaje: "La comunicación no existe." };
    const { comunicacion, destinatarios } = completa;
    if (!comunicacion.plantilla_id) return { ok: false, mensaje: "Elige antes una plantilla." };
    const destinatario = destinatarios.find((d) => d.id === destinatarioId);
    if (!destinatario) return { ok: false, mensaje: "El destinatario no existe." };

    const plantilla = await leerPlantilla(comunicacion.plantilla_id);
    const modulo = plantilla.modulo ?? comunicacion.plantilla_modulo ?? "Cuentas_de_Inversi_n";
    // Una plantilla de Contactos se resuelve sobre el primer contacto en «Para».
    const registroId =
      modulo === "Contacts" ? destinatario.para[0]?.contactoZohoId : destinatario.cuenta_zoho_id;
    if (!registroId) {
      return { ok: false, mensaje: "Este destinatario no tiene un contacto sobre el que resolver la plantilla." };
    }
    const registro = await leerRegistro(modulo, registroId);
    if (!registro) return { ok: false, mensaje: "Zoho no devolvió el registro del destinatario." };

    // Con los tipos de campo, igual que al enviar: lo que aquí salga en rojo es
    // lo que impediría que el correo saliera.
    const tipos = new Map((await listarCampos(modulo)).map((c) => [c.api_name, c.data_type]));
    const montado = renderizarPlantilla({ asunto: plantilla.asunto, html: plantilla.html }, modulo, registro, tipos);
    const conImagen = instrumentarParaVistaPrevia(montado.html);

    return {
      ok: true,
      vista: {
        ...montado,
        html: conImagen.html,
        imagen: conImagen.imagen,
        adjuntos: adjuntosDePlantilla(plantilla.crudo).map((a) => a.nombre),
        plantillaNombre: plantilla.nombre,
        registroNombre:
          modulo === "Contacts" ? (destinatario.para[0]?.nombre ?? "") : destinatario.cuenta_nombre,
        para: destinatario.para.map((d) => d.email),
        copia: destinatario.copia.map((d) => d.email),
      },
    };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : "No se pudo montar la vista previa." };
  }
}
