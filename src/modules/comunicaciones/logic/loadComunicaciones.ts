import type { UserContext } from "@/lib/auth/currentUser";
import {
  leerAjustes,
  leerComunicacion,
  listarComunicaciones,
} from "@/modules/comunicaciones/data/comunicacionesRepository";
import { nombreDePasarelaActiva } from "@/modules/comunicaciones/data/pasarela";
import {
  leerEnlaces,
  leerEventos,
  leerParaElAgregado,
  type DatosDelAgregado,
} from "@/modules/comunicaciones/data/seguimientoRepository";
import { abrio, hizoClic } from "@/modules/comunicaciones/logic/analitica";
import { calcularPermitidos, type PermitidosCandado } from "@/modules/comunicaciones/logic/candado";
import { contarAudiencias, resumirDestinatarios } from "@/modules/comunicaciones/logic/destinatarios";
import type {
  ComAjustesRow,
  ComComunicacionRow,
  ComDestinatarioRow,
  ComEnlaceRow,
  ComEventoRow,
  ComunicacionConResumen,
  NombrePasarela,
  RecuentoAudiencias,
  ResumenDestinatarios,
} from "@/modules/comunicaciones/types";
import {
  cargarEspejosDeContacto,
  ultimoSyncOk,
} from "@/modules/portfolio/inversores/data/inversoresRepository";

/**
 * Todo lo que necesita cada pantalla, en una llamada y sin lanzar nunca.
 *
 * Mismo criterio que `loadInversoresPage`: una pestaña que dice qué le pasa es
 * mejor que una que se cae entera. El `error` viaja hasta la UI y se pinta.
 */

function mensaje(err: unknown, porDefecto: string): string {
  return err instanceof Error ? err.message : porDefecto;
}

export interface DatosHistorial {
  comunicaciones: ComunicacionConResumen[];
  sinMigracion: boolean;
  error: string | null;
}

export async function loadHistorial(ctx: UserContext): Promise<DatosHistorial> {
  try {
    const [lista, ajustes] = await Promise.all([listarComunicaciones(ctx), leerAjustes(ctx)]);
    const porComunicacion = new Map<string, typeof lista.destinatarios>();
    for (const d of lista.destinatarios) {
      const grupo = porComunicacion.get(d.comunicacion_id) ?? [];
      grupo.push(d);
      porComunicacion.set(d.comunicacion_id, grupo);
    }
    return {
      comunicaciones: lista.comunicaciones.map((comunicacion) => {
        const suyos = porComunicacion.get(comunicacion.id) ?? [];
        const enviados = suyos.filter((d) => !d.excluido && d.estado_envio === "enviado");
        return {
          comunicacion,
          resumen: resumirDestinatarios(suyos, ajustes.dominios_internos),
          seguimiento: {
            enviados: enviados.length,
            abiertos: enviados.filter((d) => abrio(d)).length,
            conClic: enviados.filter((d) => hizoClic(d)).length,
          },
        };
      }),
      sinMigracion: lista.sinMigracion,
      error: null,
    };
  } catch (err) {
    return {
      comunicaciones: [],
      sinMigracion: false,
      error: mensaje(err, "No se pudo leer el historial de comunicaciones."),
    };
  }
}

export interface DatosNueva {
  recuento: RecuentoAudiencias;
  /** Cuándo terminó la última copia correcta de Zoho. */
  datosZohoAt: string | null;
  sinMigracion: boolean;
  error: string | null;
}

const RECUENTO_VACIO: RecuentoAudiencias = {
  todaLaBase: 0,
  inversoresDirectos: 0,
  sinDatoIntermediario: 0,
  promociones: [],
};

export async function loadNueva(ctx: UserContext): Promise<DatosNueva> {
  try {
    const [espejos, datosZohoAt] = await Promise.all([cargarEspejosDeContacto(ctx), ultimoSyncOk(ctx)]);
    return {
      recuento: espejos.sinMigracion ? RECUENTO_VACIO : contarAudiencias(espejos),
      datosZohoAt,
      sinMigracion: espejos.sinMigracion,
      error: null,
    };
  } catch (err) {
    return {
      recuento: RECUENTO_VACIO,
      datosZohoAt: null,
      sinMigracion: false,
      error: mensaje(err, "No se pudieron leer los datos de inversores."),
    };
  }
}

/** Lo que hay que saber de los envíos antes de tocar nada: quién puede recibir y por dónde saldría. */
export interface DatosDeEnvios {
  ajustes: ComAjustesRow | null;
  /** Direcciones que el candado deja pasar. */
  emailsPermitidos: string[];
  /** Cuentas de prueba sobre las que se puede enviar. */
  cuentasPermitidas: { zohoId: string; nombre: string }[];
  promocionEncontrada: boolean;
  /** El candado entero, para simular en el servidor qué dejaría salir. No viaja al navegador. */
  permitidos: PermitidosCandado | null;
  pasarela: NombrePasarela;
  error: string | null;
}

export async function loadDatosDeEnvios(ctx: UserContext): Promise<DatosDeEnvios> {
  const pasarela = nombreDePasarelaActiva();
  try {
    const [ajustes, espejos] = await Promise.all([leerAjustes(ctx), cargarEspejosDeContacto(ctx)]);
    const permitidos = calcularPermitidos(espejos);
    return {
      ajustes,
      emailsPermitidos: [...permitidos.emails].sort(),
      cuentasPermitidas: permitidos.cuentas,
      promocionEncontrada: permitidos.promocionEncontrada,
      permitidos,
      pasarela,
      error: null,
    };
  } catch (err) {
    return {
      ajustes: null,
      emailsPermitidos: [],
      cuentasPermitidas: [],
      promocionEncontrada: false,
      permitidos: null,
      pasarela,
      error: mensaje(err, "No se pudo leer el estado de los envíos."),
    };
  }
}

// ---------------------------------------------------------------------------
// Analítica
// ---------------------------------------------------------------------------

export interface DatosDeAnalitica {
  comunicacion: ComComunicacionRow | null;
  destinatarios: ComDestinatarioRow[];
  eventos: ComEventoRow[];
  enlaces: ComEnlaceRow[];
  /** La comunicación de la que sale esta, si es un reenvío. */
  origen: { id: string; nombre: string } | null;
  /** Los reenvíos que han salido de esta. */
  reenvios: { id: string; nombre: string; estado: string }[];
  error: string | null;
}

export async function loadAnalitica(ctx: UserContext, id: string): Promise<DatosDeAnalitica> {
  const vacio: DatosDeAnalitica = {
    comunicacion: null,
    destinatarios: [],
    eventos: [],
    enlaces: [],
    origen: null,
    reenvios: [],
    error: null,
  };
  try {
    const completa = await leerComunicacion(ctx, id);
    if (!completa) return vacio;
    const [eventos, enlaces, lista] = await Promise.all([
      leerEventos(ctx, id),
      leerEnlaces(ctx, id),
      listarComunicaciones(ctx, 500),
    ]);
    const origenId = completa.comunicacion.origen_comunicacion_id;
    const origen = origenId ? lista.comunicaciones.find((c) => c.id === origenId) : undefined;
    return {
      comunicacion: completa.comunicacion,
      destinatarios: completa.destinatarios,
      eventos,
      enlaces,
      origen: origen ? { id: origen.id, nombre: origen.nombre } : null,
      reenvios: lista.comunicaciones
        .filter((c) => c.origen_comunicacion_id === id)
        .map((c) => ({ id: c.id, nombre: c.nombre, estado: c.estado })),
      error: null,
    };
  } catch (err) {
    return { ...vacio, error: mensaje(err, "No se pudo leer la analítica.") };
  }
}

export interface DatosDelAgregadoDePantalla {
  datos: DatosDelAgregado;
  error: string | null;
}

export async function loadAnaliticaGlobal(ctx: UserContext, desdeIso: string | null): Promise<DatosDelAgregadoDePantalla> {
  try {
    return { datos: await leerParaElAgregado(ctx, desdeIso), error: null };
  } catch (err) {
    return {
      datos: { comunicaciones: [], destinatarios: [] },
      error: mensaje(err, "No se pudo leer la analítica."),
    };
  }
}

export interface DatosDetalle {
  comunicacion: ComComunicacionRow | null;
  destinatarios: ComDestinatarioRow[];
  resumen: ResumenDestinatarios;
  ajustes: ComAjustesRow | null;
  error: string | null;
}

export async function loadDetalle(ctx: UserContext, id: string): Promise<DatosDetalle> {
  const vacio = resumirDestinatarios([], []);
  try {
    const [completa, ajustes] = await Promise.all([leerComunicacion(ctx, id), leerAjustes(ctx)]);
    if (!completa) {
      return { comunicacion: null, destinatarios: [], resumen: vacio, ajustes, error: null };
    }
    return {
      comunicacion: completa.comunicacion,
      destinatarios: completa.destinatarios,
      resumen: resumirDestinatarios(completa.destinatarios, ajustes.dominios_internos),
      ajustes,
      error: null,
    };
  } catch (err) {
    return {
      comunicacion: null,
      destinatarios: [],
      resumen: vacio,
      ajustes: null,
      error: mensaje(err, "No se pudo leer la comunicación."),
    };
  }
}
