"use client";

import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import type { ComComunicacionRow, ResumenDestinatarios } from "@/modules/comunicaciones/types";
import { PasoCard } from "@/modules/comunicaciones/ui/components/ui/PasoCard";

import { cuantos } from "./texto";

export function PasoRevisar({
  comunicacion,
  resumen,
  hecho,
  puedeEscribir,
  ocupado,
  motivo,
  onRevisar,
}: {
  comunicacion: ComComunicacionRow;
  resumen: ResumenDestinatarios;
  hecho: boolean;
  puedeEscribir: boolean;
  ocupado: boolean;
  motivo: string | null;
  onRevisar: () => void;
}) {
  if (hecho) {
    return (
      <PasoCard
        numero={1}
        titulo="Destinatarios revisados"
        estado="hecho"
        resumen={`${comunicacion.revisada_por_email} · ${fmtFechaHora(comunicacion.revisada_at)} · ${cuantos(comunicacion.revisada_n ?? 0, "correo", "correos")}`}
      />
    );
  }
  return (
    <PasoCard numero={1} titulo="Revisar los destinatarios" estado="actual">
      <p>
        {resumen.aEnviar === 1 ? "Saldría" : "Saldrían"} <strong>{cuantos(resumen.aEnviar, "correo", "correos")}</strong>, a{" "}
        {cuantos(resumen.direcciones, "dirección", "direcciones")} ({cuantos(resumen.direccionesExternas, "externa", "externas")}
        ). Repasa la pestaña «Destinatarios» antes de darla por buena.
        <Ayuda className="ml-1">
          Si después excluyes o incluyes a alguien, la comunicación vuelve a borrador y habrá que revisarla otra vez.
        </Ayuda>
      </p>
      {puedeEscribir ? (
        <div className="flex flex-wrap items-center gap-2">
          <Boton variante="primario" disabled={ocupado || motivo !== null} onClick={onRevisar}>
            {resumen.aEnviar === 1 ? "He revisado el destinatario" : `He revisado los ${fmtInt(resumen.aEnviar)} destinatarios`}
          </Boton>
          {motivo ? <span className="text-xs text-text-muted">{motivo}</span> : null}
        </div>
      ) : null}
    </PasoCard>
  );
}
