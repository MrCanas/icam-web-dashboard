import { daysSince, formatLastActivity } from "@/modules/pm/actas/logic/actas-time";
import { projectPhaseLabel } from "@/modules/pm/actas/logic/project-phase";
import type { ActasProjectDetail } from "@/modules/pm/actas/types";

import { ActasProjectOwnerPicker } from "./ActasProjectOwnerPicker";

interface ActasProjectHeaderProps {
  project: ActasProjectDetail;
  /** true si el usuario puede modificar el responsable (editor de la zona pm). */
  canEditOwner: boolean;
}

export function ActasProjectHeader({
  project,
  canEditOwner,
}: ActasProjectHeaderProps) {
  const days = daysSince(project.lastLogEntryAt);
  const activityLabel = formatLastActivity(days);

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
            <dd className="text-text-body">{project.elementCount}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
