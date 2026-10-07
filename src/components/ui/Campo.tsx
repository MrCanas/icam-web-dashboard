import type { ReactNode } from "react";

/** Clases de un control de formulario (input, select, textarea). */
export const claseCampo =
  "w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-text-primary focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30 disabled:opacity-60";

/** La misma, cuando el campo está mal. */
export const claseCampoConError =
  "w-full rounded-md border border-red-300 bg-card px-3 py-2 text-sm text-text-primary focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-60";

/**
 * Etiqueta + control + ayuda corta. `error` pinta el mensaje en rojo debajo y
 * lo anuncia; el control recibe las clases con `claseCampoConError`.
 */
export function Campo({
  etiqueta,
  children,
  ayuda,
  error,
  extra,
}: {
  etiqueta: ReactNode;
  children: ReactNode;
  ayuda?: ReactNode;
  error?: string | null;
  /** Algo a la derecha de la etiqueta (una `Ayuda`, un chip). */
  extra?: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-primary">
      <span className="flex items-center gap-1.5">
        {etiqueta}
        {extra}
      </span>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-normal text-red-700">
          {error}
        </span>
      ) : ayuda ? (
        <span className="text-xs font-normal text-text-muted">{ayuda}</span>
      ) : null}
    </label>
  );
}
