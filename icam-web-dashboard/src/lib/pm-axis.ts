/** Eje temporal PM: anual si el rango visible es > 4 años; si no, trimestral con año arriba. */

const MS_PER_DAY = 86400000;
const FOUR_YEARS_MS = 4 * 365.25 * MS_PER_DAY;

export type PmAxisModel =
  | { kind: "annual"; yearLines: number[] }
  | {
      kind: "quarterly";
      /** 1 ene (línea más marcada) */
      yearLines: number[];
      /** Inicios de trimestre en la ventana */
      quarterLines: number[];
      /** Etiquetas por inicio de trimestre */
      labels: { t: number; showYear: boolean; year: number; quarterText: string }[];
    };

function quarterStartsInRange(winStart: Date, winEnd: Date): number[] {
  const ws = winStart.getTime();
  const we = winEnd.getTime();
  const out: number[] = [];
  let y = winStart.getFullYear();
  let q = Math.floor(winStart.getMonth() / 3);
  for (let guard = 0; guard < 600; guard++) {
    const d = new Date(y, q * 3, 1);
    const t = d.getTime();
    if (t > we) break;
    if (t >= ws) out.push(t);
    q++;
    if (q >= 4) {
      q = 0;
      y++;
    }
  }
  return out;
}

export function buildPmAxisModel(winStart: Date, winEnd: Date): PmAxisModel {
  const ws = winStart.getTime();
  const we = winEnd.getTime();
  const span = we - ws;
  if (span > FOUR_YEARS_MS) {
    const yearLines: number[] = [];
    const y0 = winStart.getFullYear();
    const y1 = winEnd.getFullYear();
    for (let y = y0; y <= y1 + 1; y++) {
      const t = new Date(y, 0, 1).getTime();
      if (t >= ws && t <= we) yearLines.push(t);
    }
    return { kind: "annual", yearLines };
  }

  const quarterLines = quarterStartsInRange(winStart, winEnd);
  const yearLines = quarterLines.filter((t) => {
    const d = new Date(t);
    return d.getMonth() === 0 && d.getDate() === 1;
  });

  const labels = quarterLines.map((t) => {
    const d = new Date(t);
    const qn = Math.floor(d.getMonth() / 3) + 1;
    return {
      t,
      showYear: qn === 1,
      year: d.getFullYear(),
      quarterText: `Q${qn}`,
    };
  });

  return { kind: "quarterly", yearLines, quarterLines, labels };
}

export function axisTopPadding(axis: PmAxisModel): number {
  return axis.kind === "quarterly" ? 48 : 34;
}
