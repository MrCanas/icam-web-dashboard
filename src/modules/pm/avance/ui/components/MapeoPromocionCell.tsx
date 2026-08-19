"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { mapActivoPromocion } from "@/modules/pm/avance/actions/map-activo-promocion";
import type { PromocionOption } from "@/modules/pm/avance/types";

interface MapeoPromocionCellProps {
  pmActivoId: string;
  valor: string | null;
  origen: "auto" | "manual" | null;
  opciones: PromocionOption[];
  hasWriteAccess: boolean;
  onError: (message: string) => void;
}

/**
 * Desplegable de emparejamiento con el módulo Promociones de Zoho.
 *
 * Las opciones salen de pm_promociones (cargada desde el export de Zoho), no de
 * una lista escrita a mano. Los códigos tampoco coinciden aquí: PM llama
 * «DC-15» a lo que Zoho llama «DC15», y hay 30 promociones para 9 proyectos, así
 * que solo 4 se emparejan solos y el resto lo decide la PMO.
 */
export function MapeoPromocionCell({
  pmActivoId,
  valor,
  origen,
  opciones,
  hasWriteAccess,
  onError,
}: MapeoPromocionCellProps) {
  const router = useRouter();
  const [actual, setActual] = useState<string | null>(valor);
  const [pending, startTransition] = useTransition();

  const etiqueta = (o: PromocionOption) =>
    [o.codigo_promocion, o.nombre, o.situacion].filter(Boolean).join(" · ");

  const guardar = (siguiente: string | null) => {
    const previo = actual;
    setActual(siguiente); // optimista
    startTransition(async () => {
      const r = await mapActivoPromocion({ pmActivoId, promocionId: siguiente });
      if (!r.ok) {
        setActual(previo); // rollback
        onError(r.error);
        return;
      }
      router.refresh();
    });
  };

  if (opciones.length === 0) {
    return <span className="text-xs text-text-muted">— sin promociones cargadas —</span>;
  }

  if (!hasWriteAccess) {
    const o = opciones.find((x) => x.id === actual);
    return (
      <span className="text-sm text-text-body">
        {o ? o.codigo_promocion : <span className="text-text-muted">— sin vincular —</span>}
      </span>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <select
        value={actual ?? ""}
        disabled={pending}
        aria-label="Promoción de Zoho"
        className={`min-w-0 flex-1 rounded border bg-page px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-icam-900/20 disabled:opacity-60 ${
          actual ? "border-subtle text-text-body" : "border-amber-300 text-text-muted"
        }`}
        onChange={(e) => guardar(e.target.value || null)}
      >
        <option value="">— sin vincular —</option>
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {etiqueta(o)}
          </option>
        ))}
      </select>
      {actual && origen === "auto" ? (
        <span
          className="shrink-0 rounded border border-icam-900/20 bg-icam-900/[0.06] px-1 py-0.5 text-[9px] font-medium text-icam-900"
          title="Emparejado en la carga inicial desde una lista de pares escrita a mano, no por una regla automática. Puedes cambiarlo."
        >
          auto
        </span>
      ) : null}
    </div>
  );
}
