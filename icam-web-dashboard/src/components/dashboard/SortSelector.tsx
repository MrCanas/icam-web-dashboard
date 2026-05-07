import Link from "next/link";

export type SortKey = "inversion" | "tir" | "multiplo" | "beneficio";

interface SortSelectorProps {
  selectedSort: SortKey;
  basePath?: string;
}

const options: { key: SortKey; label: string }[] = [
  { key: "inversion", label: "Inversión ↓" },
  { key: "tir", label: "TIR ↓" },
  { key: "multiplo", label: "Múltiplo ↓" },
  { key: "beneficio", label: "Beneficio ↓" },
];

function buildHref(basePath: string, sort: SortKey): string {
  const params = new URLSearchParams();
  params.set("sort", sort);
  return `${basePath}?${params.toString()}`;
}

export function SortSelector({ selectedSort, basePath = "/dashboard/portfolio/proyectos" }: SortSelectorProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-sm text-text-muted shrink-0">Ordenar por:</span>
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible">
          {options.map((option) => (
            <Link
              key={option.key}
              href={buildHref(basePath, option.key)}
              className={`min-h-11 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm border whitespace-nowrap ${
                selectedSort === option.key
                  ? "bg-icam-900 text-white border-icam-900"
                  : "bg-white text-text-body border-subtle hover:border-icam-900"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
