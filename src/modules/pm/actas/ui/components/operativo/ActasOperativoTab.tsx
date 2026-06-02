import type { UserContext } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { fetchActasProjectOperativo } from "@/modules/pm/actas/data/actasRepository";
import {
  fetchProjectCreatedAt,
  fetchProjectSnapshotAtDate,
} from "@/modules/pm/actas/data/snapshotRepository";
import {
  isAsOfBeforeProject,
  isAsOfFuture,
  parseAsOfDateParam,
} from "@/modules/pm/actas/logic/operativo-asof";

import { ActasOperativoBeforeProject } from "./ActasOperativoBeforeProject";
import { ActasOperativoBoard } from "./ActasOperativoBoard";
import { ActasOperativoHistoricalBanner } from "./ActasOperativoHistoricalBanner";

interface ActasOperativoTabProps {
  ctx: UserContext;
  projectId: string;
  projectCode: string;
  asOfParam?: string;
}

export async function ActasOperativoTab({
  ctx,
  projectId,
  projectCode,
  asOfParam,
}: ActasOperativoTabProps) {
  const isPmAdmin = getUserRole(ctx, "pm") === "admin";
  const hasWriteAccess = getUserRole(ctx, "pm") !== "lector";
  const asOfIso = parseAsOfDateParam(asOfParam);
  const isHistorical =
    asOfIso != null && !isAsOfFuture(asOfIso);

  if (isHistorical && asOfIso) {
    const { createdAt, error: createdErr } = await fetchProjectCreatedAt(
      ctx,
      projectId,
    );
    if (createdErr) {
      return (
        <section className="rounded-b-lg border border-t-0 border-red-200 bg-card p-4 text-sm text-red-700">
          No se pudo cargar la vista operativa: {createdErr}
        </section>
      );
    }
    if (createdAt && isAsOfBeforeProject(asOfIso, createdAt)) {
      return <ActasOperativoBeforeProject projectCode={projectCode} asOfDate={asOfIso} />;
    }

    const [snapshotResult, currentAuthUserId] = await Promise.all([
      fetchProjectSnapshotAtDate(ctx, projectId, asOfIso),
      resolveAuthUserIdByEmail(ctx.email),
    ]);

    if (snapshotResult.error) {
      return (
        <section className="rounded-b-lg border border-t-0 border-red-200 bg-card p-4 text-sm text-red-700">
          No se pudo cargar el snapshot: {snapshotResult.error}
        </section>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        <ActasOperativoHistoricalBanner
          projectCode={projectCode}
          asOfDate={asOfIso}
        />
        <ActasOperativoBoard
          mode="historical"
          asOfDate={asOfIso}
          categories={snapshotResult.categories}
          projectCode={projectCode}
          currentAuthUserId={currentAuthUserId}
          isPmAdmin={isPmAdmin}
          hasWriteAccess={false}
        />
      </div>
    );
  }

  const [operativoResult, currentAuthUserId] = await Promise.all([
    fetchActasProjectOperativo(ctx, projectId),
    resolveAuthUserIdByEmail(ctx.email),
  ]);
  const { categories, error } = operativoResult;

  if (error) {
    return (
      <section className="rounded-b-lg border border-t-0 border-red-200 bg-card p-4 text-sm text-red-700">
        No se pudo cargar la vista operativa: {error}
      </section>
    );
  }

  return (
    <ActasOperativoBoard
      mode="live"
      categories={categories}
      projectCode={projectCode}
      currentAuthUserId={currentAuthUserId}
      isPmAdmin={isPmAdmin}
      hasWriteAccess={hasWriteAccess}
    />
  );
}
