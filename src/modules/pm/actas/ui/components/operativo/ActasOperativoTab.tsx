import type { UserContext } from "@/lib/auth/currentUser";
import { canAccessRouteKey, getUserRole } from "@/lib/auth/permissions";
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
import {
  fetchAvanceObraAFecha,
  fetchAvanceObraProyecto,
} from "@/modules/pm/avance/data/avanceRepository";
import { AvanceObraOperativoGroup } from "@/modules/pm/avance/ui/components/AvanceObraOperativoGroup";

import { ActasOperativoBeforeProject } from "./ActasOperativoBeforeProject";
import { ActasOperativoBoard } from "./ActasOperativoBoard";
import { ActasOperativoHistoricalBanner } from "./ActasOperativoHistoricalBanner";

interface ActasOperativoTabProps {
  ctx: UserContext;
  projectId: string;
  projectCode: string;
  asOfParam?: string;
  /**
   * Activo PM del proyecto. Solo llega desde /proyecto/<id>/actas: con él, el
   * tablero abre con «Avance de obra» como primera categoría.
   */
  pmActivoId?: string;
}

/**
 * El grupo «Avance de obra», o null si no aplica (sin activo PM o sin permiso
 * de pm.avance_obra). En un snapshot, con los valores reconstruidos a esa fecha.
 */
async function avanceObraGroup(
  ctx: UserContext,
  pmActivoId: string | undefined,
  asOfIso: string | null,
  hasWriteAccess: boolean,
) {
  if (!pmActivoId || !canAccessRouteKey(ctx, "pm.avance_obra")) return null;
  const resultado = asOfIso
    ? await fetchAvanceObraAFecha(ctx, pmActivoId, asOfIso)
    : await fetchAvanceObraProyecto(ctx, pmActivoId);
  return (
    <AvanceObraOperativoGroup
      idActivo={pmActivoId}
      resultado={resultado}
      hasWriteAccess={hasWriteAccess}
      readOnly={asOfIso != null}
    />
  );
}

export async function ActasOperativoTab({
  ctx,
  projectId,
  projectCode,
  asOfParam,
  pmActivoId,
}: ActasOperativoTabProps) {
  const isPmAdmin = getUserRole(ctx, "pm") === "admin";
  const hasWriteAccess = getUserRole(ctx, "pm") !== "lector";
  // El avance mantiene su regla de siempre: editan editor y admin.
  const rolPm = getUserRole(ctx, "pm");
  const canEditAvance = rolPm === "admin" || rolPm === "editor";
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

    const [snapshotResult, currentAuthUserId, avanceGroup] = await Promise.all([
      fetchProjectSnapshotAtDate(ctx, projectId, asOfIso),
      resolveAuthUserIdByEmail(ctx.email),
      avanceObraGroup(ctx, pmActivoId, asOfIso, false),
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
          projectId={projectId}
          projectCode={projectCode}
          currentAuthUserId={currentAuthUserId}
          isPmAdmin={isPmAdmin}
          hasWriteAccess={false}
          leadingGroup={avanceGroup}
        />
      </div>
    );
  }

  const [operativoResult, currentAuthUserId, avanceGroup] = await Promise.all([
    fetchActasProjectOperativo(ctx, projectId),
    resolveAuthUserIdByEmail(ctx.email),
    avanceObraGroup(ctx, pmActivoId, null, canEditAvance),
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
      projectId={projectId}
      projectCode={projectCode}
      currentAuthUserId={currentAuthUserId}
      isPmAdmin={isPmAdmin}
      hasWriteAccess={hasWriteAccess}
      leadingGroup={avanceGroup}
    />
  );
}
