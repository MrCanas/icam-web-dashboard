import Link from "next/link";
import type { SortKey } from "@/modules/portfolio/logic/proyectoSort";

interface SituacionFilterProps {
  selectedSituacion?: string;
  selectedSort: SortKey;
  basePath?: string;
}

/** value === undefined representa "Todos". */
const options: { value?: string; label: string }[] = [
  { value: undefined, label: "Todos" },
  { value: "En Marcha", label: "En Marcha" },
  { value: "Culminado", label: "Culminados" },
];

function buildHref(basePath: string, sort: SortKey, situacion?: string): string {
  const params = new URLSearchParams();
  if (situacion) {
    params.set("situacion", situacion);
  }
  params.set("sort", sort);
  return `${basePath}?${params.toString()}`;
}

export function SituacionFilter({
  selectedSituacion,
  selectedSort,
  basePath = "/dashboard/portfolio/proyectos",
}: SituacionFilterProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-sm text-text-muted shrink-0">Situación:</span>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible">
          {options.map((option) => {
            const active = (selectedSituacion ?? undefined) === option.value;
            return (
              <Link
                key={option.label}
                href={buildHref(basePath, selectedSort, option.value)}
                className={`min-h-11 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm border whitespace-nowrap ${
                  active
                    ? "bg-icam-900 text-white border-icam-900"
                    : "bg-white text-text-body border-subtle hover:border-icam-900"
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
