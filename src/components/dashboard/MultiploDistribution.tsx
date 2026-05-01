"use client";

import { BucketCount, listProjectsInMultiploBucket } from "@/lib/calculations";
import { fmtMult } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";
import { useState } from "react";
import { Bar, BarChart, BarRectangleItem, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";

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
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-3">Distribución de Múltiplo</h3>
      <p className="text-[11px] text-text-muted mb-2">Pulsa una barra para ver los proyectos del tramo.</p>
      <div className="overflow-x-auto">
        <BarChart width={460} height={280} data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
          <XAxis dataKey="label" stroke="#8A8A8A" fontSize={11} />
          <YAxis allowDecimals={false} stroke="#8A8A8A" fontSize={11} />
          <Tooltip />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={handleBarClick}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.label}
                fill={barColors[index % barColors.length]}
                opacity={selectedLabel && selectedLabel !== entry.label ? 0.45 : 1}
              />
            ))}
            <LabelList dataKey="count" position="top" fill="#1E2A56" fontSize={11} />
          </Bar>
        </BarChart>
      </div>
      {selectedLabel ? (
        <div className="mt-3 rounded-md border border-[#EAEBEE] bg-white p-3 text-[#1E2A56]">
          <p className="text-xs font-semibold mb-2">
            Proyectos en tramo {selectedLabel} ({drillItems.length})
          </p>
          {drillItems.length === 0 ? (
            <p className="text-xs text-text-muted">No hay proyectos en este tramo con los filtros actuales.</p>
          ) : (
            <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto">
              {drillItems.map((item) => (
                <li key={item.proyecto} className="flex justify-between gap-3 border-b border-subtle/40 pb-1 last:border-0">
                  <span className="font-medium truncate">{item.proyecto}</span>
                  <span className="shrink-0 font-mono text-xs">{fmtMult(item.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
