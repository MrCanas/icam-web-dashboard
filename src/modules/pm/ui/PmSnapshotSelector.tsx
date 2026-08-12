import Link from "next/link";
import { formatSnapshotLabel } from "@/modules/pm/logic/pm-viz";
import { mergeQuarterCodes } from "@/modules/pm/logic/pm-snapshot-selection";

interface PmSnapshotSelectorProps {
  current: string;
  /** Códigos ya filtrados por visible_en_dashboard (puede incluir levantamiento; se filtra dentro). */
  extraCodes?: string[];
  /** URL para cada snapshot (permite Overview vs Detalle). */
  hrefForSnapshot: (code: string) => string;
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
