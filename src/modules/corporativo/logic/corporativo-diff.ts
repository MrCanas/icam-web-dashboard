import type { CorpPeriodo } from "@/modules/corporativo/types";

/**
 * Diff entre el snapshot corporativo actual y el que trae el maestro recién
 * parseado. Alimenta el `detalle` de `upload_logs`.
 *
 * Existe por lo mismo que su gemelo de portfolio: el RPC hace `DELETE` + `INSERT`
 * y, sin este registro, una carga que cambiara media cuenta de resultados sería
 * indistinguible de una que no tocara nada.
 */

export const TOLERANCIA_NUMERICA = 1e-3;

/** Los campos que se comparan fila a fila: los que cuentan la historia económica. */
const CAMPOS_COMPARADOS = [
  "facturacion",
  "gastos_totales",
  "ebitda",
  "ebitda_caja",
  "capital_bajo_gestion",
  "n_vehiculos",
  "saldo_caja_cierre",
  "naturaleza",
  "es_ultima_fila",
] as const;

export type CampoComparado = (typeof CAMPOS_COMPARADOS)[number];

export interface CambioCampo {
  antes: number | string | null;
  despues: number | string | null;
}

export interface PeriodoModificado {
  id: string;
  cambios: Partial<Record<CampoComparado, CambioCampo>>;
}

/**
 * Foto agregada del snapshot. Solo mira las filas de tipo AÑO para no sumar
 * trimestres y años a la vez, que es la trampa clásica de este maestro.
 */
export interface ResumenCorp {
  filas: number;
  sociedades: number;
  /** Facturación de GRUPO sumando sus filas de tipo AÑO. */
  facturacionGrupoAnios: number;
  ebitdaGrupoAnios: number;
  /** AUM del último trimestre real de GRUPO (stock: no se suma). */
  aumUltimoReal: number;
  ultimoPeriodoReal: string | null;
}

export interface CorporativoDiffResult {
  resumen: { antes: ResumenCorp; despues: ResumenCorp };
  nuevos: string[];
  eliminados: string[];
  modificados: PeriodoModificado[];
  sinCambios: number;
}

function iguales(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= TOLERANCIA_NUMERICA;
  }
  return a === b;
}

export function resumirCorp(filas: CorpPeriodo[]): ResumenCorp {
  const grupoAnios = filas.filter((f) => f.sociedad === "GRUPO" && f.tipo_periodo === "AÑO");
  const ultimoReal = filas.find((f) => f.sociedad === "GRUPO" && f.es_ultima_fila === 1) ?? null;

  return {
    filas: filas.length,
    sociedades: new Set(filas.map((f) => f.sociedad)).size,
    facturacionGrupoAnios: grupoAnios.reduce((acc, f) => acc + (f.facturacion ?? 0), 0),
    ebitdaGrupoAnios: grupoAnios.reduce((acc, f) => acc + (f.ebitda ?? 0), 0),
    aumUltimoReal: ultimoReal?.capital_bajo_gestion ?? 0,
    ultimoPeriodoReal: ultimoReal?.periodo ?? null,
  };
}

export function compararCorpPeriodos(
  antes: CorpPeriodo[],
  despues: CorpPeriodo[],
): CorporativoDiffResult {
  const porIdAntes = new Map(antes.map((f) => [f.id, f]));
  const porIdDespues = new Map(despues.map((f) => [f.id, f]));

  const nuevos: string[] = [];
  const modificados: PeriodoModificado[] = [];
  let sinCambios = 0;

  for (const fila of despues) {
    const previo = porIdAntes.get(fila.id);
    if (!previo) {
      nuevos.push(fila.id);
      continue;
    }
    const cambios: Partial<Record<CampoComparado, CambioCampo>> = {};
    for (const campo of CAMPOS_COMPARADOS) {
      if (!iguales(previo[campo], fila[campo])) {
        cambios[campo] = {
          antes: (previo[campo] ?? null) as number | string | null,
          despues: (fila[campo] ?? null) as number | string | null,
        };
      }
    }
    if (Object.keys(cambios).length > 0) modificados.push({ id: fila.id, cambios });
    else sinCambios += 1;
  }

  const eliminados = antes.filter((f) => !porIdDespues.has(f.id)).map((f) => f.id);

  return {
    resumen: { antes: resumirCorp(antes), despues: resumirCorp(despues) },
    nuevos,
    eliminados,
    modificados,
    sinCambios,
  };
}

export function buildCorporativoUploadLogDetalle(
  diff: CorporativoDiffResult,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    resumen: diff.resumen,
    nuevos: diff.nuevos,
    eliminados: diff.eliminados,
    modificados: diff.modificados,
    sinCambios: diff.sinCambios,
    ...extras,
  };
}
