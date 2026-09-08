import type { UserContext } from "@/lib/auth/currentUser";
import {
  listCorpDiccionario,
  listCorpNotas,
  listCorpPeriodos,
} from "@/modules/corporativo/data/corpPeriodosRepository";
import type {
  CorpDiccionarioEntrada,
  CorpNota,
  CorpPeriodo,
} from "@/modules/corporativo/types";

export interface CorporativoPageData {
  filas: CorpPeriodo[];
  diccionario: CorpDiccionarioEntrada[];
  notas: CorpNota[];
  /** Mensaje de error de la consulta de periodos; el resto no es crítico. */
  error: string | null;
}

/**
 * Carga las tres tablas del maestro de una vez.
 *
 * Son 83 filas más glosario y notas: cabe entero en memoria, así que la página
 * filtra y agrega en servidor sin volver a la base de datos por cada gráfica.
 * Glosario y notas viajan en paralelo y su fallo no tumba la página: sin ellos
 * el tab pierde las descripciones, no las cifras.
 */
export async function loadCorporativoPage(ctx: UserContext): Promise<CorporativoPageData> {
  const [periodos, diccionario, notas] = await Promise.all([
    listCorpPeriodos(ctx),
    listCorpDiccionario(ctx),
    listCorpNotas(ctx),
  ]);

  return {
    filas: periodos.data ?? [],
    diccionario: diccionario.data ?? [],
    notas: notas.data ?? [],
    error: periodos.error?.message ?? null,
  };
}

/** Descripción del glosario para un campo, si el maestro la trae. */
export function descripcionDe(
  diccionario: CorpDiccionarioEntrada[],
  campo: string,
): string | null {
  return diccionario.find((d) => d.campo === campo)?.descripcion ?? null;
}
