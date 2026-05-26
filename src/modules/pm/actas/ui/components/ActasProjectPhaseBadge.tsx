import { projectPhaseLabel } from "@/modules/pm/actas/logic/project-phase";
import type { ProjectPhase } from "@/modules/pm/actas/types";

interface ActasProjectPhaseBadgeProps {
  phase: ProjectPhase;
}

export function ActasProjectPhaseBadge({ phase }: ActasProjectPhaseBadgeProps) {
  return (
    <span className="shrink-0 rounded-full border border-subtle/60 bg-page px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
      {projectPhaseLabel(phase)}
    </span>
  );
}
