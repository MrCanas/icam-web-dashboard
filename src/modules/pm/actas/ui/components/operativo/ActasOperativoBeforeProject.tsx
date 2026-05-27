import Link from "next/link";

import { actasProjectOperativoPath } from "@/modules/pm/actas/logic/actas-paths";
import { formatAsOfDisplay } from "@/modules/pm/actas/logic/operativo-asof";

interface ActasOperativoBeforeProjectProps {
  projectCode: string;
  asOfDate: string;
}

export function ActasOperativoBeforeProject({
  projectCode,
  asOfDate,
}: ActasOperativoBeforeProjectProps) {
  return (
    <section className="rounded-b-lg border border-t-0 border-amber-200/80 bg-amber-50/50 p-8 text-center">
      <p className="text-sm text-amber-950">
        El proyecto aún no existía en la fecha{" "}
        <strong>{formatAsOfDisplay(asOfDate)}</strong>.
      </p>
      <Link
        href={actasProjectOperativoPath(projectCode)}
        className="mt-4 inline-flex min-h-10 items-center rounded-md bg-icam-900 px-4 text-sm font-medium text-white hover:bg-icam-800"
      >
        Volver al estado actual
      </Link>
    </section>
  );
}
