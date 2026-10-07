import type { ReactNode } from "react";

import { Icono } from "./Icono";

export type TipoAviso = "aviso" | "error" | "ok" | "info";

const CLASES: Record<TipoAviso, string> = {
  aviso: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-800",
  ok: "border-green-200 bg-green-50 text-green-900",
  info: "border-icam-900/15 bg-icam-900/[0.04] text-text-body",
};

const ICONOS: Record<TipoAviso, Parameters<typeof Icono>[0]["nombre"]> = {
  aviso: "alerta",
  error: "alerta",
  ok: "check",
  info: "info",
};

/**
 * Un aviso en caja. Una o dos líneas; lo largo va en un `Desplegable` o en una
 * `Ayuda`. `acciones` se alinea a la derecha (botones o enlaces).
 */
export function Aviso({
  tipo = "aviso",
  titulo,
  acciones,
  sinIcono,
  className = "",
  children,
}: {
  tipo?: TipoAviso;
  titulo?: string;
  acciones?: ReactNode;
  sinIcono?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${CLASES[tipo]} ${className}`}
    >
      {sinIcono ? null : <Icono nombre={ICONOS[tipo]} className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-0.5">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        {children ? <div className="leading-snug">{children}</div> : null}
      </div>
      {acciones ? <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
