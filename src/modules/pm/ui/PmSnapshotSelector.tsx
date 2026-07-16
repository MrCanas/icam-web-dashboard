import Link from "next/link";
import { compareQuarterCodes, formatSnapshotLabel, parseQuarterCode } from "@/modules/pm/logic/pm-viz";

/** Respaldo si no llega ningún trimestre desde la base de datos. */
const PRESET_QUARTERS = ["2026_Q1", "2025_Q4", "2025_Q3", "2025_Q2"] as const;

interface PmSnapshotSelectorProps {
  current: string;
  /** Códigos ya filtrados por visible_en_dashboard (puede incluir levantamiento; se filtra aquí). */
  extraCodes?: string[];
  /** URL para cada snapshot (permite Overview vs Detalle). */
  hrefForSnapshot: (code: string) => string;
}

function mergeQuarterCodes(extraCodes: string[]): string[] {
  const fromData = extraCodes.filter(
    (c) => c !== "levantamiento" && parseQuarterCode(c) !== null,
  );

  // Los presets son RESPALDO, no se suman: antes se unían siempre, así que
  // desmarcar «publicar» en Planificación no habría tenido efecto sobre esos
  // cuatro trimestres — habrían seguido saliendo en el selector.
  const source: readonly string[] =
    fromData.length > 0 ? fromData : PRESET_QUARTERS.filter((c) => parseQuarterCode(c));

  const list = [...new Set(source)];
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
