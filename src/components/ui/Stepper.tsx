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
 *
 * - `pastillas` (por defecto): una pastilla por paso, que salta de línea.
 * - `linea`: círculos unidos por una línea, para los asistentes. Con `onIr`,
 *   pulsar un paso con `href` llama a `onIr(clave)` en lugar de navegar.
 */
export function Stepper({
  pasos,
  etiqueta = "Pasos",
  variante = "pastillas",
  onIr,
}: {
  pasos: PasoDeStepper[];
  etiqueta?: string;
  variante?: "pastillas" | "linea";
  onIr?: (clave: string) => void;
}) {
  if (variante === "linea") return <StepperEnLinea pasos={pasos} etiqueta={etiqueta} onIr={onIr} />;
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

const CIRCULO: Record<EstadoPaso, string> = {
  hecho: "border-green-600 bg-green-600 text-white",
  actual: "border-icam-900 bg-icam-900 text-white ring-4 ring-icam-900/10",
  pendiente: "border-subtle bg-card text-text-muted",
  bloqueado: "border-red-600 bg-red-600 text-white",
};

const ETIQUETA: Record<EstadoPaso, string> = {
  hecho: "text-text-primary",
  actual: "font-semibold text-icam-900",
  pendiente: "text-text-muted",
  bloqueado: "text-red-700",
};

function StepperEnLinea({
  pasos,
  etiqueta,
  onIr,
}: {
  pasos: PasoDeStepper[];
  etiqueta: string;
  onIr?: (clave: string) => void;
}) {
  const indiceActual = Math.max(0, pasos.findIndex((p) => p.estado === "actual"));
  const actual = pasos[indiceActual];
  return (
    <nav aria-label={etiqueta}>
      {/* En móvil no caben cinco etiquetas: se dice en qué paso se está. */}
      <p className="text-xs font-medium text-text-muted sm:hidden">
        Paso {indiceActual + 1} de {pasos.length}
        {actual ? <span className="text-icam-900"> · {actual.etiqueta}</span> : null}
      </p>
      <ol className="mt-1.5 flex items-center sm:mt-0">
        {pasos.map((p, i) => {
          const circulo = (
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition ${CIRCULO[p.estado]}`}
              aria-hidden="true"
            >
              {p.estado === "hecho" ? <Icono nombre="check" className="h-3.5 w-3.5" /> : p.estado === "bloqueado" ? "!" : i + 1}
            </span>
          );
          const contenido = (
            <>
              {circulo}
              <span className={`hidden whitespace-nowrap text-xs sm:inline ${ETIQUETA[p.estado]}`}>{p.etiqueta}</span>
            </>
          );
          const clases = "flex items-center gap-2 rounded-full pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40";
          let paso: ReactNode = <span className={clases}>{contenido}</span>;
          if (p.href && p.estado !== "actual") {
            paso = onIr ? (
              <button type="button" onClick={() => onIr(p.clave)} className={`${clases} hover:opacity-80`}>
                {contenido}
              </button>
            ) : (
              <Link href={p.href} scroll={false} className={`${clases} hover:opacity-80`}>
                {contenido}
              </Link>
            );
          }
          return (
            <li
              key={p.clave}
              aria-current={p.estado === "actual" ? "step" : undefined}
              title={typeof p.nota === "string" ? p.nota : undefined}
              className={`flex items-center ${i < pasos.length - 1 ? "flex-1" : ""}`}
            >
              {paso}
              {i < pasos.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-0.5 min-w-3 flex-1 rounded-full ${p.estado === "hecho" ? "bg-green-600/60" : "bg-subtle"}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
