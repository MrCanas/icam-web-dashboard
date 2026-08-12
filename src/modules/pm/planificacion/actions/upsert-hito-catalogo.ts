"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";
import { TABLA_MADRE_COLUMNAS_HITO } from "@/modules/pm/planificacion/logic/tabla-madre-columnas";

export type UpdateHitoCatalogoInput = {
  id: string;
  /**
   * Cabecera en la hoja "Tabla madre". Si está en TABLA_MADRE_COLUMNAS_HITO se
   * marca tabla_madre_existe=true (la columna ya existe); si es texto libre, se
   * guarda como PROPUESTA para el día que se añada al Excel.
   */
  tablaMadreColumna?: string | null;
  color?: string | null;
  esPuntual?: boolean;
};

export type UpdateHitoCatalogoResult =
  | { ok: true; tablaMadreColumna: string | null; tablaMadreExiste: boolean }
  | { ok: false; error: string };

const COLOR_RE = /^#[0-9a-f]{6}$/i;

/**
 * Edita una entrada del catálogo de hitos: sobre todo, su mapeo con la Tabla madre.
 *
 * El mapeo tiene dos estados que la rejilla señala distinto:
 *   - tabla_madre_existe = true  → la columna ya está en la hoja (los 8 de DW-EL)
 *   - tabla_madre_existe = false → cabecera PROPUESTA; documenta qué columna
 *     crear si algún día se llevan estos hitos al Excel
 */
export async function updateHitoCatalogo(
  input: UpdateHitoCatalogoInput,
): Promise<UpdateHitoCatalogoResult> {
  const id = validateUuid(input.id, "id");
  if (!id.ok) return { ok: false, error: id.error };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let columna: string | null = null;
  let existe = false;

  if (input.tablaMadreColumna !== undefined) {
    columna = input.tablaMadreColumna?.trim() || null;
    if (columna && columna.length > 120) {
      return { ok: false, error: "La cabecera no puede pasar de 120 caracteres" };
    }
    // Comparación laxa: la hoja tiene cabeceras como «Fecha obra» y «Fecha
    // Licencia y Financiación», con mayúsculas inconsistentes.
    existe =
      columna !== null &&
      TABLA_MADRE_COLUMNAS_HITO.some(
        (c) => c.cabecera.toLowerCase() === columna!.toLowerCase(),
      );
    patch.tabla_madre_columna = columna;
    patch.tabla_madre_existe = existe;
  }

  if (input.color !== undefined) {
    const c = input.color?.trim() || null;
    if (c !== null && !COLOR_RE.test(c)) {
      return { ok: false, error: "El color debe ser hexadecimal, p. ej. #1E2A56" };
    }
    patch.color = c;
  }

  if (input.esPuntual !== undefined) {
    patch.es_puntual = Boolean(input.esPuntual);
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data, error } = await auth.client
    .from("pm_hito_catalogo")
    .update(patch)
    .eq("id", id.value)
    .select("tabla_madre_columna, tabla_madre_existe")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Hito de catálogo no encontrado" };

  return {
    ok: true,
    tablaMadreColumna: data.tabla_madre_columna as string | null,
    tablaMadreExiste: data.tabla_madre_existe as boolean,
  };
}
