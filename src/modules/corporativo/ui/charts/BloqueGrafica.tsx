import type { ReactNode } from "react";

import { CLASE_TARJETA } from "@/modules/corporativo/ui/charts/tokens";

interface BloqueGraficaProps {
  titulo: string;
  /** Periodo o alcance de lo que se pinta. Va bajo el título, en pequeño. */
  subtitulo?: string;
  /** Nota al pie: advertencias metodológicas del maestro. */
  nota?: ReactNode;
  /** Ocupa las dos columnas de la rejilla. */
  ancho?: boolean;
  children: ReactNode;
}

/**
 * Tarjeta que envuelve cada gráfica del tab. Existe para que el título, el
 * subtítulo de periodo y la nota al pie se compongan igual en los diez bloques,
 * en lugar de repetir el mismo encabezado con variaciones accidentales.
 */
export function BloqueGrafica({
  titulo,
  subtitulo,
  nota,
  ancho = false,
  children,
}: BloqueGraficaProps) {
  return (
    <section className={`${CLASE_TARJETA} ${ancho ? "xl:col-span-2" : ""}`}>
      <header className="mb-2 sm:mb-3">
        <h3 className="text-base font-semibold text-text-primary">{titulo}</h3>
        {subtitulo ? <p className="mt-0.5 text-xs text-text-muted">{subtitulo}</p> : null}
      </header>
      {children}
      {nota ? <div className="mt-2 text-xs text-text-muted">{nota}</div> : null}
    </section>
  );
}

/** Hueco con el mismo alto que una gráfica, para cuando no hay datos que pintar. */
export function SinDatos({ mensaje, alto = 260 }: { mensaje: string; alto?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded border border-dashed border-subtle px-4 text-center text-sm text-text-muted"
      style={{ height: alto }}
    >
      {mensaje}
    </div>
  );
}
