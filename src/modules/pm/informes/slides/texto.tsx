import type { ReactNode } from "react";

import type { Pie } from "./tipos";

/** Une clases descartando las vacías. */
export function cx(...clases: (string | false | null | undefined)[]): string {
  return clases.filter(Boolean).join(" ");
}

/** Texto enriquecido: «**negrita**» pasa a <strong>. El resto se deja como texto plano. */
export function rt(s: unknown): ReactNode {
  if (s == null) return null;
  if (typeof s !== "string") return s as ReactNode;
  const partes = s.split(/\*\*(.+?)\*\*/g);
  return partes.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
}

const PIE_COLA =
  "La información se facilita única y exclusivamente al receptor de este y con el propósito para el que ha sido elaborado. Dicha información tiene carácter confidencial y, en consecuencia, no puede ser parcial o completamente (i) copiada o duplicada en ningún medio o soporte, (ii) redistribuida, citada, divulgada o comunicada ni (iii) entregada a ninguna otra persona o entidad sin la autorización previa y por escrito de ";

/** Pie legal de cada página: fondo CNMV (ISIN) o sociedad (NIF). */
export function textoPie(p?: Partial<Pie> | null): string {
  const pie = p ?? {};
  if (pie.variante === "cnmv") {
    return (
      "La información contenida en este documento va dirigida al inversor del " +
      (pie.tipo || "fondo") +
      " " +
      (pie.fondo || "{FONDO}") +
      ", ISIN " +
      (pie.isin || "{ISIN}") +
      ", el cual ha sido creado por Impar Capital Asset Management, Sociedad Gestora de Entidades de Inversión Colectiva de tipo cerrado (ICAM SGEIC), inscrita en la CNMV bajo el número 192. " +
      PIE_COLA +
      "Impar Capital Asset Management SGEIC, S.A."
    );
  }
  const entidad = pie.entidad || "Impar Capital Investment, S.L.";
  return (
    "La información contenida en este documento va dirigida al inversor del vehículo " +
    (pie.vehiculo || "{VEHÍCULO}") +
    ", NIF " +
    (pie.nif || "{NIF}") +
    ", el cual ha sido creado por " +
    entidad +
    ", inscrita en el Registro Mercantil de Madrid. " +
    PIE_COLA +
    entidad +
    "."
  );
}

/**
 * Los títulos en Baskerville van en mayúsculas y en una línea. Uno más largo
 * que TITULO_MAX se parte por su primer «. »: la sección sigue en Baskerville y
 * el resto pasa a subtítulo en Lato.
 */
export const TITULO_MAX = 40;

export function partirTitulo(titulo: string | undefined, subtitulo?: string | null): [string, string | null] {
  const t = titulo || "";
  if (subtitulo != null) return [t, subtitulo];
  const i = t.indexOf(". ");
  if (t.length > TITULO_MAX && i > 0) return [t.slice(0, i), t.slice(i + 2)];
  return [t, null];
}

export function fmtPct(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2).replace(".", ",") + " %";
}
