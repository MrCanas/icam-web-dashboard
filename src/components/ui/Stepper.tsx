import Link from "next/link";
import type { ReactNode } from "react";

import { Icono } from "./Icono";

export type EstadoPaso = "hecho" | "actual" | "pendiente" | "bloqueado";

export interface PasoDeStepper {
  clave: string;
  etiqueta: string;
  estado: EstadoPaso;
  /** Adónde lleva pulsarlo. Sin `href`, no es un enlace. */
  href?: string;
  /** Una línea bajo la etiqueta: quién, cuándo, por qué está bloqueado. */
  nota?: ReactNode;
}

const PASTILLA: Record<EstadoPaso, string> = {
  hecho: "border-green-200 bg-green-50 text-green-900",
  actual: "border-icam-900 bg-icam-900 text-white",
  pendiente: "border-subtle bg-card text-text-muted",
  bloqueado: "border-red-200 bg-red-50 text-red-700",
};

const NUMERO: Record<EstadoPaso, string> = {
  hecho: "bg-green-600 text-white",
  actual: "bg-white text-icam-900",
  pendiente: "bg-page text-text-muted",
  bloqueado: "bg-red-600 text-white",
};

/**
 * Los pasos de un flujo, en fila. Generaliza el `Pasos` de pm/informes: cada
 * paso tiene su estado y, si procede, un enlace.
 */
export function Stepper({ pasos, etiqueta = "Pasos" }: { pasos: PasoDeStepper[]; etiqueta?: string }) {
  return (
    <ol className="flex flex-wrap items-start gap-1.5" aria-label={etiqueta}>
      {pasos.map((p, i) => {
        const contenido = (
          <>
            <span
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${NUMERO[p.estado]}`}
              aria-hidden="true"
            >
              {p.estado === "hecho" ? <Icono nombre="check" className="h-3 w-3" /> : p.estado === "bloqueado" ? "!" : i + 1}
            </span>
            <span>{p.etiqueta}</span>
          </>
        );
        const clases = `inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium ${PASTILLA[p.estado]}`;
        return (
          <li key={p.clave} aria-current={p.estado === "actual" ? "step" : undefined} className="flex flex-col gap-0.5">
            {p.href ? (
              <Link href={p.href} className={`${clases} transition hover:opacity-90`} scroll={false}>
                {contenido}
              </Link>
            ) : (
              <span className={clases}>{contenido}</span>
            )}
            {p.nota ? <span className="pl-1 text-[11px] text-text-muted">{p.nota}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
