"use client";

import { VintageGroup } from "@/lib/calculations";
import { fmtPct } from "@/lib/formatters";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">TIR Ponderada por Generación</h3>
      <div className="overflow-x-auto">
        <LineChart width={980} height={300} data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
          <XAxis dataKey="year" stroke="#8A8A8A" fontSize={11} />
          <YAxis stroke="#8A8A8A" fontSize={11} tickFormatter={(value) => fmtPct(Number(value))} />
          <ReferenceLine y={0.15} stroke="#B89660" strokeDasharray="6 4" />
          <Tooltip
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
            dot={{ r: 4, fill: "#1E2A56" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </div>
    </section>
  );
}
