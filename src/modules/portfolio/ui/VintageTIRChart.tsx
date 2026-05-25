"use client";

import { VintageGroup } from "@/modules/portfolio/logic/calculations";
import { fmtPct } from "@/lib/formatters";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface VintageTIRChartProps {
  data: VintageGroup[];
}

export function VintageTIRChart({ data }: VintageTIRChartProps) {
  const chartData = data
    .filter((item) => item.proyectos.some((project) => (project.tir_desp_is ?? 0) > 0))
    .map((item) => ({
      year: item.year,
      tirPonderada: item.tirPonderada,
      count: item.count,
    }));

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">
        TIR Ponderada por Generación
      </h3>
      <div className="h-[240px] w-full sm:h-[300px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis dataKey="year" stroke="#8A8A8A" tick={{ fontSize: 10 }} />
            <YAxis
              stroke="#8A8A8A"
              tick={{ fontSize: 10 }}
              width={36}
              tickFormatter={(value) => fmtPct(Number(value))}
            />
            <ReferenceLine y={0.15} stroke="#B89660" strokeDasharray="6 4" />
            <Tooltip
              cursor={false}
              formatter={(value) => {
                const numericValue = Number(value ?? 0);
                return [fmtPct(numericValue), "TIR ponderada"];
              }}
              labelFormatter={(value, payload) =>
                `Año ${value} · ${payload?.[0]?.payload?.count ?? 0} proyectos`
              }
            />
            <Line
              type="monotone"
              dataKey="tirPonderada"
              stroke="#1E2A56"
              strokeWidth={2}
              dot={{ r: 3, fill: "#1E2A56" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
