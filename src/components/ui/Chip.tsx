import type { ReactNode } from "react";

/**
 * Una etiqueta corta de estado. El tono dice qué significa, siempre igual en
 * todo el portal:
 *
 * - `neutro`: información, preparación.
 * - `marca` (oro): un hito, algo que destacar.
 * - `ok` (verde): hecho.
 * - `aviso` (ámbar): atención, no bloquea.
 * - `error` (rojo): bloquea o es delicado.
 */
export type TonoChip = "neutro" | "ok" | "aviso" | "error" | "marca";

const TONOS: Record<TonoChip, string> = {
  neutro: "border-transparent bg-subtle text-text-body",
  ok: "border-green-200 bg-green-50 text-green-800",
  aviso: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
  marca: "border-transparent bg-icam-gold/15 text-icam-900",
};

const PUNTOS: Record<TonoChip, string> = {
  neutro: "bg-text-muted",
  ok: "bg-green-600",
  aviso: "bg-amber-500",
  error: "bg-red-600",
  marca: "bg-icam-gold",
};

export function Chip({
  tono = "neutro",
  punto,
  pulso,
  className = "",
  title,
  children,
}: {
  tono?: TonoChip;
  /** Un punto de color delante del texto. */
  punto?: boolean;
  /** El punto late: algo está pasando ahora mismo. */
  pulso?: boolean;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONOS[tono]} ${className}`}
    >
      {punto || pulso ? (
        <span className={`h-1.5 w-1.5 rounded-full ${PUNTOS[tono]} ${pulso ? "animate-pulse" : ""}`} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}
