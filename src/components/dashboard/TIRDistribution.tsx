"use client";

import { BucketCount } from "@/lib/calculations";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";

interface TIRDistributionProps {
  data: BucketCount[];
}

const barColors = ["#2B3668", "#25305f", "#1f2a56", "#1E2A56", "#172047"];

export function TIRDistribution({ data }: TIRDistributionProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">Distribución de TIR</h3>
      <div className="overflow-x-auto">
        <BarChart width={460} height={280} data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
          <XAxis dataKey="label" stroke="#8A8A8A" fontSize={11} />
          <YAxis allowDecimals={false} stroke="#8A8A8A" fontSize={11} />
          <Tooltip />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={barColors[index % barColors.length]} />
            ))}
            <LabelList dataKey="count" position="top" fill="#1E2A56" fontSize={11} />
          </Bar>
        </BarChart>
      </div>
    </section>
  );
}
