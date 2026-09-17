import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import { isMissingTableError } from "@/lib/db/pgErrors";
import {
  getInversoresReadSupabase,
  getInversoresWriteSupabase,
} from "@/modules/portfolio/inversores/data/readClient";
import type {
  InvCampoCatalogoRow,
  InvContactoRow,
  InvCuentaContactoRow,
  InvCuentaPromocionRow,
  InvCuentaRow,
  InvFlujoRow,
  InvPromocionRow,
  InvSyncLogRow,
  InvSyncModuloDetalle,
  OrigenSync,
} from "@/modules/portfolio/inversores/types";

/**
 * Único sitio con acceso a las tablas `inv_*`.
 *
 * Todas las lecturas filtran `borrado_at IS NULL`: lo que desaparece de Zoho se
 * marca, no se borra, y la pestaña enseña solo lo vivo. Y todas degradan si la
 * migración 040 no está aplicada, en vez de reventar la página entera.
 */

/** Lo que devuelve una lectura que puede encontrarse sin migración. */
export interface Espejos {
  cuentas: InvCuentaRow[];
  contactos: InvContactoRow[];
  cuentaContacto: InvCuentaContactoRow[];
  promociones: InvPromocionRow[];
  cuentaPromocion: InvCuentaPromocionRow[];
  flujos: InvFlujoRow[];
  /** true si falta la migración: la página lo dice en vez de enseñar ceros. */
  sinMigracion: boolean;
}

/**
 * Supabase corta en 1.000 filas por defecto. Los flujos pueden ser decenas de
 * miles, así que se pagina explícitamente: sin esto los totales cuadrarían mal
 * y nada avisaría.
 */
const PAGINA = 1000;

async function leerTodo<T>(
  supabase: ReturnType<typeof getInversoresReadSupabase>,
  tabla: string,
  columnas: string,
  /** Filtros extra por igualdad, además de `borrado_at IS NULL`. */
  donde: Record<string, unknown> = {},
): Promise<{ filas: T[]; sinTabla: boolean }> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    let consulta = supabase.from(tabla).select(columnas).is("borrado_at", null);
    for (const [col, valor] of Object.entries(donde)) consulta = consulta.eq(col, valor);
    const { data, error } = await consulta.range(desde, desde + PAGINA - 1);

    if (error) {
      if (isMissingTableError(error)) return { filas: [], sinTabla: true };
      throw new Error(`${tabla}: ${error.message}`);
    }
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < PAGINA) return { filas, sinTabla: false };
  }
}

export async function cargarEspejos(ctx: UserContext): Promise<Espejos> {
  const supabase = getInversoresReadSupabase(ctx);

  const [cuentas, contactos, cuentaContacto, promociones, cuentaPromocion, flujos] =
    await Promise.all([
      // Las cuentas marcadas como prueba o técnicas no salen de aquí. Se filtra
      // en la lectura y no en `logic/` para que no haya forma de que una
      // consulta nueva se las cuele sin querer: si no llegan, no cuentan.
      leerTodo<InvCuentaRow>(supabase, "inv_cuentas", "*", { excluida: false }),
      leerTodo<InvContactoRow>(supabase, "inv_contactos", "*"),
      leerTodo<InvCuentaContactoRow>(supabase, "inv_cuenta_contacto", "*"),
      leerTodo<InvPromocionRow>(supabase, "inv_promociones", "*"),
      leerTodo<InvCuentaPromocionRow>(supabase, "inv_cuenta_promocion", "*"),
      leerTodo<InvFlujoRow>(supabase, "inv_flujos", "*"),
    ]);

  return {
    cuentas: cuentas.filas,
    contactos: contactos.filas,
    cuentaContacto: cuentaContacto.filas,
    promociones: promociones.filas,
    cuentaPromocion: cuentaPromocion.filas,
    flujos: flujos.filas,
    sinMigracion: cuentas.sinTabla,
  };
}

// ---------------------------------------------------------------------------
// Catálogo de mapeo
// ---------------------------------------------------------------------------

export async function listarCatalogo(ctx: UserContext): Promise<InvCampoCatalogoRow[]> {
  const supabase = getInversoresReadSupabase(ctx);
  const { data, error } = await supabase
    .from("inv_campo_catalogo")
    .select("*")
    .order("modulo")
    .order("destino");

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(`inv_campo_catalogo: ${error.message}`);
  }
  return (data ?? []) as InvCampoCatalogoRow[];
}

export interface ResolucionCampo {
  modulo: string;
  destino: string;
  zoho_api_name: string | null;
  zoho_label: string | null;
  zoho_data_type: string | null;
}

/** Guarda lo que el descubrimiento resolvió. Solo toca las tres columnas. */
export async function guardarResolucionCatalogo(
  ctx: UserContext,
  resoluciones: ResolucionCampo[],
): Promise<{ ok: true; guardadas: number } | { ok: false; error: string }> {
  if (resoluciones.length === 0) return { ok: true, guardadas: 0 };

  return withAudit(
    ctx,
    "portfolio.inversores.catalogo.resolver",
    {
      resourceType: "inv_campo_catalogo",
      payload: { n: resoluciones.length, modulos: [...new Set(resoluciones.map((r) => r.modulo))] },
    },
    async () => {
      const supabase = getInversoresWriteSupabase(ctx);
      const ahora = new Date().toISOString();
      const { error } = await supabase.from("inv_campo_catalogo").upsert(
        resoluciones.map((r) => ({
          ...r,
          confirmado_por: ctx.email,
          confirmado_at: ahora,
          updated_at: ahora,
        })),
        { onConflict: "modulo,destino" },
      );
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, guardadas: resoluciones.length };
    },
  );
}

// ---------------------------------------------------------------------------
// Escrituras del sync
// ---------------------------------------------------------------------------

/**
 * Supabase acepta lotes grandes, pero `raw` hace las filas gordas y un lote de
 * 1.000 registros con su JSON completo se pasa del límite del cuerpo.
 */
const LOTE_UPSERT = 500;

export async function upsertEspejo(
  ctx: UserContext,
  tabla: string,
  filas: Record<string, unknown>[],
): Promise<number> {
  if (filas.length === 0) return 0;
  const supabase = getInversoresWriteSupabase(ctx);

  for (let i = 0; i < filas.length; i += LOTE_UPSERT) {
    const lote = filas.slice(i, i + LOTE_UPSERT);
    const { error } = await supabase.from(tabla).upsert(lote, { onConflict: "zoho_id" });
    if (error) throw new Error(`${tabla} upsert: ${error.message}`);
  }
  return filas.length;
}

/**
 * Marca como borrado lo que esta ejecución NO ha visto.
 *
 * Quien llama tiene que haber comprobado ANTES que la lectura del módulo
 * terminó entera. Si se llama tras una lectura truncada, esto marca como
 * borrada la cola del módulo: es la forma más rápida de vaciar la pestaña sin
 * que nadie se entere. Ver `inversoresSync.ts`.
 */
export async function marcarLapidas(
  ctx: UserContext,
  tabla: string,
  syncId: string,
): Promise<number> {
  const supabase = getInversoresWriteSupabase(ctx);
  const { data, error } = await supabase
    .from(tabla)
    .update({ borrado_at: new Date().toISOString() })
    .is("borrado_at", null)
    .neq("sync_id", syncId)
    .select("zoho_id");

  if (error) throw new Error(`${tabla} lápidas: ${error.message}`);
  return (data ?? []).length;
}

// ---------------------------------------------------------------------------
// Log de sincronización
// ---------------------------------------------------------------------------

export async function ultimoSync(ctx: UserContext): Promise<InvSyncLogRow | null> {
  const supabase = getInversoresReadSupabase(ctx);
  const { data, error } = await supabase
    .from("inv_sync_log")
    .select("*")
    .order("iniciado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(`inv_sync_log: ${error.message}`);
  }
  return (data as InvSyncLogRow | null) ?? null;
}

export async function ultimoSyncOk(ctx: UserContext): Promise<string | null> {
  const supabase = getInversoresReadSupabase(ctx);
  const { data, error } = await supabase
    .from("inv_sync_log")
    .select("terminado_at")
    .eq("estado", "ok")
    .order("iniciado_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(`inv_sync_log: ${error.message}`);
  }
  return (data as { terminado_at: string | null } | null)?.terminado_at ?? null;
}

/**
 * Abre la ejecución. Devuelve null si ya había una en curso: el índice único
 * parcial de la migración lo rechaza, y eso es exactamente lo que se quiere.
 * Dos sincronizaciones entrelazadas se marcarían lápidas la una a la otra.
 */
export async function abrirSync(
  ctx: UserContext,
  origen: OrigenSync,
): Promise<{ id: string } | { ocupado: true } | { error: string }> {
  const supabase = getInversoresWriteSupabase(ctx);

  // Una ejecución que lleva más de 15 minutos en curso es una función que murió
  // sin cerrar. Si no se cierra, bloquea el cron para siempre.
  const limite = new Date(Date.now() - 15 * 60_000).toISOString();
  await supabase
    .from("inv_sync_log")
    .update({ estado: "error", error: "Interrumpida: la ejecución no llegó a cerrarse." })
    .eq("estado", "en_curso")
    .lt("iniciado_at", limite);

  const { data, error } = await supabase
    .from("inv_sync_log")
    .insert({
      origen,
      estado: "en_curso",
      disparado_por: ctx.id,
      disparado_por_email: ctx.email,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ocupado: true };
    if (isMissingTableError(error)) {
      return { error: "Falta la migración 040: no existe inv_sync_log." };
    }
    return { error: error.message };
  }
  return { id: (data as { id: string }).id };
}

export async function cerrarSync(
  ctx: UserContext,
  id: string,
  cierre: {
    estado: "ok" | "parcial" | "error";
    modulos: InvSyncModuloDetalle[];
    duracionMs: number;
    error?: string | null;
  },
): Promise<void> {
  const supabase = getInversoresWriteSupabase(ctx);
  const { error } = await supabase
    .from("inv_sync_log")
    .update({
      estado: cierre.estado,
      modulos: cierre.modulos,
      duracion_ms: cierre.duracionMs,
      terminado_at: new Date().toISOString(),
      error: cierre.error ?? null,
    })
    .eq("id", id);

  // No se propaga: el sync ya ha hecho su trabajo y fallar aquí solo perdería
  // la traza, no los datos.
  if (error) console.error("[inversores] no se pudo cerrar inv_sync_log", error);
}
