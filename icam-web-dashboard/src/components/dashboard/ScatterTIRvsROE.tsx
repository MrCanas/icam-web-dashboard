"use client";

import { fmtMEuros, fmtPct } from "@/lib/formatters";
import { Proyecto } from "@/lib/types";
import {
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

interface ScatterTIRvsROEProps {
  data: Proyecto[];
}

interface ScatterPoint {
  proyecto: string;
  tir: number;
  roe: number;
  inversion: number;
  situacion: "En Marcha" | "Culminado";
}

function isValidPoint(item: Proyecto): item is Proyecto & { tir_desp_is: number; roe_desp_is: number } {
  return (item.tir_desp_is ?? 0) > 0 && (item.roe_desp_is ?? 0) > 0;
}

function renderProjectLabel(props: {
  x?: string | number;
  y?: string | number;
  value?: unknown;
}) {
  const x = typeof props.x === "string" ? Number(props.x) : props.x;
  const y = typeof props.y === "string" ? Number(props.y) : props.y;

  if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return (
    <text x={x + 6} y={y + 3} fontSize={8} fill="#8A8A8A">
      {String(props.value ?? "")}
    </text>
  );
}

export function ScatterTIRvsROE({ data }: ScatterTIRvsROEProps) {
  const points: ScatterPoint[] = data
    .filter(isValidPoint)
    .map((item) => ({
      proyecto: item.proyecto,
      tir: item.tir_desp_is ?? 0,
      roe: item.roe_desp_is ?? 0,
      inversion: item.inversion_total ?? 0,
      situacion: item.situacion,
    }));

  const enMarcha = points.filter((item) => item.situacion === "En Marcha");
  const culminado = points.filter((item) => item.situacion === "Culminado");

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4 min-w-0">
      <h3 className="text-base font-semibold text-text-primary mb-3 sm:mb-4">
        TIR vs ROE - Tamaño por Inversión
      </h3>
      <div className="h-[280px] w-full sm:h-[360px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEBEE" />
            <XAxis
              type="number"
              dataKey="tir"
              name="TIR"
              tickFormatter={(value) => fmtPct(Number(value))}
              domain={[0, "dataMax + 0.05"]}
              stroke="#8A8A8A"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              type="number"
              dataKey="roe"
              name="ROE"
              tickFormatter={(value) => fmtPct(Number(value))}
              domain={[0, "dataMax + 0.1"]}
              stroke="#8A8A8A"
              tick={{ fontSize: 10 }}
              width={40}
            />
            <ZAxis type="number" dataKey="inversion" range={[64, 520]} />
            <ReferenceLine x={0.15} stroke="#1E2A56" strokeDasharray="6 4" />
            <ReferenceLine y={0.3} stroke="#9b7f57" strokeDasharray="6 4" />
            <Tooltip
              cursor={false}
              formatter={(value, name) => {
                const numericValue = Number(value ?? 0);
                const key = String(name ?? "");
                if (key === "inversion") return [fmtMEuros(numericValue), "Inversión"];
                if (key === "tir") return [fmtPct(numericValue), "TIR"];
                if (key === "roe") return [fmtPct(numericValue), "ROE"];
                return [String(value ?? "—"), key];
              }}
              labelFormatter={(_label, payload) => payload?.[0]?.payload?.proyecto ?? ""}
            />
            <Scatter name="En Marcha" data={enMarcha} fill="#1E2A56">
              <LabelList dataKey="proyecto" content={renderProjectLabel} />
            </Scatter>
            <Scatter name="Culminado" data={culminado} fill="#B89660">
              <LabelList dataKey="proyecto" content={renderProjectLabel} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
