import Link from "next/link";

import { actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

interface ActasHubPageProps {
  projects: ActasProjectListItem[];
}

export function ActasHubPage({ projects }: ActasHubPageProps) {
  if (!projects.length) {
    return null;
  }

  const first = projects[0]!;

  return (
    <section className="bg-card rounded-lg border border-subtle/50 p-6 h-full min-h-[240px] flex flex-col justify-center">
      <p className="text-sm text-text-muted">
        Selecciona un proyecto en la barra lateral o abre{" "}
        <Link
          href={actasProjectPath(first.code)}
          className="font-medium text-icam-900 underline underline-offset-2"
        >
          {first.code}
        </Link>{" "}
        para empezar.
      </p>
    </section>
  );
}
