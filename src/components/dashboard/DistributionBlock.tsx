import { fmtMEuros } from "@/lib/formatters";

interface DistributionRow {
  label: string;
  count: number;
  inversion: number;
}

interface DistributionBlockProps {
  rows: DistributionRow[];
}

export function DistributionBlock({ rows }: DistributionBlockProps) {
  const maxCount = Math.max(...rows.map((row) => row.count), 1);

  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <h3 className="text-base font-semibold text-text-primary mb-4">Distribución del portfolio</h3>
      <div className="space-y-4">
        {rows.map((row) => {
          const width = `${(row.count / maxCount) * 100}%`;

          return (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-text-body font-medium">{row.label}</span>
                <span className="text-text-muted">
                  {row.count} proy · {fmtMEuros(row.inversion)}
                </span>
              </div>
              <div className="h-2 bg-subtle rounded-full overflow-hidden">
                <div className="h-full bg-icam-900 rounded-full" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
