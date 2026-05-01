"use client";

import { fmtMEuros } from "@/lib/formatters";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

interface DonutChartDatum {
  label: string;
  count: number;
  inversion: number;
}

interface DonutChartProps {
  title: string;
  data: DonutChartDatum[];
}

const palette = ["#1E2A56", "#9b7f57", "#B89660", "#A0824F", "#8A8A8A"];

export function DonutChart({ title, data }: DonutChartProps) {
  const totalCount = data.reduce((acc, item) => acc + item.count, 0);

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-sm font-semibold text-text-primary mb-2 sm:mb-3">{title}</h3>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 sm:items-center min-w-0">
        <div className="h-[160px] w-full sm:w-1/2 sm:max-w-[200px] sm:h-[150px] mx-auto sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="inversion"
                nameKey="label"
                innerRadius={34}
                outerRadius={58}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                formatter={(value) => fmtMEuros(Number(value ?? 0))}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full sm:w-1/2 flex flex-col justify-center gap-2 text-sm min-w-0">
          {data.map((item, index) => (
            <div
              key={item.label}
              className="text-text-body flex items-center justify-between gap-2 min-w-0"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-text-muted shrink-0">
                {item.count}/{totalCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
