import type { MondayItem } from "@/modules/monday/data/types";

// Dashboard del Comité de Adquisiciones: cálculos puros sobre el tablero
// ADQUISICIONES AUTO de Monday, grupo «En análisis».

export const ADQ_BOARD_ID = "18410571463";
export const ADQ_GROUP_TITLE = "En análisis";

/** Columnas del tablero (ids estables de Monday). */
export const ADQ_COLUMNS = {
  etapa: "estado_186",
  asking: "n_meros8",
  superficie: "numeric_mm32gh5q",
  uso: "men__desplegable",
  ubicacion: "text_mm2vgaey",
} as const;

/** Etapas del embudo, en orden. Stand by y Descartado quedan fuera. */
export const PIPELINE = [
  "Recibido",
  "Info. Solicitada",
  "Servilleta",
  "Pre-Comité",
  "Comité",
  "2º Análisis",
  "LOI",
  "Adquirido",
] as const;

/**
 * Etapas cuyas tarjetas se ven con «En análisis». «2º Análisis» es el análisis
 * en Flujo de Caja (FCF), según la descripción de la etapa en Monday.
 */
export const CARD_STAGES = ["Servilleta", "Pre-Comité", "Comité", "2º Análisis"] as const;

/** Nombre corto de la etapa en las tarjetas. */
export const STAGE_LABEL: Record<string, string> = { "2º Análisis": "FCF · 2º Análisis" };

/** Coordenadas exactas para Maps cuando la dirección de Monday no lleva al sitio. */
const MAPS_OVERRIDE: Record<string, string> = {
  "Project Sabika": "37.181619941515955,-3.5900531565536515",
  "Proyecto Andratx": "39.53396172212084,2.367560506593664",
};

/** Superficies corregidas a mano porque el dato de Monday es erróneo. */
const SURFACE_OVERRIDE: Record<string, number> = { "Parc Mestalla": 97000 };

export interface AdqAsset {
  name: string;
  stage: string;
  price: number | null;
  m2: number | null;
  uso: string;
  loc: string;
}

export interface AdqData {
  total: number;
  withPrice: number;
  vol: number;
  m2: number;
  m2Count: number;
  eurM2: number | null;
  eurM2Count: number;
  discarded: number;
  stages: Record<string, number>;
  uses: Record<string, number>;
  provincias: Record<string, number>;
}

export interface AdqFunnelStep {
  name: string;
  count: number;
}

export interface AdqCard {
  name: string;
  stage: string;
  location: string;
  /** Dirección tal cual viene de Monday («» si no tiene). */
  address: string;
  price: number | null;
  m2: number | null;
  repercusion: number | null;
  /** Dirección o coordenadas para Maps y Earth. */
  mapsQuery: string | null;
}

/**
 * Número de una columna «numbers» de Monday. El `value` es un JSON con el
 * número en formato inglés ("6399.96"); el `text` solo se usa de respaldo.
 */
export function parseMondayNumber(value: string | null, text: string | null): number | null {
  let raw: unknown = null;
  if (value) {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = value;
    }
  }
  if (raw == null || raw === "") raw = text;
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Activos del grupo «En análisis», con las correcciones manuales aplicadas. */
export function buildAdqAssets(items: MondayItem[]): AdqAsset[] {
  return items
    .filter((item) => item.group?.title?.trim() === ADQ_GROUP_TITLE)
    .map((item) => {
      const col = (id: string) => item.column_values.find((c) => c.id === id);
      const num = (id: string) => {
        const c = col(id);
        return parseMondayNumber(c?.value ?? null, c?.text ?? null);
      };
      return {
        name: item.name,
        stage: col(ADQ_COLUMNS.etapa)?.text?.trim() ?? "",
        price: num(ADQ_COLUMNS.asking),
        m2: SURFACE_OVERRIDE[item.name] ?? num(ADQ_COLUMNS.superficie),
        uso: col(ADQ_COLUMNS.uso)?.text?.trim() ?? "",
        loc: col(ADQ_COLUMNS.ubicacion)?.text?.trim() ?? "",
      };
    });
}

/**
 * Provincia o ciudad a partir de la dirección: último tramo, sin país, código
 * postal ni «centro». Santander pasa a Cantabria.
 */
export function provincia(loc: string): string | null {
  if (!loc) return null;
  const parts = loc
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  while (parts.length > 1 && /^(españa|spain|portugal)$/i.test(parts[parts.length - 1]!)) parts.pop();
  let p = parts[parts.length - 1]!.replace(/^\d{4,5}\s+/, "").replace(/\s+centro$/i, "");
  if (/^santander$/i.test(p)) p = "Cantabria";
  return p;
}

export function buildAdqData(list: AdqAsset[]): AdqData {
  const priced = list.filter((a) => a.price);
  const sized = list.filter((a) => a.m2);
  const both = list.filter((a) => a.price && a.m2);
  const stages: Record<string, number> = {};
  const uses: Record<string, number> = {};
  const provincias: Record<string, number> = {};

  for (const a of list) {
    stages[a.stage] = (stages[a.stage] ?? 0) + 1;
    a.uso
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((u) => (uses[u] = (uses[u] ?? 0) + 1));
    const p = provincia(a.loc);
    if (p) provincias[p] = (provincias[p] ?? 0) + 1;
  }

  return {
    total: list.length,
    withPrice: priced.length,
    vol: priced.reduce((s, a) => s + a.price!, 0),
    m2: sized.reduce((s, a) => s + a.m2!, 0),
    m2Count: sized.length,
    eurM2: both.length ? both.reduce((s, a) => s + a.price! / a.m2!, 0) / both.length : null,
    eurM2Count: both.length,
    discarded: list.filter((a) => /descartad/i.test(a.stage)).length,
    stages,
    uses,
    provincias,
  };
}

/** Ticket medio: volumen ÷ activos con precio. */
export function avgTicket(d: AdqData): number {
  return d.withPrice > 0 ? d.vol / d.withPrice : 0;
}

/** Descartados ÷ (total − Info. Solicitada), en %. */
export function discardRate(d: AdqData): { rate: number; base: number } {
  const base = Math.max(d.total - (d.stages["Info. Solicitada"] ?? 0), 1);
  return { rate: Math.round((d.discarded / base) * 100), base };
}

/**
 * Situación actual: cuántos activos hay hoy en cada etapa, sin suponer por
 * qué etapas pasaron antes. Orden del pipeline, luego el resto (Stand by, Descartado…).
 * Las etapas sin activos no salen.
 */
export function buildFunnel(stages: Record<string, number>): AdqFunnelStep[] {
  const order = (s: string) => {
    const i = (PIPELINE as readonly string[]).indexOf(s);
    return i === -1 ? PIPELINE.length : i;
  };
  return Object.entries(stages)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => order(a) - order(b))
    .map(([name, count]) => ({ name, count }));
}

/** Tarjetas de los activos en las etapas pedidas, en el orden del embudo. */
export function buildCards(list: AdqAsset[], stages: readonly string[]): AdqCard[] {
  const order = (stage: string) => (PIPELINE as readonly string[]).indexOf(stage);
  return list
    .filter((a) => stages.includes(a.stage))
    .sort((a, b) => order(b.stage) - order(a.stage))
    .map((a) => ({
      name: a.name,
      stage: a.stage,
      location: [provincia(a.loc), a.uso].filter(Boolean).join(" · "),
      address: a.loc,
      price: a.price,
      m2: a.m2,
      repercusion: a.price && a.m2 ? a.price / a.m2 : null,
      mapsQuery: MAPS_OVERRIDE[a.name] ?? (a.loc || null),
    }));
}

export const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

export const earthUrl = (q: string) => `https://earth.google.com/web/search/${encodeURIComponent(q)}`;

/** Ficha del Catastro de la parcela, o el buscador si no hay referencia. */
export const catastroUrl = (rc: string | null) =>
  rc && rc.length >= 14
    ? `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${rc.slice(0, 7)}&rc2=${rc.slice(7, 14)}`
    : "https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCBusqueda.aspx";
