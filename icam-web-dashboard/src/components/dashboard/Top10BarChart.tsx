"use client";

import { fmtMEuros } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Top10BarChartProps {
  data: Proyecto[];
}

export function Top10BarChart({ data }: Top10BarChartProps) {
  const chartData = data.map((item) => ({
    name: item.proyecto,
    inversion: item.inversion_total ?? 0,
  }));

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-3 sm:mb-4">
        Top 10 proyectos por inversión
      </h3>
      <div className="h-[300px] w-full sm:h-[340px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis
              type="number"
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              tickFormatter={(value) => fmtMEuros(Number(value))}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={76}
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              interval={0}
            />
            <Tooltip
              cursor={false}
              formatter={(value) => fmtMEuros(Number(value))}
            />
            <Bar dataKey="inversion" fill="#1E2A56" radius={[0, 4, 4, 0]} activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
