"use client";

import { fmtMEuros } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

interface Top10BarChartProps {
  data: Proyecto[];
}

export function Top10BarChart({ data }: Top10BarChartProps) {
  const chartData = data.map((item) => ({
    name: item.proyecto,
    inversion: item.inversion_total ?? 0,
  }));

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 h-[420px]">
      <h3 className="text-base font-semibold text-text-primary mb-4">Top 10 proyectos por inversión</h3>
      <div className="h-[340px] min-w-0 overflow-x-auto">
        <BarChart width={700} height={340} data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
          <XAxis
            type="number"
            stroke="#8A8A8A"
            tickFormatter={(value) => fmtMEuros(Number(value))}
            fontSize={11}
          />
          <YAxis dataKey="name" type="category" width={80} stroke="#8A8A8A" fontSize={11} />
          <Tooltip formatter={(value) => fmtMEuros(Number(value))} />
          <Bar dataKey="inversion" fill="#1E2A56" radius={[0, 4, 4, 0]} />
        </BarChart>
      </div>
    </section>
  );
}
