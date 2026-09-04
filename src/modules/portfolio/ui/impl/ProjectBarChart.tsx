"use client";

import { fmtMEuros, fmtPct } from "@/lib/formatters";
import { projectByName } from "@/modules/portfolio/logic/drilldown";
import type { Proyecto } from "@/modules/portfolio/types";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BarDatum {
  name: string;
  value: number;
}

export interface ProjectBarChartProps {
  title: string;
  data: BarDatum[];
  valueType: "pct" | "meuros";
  /** Filas ya filtradas, para resolver el proyecto de la barra pinchada. */
  proyectos: Proyecto[];
}

function formatValue(value: number, valueType: "pct" | "meuros"): string {
  return valueType === "pct" ? fmtPct(value) : fmtMEuros(value);
}

export function ProjectBarChart({ title, data, valueType, proyectos }: ProjectBarChartProps) {
  const height = Math.max(280, data.length * 34);
  const drilldown = useChartDrilldown();

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">{title}</h3>
      <div className="w-full min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 12, left: 4, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis
              type="number"
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              tickFormatter={(value) => formatValue(Number(value), valueType)}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={82}
              stroke="#8A8A8A"
              tick={{ fontSize: 9 }}
              interval={0}
            />
            <Tooltip
              cursor={false}
              content={
                <DrilldownTooltip
                  heading={(payload) => String(payload[0]?.payload?.name ?? "")}
                  rows={(payload) => [
                    { label: title, value: formatValue(Number(payload[0]?.value ?? 0), valueType) },
                  ]}
                />
              }
            />
            <Bar
              dataKey="value"
              fill="#1E2A56"
              radius={[0, 4, 4, 0]}
              activeBar={false}
              cursor="pointer"
              onClick={(item) => {
                const name = (item as { payload?: { name?: string } })?.payload?.name;
                if (!name) return;
                drilldown.open({ title: name, proyectos: projectByName(proyectos, name) });
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {drilldown.modal}
    </section>
  );
}
