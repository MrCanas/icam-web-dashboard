import Link from "next/link";
import { compareQuarterCodes, formatSnapshotLabel, parseQuarterCode } from "@/lib/pm-viz";

const PRESET_QUARTERS = ["2026_Q1", "2025_Q4", "2025_Q3", "2025_Q2"] as const;

interface PmSnapshotSelectorProps {
  current: string;
  /** Códigos desde Supabase (puede incluir levantamiento; se filtra). */
  extraCodes?: string[];
  /** URL para cada snapshot (permite Overview vs Detalle). */
  hrefForSnapshot: (code: string) => string;
}

function mergeQuarterCodes(extraCodes: string[]): string[] {
  const set = new Set<string>();
  for (const c of PRESET_QUARTERS) {
    if (parseQuarterCode(c)) set.add(c);
  }
  for (const c of extraCodes) {
    if (c === "levantamiento") continue;
    if (parseQuarterCode(c)) set.add(c);
  }
  const list = [...set];
  list.sort((a, b) => -compareQuarterCodes(a, b));
  return list;
}

export function PmSnapshotSelector({
  current,
  extraCodes = [],
  hrefForSnapshot,
}: PmSnapshotSelectorProps) {
  const quarters = mergeQuarterCodes(extraCodes);

  const items: { code: string; label: string }[] = [
    { code: "fecha_actual", label: "Fecha actual" },
    ...quarters.map((code) => ({ code, label: formatSnapshotLabel(code) })),
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-text-muted shrink-0">Snapshot:</span>
      {items.map(({ code, label }) => {
        const active = current === code;
        return (
          <Link
            key={code}
            href={hrefForSnapshot(code)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ease-out duration-300 ${
              active
                ? "bg-icam-900 text-white border-icam-900"
                : "bg-white text-icam-900 border-subtle hover:border-icam-900"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
