import type { UserContext } from "@/lib/auth/currentUser";
import { fetchActasProjectOperativo } from "@/modules/pm/actas/data/actasRepository";

import { ActasOperativoBoard } from "./ActasOperativoBoard";

interface ActasOperativoTabProps {
  ctx: UserContext;
  projectId: string;
  projectCode: string;
}

export async function ActasOperativoTab({
  ctx,
  projectId,
  projectCode,
}: ActasOperativoTabProps) {
  const { categories, error } = await fetchActasProjectOperativo(
    ctx,
    projectId,
  );

  if (error) {
    return (
      <section className="rounded-b-lg border border-t-0 border-red-200 bg-card p-4 text-sm text-red-700">
        No se pudo cargar la vista operativa: {error}
      </section>
    );
  }

  return (
    <ActasOperativoBoard categories={categories} projectCode={projectCode} />
  );
}
