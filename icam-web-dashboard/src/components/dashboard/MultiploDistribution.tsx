"use client";

import { BucketCount, listProjectsInMultiploBucket } from "@/lib/calculations";
import { fmtMult } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";
import { useState } from "react";
import {
  Bar,
  BarChart,
  BarRectangleItem,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MultiploDistributionProps {
  data: BucketCount[];
  proyectos: Proyecto[];
}

const barColors = ["#9b7f57", "#a88d67", "#B89660", "#8e744f"];

export function MultiploDistribution({ data, proyectos }: MultiploDistributionProps) {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  function handleBarClick(item: BarRectangleItem) {
    const label = item.payload?.label as string | undefined;
    if (typeof label !== "string") return;
    setSelectedLabel((prev) => (prev === label ? null : label));
  }

  const drillItems = selectedLabel ? listProjectsInMultiploBucket(proyectos, selectedLabel) : [];

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">Distribución de Múltiplo</h3>
      <p className="text-xs sm:text-sm text-text-muted mb-2">
        Pulsa una barra para ver los proyectos del tramo.
      </p>
      <div className="h-[240px] w-full sm:h-[280px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 6, left: -18, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis
              dataKey="label"
              stroke="#8A8A8A"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={48}
            />
            <YAxis allowDecimals={false} stroke="#8A8A8A" tick={{ fontSize: 10 }} width={32} />
            <Tooltip cursor={false} />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              activeBar={false}
              onClick={handleBarClick}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={barColors[index % barColors.length]}
                  opacity={selectedLabel && selectedLabel !== entry.label ? 0.4 : 1}
                />
              ))}
              <LabelList dataKey="count" position="top" fill="#1E2A56" fontSize={10} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {selectedLabel ? (
        <div className="mt-3 rounded-md border border-[#EAEBEE] bg-white p-3 text-[#1E2A56]">
          <p className="text-sm font-semibold mb-2">
            Proyectos en tramo {selectedLabel} ({drillItems.length})
          </p>
          {drillItems.length === 0 ? (
            <p className="text-sm text-text-muted">No hay proyectos en este tramo con los filtros actuales.</p>
          ) : (
            <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
              {drillItems.map((item) => (
                <li
                  key={item.proyecto}
                  className="flex justify-between gap-3 border-b border-subtle/40 pb-1 last:border-0"
                >
                  <span className="font-medium truncate">{item.proyecto}</span>
                  <span className="shrink-0 font-mono text-sm">{fmtMult(item.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
