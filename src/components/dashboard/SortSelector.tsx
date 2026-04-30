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

export function SortSelector({ selectedSort, basePath = "/dashboard/proyectos" }: SortSelectorProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-text-muted">Ordenar por:</span>
        {options.map((option) => (
          <Link
            key={option.key}
            href={buildHref(basePath, option.key)}
            className={`px-3 py-1.5 rounded-md text-xs border ${
              selectedSort === option.key
                ? "bg-icam-900 text-white border-icam-900"
                : "bg-white text-text-body border-subtle hover:border-icam-900"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
