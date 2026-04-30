"use client";

import { fmtMEuros } from "@/lib/formatters";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 h-[202px]">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      <div className="flex h-[150px]">
        <div className="w-1/2">
          <div className="h-full min-w-0">
            <PieChart width={180} height={150}>
              <Pie
                data={data}
                dataKey="inversion"
                nameKey="label"
                innerRadius={34}
                outerRadius={56}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => fmtMEuros(Number(value ?? 0))} />
            </PieChart>
          </div>
        </div>
        <div className="w-1/2 flex flex-col justify-center gap-2 pl-2">
          {data.map((item, index) => (
            <div key={item.label} className="text-xs text-text-body flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                {item.label}
              </span>
              <span className="text-text-muted">
                {item.count}/{totalCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
