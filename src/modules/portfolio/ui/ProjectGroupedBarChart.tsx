"use client";

import { fmtMEuros, fmtPct } from "@/lib/formatters";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface GroupedBarDatum {
  name: string;
  a: number;
  b: number;
}

interface ProjectGroupedBarChartProps {
  title: string;
  data: GroupedBarDatum[];
  seriesNames: [string, string];
  valueType: "pct" | "meuros";
}

function formatValue(value: number, valueType: "pct" | "meuros"): string {
  return valueType === "pct" ? fmtPct(value) : fmtMEuros(value);
}

export function ProjectGroupedBarChart({
  title,
  data,
  seriesNames,
  valueType,
}: ProjectGroupedBarChartProps) {
  // Layout horizontal: alto proporcional al nº de proyectos para que sea legible.
  const height = Math.max(280, data.length * 42);

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">{title}</h3>
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            barGap={2}
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
              formatter={(value, key) => {
                const name = key === "a" ? seriesNames[0] : seriesNames[1];
                return [formatValue(Number(value ?? 0), valueType), name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="a" name={seriesNames[0]} fill="#1E2A56" radius={[0, 3, 3, 0]} activeBar={false} />
            <Bar dataKey="b" name={seriesNames[1]} fill="#B89660" radius={[0, 3, 3, 0]} activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
