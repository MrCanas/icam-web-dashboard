"use client";

import { fmtMEuros } from "@/lib/formatters";
import { VintageGroup } from "@/lib/calculations";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface VintageChartProps {
  data: VintageGroup[];
}

export function VintageChart({ data }: VintageChartProps) {
  const chartData = data.map((item) => ({
    year: item.year,
    invActivos: item.invActivos,
    invCulminados: item.invCulminados,
    total: item.invTotal,
    count: item.count,
    tooltipLabel: `Año ${item.year} · ${item.count} proyectos`,
  }));

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">
        Inversión Comprometida por Vintage
      </h3>
      <div className="overflow-x-auto">
        <BarChart width={980} height={320} data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
          <XAxis dataKey="year" stroke="#8A8A8A" fontSize={11} />
          <YAxis stroke="#8A8A8A" fontSize={11} tickFormatter={(value) => fmtMEuros(Number(value))} />
          <Tooltip
            formatter={(value, key) => {
              const numericValue = Number(value ?? 0);
              const name = String(key ?? "");
              if (name === "invActivos") return [fmtMEuros(numericValue), "En Marcha"];
              if (name === "invCulminados") return [fmtMEuros(numericValue), "Culminado"];
              return [fmtMEuros(numericValue), "Total"];
            }}
            labelFormatter={(_value, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
          />
          <Legend />
          <Bar dataKey="invActivos" stackId="inv" fill="#1E2A56" name="En Marcha" />
          <Bar dataKey="invCulminados" stackId="inv" fill="#B89660" name="Culminado">
            <LabelList
              dataKey="total"
              position="top"
              formatter={(value) => fmtMEuros(Number(value ?? 0))}
              fill="#1E2A56"
              fontSize={10}
            />
          </Bar>
        </BarChart>
      </div>
    </section>
  );
}
