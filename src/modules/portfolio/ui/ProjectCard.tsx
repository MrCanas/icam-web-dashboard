import { getTIRColorClass } from "@/modules/portfolio/logic/calculations";
import { fmtInt, fmtMEuros, fmtMult, fmtPct } from "@/lib/formatters";
import { Proyecto } from "@/modules/portfolio/types";

interface ProjectCardProps {
  project: Proyecto;
}

function maybe(value: number | null, formatter: (value: number) => string): string {
  if (value === null || value <= 0) return "—";
  return formatter(value);
}

function maybeInteger(value: number | null, suffix = ""): string {
  if (value === null || value <= 0) return "—";
  return `${fmtInt(value)}${suffix}`;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const tir = project.tir_desp_is ?? 0;

  return (
    <article className="bg-card rounded-lg border border-subtle/50 shadow-sm overflow-hidden">
      <div className={`h-1 ${getTIRColorClass(tir)}`} />

      <header className="p-3 sm:p-4 border-b border-subtle/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-semibold text-icam-900 break-words">{project.proyecto}</h3>
            <p className="mt-1 text-xs text-text-muted">{project.ubicacion ?? "—"}</p>
          </div>
          <span className="px-2 py-1 rounded-md text-[10px] border border-subtle text-text-body">
            {project.tipo_proyecto}
          </span>
        </div>
      </header>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          <Metric label="Inversión" value={maybe(project.inversion_total, fmtMEuros)} />
          <Metric label="TIR" value={maybe(project.tir_desp_is, fmtPct)} />
          <Metric label="ROE" value={maybe(project.roe_desp_is, fmtPct)} />
          <Metric label="Beneficio" value={maybe(project.beneficios, fmtMEuros)} />
          <Metric label="Múltiplo" value={maybe(project.multiplo, fmtMult)} />
          <Metric label="Unidades" value={maybeInteger(project.unidades_totales)} />
        </div>

        <footer className="mt-4 pt-3 border-t border-subtle/60 text-xs sm:text-sm text-text-muted flex flex-wrap gap-x-3 gap-y-2">
          <span>Equity: {maybe(project.equity, fmtMEuros)}</span>
          <span>Holding Period: {maybeInteger(project.holding_period, " meses")}</span>
          <span>Superficie: {maybeInteger(project.superficie_edificable, " m²")}</span>
          <span>Project IRR: {maybe(project.project_irr, fmtPct)}</span>
        </footer>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm sm:text-base font-semibold text-icam-900 break-words leading-tight">{value}</p>
    </div>
  );
}
