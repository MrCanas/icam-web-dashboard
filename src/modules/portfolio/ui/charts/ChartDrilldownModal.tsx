"use client";

import { Modal } from "@/components/ui/Modal";
import { fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { drilldownSummary } from "@/modules/portfolio/logic/drilldown";
import type { Proyecto } from "@/modules/portfolio/types";

export interface ChartDrilldownSelection {
  title: string;
  subtitle?: string;
  proyectos: Proyecto[];
  /**
   * Identificador de la marca pinchada. Permite resaltarla mientras el modal
   * está abierto sin duplicar estado en la gráfica.
   */
  key?: string;
}

interface ChartDrilldownModalProps {
  selection: ChartDrilldownSelection | null;
  onClose: () => void;
}

function maybe(value: number | null, formatter: (value: number) => string): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  return formatter(value);
}

/**
 * Detalle de la marca pinchada en una gráfica: los proyectos concretos que hay
 * detrás, con sus métricas y una fila de totales.
 *
 * Va en la capa elevada (portal + z-[80]) porque la barra flotante de portfolio
 * vive en z-[65]: un modal z-50 quedaría por debajo de ella.
 */
export function ChartDrilldownModal({ selection, onClose }: ChartDrilldownModalProps) {
  const proyectos = selection?.proyectos ?? [];
  const total = drilldownSummary(proyectos);

  return (
    <Modal
      open={selection !== null}
      title={selection?.title ?? ""}
      subtitle={selection?.subtitle}
      width="xl"
      elevated
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900"
        >
          Cerrar
        </button>
      }
    >
      {proyectos.length === 0 ? (
        <p className="text-sm text-text-muted">
          No hay proyectos en este tramo con los filtros activos.
        </p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-text-muted border-b border-subtle">
                <th className="py-2 pr-3">Proyecto</th>
                <th className="py-2 pr-3">Situación</th>
                <th className="py-2 pr-3 text-right">Inversión</th>
                <th className="py-2 pr-3 text-right">TIR</th>
                <th className="py-2 pr-3 text-right">ROE</th>
                <th className="py-2 pr-3 text-right">Múltiplo</th>
                <th className="py-2 text-right">Beneficio</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.map((p) => (
                <tr key={p.id} className="border-b border-subtle/60 text-text-body last:border-b-0">
                  <td className="py-2 pr-3 font-medium text-icam-900">
                    {p.proyecto}
                    {p.ubicacion ? (
                      <span className="block text-xs font-normal text-text-muted">
                        {p.ubicacion}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{p.situacion}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {maybe(p.inversion_total, fmtMEuros)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {maybe(p.tir_desp_is, fmtPct)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {maybe(p.roe_desp_is, fmtPct)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {maybe(p.multiplo, fmtMult)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {maybe(p.beneficios, fmtMEuros)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-subtle font-semibold text-icam-900">
                <td className="py-2 pr-3">{total.count} proyectos</td>
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3 text-right tabular-nums">{fmtMEuros(total.inversion)}</td>
                <td className="py-2 pr-3 text-right tabular-nums" title="TIR ponderada por inversión">
                  {fmtPct(total.tirPonderada)}
                </td>
                <td className="py-2 pr-3" />
                <td className="py-2 pr-3" />
                <td className="py-2 text-right tabular-nums">{fmtMEuros(total.beneficio)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Modal>
  );
}
