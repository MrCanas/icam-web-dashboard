"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelarComunicacionAction } from "@/modules/comunicaciones/actions/comunicaciones";

/** Descarta la comunicación. No borra nada: queda en el historial como cancelada. */
export function CancelarButton({ comunicacionId }: { comunicacionId: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900"
      >
        Descartar
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-text-body">¿Descartar esta comunicación?</span>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          empezar(async () => {
            const r = await cancelarComunicacionAction(comunicacionId);
            if (r.ok) router.refresh();
            else setError(r.mensaje);
          })
        }
        className="min-h-9 rounded-md border border-[#9B3B3B]/60 px-3 py-1.5 text-[#9B3B3B] disabled:opacity-60"
      >
        {pendiente ? "Descartando…" : "Sí, descartar"}
      </button>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => setConfirmando(false)}
        className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-text-body"
      >
        No
      </button>
      {error ? <span className="text-[#9B3B3B]">{error}</span> : null}
    </div>
  );
}
