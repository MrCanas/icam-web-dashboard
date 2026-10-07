import { normalizarEmail } from "@/modules/comunicaciones/logic/candado";
import type {
  ComComunicacionRow,
  ComDestinatarioRow,
  ComEnlaceRow,
  ComEventoRow,
} from "@/modules/comunicaciones/types";

/**
 * Las cifras del panel de analítica: quién abrió, quién pulsó y qué.
 *
 * Dos advertencias que el panel repite en pantalla y que aquí se respetan:
 *   · una apertura solo consta si el programa de correo cargó las imágenes, así
 *     que «no consta apertura» NO es «no lo leyó». Por eso quien pulsa un
 *     enlace cuenta como que lo abrió aunque no conste la imagen;
 *   · lo que abre o pulsa un filtro de correo (`automatico`) y lo de la prueba
 *     obligatoria (`es_prueba`) se guarda, pero no entra en ninguna cifra.
 *
 * Puro: recibe filas y devuelve cifras.
 */

export type DestinatarioAnalitica = Pick<
  ComDestinatarioRow,
  | "id"
  | "comunicacion_id"
  | "cuenta_zoho_id"
  | "cuenta_nombre"
  | "para"
  | "copia"
  | "excluido"
  | "estado_envio"
  | "enviado_at"
  | "enviado_para"
  | "aperturas"
  | "primera_apertura_at"
  | "ultima_apertura_at"
  | "clics"
  | "primer_clic_at"
  | "ultimo_clic_at"
  | "entrega_estado"
  | "rebote_motivo"
  | "error"
>;

export const FILTROS_ANALITICA = [
  "todos",
  "enviados",
  "no_consta_apertura",
  "abrio",
  "no_hizo_clic",
  "hizo_clic",
  "abrio_sin_clic",
  "pulso_enlace",
  "error",
  "rebotado",
] as const;
export type FiltroAnalitica = (typeof FILTROS_ANALITICA)[number];

export const ETIQUETA_FILTRO: Record<FiltroAnalitica, string> = {
  todos: "Todos",
  enviados: "Todos los que lo recibieron",
  no_consta_apertura: "No consta apertura",
  abrio: "Abrió",
  no_hizo_clic: "No hizo clic",
  hizo_clic: "Hizo clic",
  abrio_sin_clic: "Abrió y no hizo clic",
  pulso_enlace: "Pulsó un enlace concreto",
  error: "Error al enviar",
  rebotado: "Rebotado",
};

/**
 * Los filtros que no necesitan aperturas ni clics: valen también para una
 * comunicación que salió en modo pruebas o por la pasarela simulada.
 */
export const FILTROS_SIN_SEGUIMIENTO: readonly FiltroAnalitica[] = ["todos", "enviados", "error"];

export function necesitaSeguimiento(filtro: FiltroAnalitica): boolean {
  return !FILTROS_SIN_SEGUIMIENTO.includes(filtro);
}

export function esFiltro(valor: unknown): valor is FiltroAnalitica {
  return typeof valor === "string" && (FILTROS_ANALITICA as readonly string[]).includes(valor);
}

export function fueEnviado(d: Pick<DestinatarioAnalitica, "estado_envio" | "excluido">): boolean {
  return !d.excluido && d.estado_envio === "enviado";
}

export function hizoClic(d: Pick<DestinatarioAnalitica, "clics">): boolean {
  return (d.clics ?? 0) > 0;
}

/** Abrió si consta la imagen o si pulsó un enlace: no se pulsa lo que no se ha abierto. */
export function abrio(d: Pick<DestinatarioAnalitica, "aperturas" | "clics">): boolean {
  return (d.aperturas ?? 0) > 0 || hizoClic(d);
}

/** Qué enlaces (por posición) ha pulsado cada destinatario, sin lo automático ni la prueba. */
export function enlacesPulsados(eventos: readonly ComEventoRow[]): Map<string, Set<number>> {
  const mapa = new Map<string, Set<number>>();
  for (const e of eventos) {
    if (e.tipo !== "clic" || e.automatico || e.es_prueba || !e.destinatario_id || e.enlace === null) continue;
    const grupo = mapa.get(e.destinatario_id) ?? new Set<number>();
    grupo.add(e.enlace);
    mapa.set(e.destinatario_id, grupo);
  }
  return mapa;
}

/**
 * ¿Cumple este destinatario el filtro?
 *
 * Los filtros de lectura (abrió, clic…) solo valen para correos que salieron:
 * de uno que dio error no se puede decir que «no consta apertura».
 */
export function cumpleFiltro(
  d: DestinatarioAnalitica,
  filtro: FiltroAnalitica,
  enlace: number | null = null,
  pulsados: ReadonlyMap<string, ReadonlySet<number>> = new Map(),
): boolean {
  switch (filtro) {
    case "todos":
      return true;
    case "enviados":
      return fueEnviado(d);
    case "error":
      return !d.excluido && d.estado_envio === "error";
    case "rebotado":
      return fueEnviado(d) && d.entrega_estado === "rebotado";
    case "no_consta_apertura":
      return fueEnviado(d) && !abrio(d);
    case "abrio":
      return fueEnviado(d) && abrio(d);
    case "no_hizo_clic":
      return fueEnviado(d) && !hizoClic(d);
    case "hizo_clic":
      return fueEnviado(d) && hizoClic(d);
    case "abrio_sin_clic":
      return fueEnviado(d) && abrio(d) && !hizoClic(d);
    case "pulso_enlace":
      return fueEnviado(d) && enlace !== null && (pulsados.get(d.id)?.has(enlace) ?? false);
    default:
      return false;
  }
}

export interface Cifras {
  /** Correos que salieron. */
  enviados: number;
  abiertos: number;
  conClic: number;
  errores: number;
  omitidos: number;
  rebotados: number;
  /** De los enviados, cuántos tienen dato de entrega de Zoho. */
  conDatoDeEntrega: number;
  /** Sobre los enviados, de 0 a 1. `null` si no salió ninguno. */
  tasaApertura: number | null;
  tasaClic: number | null;
}

export function tasa(parte: number, total: number): number | null {
  return total > 0 ? parte / total : null;
}

export function cifrasDe(destinatarios: readonly DestinatarioAnalitica[]): Cifras {
  let enviados = 0;
  let abiertos = 0;
  let conClic = 0;
  let errores = 0;
  let omitidos = 0;
  let rebotados = 0;
  let conDatoDeEntrega = 0;
  for (const d of destinatarios) {
    if (d.excluido) continue;
    if (d.estado_envio === "error") errores++;
    if (d.estado_envio === "omitido") omitidos++;
    if (d.estado_envio !== "enviado") continue;
    enviados++;
    if (abrio(d)) abiertos++;
    if (hizoClic(d)) conClic++;
    if (d.entrega_estado === "rebotado") rebotados++;
    if (d.entrega_estado === "entregado" || d.entrega_estado === "rebotado") conDatoDeEntrega++;
  }
  return {
    enviados,
    abiertos,
    conClic,
    errores,
    omitidos,
    rebotados,
    conDatoDeEntrega,
    tasaApertura: tasa(abiertos, enviados),
    tasaClic: tasa(conClic, enviados),
  };
}

/**
 * ¿Sirven las aperturas de esta comunicación para medir algo?
 *
 * Solo si salió de verdad (por Zoho) y a sus destinatarios (modo real). En modo
 * pruebas todos los correos le llegan a quien envía, y con la pasarela simulada
 * no llega ninguno.
 */
export function esMedible(c: Pick<ComComunicacionRow, "estado" | "modo_envio" | "pasarela">): boolean {
  return c.modo_envio === "real" && c.pasarela === "zoho" && ["enviando", "pausada", "enviada"].includes(c.estado);
}

/** Por qué no es medible, para decirlo en pantalla. `null` si lo es. */
export function porQueNoEsMedible(c: Pick<ComComunicacionRow, "estado" | "modo_envio" | "pasarela">): string | null {
  if (!["enviando", "pausada", "enviada"].includes(c.estado)) return "Todavía no se ha enviado.";
  if (c.pasarela === "simulada") return "Salió por la pasarela simulada: no se envió ningún correo.";
  if (c.modo_envio === "pruebas") {
    return "Se envió en modo pruebas: todos los correos le llegaron a quien la envió, así que las aperturas y los clics son suyos.";
  }
  if (!c.modo_envio) return "Se envió antes de que existiera el seguimiento.";
  return null;
}

// ---------------------------------------------------------------------------
// Evolución y enlaces
// ---------------------------------------------------------------------------

export interface PuntoDeSerie {
  /** Horas desde el envío: 0 es la primera hora. */
  hora: number;
  aperturas: number;
  clics: number;
}

function cuenta(e: ComEventoRow): boolean {
  return !e.automatico && !e.es_prueba && e.destinatario_id !== null;
}

/** Aperturas y clics por hora desde el envío, hasta `horas`. */
export function serieTemporal(
  eventos: readonly ComEventoRow[],
  desdeIso: string | null,
  horas = 72,
): PuntoDeSerie[] {
  const serie: PuntoDeSerie[] = Array.from({ length: horas }, (_, hora) => ({ hora, aperturas: 0, clics: 0 }));
  if (!desdeIso) return serie;
  const desde = new Date(desdeIso).getTime();
  for (const e of eventos) {
    if (!cuenta(e)) continue;
    const hora = Math.floor((new Date(e.ocurrido_at).getTime() - desde) / 3_600_000);
    const punto = serie[hora];
    if (hora < 0 || !punto) continue;
    if (e.tipo === "apertura") punto.aperturas++;
    else punto.clics++;
  }
  return serie;
}

export interface ClicsDeEnlace {
  posicion: number;
  url: string;
  texto: string | null;
  clics: number;
  /** Destinatarios distintos que lo pulsaron. */
  personas: number;
}

export function clicsPorEnlace(
  eventos: readonly ComEventoRow[],
  enlaces: readonly Pick<ComEnlaceRow, "posicion" | "url" | "texto">[],
): ClicsDeEnlace[] {
  const porPosicion = new Map<number, { clics: number; personas: Set<string> }>();
  for (const e of eventos) {
    if (e.tipo !== "clic" || !cuenta(e) || e.enlace === null) continue;
    const t = porPosicion.get(e.enlace) ?? { clics: 0, personas: new Set<string>() };
    t.clics++;
    t.personas.add(e.destinatario_id!);
    porPosicion.set(e.enlace, t);
  }
  return [...enlaces]
    .sort((a, b) => a.posicion - b.posicion)
    .map((en) => ({
      posicion: en.posicion,
      url: en.url,
      texto: en.texto,
      clics: porPosicion.get(en.posicion)?.clics ?? 0,
      personas: porPosicion.get(en.posicion)?.personas.size ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// El agregado
// ---------------------------------------------------------------------------

export type ComunicacionAnalitica = Pick<
  ComComunicacionRow,
  | "id"
  | "nombre"
  | "estado"
  | "modo_envio"
  | "pasarela"
  | "plantilla_id"
  | "plantilla_nombre"
  | "origen_comunicacion_id"
  | "enviada_at"
  | "confirmada_at"
  | "created_at"
>;

export interface FilaDeComunicacion {
  comunicacion: ComunicacionAnalitica;
  cifras: Cifras;
  esReenvio: boolean;
}

/** Las direcciones a las que le salió un correo de verdad. */
function direccionesDe(d: DestinatarioAnalitica): string[] {
  const lista = d.enviado_para ? [...d.enviado_para.para, ...d.enviado_para.copia] : d.para.map((p) => p.email);
  return lista.map(normalizarEmail);
}

export function filasPorComunicacion(
  comunicaciones: readonly ComunicacionAnalitica[],
  destinatarios: readonly DestinatarioAnalitica[],
): FilaDeComunicacion[] {
  const porComunicacion = new Map<string, DestinatarioAnalitica[]>();
  for (const d of destinatarios) {
    const grupo = porComunicacion.get(d.comunicacion_id) ?? [];
    grupo.push(d);
    porComunicacion.set(d.comunicacion_id, grupo);
  }
  return comunicaciones.map((comunicacion) => ({
    comunicacion,
    cifras: cifrasDe(porComunicacion.get(comunicacion.id) ?? []),
    esReenvio: Boolean(comunicacion.origen_comunicacion_id),
  }));
}

export interface GrupoDePlantilla {
  plantillaId: string;
  plantillaNombre: string;
  envios: FilaDeComunicacion[];
  /** Direcciones distintas a las que llegó al menos uno de los envíos. */
  personas: number;
  /** De esas, las que abrieron al menos uno. */
  personasQueAbrieron: number;
  personasConClic: number;
}

/**
 * Los envíos de una misma plantilla, juntos.
 *
 * Cada envío conserva sus cifras, porque cada uno lleva su propio seguimiento.
 * Además se cuenta a cuántas personas distintas se ha llegado entre todos: una
 * persona que recibió el original y el reenvío es una persona, no dos.
 */
export function agruparPorPlantilla(
  filas: readonly FilaDeComunicacion[],
  destinatarios: readonly DestinatarioAnalitica[],
): GrupoDePlantilla[] {
  const deComunicacion = new Map<string, DestinatarioAnalitica[]>();
  for (const d of destinatarios) {
    const grupo = deComunicacion.get(d.comunicacion_id) ?? [];
    grupo.push(d);
    deComunicacion.set(d.comunicacion_id, grupo);
  }

  const grupos = new Map<string, FilaDeComunicacion[]>();
  for (const fila of filas) {
    const id = fila.comunicacion.plantilla_id;
    if (!id) continue;
    const grupo = grupos.get(id) ?? [];
    grupo.push(fila);
    grupos.set(id, grupo);
  }

  return [...grupos.entries()].map(([plantillaId, envios]) => {
    const personas = new Set<string>();
    const abrieron = new Set<string>();
    const conClic = new Set<string>();
    for (const envio of envios) {
      for (const d of deComunicacion.get(envio.comunicacion.id) ?? []) {
        if (!fueEnviado(d)) continue;
        for (const email of direccionesDe(d)) {
          personas.add(email);
          if (abrio(d)) abrieron.add(email);
          if (hizoClic(d)) conClic.add(email);
        }
      }
    }
    return {
      plantillaId,
      plantillaNombre: envios[0]?.comunicacion.plantilla_nombre ?? "(sin nombre)",
      envios,
      personas: personas.size,
      personasQueAbrieron: abrieron.size,
      personasConClic: conClic.size,
    };
  });
}

export interface FilaDeCuenta {
  cuentaZohoId: string;
  cuentaNombre: string;
  direcciones: string[];
  recibidas: number;
  abiertas: number;
  conClic: number;
  /** La última apertura o clic, en cualquiera de las comunicaciones. */
  ultimaActividad: string | null;
}

/** Cada cuenta a través de todas las comunicaciones: cuántas recibió, abrió y pulsó. */
export function filasPorCuenta(destinatarios: readonly DestinatarioAnalitica[]): FilaDeCuenta[] {
  const cuentas = new Map<string, FilaDeCuenta & { conjunto: Set<string> }>();
  for (const d of destinatarios) {
    if (!fueEnviado(d)) continue;
    const fila =
      cuentas.get(d.cuenta_zoho_id) ??
      ({
        cuentaZohoId: d.cuenta_zoho_id,
        cuentaNombre: d.cuenta_nombre,
        direcciones: [],
        recibidas: 0,
        abiertas: 0,
        conClic: 0,
        ultimaActividad: null,
        conjunto: new Set<string>(),
      } satisfies FilaDeCuenta & { conjunto: Set<string> });
    fila.recibidas++;
    if (abrio(d)) fila.abiertas++;
    if (hizoClic(d)) fila.conClic++;
    for (const email of direccionesDe(d)) fila.conjunto.add(email);
    for (const fecha of [d.ultima_apertura_at, d.ultimo_clic_at]) {
      if (fecha && (!fila.ultimaActividad || fecha > fila.ultimaActividad)) fila.ultimaActividad = fecha;
    }
    cuentas.set(d.cuenta_zoho_id, fila);
  }
  return [...cuentas.values()]
    .map(({ conjunto, ...fila }) => ({ ...fila, direcciones: [...conjunto].sort() }))
    .sort((a, b) => a.cuentaNombre.localeCompare(b.cuentaNombre, "es", { sensitivity: "base" }));
}
