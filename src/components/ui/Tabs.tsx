"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId, type KeyboardEvent, type ReactNode } from "react";

export interface Pestana {
  clave: string;
  etiqueta: string;
  /** Un recuento o un chip a la derecha de la etiqueta. */
  extra?: ReactNode;
}

/**
 * Pestañas con el estado en la URL (`?vista=clave`), para que un
 * `router.refresh()` tras una acción no devuelva a la primera.
 *
 * Todos los paneles se montan y los que no se ven llevan `hidden`: así una
 * pestaña no pierde lo que había cargado (una lista de Zoho, una vista previa)
 * al cambiar a otra y volver.
 */
export function Tabs({
  pestanas,
  porDefecto,
  param = "vista",
  children,
  etiqueta = "Secciones",
}: {
  pestanas: Pestana[];
  porDefecto: string;
  param?: string;
  children: Record<string, ReactNode>;
  etiqueta?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const id = useId();

  const enUrl = params.get(param);
  const activa = pestanas.some((p) => p.clave === enUrl) ? (enUrl as string) : porDefecto;

  const ir = useCallback(
    (clave: string) => {
      const siguiente = new URLSearchParams(params.toString());
      if (clave === porDefecto) siguiente.delete(param);
      else siguiente.set(param, clave);
      const q = siguiente.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, param, porDefecto, pathname, router],
  );

  const teclas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const n = pestanas.length;
    const destino =
      e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "ArrowRight" ? (i + 1) % n : (i - 1 + n) % n;
    ir(pestanas[destino]!.clave);
    (e.currentTarget.parentElement?.children[destino] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <div role="tablist" aria-label={etiqueta} className="flex flex-wrap gap-1 border-b border-subtle">
        {pestanas.map((p, i) => {
          const seleccionada = p.clave === activa;
          return (
            <button
              key={p.clave}
              type="button"
              role="tab"
              id={`${id}-tab-${p.clave}`}
              aria-selected={seleccionada}
              aria-controls={`${id}-panel-${p.clave}`}
              tabIndex={seleccionada ? 0 : -1}
              onClick={() => ir(p.clave)}
              onKeyDown={(e) => teclas(e, i)}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
                seleccionada
                  ? "border-icam-900 font-medium text-icam-900"
                  : "border-transparent text-text-muted hover:border-subtle hover:text-text-primary"
              }`}
            >
              {p.etiqueta}
              {p.extra !== undefined ? <span className="text-xs">{p.extra}</span> : null}
            </button>
          );
        })}
      </div>
      {pestanas.map((p) => (
        <div
          key={p.clave}
          role="tabpanel"
          id={`${id}-panel-${p.clave}`}
          aria-labelledby={`${id}-tab-${p.clave}`}
          hidden={p.clave !== activa}
          className="min-w-0 space-y-3 sm:space-y-4"
        >
          {children[p.clave]}
        </div>
      ))}
    </div>
  );
}
