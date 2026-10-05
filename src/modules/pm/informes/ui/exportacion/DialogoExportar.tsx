"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";

import { resumenIncidencias } from "../../logic/exportacion";
import type { IncidenciaExportacion, MedioExportacion } from "../../types";
import { Boton } from "../componentes";

interface Props {
  medio: MedioExportacion;
  incidencias: IncidenciaExportacion[];
  /** Mientras se genera el PDF o se anota la exportación. */
  ocupado: boolean;
  error: string | null;
  onCerrar: () => void;
  /** `confirmado`: había incidencias y la persona ha marcado «Estoy seguro». */
  onExportar: (confirmado: boolean) => void;
}

/**
 * Validador de exportación: antes de sacar el PDF lista lo que falta por
 * resolver y, si hay algo, no deja seguir sin marcar «Estoy seguro». Lo que se
 * decide aquí queda en el registro de exportaciones del informe.
 */
export function DialogoExportar({ medio, incidencias, ocupado, error, onCerrar, onExportar }: Props) {
  const [seguro, setSeguro] = useState(false);
  const errores = incidencias.filter((x) => x.nivel === "error");
  const avisos = incidencias.filter((x) => x.nivel === "aviso");
  const hay = incidencias.length > 0;
  const puede = !ocupado && (!hay || seguro);
  const accion = medio === "pdf" ? "Descargar PDF" : "Imprimir";

  return (
    <Modal
      open
      elevated
      width="lg"
      title={hay ? "¿Seguro que quieres exportar el informe así?" : "Exportar el informe"}
      subtitle={hay ? `El validador ha encontrado ${resumenIncidencias(incidencias)}.` : "El validador no ha encontrado nada pendiente."}
      busy={ocupado}
      onClose={onCerrar}
      footer={
        <>
          <Boton onClick={onCerrar} disabled={ocupado}>
            Cancelar
          </Boton>
          <Boton variante="primario" disabled={!puede} onClick={() => onExportar(hay && seguro)}>
            {ocupado ? (medio === "pdf" ? "Generando PDF…" : "Anotando…") : accion}
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        {hay ? (
          <>
            <p className="text-sm text-text-primary">Falta por resolver:</p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {[...errores, ...avisos].map((x, i) => (
                <li key={i} className="flex flex-wrap items-start gap-1.5">
                  <span
                    className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${x.nivel === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}
                  >
                    {x.nivel === "error" ? "Bloqueante" : "Aviso"}
                  </span>
                  <span>
                    {x.slide ? <b className="text-text-primary">{x.slide} · </b> : null}
                    {x.texto}
                  </span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={seguro} disabled={ocupado} onChange={(e) => setSeguro(e.target.checked)} />
              <span>
                <b>Estoy seguro:</b> quiero exportar el informe así, con lo que falta. Quedará registrado que he exportado con estas incidencias.
              </span>
            </label>
          </>
        ) : (
          <p className="text-sm text-text-muted">Sin datos pendientes, desbordes, páginas de Finanzas sin aportar ni huecos de imagen.</p>
        )}
        <p className="text-xs text-text-muted">
          Cada exportación queda anotada al final del informe: quién, cuándo, por qué medio y si ha tenido que confirmar.
        </p>
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
