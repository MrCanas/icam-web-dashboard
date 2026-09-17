import { Suspense } from "react";

import type { UserContext } from "@/lib/auth/currentUser";
import { fetchActasProjectHeaderStats } from "@/modules/pm/actas/data/actasRepository";
import { daysSince, formatLastActivity } from "@/modules/pm/actas/logic/actas-time";
import { projectPhaseLabel } from "@/modules/pm/actas/logic/project-phase";
import type { ActasProjectDetail } from "@/modules/pm/actas/types";

import { ActasProjectOwnerPicker } from "./ActasProjectOwnerPicker";

interface ActasProjectHeaderProps {
  ctx: UserContext;
  project: ActasProjectDetail;
  /** true si el usuario puede modificar el responsable (editor de la zona pm). */
  canEditOwner: boolean;
}

export function ActasProjectHeader({
  ctx,
  project,
  canEditOwner,
}: ActasProjectHeaderProps) {
  return (
    <header className="bg-card rounded-lg border border-subtle/50 p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-icam-900">
              {project.code}
            </span>
            <span className="rounded-full border border-subtle/60 bg-page px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {projectPhaseLabel(project.phase)}
            </span>
          </div>
          <h2 className="mt-0.5 text-lg font-semibold text-text-primary leading-snug">
            {project.name}
          </h2>
          <div className="mt-2">
            <ActasProjectOwnerPicker
              projectId={project.id}
              owner={project.owner}
              canEdit={canEditOwner}
            />
          </div>
        </div>

        <Suspense fallback={<ActasProjectHeaderStatsView loading />}>
          <ActasProjectHeaderStats ctx={ctx} projectId={project.id} />
        </Suspense>
      </div>
    </header>
  );
}

async function ActasProjectHeaderStats({
  ctx,
  projectId,
}: {
  ctx: UserContext;
  projectId: string;
}) {
  const stats = await fetchActasProjectHeaderStats(ctx, projectId);
  return (
    <ActasProjectHeaderStatsView
      lastLogEntryAt={stats.lastLogEntryAt}
      elementCount={stats.elementCount}
    />
  );
}

function ActasProjectHeaderStatsView(
  props:
    | { loading: true }
    | { loading?: false; lastLogEntryAt: string | null; elementCount: number },
) {
  const days = props.loading ? null : daysSince(props.lastLogEntryAt);
  const activityLabel = props.loading ? "…" : formatLastActivity(days);

  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm shrink-0">
      <div className="flex flex-col gap-0.5">
        <dt className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Última actividad
        </dt>
        <dd
          className={
            days === null
              ? "text-text-muted"
              : days > 30
                ? "text-amber-600"
                : "text-emerald-600"
          }
        >
          {activityLabel}
        </dd>
      </div>

      <div className="flex flex-col gap-0.5">
        <dt className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Elementos
        </dt>
        <dd className={props.loading ? "text-text-muted" : "text-text-body"}>
          {props.loading ? "…" : props.elementCount}
        </dd>
      </div>
    </dl>
  );
}
