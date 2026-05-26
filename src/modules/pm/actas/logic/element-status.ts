import type { ElementStatus } from "@/modules/pm/actas/types";

export const ELEMENT_STATUS_LABEL: Record<ElementStatus, string> = {
  not_started: "Sin empezar",
  working_on_it: "En curso",
  stuck: "Atascado",
  done: "Hecho",
};

/** Colores de estado al estilo Monday (píldora en fila de elemento). */
export const ELEMENT_STATUS_STYLE: Record<
  ElementStatus,
  { bg: string; text: string }
> = {
  not_started: { bg: "#c4c4c4", text: "#323338" },
  working_on_it: { bg: "#fdab3d", text: "#323338" },
  stuck: { bg: "#e2445c", text: "#ffffff" },
  done: { bg: "#00c875", text: "#ffffff" },
};

const ELEMENT_STATUSES = new Set<ElementStatus>([
  "not_started",
  "working_on_it",
  "stuck",
  "done",
]);

/** Valor del select de estado al crear entrada (vacío = sin cambio). */
export const LOG_ENTRY_STATUS_OPTIONS: {
  value: "" | ElementStatus;
  label: string;
}[] = [
  { value: "", label: "Sin cambio" },
  { value: "not_started", label: ELEMENT_STATUS_LABEL.not_started },
  { value: "working_on_it", label: ELEMENT_STATUS_LABEL.working_on_it },
  { value: "stuck", label: ELEMENT_STATUS_LABEL.stuck },
  { value: "done", label: ELEMENT_STATUS_LABEL.done },
];

export function toElementStatus(value: string): ElementStatus {
  if (ELEMENT_STATUSES.has(value as ElementStatus)) {
    return value as ElementStatus;
  }
  return "not_started";
}
