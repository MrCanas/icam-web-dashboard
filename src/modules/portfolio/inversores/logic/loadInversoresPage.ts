import type { UserContext } from "@/lib/auth/currentUser";
import {
  cargarEspejos,
  ultimoSync,
  ultimoSyncOk,
} from "@/modules/portfolio/inversores/data/inversoresRepository";
import { construirModelo } from "@/modules/portfolio/inversores/logic/inversoresModel";
import type {
  EstadoSincronizacion,
  ModeloInversores,
} from "@/modules/portfolio/inversores/types";

export interface DatosInversores {
  modelo: ModeloInversores;
  sync: EstadoSincronizacion;
  /** La migración 040 no está aplicada. */
  sinMigracion: boolean;
  /** Fallo de lectura. La página lo pinta en vez de reventar. */
  error: string | null;
}

const MODELO_VACIO: ModeloInversores = {
  cuentas: [],
  kpis: {
    comprometido: 0,
    aportado: 0,
    repartido: 0,
    pendiente: 0,
    dpi: null,
    numCuentas: 0,
    numInversores: 0,
    numPromociones: 0,
  },
  porPromocion: [],
  porTrimestre: [],
  tramos: [],
  topCuentas: [],
};

/**
 * Todo lo que necesita la pantalla, en una llamada y sin lanzar nunca.
 *
 * Mismo criterio que `loadCorporativoPage`: una pestaña que se cae entera
 * porque una tabla no responde es peor que una que dice qué le pasa. El
 * `error` viaja hasta la UI y se pinta.
 */
export async function loadInversoresPage(ctx: UserContext): Promise<DatosInversores> {
  try {
    const [espejos, ultimo, ultimoOk] = await Promise.all([
      cargarEspejos(ctx),
      ultimoSync(ctx),
      ultimoSyncOk(ctx),
    ]);

    return {
      modelo: espejos.sinMigracion ? MODELO_VACIO : construirModelo(espejos),
      sync: { ultimo, ultimoOk },
      sinMigracion: espejos.sinMigracion,
      error: null,
    };
  } catch (err) {
    return {
      modelo: MODELO_VACIO,
      sync: { ultimo: null, ultimoOk: null },
      sinMigracion: false,
      error: err instanceof Error ? err.message : "No se pudieron leer los datos de inversores.",
    };
  }
}
