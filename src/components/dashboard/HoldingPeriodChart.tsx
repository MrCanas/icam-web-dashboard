"use client";

import { HoldingBucket } from "@/lib/calculations";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

interface HoldingPeriodChartProps {
  data: HoldingBucket[];
  averageMonths: number;
}

export function HoldingPeriodChart({ data, averageMonths }: HoldingPeriodChartProps) {
  const chartData = data.map((item) => ({
    label: item.label,
    activos: item.activos,
    culminados: item.culminados,
  }));

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">Holding Period por Proyecto</h3>
      <div className="overflow-x-auto">
        <BarChart width={980} height={320} data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
          <XAxis dataKey="label" stroke="#8A8A8A" fontSize={11} />
          <YAxis allowDecimals={false} stroke="#8A8A8A" fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar dataKey="activos" stackId="hold" fill="#1E2A56" name="En Marcha" />
          <Bar dataKey="culminados" stackId="hold" fill="#B89660" name="Culminado" />
        </BarChart>
      </div>
      <p className="mt-2 text-xs text-text-muted">Media general: {Math.round(averageMonths)} meses</p>
    </section>
  );
}
