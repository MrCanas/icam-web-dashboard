import type { UserContext } from "@/lib/auth/currentUser";
import { getPortfolioWriteSupabase } from "@/modules/portfolio/data/readClient";
import type { MaestroLineaTrimestre } from "@/modules/portfolio/data/excel-parser";

export interface MaestroLineaClave {
  proyecto: string;
  trimestre_code: string;
}

/**
 * Persiste las líneas trimestrales del maestro (migración 024) y devuelve las
 * NUEVAS: (proyecto, trimestre) que no se habían visto en ninguna carga
 * anterior. Esa novedad es la señal de «el Financiero ya reportó el trimestre»
 * que desbloquea la publicación en PM.
 *
 * Solo upsert, nunca DELETE: si el maestro deja de traer una línea, aquí queda
 * como histórico (con su ultima_vista_at antigua).
 */
export async function upsertMaestroTrimestres(
  ctx: UserContext,
  lineas: MaestroLineaTrimestre[],
  archivo: string,
): Promise<{ nuevas: MaestroLineaClave[]; error: string | null }> {
  if (lineas.length === 0) return { nuevas: [], error: null };

  try {
    const supabase = getPortfolioWriteSupabase(ctx);

    const { data: existentes, error: readErr } = await supabase
      .from("maestro_lineas_trimestre")
      .select("proyecto, trimestre_code");
    if (readErr) return { nuevas: [], error: readErr.message };

    const vistas = new Set(
      (existentes ?? []).map((l) => `${l.proyecto}|${l.trimestre_code}`),
    );
    const nuevas: MaestroLineaClave[] = lineas
      .filter((l) => !vistas.has(`${l.proyecto}|${l.trimestreCode}`))
      .map((l) => ({ proyecto: l.proyecto, trimestre_code: l.trimestreCode }));

    const ahora = new Date().toISOString();

    // primera_vista_at no va en el payload: el default lo pone al insertar y el
    // upsert no lo toca al actualizar.
    const { error: lineasErr } = await supabase.from("maestro_lineas_trimestre").upsert(
      lineas.map((l) => ({
        proyecto: l.proyecto,
        trimestre_code: l.trimestreCode,
        ultima_vista_at: ahora,
        ultimo_archivo: archivo,
      })),
      { onConflict: "proyecto,trimestre_code" },
    );
    if (lineasErr) return { nuevas: [], error: lineasErr.message };

    const fechas = lineas.flatMap((l) =>
      l.hitos.map((h) => ({
        proyecto: l.proyecto,
        trimestre_code: l.trimestreCode,
        columna: h.columna,
        fecha: h.fecha,
        flag: h.flag,
        updated_at: ahora,
      })),
    );
    if (fechas.length > 0) {
      const { error: fechasErr } = await supabase
        .from("maestro_hito_fechas")
        .upsert(fechas, { onConflict: "proyecto,trimestre_code,columna" });
      if (fechasErr) return { nuevas, error: fechasErr.message };
    }

    return { nuevas, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo conectar a Supabase";
    return { nuevas: [], error: msg };
  }
}
