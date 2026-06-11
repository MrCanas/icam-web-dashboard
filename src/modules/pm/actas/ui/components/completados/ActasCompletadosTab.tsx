import type { UserContext } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { fetchActasProjectOperativo } from "@/modules/pm/actas/data/actasRepository";

import { ActasCompletadosBoard } from "./ActasCompletadosBoard";

interface ActasCompletadosTabProps {
  ctx: UserContext;
  projectId: string;
  projectCode: string;
}

export async function ActasCompletadosTab({
  ctx,
  projectId,
  projectCode,
}: ActasCompletadosTabProps) {
  const isPmAdmin = getUserRole(ctx, "pm") === "admin";
  const hasWriteAccess = getUserRole(ctx, "pm") !== "lector";

  const [operativoResult, currentAuthUserId] = await Promise.all([
    fetchActasProjectOperativo(ctx, projectId),
    resolveAuthUserIdByEmail(ctx.email),
  ]);

  if (operativoResult.error) {
    return (
      <section className="rounded-b-lg border border-t-0 border-red-200 bg-card p-4 text-sm text-red-700">
        No se pudo cargar completados: {operativoResult.error}
      </section>
    );
  }

  return (
    <ActasCompletadosBoard
      categories={operativoResult.categories}
      projectCode={projectCode}
      currentAuthUserId={currentAuthUserId}
      isPmAdmin={isPmAdmin}
      hasWriteAccess={hasWriteAccess}
    />
  );
}
