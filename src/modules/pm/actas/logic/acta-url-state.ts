import type { ActasActaRangePreset } from "@/modules/pm/actas/types";

import { actasProjectPath } from "./actas-paths";

/** Valor en URL para entradas sin `author_id`. */
export const ACTA_AUTHOR_NONE = "__none__";

export interface ActasActaUrlState {
  range: ActasActaRangePreset;
  dateFrom: string;
  dateTo: string;
  categoryIds: string[];
  authorKeys: string[];
  onlyWithStatusChange: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function resolveActaRangeBounds(
  range: ActasActaRangePreset,
  dateFrom: string,
  dateTo: string,
  now = new Date(),
): { dateFrom: string; dateTo: string } {
  const end = formatDateYmd(now);
  if (range === "custom") {
    return {
      dateFrom: dateFrom || formatDateYmd(addDays(now, -7)),
      dateTo: dateTo || end,
    };
  }
  const days =
    range === "month" ? 30 : range === "quarter" ? 90 : 7;
  return {
    dateFrom: formatDateYmd(addDays(now, -days)),
    dateTo: end,
  };
}

export function parseActaUrlState(
  params: URLSearchParams,
  now = new Date(),
): ActasActaUrlState {
  const rangeParam = params.get("range");
  const range: ActasActaRangePreset =
    rangeParam === "month" ||
    rangeParam === "quarter" ||
    rangeParam === "custom"
      ? rangeParam
      : "week";

  const defaults = resolveActaRangeBounds(
    range,
    params.get("from") ?? "",
    params.get("to") ?? "",
    now,
  );

  const categories = params.get("categories");
  const authors = params.get("authors");

  return {
    range,
    dateFrom: params.get("from") ?? defaults.dateFrom,
    dateTo: params.get("to") ?? defaults.dateTo,
    categoryIds: categories
      ? categories.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    authorKeys: authors
      ? authors.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    onlyWithStatusChange: params.get("statusOnly") === "1",
  };
}

export function authorKeysToIds(keys: string[]): (string | null)[] | undefined {
  if (keys.length === 0) return undefined;
  return keys.map((k) => (k === ACTA_AUTHOR_NONE ? null : k));
}

export function authorIdsToKeys(ids: (string | null)[]): string[] {
  return ids.map((id) => (id == null ? ACTA_AUTHOR_NONE : id));
}

export function buildActaShareUrl(
  projectCode: string,
  state: ActasActaUrlState,
  basePath?: string,
): string {
  const params = new URLSearchParams();
  params.set("tab", "acta");
  params.set("range", state.range);
  params.set("from", state.dateFrom);
  params.set("to", state.dateTo);
  if (state.categoryIds.length > 0) {
    params.set("categories", state.categoryIds.join(","));
  }
  if (state.authorKeys.length > 0) {
    params.set("authors", state.authorKeys.join(","));
  }
  if (state.onlyWithStatusChange) {
    params.set("statusOnly", "1");
  }
  return `${actasProjectPath(projectCode, basePath)}?${params.toString()}`;
}
