"use client";

import { useState, useTransition } from "react";

import { sincronizarInversoresAction } from "@/modules/portfolio/inversores/actions/sincronizar";

/**
 * Trae de Zoho lo que el cron traería esta noche.
 *
 * A diferencia de los botones de los maestros de SharePoint, esto NO reemplaza
 * nada: es un upsert, y lo que ya no está en Zoho se marca, no se borra. Merece
 * decirlo en el propio botón, porque la costumbre del portal es la contraria.
 */
export function SincronizarButton() {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            setAviso(null);
            setAviso(await sincronizarInversoresAction());
          })
        }
        className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900 disabled:opacity-60"
      >
        {pendiente ? "Sincronizando…" : "Sincronizar ahora"}
      </button>
      {aviso ? (
        <p
          role="status"
          className={`text-sm ${aviso.ok ? "text-text-muted" : "text-[#9B3B3B]"}`}
        >
          {aviso.mensaje}
        </p>
      ) : null}
    </div>
  );
}
