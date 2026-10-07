import type { ReactNode } from "react";

/**
 * La superficie del portal: fondo blanco, borde fino, sombra corta. Con
 * `titulo` pinta una cabecera (título, subtítulo de una línea y acciones a la
 * derecha); con `sinRelleno` el contenido llega al borde (tablas).
 */
export function Tarjeta({
  titulo,
  subtitulo,
  acciones,
  sinRelleno,
  id,
  className = "",
  children,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  sinRelleno?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const conCabecera = titulo !== undefined || acciones !== undefined;
  return (
    <section
      id={id}
      aria-labelledby={id && titulo !== undefined ? `${id}-titulo` : undefined}
      className={`min-w-0 overflow-hidden rounded-lg border border-subtle/50 bg-card shadow-sm ${className}`}
    >
      {conCabecera ? (
        <header className="flex flex-wrap items-start justify-between gap-2 px-4 pt-4 pb-3 sm:px-5">
          <div className="min-w-0">
            {titulo !== undefined ? (
              <h2 id={id ? `${id}-titulo` : undefined} className="text-base font-semibold text-text-primary">
                {titulo}
              </h2>
            ) : null}
            {subtitulo ? <p className="mt-0.5 text-xs text-text-muted">{subtitulo}</p> : null}
          </div>
          {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
        </header>
      ) : null}
      <div className={sinRelleno ? "" : `space-y-3 px-4 pb-4 sm:px-5 sm:pb-5 ${conCabecera ? "" : "pt-4 sm:pt-5"}`}>
        {children}
      </div>
    </section>
  );
}
