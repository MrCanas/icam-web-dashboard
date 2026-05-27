import Link from "next/link";

import { actasProjectOperativoPath } from "@/modules/pm/actas/logic/actas-paths";
import { formatAsOfDisplay } from "@/modules/pm/actas/logic/operativo-asof";

interface ActasOperativoHistoricalBannerProps {
  projectCode: string;
  asOfDate: string;
}

export function ActasOperativoHistoricalBanner({
  projectCode,
  asOfDate,
}: ActasOperativoHistoricalBannerProps) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p>
        <span aria-hidden>📅 </span>
        Viendo el estado a fecha{" "}
        <strong>{formatAsOfDisplay(asOfDate)}</strong>. Esto es un snapshot
        histórico, no editable.
      </p>
      <Link
        href={actasProjectOperativoPath(projectCode)}
        className="shrink-0 rounded-md border border-amber-400/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100/80"
      >
        Volver al estado actual
      </Link>
    </div>
  );
}
