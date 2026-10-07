import type { ReactNode } from "react";

import { Icono } from "@/components/ui/Icono";

export type EstadoDePasoCard = "hecho" | "actual" | "pendiente";

const BORDE: Record<EstadoDePasoCard, string> = {
  hecho: "border-l-green-500",
  actual: "border-l-icam-900",
  pendiente: "border-l-subtle",
};

const NUMERO: Record<EstadoDePasoCard, string> = {
  hecho: "bg-green-600 text-white",
  actual: "bg-icam-900 text-white",
  pendiente: "bg-page text-text-muted",
};

/**
 * Un paso del envío. El actual va expandido; los hechos, en una línea con su
 * resumen (quién y cuándo); los pendientes, apagados con el motivo.
 */
export function PasoCard({
  numero,
  titulo,
  estado,
  resumen,
  children,
}: {
  numero: number;
  titulo: string;
  estado: EstadoDePasoCard;
  /** Una línea: lo que pasó (hecho) o lo que falta (pendiente). */
  resumen?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li
      aria-current={estado === "actual" ? "step" : undefined}
      className={`rounded-lg border border-subtle/50 border-l-4 bg-card shadow-sm ${BORDE[estado]} ${
        estado === "pendiente" ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${NUMERO[estado]}`}
          aria-hidden="true"
        >
          {estado === "hecho" ? <Icono nombre="check" className="h-3.5 w-3.5" /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`text-sm font-semibold ${estado === "pendiente" ? "text-text-muted" : "text-text-primary"}`}>
            {titulo}
          </h3>
          {resumen ? <p className="mt-0.5 text-sm text-text-muted">{resumen}</p> : null}
          {children ? <div className="mt-3 space-y-3 text-sm text-text-body">{children}</div> : null}
        </div>
      </div>
    </li>
  );
}
