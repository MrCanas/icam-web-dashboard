import type { ReactNode } from "react";

import { Icono, type NombreIcono } from "./Icono";

/** Lo que se ve cuando una lista no tiene nada: qué es esto y qué hacer. */
export function EstadoVacio({
  icono = "correo",
  titulo,
  descripcion,
  accion,
  compacto,
}: {
  icono?: NombreIcono;
  titulo: string;
  descripcion?: ReactNode;
  accion?: ReactNode;
  compacto?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-subtle bg-card text-center ${
        compacto ? "px-4 py-6" : "px-6 py-10"
      }`}
    >
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-icam-900/[0.06] text-icam-900">
        <Icono nombre={icono} className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-text-primary">{titulo}</p>
      {descripcion ? <p className="mt-1 max-w-md text-sm text-text-muted">{descripcion}</p> : null}
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  );
}
