import type { ProjectPhase } from "../types";

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  adquisicion: "Adquisición",
  desarrollo: "Desarrollo",
  comercializacion: "Comercialización",
  operacion: "Operación",
  desinversion: "Desinversión",
  cierre: "Cierre",
};

export function projectPhaseLabel(phase: ProjectPhase): string {
  return PROJECT_PHASE_LABELS[phase] ?? phase;
}
