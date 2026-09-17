import { Suspense } from "react";

import type { UserContext } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";

import { ActasHistoricoTab } from "./ActasHistoricoTab";

interface ActasHistoricoTabServerProps {
  ctx: UserContext;
  projectId: string;
  projectCode: string;
}

export async function ActasHistoricoTabServer({
  ctx,
  projectId,
  projectCode,
}: ActasHistoricoTabServerProps) {
  // ctx.id ya es auth.users.id (loadUserContext lo carga con getUserById):
  // resolverlo otra vez por email era un viaje más a la base de datos.
  const currentAuthUserId = ctx.id;
  const isPmAdmin = getUserRole(ctx, "pm") === "admin";
  const hasWriteAccess = getUserRole(ctx, "pm") !== "lector";

  return (
    <Suspense
      fallback={
        <section className="bg-card rounded-b-lg border border-t-0 border-subtle/50 p-6 text-sm text-text-muted">
          Cargando histórico…
        </section>
      }
    >
      <ActasHistoricoTab
        projectId={projectId}
        projectCode={projectCode}
        currentAuthUserId={currentAuthUserId}
        isPmAdmin={isPmAdmin}
        hasWriteAccess={hasWriteAccess}
      />
    </Suspense>
  );
}
