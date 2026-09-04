"use client";

import { fmtMEuros } from "@/lib/formatters";
import { VintageGroup } from "@/modules/portfolio/logic/calculations";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { useChartDrilldown } from "@/modules/portfolio/ui/charts/useChartDrilldown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface VintageChartProps {
  data: VintageGroup[];
}

export function VintageChart({ data }: VintageChartProps) {
  const drilldown = useChartDrilldown();
  const porAnio = new Map(data.map((item) => [item.year, item]));

  function abrirDetalle(item: unknown, serie: "En Marcha" | "Culminado") {
    const year = (item as { payload?: { year?: string } })?.payload?.year;
    if (!year) return;
    const grupo = porAnio.get(year);
    if (!grupo) return;
    const proyectos = grupo.proyectos.filter((p) => p.situacion === serie);
    drilldown.open({
      title: `Vintage ${year} · ${serie}`,
      subtitle: `${proyectos.length} de ${grupo.count} proyectos de la añada`,
      proyectos,
    });
  }

  const chartData = data.map((item) => ({
    year: item.year,
    invActivos: item.invActivos,
    invCulminados: item.invCulminados,
    total: item.invTotal,
    count: item.count,
    tooltipLabel: `Año ${item.year} · ${item.count} proyectos`,
  }));

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-2 sm:mb-3">
        Inversión Comprometida por Vintage
      </h3>
      <p className="text-xs text-text-muted mb-2 sm:mb-3">
        El <strong className="font-semibold">vintage</strong> de un proyecto es su año de arranque
        (fecha de inicio). Cada barra suma la inversión comprometida en los proyectos que arrancaron
        ese año, separando los que siguen{" "}
        <span className="font-medium text-icam-900">En Marcha</span> de los ya{" "}
        <span className="font-medium text-icam-gold">Culminados</span>; la cifra de encima es el total
        del año. Sirve para ver en qué añadas se concentró el capital y cuánto de cada una sigue vivo.
      </p>
      <div className="h-[260px] w-full sm:h-[320px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis dataKey="year" stroke="#8A8A8A" tick={{ fontSize: 10 }} interval={0} />
            <YAxis
              stroke="#8A8A8A"
              tick={{ fontSize: 10 }}
              width={36}
              tickFormatter={(value) => fmtMEuros(Number(value))}
            />
            <Tooltip
              cursor={false}
              content={
                <DrilldownTooltip
                  heading={(payload) => String(payload[0]?.payload?.tooltipLabel ?? "")}
                  rows={(payload) => [
                    ...payload.map((point) => ({
                      label: point.dataKey === "invActivos" ? "En Marcha" : "Culminado",
                      value: fmtMEuros(Number(point.value ?? 0)),
                      color: point.color,
                    })),
                    {
                      label: "Total",
                      value: fmtMEuros(Number(payload[0]?.payload?.total ?? 0)),
                    },
                  ]}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar
              dataKey="invActivos"
              stackId="inv"
              fill="#1E2A56"
              name="En Marcha"
              activeBar={false}
              cursor="pointer"
              onClick={(item) => abrirDetalle(item, "En Marcha")}
            />
            <Bar
              dataKey="invCulminados"
              stackId="inv"
              fill="#B89660"
              name="Culminado"
              activeBar={false}
              cursor="pointer"
              onClick={(item) => abrirDetalle(item, "Culminado")}
            >
              <LabelList
                dataKey="total"
                position="top"
                formatter={(value) => fmtMEuros(Number(value ?? 0))}
                fill="#1E2A56"
                fontSize={9}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {drilldown.modal}
    </section>
  );
}
