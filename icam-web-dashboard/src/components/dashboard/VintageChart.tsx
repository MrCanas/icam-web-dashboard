"use client";

import { fmtMEuros } from "@/lib/formatters";
import { VintageGroup } from "@/lib/calculations";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">
        Inversión Comprometida por Vintage
      </h3>
      <div className="h-[260px] w-full sm:h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis dataKey="year" stroke="#8A8A8A" tick={{ fontSize: 10 }} interval={0} />
            <YAxis
              stroke="#8A8A8A"
              tick={{ fontSize: 10 }}
              width={36}
              tickFormatter={(value) => fmtMEuros(Number(value))}
            />
            <Tooltip
              cursor={false}
              formatter={(value, key) => {
                const numericValue = Number(value ?? 0);
                const name = String(key ?? "");
                if (name === "invActivos") return [fmtMEuros(numericValue), "En Marcha"];
                if (name === "invCulminados") return [fmtMEuros(numericValue), "Culminado"];
                return [fmtMEuros(numericValue), "Total"];
              }}
              labelFormatter={(_value, payload) => payload?.[0]?.payload?.tooltipLabel ?? ""}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="invActivos" stackId="inv" fill="#1E2A56" name="En Marcha" activeBar={false} />
            <Bar dataKey="invCulminados" stackId="inv" fill="#B89660" name="Culminado" activeBar={false}>
              <LabelList
                dataKey="total"
                position="top"
                formatter={(value) => fmtMEuros(Number(value ?? 0))}
                fill="#1E2A56"
                fontSize={9}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
