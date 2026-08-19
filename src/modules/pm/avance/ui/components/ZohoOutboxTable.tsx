"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  aprobarCambioOutbox,
  descartarCambioOutbox,
  marcarExportadoOutbox,
} from "@/modules/pm/avance/actions/resolver-outbox";
import { fmtPorcentaje } from "@/modules/pm/avance/logic/avance-obra";
import type { OutboxFila } from "@/modules/pm/avance/data/avanceRepository";

interface ZohoOutboxTableProps {
  filas: OutboxFila[];
  /** «pendiente» ofrece aprobar/descartar; «aprobado», marcar como exportado. */
  modo: "pendiente" | "aprobado";
  isAdmin: boolean;
}

const FECHA = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ZohoOutboxTable({ filas, modo, isAdmin }: ZohoOutboxTableProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ejecutar = (fn: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>, id: string) => {
    startTransition(async () => {
      const r = await fn(id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  };

  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-subtle/50 bg-card p-4 text-sm text-text-muted">
        {modo === "pendiente"
          ? "No hay cambios pendientes de aprobar."
          : "No hay cambios aprobados a la espera de exportarse."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-subtle/30">
            <tr>
              <th className="p-3 font-semibold text-icam-900">Promoción</th>
              <th className="p-3 font-semibold text-icam-900">Fase</th>
              <th className="p-3 font-semibold text-icam-900">Zoho</th>
              <th className="p-3 font-semibold text-icam-900">Propuesto</th>
              <th className="p-3 font-semibold text-icam-900">Quién</th>
              <th className="p-3 font-semibold text-icam-900">Cuándo</th>
              {isAdmin ? <th className="p-3 font-semibold text-icam-900" /> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-subtle/50">
                <td className="p-3">
                  <span className="font-medium text-text-body">{f.codigoPromocion}</span>
                  {f.nombrePromocion ? (
                    <span className="text-text-muted"> · {f.nombrePromocion}</span>
                  ) : null}
                </td>
                <td className="p-3 text-text-body">{f.faseNombre}</td>
                <td className="p-3 tabular-nums text-text-muted">
                  {fmtPorcentaje(f.porcentajeZoho)}
                </td>
                <td className="p-3 tabular-nums font-medium text-text-primary">
                  {fmtPorcentaje(f.porcentajeNuevo)}
                </td>
                <td className="p-3 text-text-muted">
                  {modo === "aprobado" ? f.aprobadoPorEmail : f.creadoPorEmail}
                </td>
                <td className="p-3 whitespace-nowrap text-text-muted">
                  {FECHA.format(new Date(modo === "aprobado" ? (f.aprobadoAt ?? f.creadoAt) : f.creadoAt))}
                </td>
                {isAdmin ? (
                  <td className="p-3 whitespace-nowrap">
                    {modo === "pendiente" ? (
                      <span className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => ejecutar(aprobarCambioOutbox, f.id)}
                          className="rounded border border-icam-900/30 bg-icam-900/[0.06] px-2 py-1 text-xs font-medium text-icam-900 hover:bg-icam-900/10 disabled:opacity-60"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          title="No se comunicará a Zoho. El valor editado en el portal se mantiene."
                          onClick={() => ejecutar(descartarCambioOutbox, f.id)}
                          className="rounded border border-subtle px-2 py-1 text-xs text-text-muted hover:bg-page disabled:opacity-60"
                        >
                          Descartar
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        title="Ciérralo cuando hayas subido el fichero a Zoho."
                        onClick={() => ejecutar(marcarExportadoOutbox, f.id)}
                        className="rounded border border-subtle px-2 py-1 text-xs text-text-muted hover:bg-page disabled:opacity-60"
                      >
                        Marcar como enviado
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdmin ? (
        <p className="text-xs text-text-muted">
          Solo un administrador de PM puede aprobar o descartar lo que se le comunica a Zoho.
        </p>
      ) : null}
    </div>
  );
}
