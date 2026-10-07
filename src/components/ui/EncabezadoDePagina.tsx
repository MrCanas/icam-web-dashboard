import Link from "next/link";
import type { ReactNode } from "react";

export interface MigaDePan {
  etiqueta: string;
  href?: string;
}

/**
 * La cabecera de una página: ruta, título con sus chips, una línea de
 * contexto y las acciones a la derecha. Sin párrafos: lo que haya que explicar
 * va en una `Ayuda` o en un `Desplegable` más abajo.
 */
export function EncabezadoDePagina({
  ruta,
  titulo,
  chips,
  meta,
  acciones,
}: {
  ruta?: MigaDePan[];
  titulo: ReactNode;
  chips?: ReactNode;
  meta?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {ruta && ruta.length > 0 ? (
          <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
            {ruta.map((m, i) => (
              <span key={`${m.etiqueta}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {m.href ? (
                  <Link href={m.href} className="underline-offset-2 hover:text-icam-900 hover:underline">
                    {m.etiqueta}
                  </Link>
                ) : (
                  <span className="truncate">{m.etiqueta}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">{titulo}</h1>
          {chips}
        </div>
        {meta ? <p className="mt-0.5 text-sm text-text-muted">{meta}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
    </header>
  );
}
