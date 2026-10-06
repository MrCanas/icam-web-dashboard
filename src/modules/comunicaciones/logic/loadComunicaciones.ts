import type { UserContext } from "@/lib/auth/currentUser";
import {
  leerAjustes,
  leerComunicacion,
  listarComunicaciones,
} from "@/modules/comunicaciones/data/comunicacionesRepository";
import { contarAudiencias, resumirDestinatarios } from "@/modules/comunicaciones/logic/destinatarios";
import type {
  ComAjustesRow,
  ComComunicacionRow,
  ComDestinatarioRow,
  ComunicacionConResumen,
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
      comunicaciones: lista.comunicaciones.map((comunicacion) => ({
        comunicacion,
        resumen: resumirDestinatarios(
          porComunicacion.get(comunicacion.id) ?? [],
          ajustes.dominios_internos,
        ),
      })),
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
