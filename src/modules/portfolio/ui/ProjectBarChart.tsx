"use client";

import { fmtMEuros, fmtPct } from "@/lib/formatters";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BarDatum {
  name: string;
  value: number;
}

interface ProjectBarChartProps {
  title: string;
  data: BarDatum[];
  valueType: "pct" | "meuros";
}

function formatValue(value: number, valueType: "pct" | "meuros"): string {
  return valueType === "pct" ? fmtPct(value) : fmtMEuros(value);
}

export function ProjectBarChart({ title, data, valueType }: ProjectBarChartProps) {
  const height = Math.max(280, data.length * 34);

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">{title}</h3>
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis
              type="number"
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              tickFormatter={(value) => formatValue(Number(value), valueType)}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={82}
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              interval={0}
            />
            <Tooltip
              cursor={false}
              formatter={(value) => formatValue(Number(value ?? 0), valueType)}
            />
            <Bar dataKey="value" fill="#1E2A56" radius={[0, 4, 4, 0]} activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
