"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { getAvanceActa, type GetAvanceActaResult } from "@/modules/pm/avance/actions/get-avance-acta";
import { fmtDelta, type AvanceActa, type AvanceActaFila } from "@/modules/pm/avance/logic/avance-a-fecha";
import { anchoBarra, fmtPorcentaje } from "@/modules/pm/avance/logic/avance-obra";
import { formatDateYmd } from "@/modules/pm/actas/logic/acta-url-state";
import { formatActaRangeDate } from "@/modules/pm/actas/logic/actas-time";

import { AvanceHistoricoTable } from "./AvanceHistoricoTable";
import { AvanceObraEstadoVacio } from "./AvanceObraEstadoVacio";
import { AvanceObraPanel } from "./AvanceObraPanel";

interface ActaAvanceObraSectionProps {
  idActivo: string;
  dateFrom: string;
  dateTo: string;
}

/**
 * Primera sección de la vista Acta: el avance de obra del proyecto.
 *
 * - Si el acta llega a hoy, el avance vigente es el del acta y se puede editar
 *   aquí mismo (el mismo panel que la antigua pestaña «Avance de obra»).
 * - Si el acta es de un periodo cerrado, se enseña el avance reconstruido a esa
 *   fecha, de solo lectura: editar ahí escribiría hoy un valor que parecería
 *   del pasado.
 *
 * En los dos casos va la variación del periodo por fase.
 */
export function ActaAvanceObraSection({ idActivo, dateFrom, dateTo }: ActaAvanceObraSectionProps) {
  const [pending, startTransition] = useTransition();
  const [res, setRes] = useState<GetAvanceActaResult | null>(null);
  const [verHistorico, setVerHistorico] = useState(false);

  const cargar = useCallback(() => {
    startTransition(async () => {
      setRes(await getAvanceActa({ idActivo, dateFrom, dateTo }));
    });
  }, [idActivo, dateFrom, dateTo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (res?.ok && res.oculto) return null;

  const periodoAbierto = dateTo >= formatDateYmd(new Date());

  return (
    <section aria-label="Avance de obra" className="relative space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-subtle/40 pb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-icam-900">
          Avance de obra
        </h2>
        <span className="text-xs text-text-muted">
          {periodoAbierto
            ? "Valores vigentes"
            : `Valores a ${formatActaRangeDate(dateTo)}`}
        </span>
      </div>

      {pending && !res ? (
        <p className="rounded-lg border border-subtle/50 bg-card p-4 text-sm text-text-muted">
          Cargando avance de obra…
        </p>
      ) : null}

      {res && !res.ok ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {res.error}
        </p>
      ) : null}

      {res?.ok && !res.oculto ? (
        <div className={pending ? "opacity-60 transition-opacity" : undefined}>
          {!res.resultado.data || !res.resultado.acta ? (
            <AvanceObraEstadoVacio
              idActivo={idActivo}
              sinPromocion={
                res.resultado.sinPromocion ||
                (!res.resultado.migracionPendiente && !res.resultado.error)
              }
              migracionPendiente={res.resultado.migracionPendiente}
              error={res.resultado.error}
            />
          ) : (
            <div className="space-y-4">
              {periodoAbierto ? (
                <AvanceObraPanel
                  data={res.resultado.data}
                  hasWriteAccess={res.hasWriteAccess}
                  onSaved={cargar}
                />
              ) : (
                <p className="rounded border border-subtle/60 bg-page px-3 py-2 text-xs leading-snug text-text-muted">
                  Acta de un periodo cerrado: se muestra el avance que había el{" "}
                  {formatActaRangeDate(dateTo)}. El avance se edita desde un acta que llegue a hoy.
                </p>
              )}

              <AvanceActaTabla
                acta={res.resultado.acta}
                dateFrom={dateFrom}
                dateTo={dateTo}
                mostrarBarras={!periodoAbierto}
              />

              <div>
                <button
                  type="button"
                  className="text-sm font-medium text-icam-900 hover:underline"
                  aria-expanded={verHistorico}
                  onClick={() => setVerHistorico((v) => !v)}
                >
                  {verHistorico ? "▾" : "▸"} Cambios de avance en el periodo (
                  {res.resultado.historicoPeriodo.length})
                </button>
                {verHistorico ? (
                  <div className="mt-2">
                    <AvanceHistoricoTable filas={res.resultado.historicoPeriodo} />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function AvanceActaTabla({
  acta,
  dateFrom,
  dateTo,
  mostrarBarras,
}: {
  acta: AvanceActa;
  dateFrom: string;
  dateTo: string;
  mostrarBarras: boolean;
}) {
  const filas: (AvanceActaFila & { destacado?: boolean })[] = [
    ...(acta.general ? [{ ...acta.general, destacado: true }] : []),
    ...acta.fases,
  ];

  if (filas.length === 0) {
    return <p className="text-sm text-text-muted">El catálogo de fases está vacío.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
      <table className="w-full min-w-[480px] text-left text-sm">
        <caption className="px-3 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted">
          Variación en el periodo
        </caption>
        <thead className="bg-subtle/30">
          <tr>
            <th className="p-3 font-semibold text-icam-900">Fase</th>
            <th className="p-3 text-right font-semibold text-icam-900">
              {formatActaRangeDate(dateFrom)}
            </th>
            <th className="p-3 text-right font-semibold text-icam-900">
              {formatActaRangeDate(dateTo)}
            </th>
            <th className="p-3 text-right font-semibold text-icam-900">Δ</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.faseId}
              className={`border-t border-subtle/50 ${f.destacado ? "bg-icam-900/[0.03]" : ""}`}
            >
              <td className={`p-3 text-text-body ${f.destacado ? "font-semibold" : ""}`}>
                {f.nombre}
                {mostrarBarras ? (
                  <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded bg-subtle">
                    <div className="h-full bg-icam-900" style={{ width: anchoBarra(f.hasta) }} />
                  </div>
                ) : null}
              </td>
              <td className="p-3 text-right tabular-nums text-text-muted">
                {fmtPorcentaje(f.desde)}
              </td>
              <td className="p-3 text-right font-medium tabular-nums text-text-body">
                {fmtPorcentaje(f.hasta)}
              </td>
              <td
                className={`p-3 text-right tabular-nums ${
                  f.delta !== null && f.delta > 0
                    ? "text-emerald-700"
                    : f.delta !== null && f.delta < 0
                      ? "text-red-700"
                      : "text-text-muted"
                }`}
              >
                {fmtDelta(f.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
