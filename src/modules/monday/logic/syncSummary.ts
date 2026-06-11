import type { MondaySyncLogRecord } from "@/modules/monday/data/syncLogsRepository";

function toDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computeSyncSummary(logs: MondaySyncLogRecord[]) {
  const latest = logs[0] ?? null;
  const windowLogs = logs.slice(0, 30);
  const successCount = windowLogs.filter((log) => log.estado === "completado").length;
  const successRate = windowLogs.length > 0 ? successCount / windowLogs.length : 0;

  let averageFrequencyDays = 0;
  if (windowLogs.length > 1) {
    const diffs: number[] = [];
    for (let i = 0; i < windowLogs.length - 1; i += 1) {
      const d1 = toDate(windowLogs[i].created_at) ?? toDate(windowLogs[i].fecha);
      const d2 = toDate(windowLogs[i + 1].created_at) ?? toDate(windowLogs[i + 1].fecha);
      if (d1 && d2) diffs.push(Math.abs(d1.getTime() - d2.getTime()));
    }
    if (diffs.length > 0) {
      averageFrequencyDays = diffs.reduce((acc, cur) => acc + cur, 0) / diffs.length / 86_400_000;
    }
  }
  return { latest, successRate, averageFrequencyDays };
}
