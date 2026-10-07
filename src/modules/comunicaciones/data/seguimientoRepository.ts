import type { UserContext } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";
import { getComunicacionesSupabase } from "@/modules/comunicaciones/data/readClient";
import type { ComunicacionAnalitica, DestinatarioAnalitica } from "@/modules/comunicaciones/logic/analitica";
import type { ComEnlaceRow, ComEventoRow, ImagenApertura } from "@/modules/comunicaciones/types";

/**
 * Las aperturas y los clics: anotarlos y leerlos.
 *
 * Anotar lo hacen las dos rutas PÚBLICAS de seguimiento (`/api/s/…`), que no
 * tienen usuario: llaman a la función `com_registrar_evento` de la base con
 * service role, y esa función es lo único que pueden hacer. No leen ninguna
 * tabla ni devuelven nada de nadie.
 *
 * Leer lo hace el panel de analítica, detrás de la sesión y los permisos de
 * siempre.
 */

export interface EventoRegistrado {
  encontrado: boolean;
  /** Adónde redirigir, en un clic. Sale de lo guardado al enviar. */
  destino: string | null;
  imagen: ImagenApertura;
}

const NO_ENCONTRADO: EventoRegistrado = { encontrado: false, destino: null, imagen: "pixel" };

/** Anota una apertura o un clic. Sin usuario: es la única escritura de las rutas públicas. */
export async function registrarEvento(
  token: string,
  tipo: "apertura" | "clic",
  enlace: number | null,
  agente: string | null,
  automatico: boolean,
): Promise<EventoRegistrado> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("com_registrar_evento", {
    p_token: token,
    p_tipo: tipo,
    p_enlace: enlace,
    p_agente: agente,
    p_automatico: automatico,
  });
  if (error) throw new Error(`com_registrar_evento: ${error.message}`);
  const fila = (Array.isArray(data) ? data[0] : data) as
    | { encontrado: boolean; destino: string | null; imagen: string | null }
    | null
    | undefined;
  if (!fila?.encontrado) return NO_ENCONTRADO;
  return { encontrado: true, destino: fila.destino, imagen: fila.imagen === "logo" ? "logo" : "pixel" };
}

// ---------------------------------------------------------------------------
// Lecturas del panel
// ---------------------------------------------------------------------------

async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  tabla: string,
): Promise<T[]> {
  const filas: T[] = [];
  // Supabase corta en 1.000 filas: se pagina, como en el resto del módulo.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    const lote = (data ?? []) as T[];
    filas.push(...lote);
    if (lote.length < 1000) return filas;
  }
}

export async function leerEventos(ctx: UserContext, comunicacionId: string): Promise<ComEventoRow[]> {
  const supabase = getComunicacionesSupabase(ctx);
  return todas<ComEventoRow>(
    (desde, hasta) =>
      supabase
        .from("com_evento")
        .select("*")
        .eq("comunicacion_id", comunicacionId)
        .order("ocurrido_at")
        .range(desde, hasta),
    "com_evento",
  );
}

export async function leerEnlaces(ctx: UserContext, comunicacionId: string): Promise<ComEnlaceRow[]> {
  const supabase = getComunicacionesSupabase(ctx);
  const { data, error } = await supabase
    .from("com_enlace")
    .select("*")
    .eq("comunicacion_id", comunicacionId)
    .order("posicion");
  if (error) throw new Error(`com_enlace: ${error.message}`);
  return (data ?? []) as ComEnlaceRow[];
}

const COLUMNAS_DE_DESTINATARIO =
  "id, comunicacion_id, cuenta_zoho_id, cuenta_nombre, para, copia, excluido, estado_envio, enviado_at, " +
  "enviado_para, aperturas, primera_apertura_at, ultima_apertura_at, clics, primer_clic_at, ultimo_clic_at, " +
  "entrega_estado, rebote_motivo, error";

const COLUMNAS_DE_COMUNICACION =
  "id, nombre, estado, modo_envio, pasarela, plantilla_id, plantilla_nombre, origen_comunicacion_id, " +
  "enviada_at, confirmada_at, created_at";

export interface DatosDelAgregado {
  comunicaciones: ComunicacionAnalitica[];
  destinatarios: DestinatarioAnalitica[];
}

/**
 * Todo lo enviado desde una fecha, para el panel agregado.
 *
 * Trae las comunicaciones que llegaron a enviarse y sus destinatarios; qué es
 * medible y qué no lo decide `logic/analitica.ts`.
 */
export async function leerParaElAgregado(ctx: UserContext, desdeIso: string | null): Promise<DatosDelAgregado> {
  const supabase = getComunicacionesSupabase(ctx);
  let consulta = supabase
    .from("com_comunicacion")
    .select(COLUMNAS_DE_COMUNICACION)
    .in("estado", ["enviando", "pausada", "enviada"])
    .order("created_at", { ascending: false })
    .limit(500);
  if (desdeIso) consulta = consulta.gte("created_at", desdeIso);
  const { data, error } = await consulta;
  if (error) throw new Error(`com_comunicacion: ${error.message}`);
  const comunicaciones = (data ?? []) as unknown as ComunicacionAnalitica[];
  if (comunicaciones.length === 0) return { comunicaciones, destinatarios: [] };

  const ids = comunicaciones.map((c) => c.id);
  const destinatarios = await todas<DestinatarioAnalitica>(
    (desde, hasta) =>
      supabase
        .from("com_destinatario")
        .select(COLUMNAS_DE_DESTINATARIO)
        .in("comunicacion_id", ids)
        .order("id")
        .range(desde, hasta),
    "com_destinatario",
  );
  return { comunicaciones, destinatarios };
}
