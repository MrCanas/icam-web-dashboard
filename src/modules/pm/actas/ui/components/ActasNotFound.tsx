import Link from "next/link";

import { actasHubPath } from "@/modules/pm/actas/logic/actas-paths";

interface ActasNotFoundProps {
  projectCode: string;
}

export function ActasNotFound({ projectCode }: ActasNotFoundProps) {
  return (
    <section className="bg-card rounded-lg border border-subtle/50 p-8 min-h-[280px] flex flex-col items-center justify-center text-center gap-4">
      <span className="text-4xl" aria-hidden>
        🗂️
      </span>
      <div>
        <p className="text-base font-semibold text-text-primary">
          Proyecto no encontrado
        </p>
        <p className="mt-1 text-sm text-text-muted">
          No existe ningún proyecto con el código{" "}
          <span className="font-mono font-semibold text-icam-900">
            {projectCode}
          </span>{" "}
          o no tienes acceso a él.
        </p>
      </div>
      <Link
        href={actasHubPath()}
        className="min-h-10 inline-flex items-center rounded-md border border-icam-gold px-4 text-sm font-medium text-icam-900 hover:bg-icam-gold hover:text-white transition"
      >
        ← Volver a la lista
      </Link>
    </section>
  );
}
