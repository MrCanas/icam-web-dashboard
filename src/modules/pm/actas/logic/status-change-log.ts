import type { ElementStatus } from "@/modules/pm/actas/types";

import { ELEMENT_STATUS_LABEL } from "./element-status";

/** Orden fijo del picker inline de status (P-UX-3). */
export const ELEMENT_STATUS_PICKER_ORDER: ElementStatus[] = [
  "not_started",
  "working_on_it",
  "stuck",
  "done",
];

export function formatStatusChangeLogContent(
  before: ElementStatus,
  after: ElementStatus,
): string {
  return `Estado cambiado: ${ELEMENT_STATUS_LABEL[before]} → ${ELEMENT_STATUS_LABEL[after]}`;
}
