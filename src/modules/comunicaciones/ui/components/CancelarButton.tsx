"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Boton } from "@/components/ui/Boton";
import { cancelarComunicacionAction } from "@/modules/comunicaciones/actions/comunicaciones";

/** Descarta la comunicación. No borra nada: queda en el historial como cancelada. */
export function CancelarButton({ comunicacionId }: { comunicacionId: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirmando) {
    return (
      <Boton variante="texto" onClick={() => setConfirmando(true)} className="text-text-muted hover:text-red-700">
        Descartar
      </Boton>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-sm">
      <span className="text-red-800">¿Descartar esta comunicación?</span>
      <Boton
        variante="peligro"
        pequeno
        cargando={pendiente}
        onClick={() =>
          empezar(async () => {
            const r = await cancelarComunicacionAction(comunicacionId);
            if (r.ok) router.refresh();
            else setError(r.mensaje);
          })
        }
      >
        Sí, descartar
      </Boton>
      <Boton variante="secundario" pequeno disabled={pendiente} onClick={() => setConfirmando(false)}>
        No
      </Boton>
      {error ? <span className="text-red-700">{error}</span> : null}
    </div>
  );
}
