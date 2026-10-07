import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Botones del portal. Nacieron en pm/informes y se promovieron aquí para que
 * Comunicaciones (y cualquier otra zona) no copiara las clases una vez más.
 *
 * - `primario`: la acción principal de la pantalla, una por vista.
 * - `secundario`: el resto.
 * - `peligro`: lo que descarta o detiene.
 * - `texto`: acciones de fila, sin caja.
 */
export type VarianteBoton = "primario" | "secundario" | "peligro" | "texto";

const BASE =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 disabled:cursor-not-allowed disabled:opacity-40";

const COLOR: Record<VarianteBoton, string> = {
  primario: "bg-icam-900 text-white hover:bg-icam-800",
  secundario: "border border-subtle bg-card text-text-primary hover:bg-page",
  peligro: "border border-red-200 bg-card text-red-700 hover:bg-red-50",
  texto: "text-icam-900 hover:underline",
};

const TAMANO: Record<VarianteBoton, string> = {
  primario: "min-h-9 px-4 py-2",
  secundario: "min-h-9 px-3 py-2",
  peligro: "min-h-9 px-3 py-2",
  texto: "px-1.5 py-1",
};

const PEQUENO: Record<VarianteBoton, string> = {
  primario: "min-h-7 px-2.5 py-1 text-xs",
  secundario: "min-h-7 px-2.5 py-1 text-xs",
  peligro: "min-h-7 px-2.5 py-1 text-xs",
  texto: "px-1 py-0.5 text-xs",
};

export function claseBoton(variante: VarianteBoton = "secundario", pequeno = false, extra = ""): string {
  return `${BASE} ${COLOR[variante]} ${pequeno ? PEQUENO[variante] : TAMANO[variante]} ${extra}`.trim();
}

interface PropsComunes {
  variante?: VarianteBoton;
  pequeno?: boolean;
  /** Un icono a la izquierda del texto (`<Icono …/>`). */
  icono?: ReactNode;
}

export function Boton({
  variante = "secundario",
  pequeno,
  icono,
  cargando,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & PropsComunes & { cargando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={claseBoton(variante, pequeno, className)}
    >
      {cargando ? <Rueda /> : icono}
      {children}
    </button>
  );
}

/** Un enlace con pinta de botón: para navegar, no para actuar. */
export function BotonEnlace({
  variante = "secundario",
  pequeno,
  icono,
  className = "",
  children,
  href,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & PropsComunes & { href: string }) {
  return (
    <Link href={href} {...props} className={claseBoton(variante, pequeno, className)}>
      {icono}
      {children}
    </Link>
  );
}

function Rueda() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
