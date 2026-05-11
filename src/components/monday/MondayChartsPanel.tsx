"use client";

import type { MondayStageMetric, MondayUseMetric } from "@/lib/monday/dashboard-types";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const usePalette = ["#1E2A56", "#B89660", "#2B3668", "#8A8A8A", "#A0824F"];
const locale = "es-ES";

function fmtMEur(value: number) {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 1_000_000)} M€`;
}

interface MondayChartsPanelProps {
  stageMetrics: MondayStageMetric[];
  useMetrics: MondayUseMetric[];
}

export function MondayChartsPanel({ stageMetrics, useMetrics }: MondayChartsPanelProps) {
  return (
    <section className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
      <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Activos por fase</h3>
        <div className="h-[260px] min-h-[260px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageMetrics} layout="vertical" margin={{ left: 10, right: 8 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(value) => Number(value).toLocaleString(locale)} />
              <Bar dataKey="count" fill="#1E2A56" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Volumen por fase</h3>
        <div className="h-[260px] min-h-[260px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageMetrics} margin={{ left: 0, right: 8 }}>
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => fmtMEur(Number(value ?? 0))} />
              <Bar dataKey="volume" fill="#1E2A56" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Mix por uso</h3>
        <div className="h-[260px] min-h-[260px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={useMetrics} dataKey="count" nameKey="label" innerRadius={50} outerRadius={86} paddingAngle={2}>
                {useMetrics.map((entry, index) => (
                  <Cell key={entry.label} fill={usePalette[index % usePalette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, _name, payload) => `${value} (${fmtMEur(Number(payload?.payload?.volume ?? 0))})`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}

