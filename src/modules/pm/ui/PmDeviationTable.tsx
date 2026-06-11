"use client";

import {
  formatDeviationMonths,
  type PmDeviationTableRow,
  type PmDeviationTrend,
} from "@/modules/pm/logic/pm-viz";

function TrendCell({ trend }: { trend: PmDeviationTrend | null }) {
  if (!trend) return <span className="text-text-muted">—</span>;
  if (trend === "worse") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 font-medium" title="Empeorando">
        ↗
      </span>
    );
  }
  if (trend === "better") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium" title="Mejorando">
        ↘
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-500 font-medium" title="Estable">
      →
    </span>
  );
}

export function PmDeviationTable({ rows }: { rows: PmDeviationTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-subtle bg-subtle/30 text-left">
            <th className="p-3 font-semibold text-[#1E2A56]">Hito</th>
            <th className="p-3 font-semibold text-[#1E2A56]">Fecha actual</th>
            <th className="p-3 font-semibold text-[#1E2A56]">Fecha levantamiento</th>
            <th className="p-3 font-semibold text-[#1E2A56]">Desviación (meses)</th>
            <th className="p-3 font-semibold text-[#1E2A56]">Tendencia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.hito}-${r.ordenHito}`} className="border-b border-subtle/70">
              <td className="p-3 font-medium text-[#1E2A56]">{r.hito}</td>
              <td className="p-3 whitespace-nowrap">{r.fechaActual ?? "—"}</td>
              <td className="p-3 whitespace-nowrap">{r.fechaLevantamiento ?? "—"}</td>
              <td className="p-3 tabular-nums">
                {r.deviationDays != null ? formatDeviationMonths(r.deviationDays) : "—"}
              </td>
              <td className="p-3 text-lg leading-none">
                <TrendCell trend={r.trend} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
