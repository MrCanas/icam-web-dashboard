import type { MondayFunnelMetric } from "@/modules/monday/data/dashboard-types";

const locale = "es-ES";

function stageLabel(stage: string): string {
  return stage
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function fmtPct(value: number): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100)}%`;
}

interface MondayFunnelProps {
  data: MondayFunnelMetric[];
  standByCount: number;
}

export function MondayFunnel({ data, standByCount }: MondayFunnelProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Embudo de análisis</h3>
        <span className="text-xs px-2 py-1 rounded bg-page text-text-body">Stand by: {standByCount}</span>
      </div>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.stage} className="grid grid-cols-[120px_1fr_90px] items-center gap-3">
            <span className="text-sm text-text-body">{stageLabel(row.stage)}</span>
            <div className="h-5 rounded bg-page overflow-hidden">
              <div
                className="h-full bg-icam-900 transition-all"
                style={{ width: `${Math.max(2, Math.min(100, row.percent * 100))}%` }}
              />
            </div>
            <span className="text-xs text-text-muted text-right">
              {row.count} · {fmtPct(row.percent)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Nota: en esta versión el embudo se calcula sobre estado actual por limitación de histórico en Monday.
      </p>
    </section>
  );
}

