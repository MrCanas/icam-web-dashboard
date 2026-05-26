import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  MONDAY_EXTRACTS_DIR,
  type MondayExtractBoard,
  type MondayExtractPayload,
} from "./lib/monday-extract";
import { normalizeKey } from "./lib/normalize";

type BoardStats = {
  id: string;
  name: string;
  snapshot_date: string | null;
  snapshot_date_iso: string | null;
  kind: string;
  is_duplicado: boolean;
  root_items: number;
  subitems: number;
};

function parseProjectCodeArg(argv: string[]): string {
  const code = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!code) {
    throw new Error(
      "Uso: npm run actas:monday-extract-diagnose -- <CÓDIGO_PROYECTO>\n  Ejemplo: npm run actas:monday-extract-diagnose -- GQ8",
    );
  }
  return code.toUpperCase();
}

function countBoardItems(board: MondayExtractBoard): {
  root_items: number;
  subitems: number;
} {
  let root_items = 0;
  let subitems = 0;
  for (const group of board.groups) {
    root_items += group.items.length;
    for (const item of group.items) {
      subitems += item.subitems.length;
    }
  }
  return { root_items, subitems };
}

function isDuplicadoBoard(name: string): boolean {
  return /^Duplicado de\s+/i.test(name.trim());
}

function boardStats(board: MondayExtractBoard): BoardStats {
  const { root_items, subitems } = countBoardItems(board);
  return {
    id: board.id,
    name: board.name,
    snapshot_date: board.parsed.snapshot_date,
    snapshot_date_iso: board.parsed.snapshot_date_iso,
    kind: board.parsed.kind,
    is_duplicado: isDuplicadoBoard(board.name),
    root_items,
    subitems,
  };
}

function itemCountBucket(n: number): string {
  if (n === 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 10) return "6-10";
  if (n <= 15) return "11-15";
  if (n <= 20) return "16-20";
  if (n <= 25) return "21-25";
  if (n <= 30) return "26-30";
  return "30+";
}

const HISTOGRAM_BUCKETS = [
  "0",
  "1-5",
  "6-10",
  "11-15",
  "16-20",
  "21-25",
  "26-30",
  "30+",
] as const;

/** Tableros snapshot con más de 5 items raíz (excluye stubs 1–5). */
const COMPLETE_SNAPSHOT_MIN_ROOT_ITEMS = 6;

function isSubelementosBoard(kind: string): boolean {
  return kind === "subelementos" || kind === "subitems";
}

function sortByDateThenName(a: BoardStats, b: BoardStats): number {
  const da = a.snapshot_date_iso ?? "9999-99-99";
  const db = b.snapshot_date_iso ?? "9999-99-99";
  if (da !== db) return da.localeCompare(db);
  return a.name.localeCompare(b.name, "es");
}

function printPerBoardTable(rows: BoardStats[]): void {
  console.log("\n## Tableros por fecha\n");
  console.log(
    "| Fecha | Título | Items raíz | Subitems | Tipo |",
  );
  console.log("|-------|--------|----------:|---------:|------|");
  for (const r of rows) {
    const date = r.snapshot_date ?? r.snapshot_date_iso ?? "—";
    const title = r.name.replace(/\|/g, "\\|");
    console.log(
      `| ${date} | ${title} | ${r.root_items} | ${r.subitems} | ${r.kind} |`,
    );
  }
}

function printHistogram(rows: BoardStats[]): void {
  const hist = new Map<string, number>();
  for (const b of HISTOGRAM_BUCKETS) hist.set(b, 0);
  for (const r of rows) {
    const bucket = itemCountBucket(r.root_items);
    hist.set(bucket, (hist.get(bucket) ?? 0) + 1);
  }

  console.log("\n## Histograma (items raíz por tablero)\n");
  console.log("| Rango items | Tableros |");
  console.log("|-------------|----------:|");
  for (const b of HISTOGRAM_BUCKETS) {
    console.log(`| ${b} | ${hist.get(b) ?? 0} |`);
  }
}

function printSuspicious(rows: BoardStats[]): void {
  const byItems = [...rows].sort((a, b) => a.root_items - b.root_items);
  const least = byItems.slice(0, 5);
  const most = [...rows].sort((a, b) => b.root_items - a.root_items).slice(0, 5);

  console.log("\n## Boards sospechosos\n");
  console.log("### 5 con menos items raíz\n");
  for (const r of least) {
    console.log(
      `  - ${r.root_items} items · ${r.snapshot_date ?? "—"} · ${r.name}`,
    );
  }
  console.log("\n### 5 con más items raíz\n");
  for (const r of most) {
    console.log(
      `  - ${r.root_items} items · ${r.snapshot_date ?? "—"} · ${r.name}`,
    );
  }
}

function printDuplicadoAnalysis(rows: BoardStats[]): void {
  const duplicados = rows.filter((r) => r.is_duplicado);
  const nonDuplicado = rows.filter((r) => !r.is_duplicado);

  console.log("\n## Tableros «Duplicado de»\n");
  console.log(`Total tableros duplicado: **${duplicados.length}**`);

  if (!duplicados.length) {
    console.log("_Ninguno._");
    return;
  }

  console.log("\n| Fecha | Duplicado (items) | Contraparte(s) (items) | Contraparte(s) |");
  console.log("|-------|------------------:|-----------------------:|----------------|");

  for (const dup of duplicados.sort(sortByDateThenName)) {
    const dateIso = dup.snapshot_date_iso;
    const counterparts = nonDuplicado.filter(
      (r) =>
        r.snapshot_date_iso === dateIso &&
        r.kind === dup.kind &&
        !r.is_duplicado,
    );

    if (!counterparts.length) {
      console.log(
        `| ${dup.snapshot_date ?? "—"} | ${dup.root_items} | — | _sin contraparte misma fecha_ |`,
      );
      continue;
    }

    const cpItems = counterparts.map((c) => c.root_items).join(", ");
    const cpNames = counterparts
      .map((c) => `${c.name} (${c.root_items})`)
      .join("; ")
      .replace(/\|/g, "\\|");
    const cpTotal = counterparts.reduce((s, c) => s + c.root_items, 0);

    console.log(
      `| ${dup.snapshot_date ?? "—"} | ${dup.root_items} | ${cpTotal} (${cpItems}) | ${cpNames} |`,
    );
  }

  const withCounterpart = duplicados.filter((dup) =>
    nonDuplicado.some(
      (r) =>
        r.snapshot_date_iso === dup.snapshot_date_iso &&
        r.kind === dup.kind,
    ),
  );
  const dupItems = duplicados.reduce((s, r) => s + r.root_items, 0);
  const cpItems = withCounterpart.reduce((s, dup) => {
    const cps = nonDuplicado.filter(
      (r) =>
        r.snapshot_date_iso === dup.snapshot_date_iso && r.kind === dup.kind,
    );
    return s + cps.reduce((n, c) => n + c.root_items, 0);
  }, 0);

  console.log(
    `\nResumen: ${duplicados.length} duplicados · ${dupItems} items raíz en duplicados · ${withCounterpart.length} con contraparte · ${cpItems} items en contrapartes emparejadas.`,
  );
}

function collectInlineSubitemNames(board: MondayExtractBoard): string[] {
  const names: string[] = [];
  for (const group of board.groups) {
    for (const item of group.items) {
      for (const sub of item.subitems) {
        const name = sub.name.trim();
        if (name) names.push(name);
      }
    }
  }
  return names;
}

function collectRootItemNames(board: MondayExtractBoard): string[] {
  const names: string[] = [];
  for (const group of board.groups) {
    for (const item of group.items) {
      const name = item.name.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function findLatestCompleteSnapshotIso(rows: BoardStats[]): string | null {
  const complete = rows.filter(
    (r) =>
      r.kind === "snapshot" &&
      !r.is_duplicado &&
      r.snapshot_date_iso &&
      r.root_items >= COMPLETE_SNAPSHOT_MIN_ROOT_ITEMS,
  );
  if (!complete.length) return null;
  return [...complete].sort((a, b) =>
    (b.snapshot_date_iso ?? "").localeCompare(a.snapshot_date_iso ?? ""),
  )[0]!.snapshot_date_iso;
}

function pickMainSnapshotBoard(
  payload: MondayExtractPayload,
  dateIso: string,
): MondayExtractBoard | null {
  const candidates = payload.boards.filter(
    (b) =>
      b.parsed.kind === "snapshot" &&
      !isDuplicadoBoard(b.name) &&
      b.parsed.snapshot_date_iso === dateIso,
  );
  if (!candidates.length) return null;
  return [...candidates].sort(
    (a, b) => countBoardItems(b).root_items - countBoardItems(a).root_items,
  )[0]!;
}

function pickSubelementosBoard(
  payload: MondayExtractPayload,
  dateIso: string,
): MondayExtractBoard | null {
  const candidates = payload.boards.filter(
    (b) =>
      isSubelementosBoard(b.parsed.kind) &&
      b.parsed.snapshot_date_iso === dateIso,
  );
  if (!candidates.length) return null;
  return [...candidates].sort(
    (a, b) => countBoardItems(b).root_items - countBoardItems(a).root_items,
  )[0]!;
}

function compareNameSets(a: string[], b: string[]): {
  sameExact: boolean;
  onlyA: string[];
  onlyB: string[];
  intersection: string[];
} {
  const setA = new Set(a.map((n) => n.trim()));
  const setB = new Set(b.map((n) => n.trim()));
  const intersection = [...setA].filter((n) => setB.has(n)).sort((x, y) =>
    x.localeCompare(y, "es"),
  );
  const onlyA = [...setA].filter((n) => !setB.has(n)).sort((x, y) =>
    x.localeCompare(y, "es"),
  );
  const onlyB = [...setB].filter((n) => !setA.has(n)).sort((x, y) =>
    x.localeCompare(y, "es"),
  );
  return {
    sameExact: onlyA.length === 0 && onlyB.length === 0 && setA.size === setB.size,
    onlyA,
    onlyB,
    intersection,
  };
}

function compareNameSetsNormalized(a: string[], b: string[]): {
  onlyA: string[];
  onlyB: string[];
} {
  const mapA = new Map<string, string>();
  const mapB = new Map<string, string>();
  for (const n of a) mapA.set(normalizeKey(n), n);
  for (const n of b) mapB.set(normalizeKey(n), n);

  const onlyA: string[] = [];
  const onlyB: string[] = [];
  for (const [key, label] of mapA) {
    if (!mapB.has(key)) onlyA.push(label);
  }
  for (const [key, label] of mapB) {
    if (!mapA.has(key)) onlyB.push(label);
  }
  onlyA.sort((x, y) => x.localeCompare(y, "es"));
  onlyB.sort((x, y) => x.localeCompare(y, "es"));
  return { onlyA, onlyB };
}

function printCrossBoardVerification(
  rows: BoardStats[],
  payload: MondayExtractPayload,
): void {
  const dateIso = findLatestCompleteSnapshotIso(rows);
  if (!dateIso) {
    console.log(
      "\n## Verificación cross-board (main vs Subelementos)\n\n_Sin snapshot completo (≥6 items raíz)._",
    );
    return;
  }

  const mainBoard = pickMainSnapshotBoard(payload, dateIso);
  const subBoard = pickSubelementosBoard(payload, dateIso);

  if (!mainBoard) {
    console.log(
      "\n## Verificación cross-board\n\n_Sin tablero snapshot principal para la fecha._",
    );
    return;
  }

  const inlineSubs = collectInlineSubitemNames(mainBoard);
  const subBoardRoots = subBoard ? collectRootItemNames(subBoard) : [];

  const exact = compareNameSets(inlineSubs, subBoardRoots);
  const normalized = compareNameSetsNormalized(inlineSubs, subBoardRoots);

  console.log("\n## Verificación cross-board (main vs Subelementos)\n");
  console.log(
    `Fecha elegida: **${mainBoard.parsed.snapshot_date ?? dateIso}** (snapshot completo más reciente, ≥${COMPLETE_SNAPSHOT_MIN_ROOT_ITEMS} items raíz)`,
  );
  console.log(`Main board: ${mainBoard.name} (${countBoardItems(mainBoard).root_items} items raíz, ${inlineSubs.length} subitems inline)`);
  if (subBoard) {
    console.log(
      `Subelementos board: ${subBoard.name} (${countBoardItems(subBoard).root_items} items raíz)`,
    );
  } else {
    console.log("Subelementos board: _no encontrado para esta fecha_");
  }

  console.log("\n### Subitems inline (main board)\n");
  if (!inlineSubs.length) {
    console.log("_Ninguno._");
  } else {
    for (const name of [...inlineSubs].sort((a, b) => a.localeCompare(b, "es"))) {
      console.log(`  - ${name}`);
    }
  }

  console.log("\n### Items raíz (board Subelementos)\n");
  if (!subBoardRoots.length) {
    console.log(subBoard ? "_Ninguno._" : "_Sin tablero Subelementos._");
  } else {
    for (const name of [...subBoardRoots].sort((a, b) => a.localeCompare(b, "es"))) {
      console.log(`  - ${name}`);
    }
  }

  console.log("\n### Comparación\n");
  console.log(`| Métrica | Valor |`);
  console.log(`|---------|------:|`);
  console.log(`| Subitems inline (main) | ${inlineSubs.length} |`);
  console.log(`| Items raíz (Subelementos) | ${subBoardRoots.length} |`);
  console.log(`| Intersección (nombre exacto) | ${exact.intersection.length} |`);
  console.log(`| Solo en main (inline) | ${exact.onlyA.length} |`);
  console.log(`| Solo en Subelementos | ${exact.onlyB.length} |`);
  console.log(
    `| ¿Mismos nombres (exacto)? | ${exact.sameExact ? "**sí**" : "**no**"} |`,
  );

  if (!exact.sameExact) {
    if (exact.onlyA.length) {
      console.log("\n**Solo en main (subitems inline):**\n");
      for (const n of exact.onlyA) console.log(`  - ${n}`);
    }
    if (exact.onlyB.length) {
      console.log("\n**Solo en Subelementos (items raíz):**\n");
      for (const n of exact.onlyB) console.log(`  - ${n}`);
    }
    if (normalized.onlyA.length || normalized.onlyB.length) {
      console.log(
        "\n_Diferencias restantes tras normalizar (minúsculas, sin tildes):_",
      );
      if (normalized.onlyA.length) {
        console.log("  Solo main:", normalized.onlyA.join("; "));
      }
      if (normalized.onlyB.length) {
        console.log("  Solo Subelementos:", normalized.onlyB.join("; "));
      }
    } else if (exact.onlyA.length || exact.onlyB.length) {
      console.log(
        "\n_Con coincidencia normalizada: mismos nombres salvo mayúsculas/tildes/espacios._",
      );
    }
  }
}

function printMostRecentSnapshot(rows: BoardStats[], payload: MondayExtractPayload): void {
  const snapshots = rows.filter(
    (r) => r.snapshot_date_iso && r.kind === "snapshot" && !r.is_duplicado,
  );
  const candidates = snapshots.length ? snapshots : rows.filter((r) => r.snapshot_date_iso);

  if (!candidates.length) {
    console.log("\n## Tablero más reciente\n\n_Sin fechas parseables._");
    return;
  }

  const latest = [...candidates].sort((a, b) =>
    (b.snapshot_date_iso ?? "").localeCompare(a.snapshot_date_iso ?? ""),
  )[0]!;

  const board = payload.boards.find((b) => b.id === latest.id);
  if (!board) return;

  const itemNames: string[] = [];
  for (const group of board.groups) {
    for (const item of group.items) {
      itemNames.push(item.name);
    }
  }

  console.log("\n## Tablero más reciente\n");
  console.log(`Título: ${latest.name}`);
  console.log(`Fecha: ${latest.snapshot_date ?? latest.snapshot_date_iso}`);
  console.log(`ID: ${latest.id}`);
  console.log(`Items raíz: **${latest.root_items}** (subitems: ${latest.subitems})`);
  console.log("\nNombres de items raíz:\n");
  itemNames.sort((a, b) => a.localeCompare(b, "es"));
  for (const name of itemNames) {
    console.log(`  - ${name}`);
  }
}

function main(): void {
  const projectCode = parseProjectCodeArg(process.argv.slice(2));
  const path = resolve(MONDAY_EXTRACTS_DIR, `${projectCode}.json`);

  const raw = readFileSync(path, "utf8");
  const payload = JSON.parse(raw) as MondayExtractPayload;

  const rows = payload.boards.map(boardStats).sort(sortByDateThenName);

  console.log(`# Diagnóstico extract Monday — ${projectCode}`);
  console.log(`Archivo: ${path}`);
  console.log(`Extraído: ${payload.extracted_at}`);
  console.log(`Tableros: ${rows.length}`);

  printPerBoardTable(rows);
  printHistogram(rows);
  printSuspicious(rows);
  printDuplicadoAnalysis(rows);
  printCrossBoardVerification(rows, payload);
  printMostRecentSnapshot(rows, payload);
}

main();
