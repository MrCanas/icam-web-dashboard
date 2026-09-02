"use client";

import { BucketCount } from "@/modules/portfolio/logic/calculations";
import { projectsInTirBucket } from "@/modules/portfolio/logic/drilldown";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";
import { Proyecto } from "@/modules/portfolio/types";
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

interface TIRDistributionProps {
  data: BucketCount[];
  proyectos: Proyecto[];
}

const barColors = ["#2B3668", "#25305f", "#1f2a56", "#1E2A56", "#172047"];

export function TIRDistribution({ data, proyectos }: TIRDistributionProps) {
  const drilldown = useChartDrilldown();
  // El tramo resaltado es el que tiene el modal abierto: sin estado paralelo,
  // al cerrar el modal la barra recupera su opacidad sola.
  const selectedLabel = drilldown.selection?.key ?? null;

  function handleBarClick(item: BarRectangleItem) {
    const label = item.payload?.label as string | undefined;
    if (typeof label !== "string") return;
    const delTramo = projectsInTirBucket(proyectos, label);
    drilldown.open({
      title: `Tramo TIR ${label}`,
      subtitle: `${delTramo.length} de ${proyectos.length} proyectos`,
      proyectos: delTramo,
      key: label,
    });
  }

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">Distribución de TIR</h3>
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
            <Tooltip
              cursor={false}
              content={
                <DrilldownTooltip
                  heading={(payload) => String(payload[0]?.payload?.label ?? "")}
                  rows={(payload) => [
                    { label: "Proyectos", value: String(payload[0]?.value ?? 0) },
                  ]}
                />
              }
            />
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
      {drilldown.modal}
    </section>
  );
}
