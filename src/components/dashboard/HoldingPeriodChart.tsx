"use client";

import { HoldingBucket } from "@/lib/calculations";
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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">
        Holding Period por Proyecto
      </h3>
      <div className="h-[260px] w-full sm:h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis
              dataKey="label"
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={44}
            />
            <YAxis allowDecimals={false} stroke="#8A8A8A" tick={{ fontSize: 10 }} width={32} />
            <Tooltip cursor={false} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="activos" stackId="hold" fill="#1E2A56" name="En Marcha" activeBar={false} />
            <Bar dataKey="culminados" stackId="hold" fill="#B89660" name="Culminado" activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-sm text-text-muted">Media general: {Math.round(averageMonths)} meses</p>
    </section>
  );
}
