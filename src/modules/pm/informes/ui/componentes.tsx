import type { ButtonHTMLAttributes, ReactNode } from "react";

import type { EstadoInforme } from "../types";

/**
 * Piezas de interfaz de la herramienta de informes, con el look del
 * dashboard (tailwind.config.js). Las slides no usan nada de esto.
 */

export const claseCampo =
  "w-full rounded-md border border-subtle bg-page px-3 py-2 text-sm text-text-primary focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30 disabled:opacity-60";

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-subtle/50 bg-card p-4 shadow-sm space-y-3 ${className}`}>{children}</section>;
}

type Variante = "primario" | "secundario" | "peligro" | "texto";

const CLASES: Record<Variante, string> = {
  primario: "rounded-md bg-icam-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-icam-800",
  secundario: "rounded-md border border-subtle bg-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-page",
  peligro: "rounded-md border border-red-200 bg-card px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50",
  texto: "px-1.5 py-1 text-sm font-medium text-icam-900 hover:underline",
};

export function Boton({
  variante = "secundario",
  pequeno,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; pequeno?: boolean }) {
  const tam = pequeno && variante !== "texto" ? " !px-2.5 !py-1 !text-xs" : "";
  return (
    <button
      type="button"
      {...props}
      className={`${CLASES[variante]}${tam} disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    />
  );
}

export function Aviso({ tipo = "aviso", children }: { tipo?: "aviso" | "error" | "ok"; children: ReactNode }) {
  const c =
    tipo === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tipo === "ok"
        ? "border-green-200 bg-green-50 text-green-900"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-md border px-3.5 py-2.5 text-sm ${c}`}>
      {children}
    </div>
  );
}

export function Chip({ tono = "neutro", children }: { tono?: "neutro" | "ok" | "aviso" | "error" | "marca"; children: ReactNode }) {
  const c = {
    neutro: "bg-subtle text-text-muted",
    ok: "border-green-200 bg-green-50 text-green-800",
    aviso: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700",
    marca: "bg-icam-gold/15 text-icam-900",
  }[tono];
  return <span className={`inline-block whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

const ESTADOS: Record<EstadoInforme, [string, "neutro" | "ok" | "aviso" | "marca"]> = {
  datos: ["Datos", "neutro"],
  fuentes: ["Fuentes", "neutro"],
  analizado: ["Pendiente de GO", "marca"],
  generando: ["Generando", "aviso"],
  borrador: ["Borrador", "aviso"],
  aprobado: ["Aprobado", "ok"],
};

export function ChipEstado({ estado }: { estado: EstadoInforme }) {
  const [t, tono] = ESTADOS[estado] ?? [estado, "neutro"];
  return <Chip tono={tono}>{t}</Chip>;
}

export function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: ReactNode; ayuda?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
      {etiqueta}
      {children}
      {ayuda ? <span className="text-xs font-normal text-text-muted">{ayuda}</span> : null}
    </label>
  );
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export const PASOS = ["Datos del informe", "Informe anterior", "Información del trimestre", "Biblioteca y GO"];

export function Pasos({ actual }: { actual: number }) {
  return (
    <ol className="flex flex-wrap gap-1.5" aria-label="Pasos">
      {PASOS.map((n, i) => (
        <li
          key={n}
          aria-current={i === actual ? "step" : undefined}
          className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-medium ${
            i === actual ? "border-icam-900 bg-icam-900 text-white" : "border-subtle bg-card text-text-primary"
          }`}
        >
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
              i < actual ? "bg-emerald-600 text-white" : i === actual ? "bg-white text-icam-900" : "bg-page text-text-muted"
            }`}
          >
            {i < actual ? "✓" : i + 1}
          </span>
          {n}
        </li>
      ))}
    </ol>
  );
}
