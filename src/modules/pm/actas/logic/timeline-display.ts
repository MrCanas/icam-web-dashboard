import type { ElementStatus } from "@/modules/pm/actas/types";

const MONTH_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});
const FULL_FMT = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function parseIsoDate(value: string): Date | null {
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatTimelineCell(
  timelineStart: string | null,
  timelineEnd: string | null,
): string | null {
  if (!timelineStart && !timelineEnd) return null;
  if (!timelineStart && timelineEnd) {
    const end = parseIsoDate(timelineEnd);
    return end ? FULL_FMT.format(end) : timelineEnd;
  }
  if (timelineStart && timelineEnd) {
    const start = parseIsoDate(timelineStart);
    const end = parseIsoDate(timelineEnd);
    if (!start || !end) return `${timelineStart} – ${timelineEnd}`;
    return `${MONTH_FMT.format(start)} – ${FULL_FMT.format(end)}`;
  }
  const start = parseIsoDate(timelineStart!);
  return start ? FULL_FMT.format(start) : timelineStart!;
}

export function timelineUrgencyClass(
  timelineEnd: string | null,
  status: ElementStatus,
): string {
  if (!timelineEnd || status === "done") return "text-text-body";
  const end = parseIsoDate(timelineEnd);
  if (!end) return "text-text-body";

  const today = new Date();
  const todayMid = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const endMid = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
  );
  const diffDays = Math.floor((endMid.getTime() - todayMid.getTime()) / 86400000);

  if (diffDays < 0) return "text-red-700";
  if (diffDays <= 7) return "text-amber-700";
  return "text-text-body";
}
