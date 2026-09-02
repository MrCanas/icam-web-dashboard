"use client";

import { fmtMEuros, fmtPct } from "@/lib/formatters";
import { projectByName } from "@/modules/portfolio/logic/drilldown";
import type { Proyecto } from "@/modules/portfolio/types";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface ShareDatum {
  label: string;
  value: number;
}

interface ProjectSharePieProps {
  title: string;
  data: ShareDatum[];
  valueType: "pct" | "meuros";
  /** Filas ya filtradas, para resolver el proyecto del sector pinchado. */
  proyectos: Proyecto[];
}

const palette = [
  "#1E2A56",
  "#B89660",
  "#2B3668",
  "#9b7f57",
  "#3D4C82",
  "#A0824F",
  "#55639B",
  "#C7A97A",
  "#6E7BB0",
  "#8A8A8A",
  "#4A5688",
  "#D4BC94",
];

function formatValue(value: number, valueType: "pct" | "meuros"): string {
  return valueType === "pct" ? fmtPct(value) : fmtMEuros(value);
}

export function ProjectSharePie({ title, data, valueType, proyectos }: ProjectSharePieProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const drilldown = useChartDrilldown();

  function abrirDetalle(label: string) {
    drilldown.open({ title: label, proyectos: projectByName(proyectos, label) });
  }

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">{title}</h3>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 sm:items-center min-w-0">
        <div className="h-[200px] w-full sm:w-1/2 sm:max-w-[240px] sm:h-[220px] mx-auto sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                outerRadius={82}
                paddingAngle={1}
                cursor="pointer"
                onClick={(entry) => {
                  const label = (entry as { label?: string })?.label;
                  if (label) abrirDetalle(label);
                }}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    heading={(payload) => String(payload[0]?.payload?.label ?? "")}
                    rows={(payload) => {
                      const valor = Number(payload[0]?.value ?? 0);
                      return [
                        { label: title, value: formatValue(valor, valueType) },
                        {
                          label: "Peso",
                          value: total > 0 ? fmtPct(valor / total) : "—",
                        },
                      ];
                    }}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full sm:w-1/2 flex flex-col gap-1.5 text-sm min-w-0 max-h-[240px] overflow-y-auto pr-1">
          {data.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => abrirDetalle(item.label)}
              className="text-text-body flex items-center justify-between gap-2 min-w-0 rounded px-1 py-0.5 text-left hover:bg-subtle/60 focus-visible:outline-2 focus-visible:outline-icam-900"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-text-muted shrink-0 tabular-nums">
                {total > 0 ? fmtPct(item.value / total) : "—"}
              </span>
            </button>
          ))}
        </div>
      </div>
      {drilldown.modal}
    </section>
  );
}
