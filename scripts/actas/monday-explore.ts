import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { mondayQuery, type Board, type Group } from "../../src/services/monday/client";

config({ path: resolve(process.cwd(), ".env.local") });

const PAGE_SIZE = 500;
const OUTPUT_PATH = resolve(process.cwd(), "docs/actas/05-monday-inventory.md");

const WORKSPACE_QUERY = `
  query Workspace($ids: [ID!]!) {
    workspaces(ids: $ids) {
      id
      name
    }
  }
`;

const BOARDS_PAGE_QUERY = `
  query BoardsPage($workspaceIds: [ID!]!, $limit: Int!, $page: Int!) {
    boards(workspace_ids: $workspaceIds, limit: $limit, page: $page) {
      id
      name
      items_count
      updated_at
      groups {
        id
        title
      }
    }
  }
`;

type BoardRow = Board & { groups?: Group[] };

interface ParsedBoard {
  id: string;
  rawName: string;
  kind: "snapshot" | "subelementos" | "subitems" | "other";
  projectCode: string | null;
  snapshotDate: string | null;
  snapshotIso: string | null;
  itemsCount: number;
  groupTitles: string[];
}

interface ProjectAggregate {
  code: string;
  snapshots: ParsedBoard[];
  subelementBoards: ParsedBoard[];
}

const DATE_SUFFIX = /\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/;

function normalizeProjectCode(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

function parseSnapshotDate(match: RegExpMatchArray): { label: string; iso: string } | null {
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const probe = new Date(iso);
  if (Number.isNaN(probe.getTime())) return null;
  return { label: `${match[1]}/${match[2]}/${match[3]}`, iso };
}

function parseBoard(board: BoardRow): ParsedBoard {
  const name = board.name.trim();
  const itemsCount = board.items_count ?? 0;
  const groupTitles = (board.groups ?? []).map((g) => g.title.trim()).filter(Boolean);

  let kind: ParsedBoard["kind"] = "other";
  let projectCode: string | null = null;
  let snapshotDate: string | null = null;
  let snapshotIso: string | null = null;

  const subEs = name.match(/^Subelementos de\s+(.+)$/i);
  const subEn = name.match(/^Subitems of\s+(.+)$/i);
  const prefix = subEs ?? subEn;

  if (prefix) {
    kind = subEs ? "subelementos" : "subitems";
    const rest = prefix[1];
    const dateMatch = rest.match(DATE_SUFFIX);
    if (dateMatch) {
      projectCode = normalizeProjectCode(rest.slice(0, dateMatch.index).trim());
      const parsed = parseSnapshotDate(dateMatch);
      if (parsed) {
        snapshotDate = parsed.label;
        snapshotIso = parsed.iso;
      }
    }
  } else {
    const dateMatch = name.match(DATE_SUFFIX);
    if (dateMatch) {
      kind = "snapshot";
      projectCode = normalizeProjectCode(name.slice(0, dateMatch.index!).trim());
      const parsed = parseSnapshotDate(dateMatch);
      if (parsed) {
        snapshotDate = parsed.label;
        snapshotIso = parsed.iso;
      }
    }
  }

  return {
    id: board.id,
    rawName: name,
    kind,
    projectCode,
    snapshotDate,
    snapshotIso,
    itemsCount,
    groupTitles,
  };
}

async function fetchWorkspaceName(workspaceId: string): Promise<string> {
  const data = await mondayQuery<{ workspaces: { id: string; name: string }[] }>(
    WORKSPACE_QUERY,
    { ids: [workspaceId] },
  );
  return data.workspaces[0]?.name ?? workspaceId;
}

async function fetchAllBoards(workspaceId: string): Promise<BoardRow[]> {
  const all: BoardRow[] = [];
  let page = 1;
  for (;;) {
    const data = await mondayQuery<{ boards: BoardRow[] }>(
      BOARDS_PAGE_QUERY,
      { workspaceIds: [workspaceId], limit: PAGE_SIZE, page },
      { timeoutMs: 90_000 },
    );
    const batch = data.boards ?? [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page += 1;
    console.log(`  página ${page - 1}: ${batch.length} tableros (acum. ${all.length})`);
  }
  return all;
}

function buildInventory(
  workspaceName: string,
  workspaceId: string,
  boards: ParsedBoard[],
): string {
  const byProject = new Map<string, ProjectAggregate>();

  for (const b of boards) {
    if (!b.projectCode) continue;
    if (!byProject.has(b.projectCode)) {
      byProject.set(b.projectCode, {
        code: b.projectCode,
        snapshots: [],
        subelementBoards: [],
      });
    }
    const agg = byProject.get(b.projectCode)!;
    if (b.kind === "snapshot") agg.snapshots.push(b);
    else if (b.kind === "subelementos" || b.kind === "subitems") {
      agg.subelementBoards.push(b);
    }
  }

  const snapshotBoards = boards.filter((b) => b.kind === "snapshot");
  const unparsed = boards.filter((b) => b.kind === "other" || !b.projectCode);
  const projects = [...byProject.values()].sort((a, b) =>
    a.code.localeCompare(b.code, "es"),
  );

  const singleSnapshot = projects.filter((p) => p.snapshots.length === 1);
  const noSnapshots = projects.filter((p) => p.snapshots.length === 0);
  const multiSnapshot = projects.filter((p) => p.snapshots.length > 1);

  const duplicateDates: {
    code: string;
    date: string;
    count: number;
    detail: string;
  }[] = [];
  for (const p of projects) {
    const byDate = new Map<string, ParsedBoard[]>();
    for (const s of p.snapshots) {
      const d = s.snapshotDate ?? "?";
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(s);
    }
    for (const [date, snaps] of byDate) {
      if (snaps.length <= 1) continue;
      const items = snaps.map((s) => s.itemsCount).join("+");
      const groups = snaps.map((s) => s.groupTitles.length).join("+");
      duplicateDates.push({
        code: p.code,
        date,
        count: snaps.length,
        detail: `items[${items}] grupos[${groups}]`,
      });
    }
  }
  duplicateDates.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const invalidDates = boards.filter(
    (b) => b.kind === "snapshot" && b.projectCode && !b.snapshotIso,
  );
  const futureCutoff = new Date();
  futureCutoff.setMonth(futureCutoff.getMonth() + 3);
  const farFuture = snapshotBoards.filter((b) => {
    if (!b.snapshotIso) return false;
    return new Date(b.snapshotIso) > futureCutoff;
  });
  const veryOld = snapshotBoards.filter((b) => {
    if (!b.snapshotIso) return false;
    return new Date(b.snapshotIso) < new Date("2024-01-01");
  });

  const allIso = snapshotBoards
    .map((b) => b.snapshotIso)
    .filter((d): d is string => Boolean(d))
    .sort();
  const globalMin = allIso[0] ?? "—";
  const globalMax = allIso[allIso.length - 1] ?? "—";

  const lines: string[] = [
    "# Inventario Monday — workspace Actas",
    "",
    `**Generado:** ${new Date().toISOString().slice(0, 10)} (script \`monday-explore.ts\`)`,
    `**Workspace:** ${workspaceName} (\`id=${workspaceId}\`)`,
    "",
    "> Exploración read-only. No se escribe en Supabase.",
    "",
    "## Resumen",
    "",
    "| Métrica | Valor |",
    "|---------|------:|",
    `| Tableros totales | ${boards.length} |`,
    `| Tableros snapshot (\`PROYECTO - DD/MM/YYYY\`) | ${snapshotBoards.length} |`,
    `| Tableros subelementos / subitems | ${boards.filter((b) => b.kind === "subelementos" || b.kind === "subitems").length} |`,
    `| Tableros sin parsear (otros) | ${unparsed.length} |`,
    `| **Códigos de proyecto detectados** | **${projects.length}** |`,
    `| Snapshots totales (tableros snapshot) | ${snapshotBoards.length} |`,
    `| Rango fechas snapshots (global) | ${globalMin} → ${globalMax} |`,
    "",
    "## Agrupación por código de proyecto",
    "",
    "Cada **snapshot** es un tablero cuyo título sigue `CÓDIGO - DD/MM/YYYY` (ej. `GQ8 - 26/02/2026`).",
    "Los tableros `Subelementos de …` / `Subitems of …` comparten el mismo código y fecha en el título.",
    "",
    "| Código | Snapshots | Sub-tableros | Fecha min | Fecha max | Items (snapshots) | Grupos típicos (último snapshot) |",
    "|--------|----------:|-------------:|-----------|-----------|------------------:|--------------------------------|",
  ];

  for (const p of projects) {
    const dates = p.snapshots
      .map((s) => s.snapshotIso)
      .filter((d): d is string => Boolean(d))
      .sort();
    const min = dates[0] ?? "—";
    const max = dates[dates.length - 1] ?? "—";
    const items = p.snapshots.reduce((n, s) => n + s.itemsCount, 0);
    const latest = [...p.snapshots].sort((a, b) =>
      (b.snapshotIso ?? "").localeCompare(a.snapshotIso ?? ""),
    )[0];
    const groupsSample =
      latest?.groupTitles.slice(0, 5).join("; ") +
      (latest && latest.groupTitles.length > 5 ? "…" : "") || "—";
    lines.push(
      `| ${p.code} | ${p.snapshots.length} | ${p.subelementBoards.length} | ${min} | ${max} | ${items} | ${groupsSample} |`,
    );
  }

  lines.push(
    "",
    "## Detalle por proyecto (snapshots)",
    "",
  );

  for (const p of projects) {
    const sorted = [...p.snapshots].sort((a, b) =>
      (a.snapshotIso ?? "").localeCompare(b.snapshotIso ?? ""),
    );
    lines.push(`### ${p.code}`, "");
    lines.push(
      `- Snapshots: **${p.snapshots.length}** · Sub-tableros: ${p.subelementBoards.length}`,
    );
    if (sorted.length) {
      lines.push("- Fechas:");
      for (const s of sorted) {
        lines.push(
          `  - ${s.snapshotDate ?? "?"} — ${s.itemsCount} items, ${s.groupTitles.length} grupos (\`${s.id}\`)`,
        );
      }
    } else {
      lines.push("- Sin tableros snapshot (solo subelementos u otros).");
    }
    lines.push("");
  }

  lines.push(
    "## Anomalías y observaciones",
    "",
  );

  lines.push(
    "### Proyectos con un solo snapshot",
    "",
    singleSnapshot.length
      ? singleSnapshot.map((p) => `- **${p.code}** (${p.snapshots[0]?.snapshotDate})`).join("\n")
      : "_Ninguno._",
    "",
  );

  lines.push(
    "### Proyectos sin tablero snapshot (solo subelementos)",
    "",
    noSnapshots.length
      ? noSnapshots.map((p) => `- **${p.code}** (${p.subelementBoards.length} sub-tableros)`).join("\n")
      : "_Ninguno._",
    "",
  );

  lines.push(
    "### Misma fecha duplicada en un proyecto",
    "",
    "Patrón habitual: **dos tableros** con la misma fecha — uno «stub» (1 item, 1 grupo) y otro con el acta completa (~6 grupos, 15–50 items). No son snapshots distintos en el tiempo.",
    "",
    duplicateDates.length
      ? duplicateDates
          .slice(0, 40)
          .map(
            (d) =>
              `- **${d.code}** — ${d.date} ×${d.count} (${d.detail})`,
          )
          .join("\n") +
        (duplicateDates.length > 40
          ? `\n- … y ${duplicateDates.length - 40} fechas duplicadas más`
          : "")
      : "_Ninguna duplicidad de fecha dentro del mismo código._",
    "",
  );

  const duplicadoBoards = boards.filter((b) =>
    /^Duplicado de\s/i.test(b.rawName),
  );
  lines.push(
    "### Tableros «Duplicado de …» (clones Monday)",
    "",
    duplicadoBoards.length
      ? duplicadoBoards
          .map((b) => `- \`${b.rawName}\` — ${b.itemsCount} items (${b.id})`)
          .join("\n")
      : "_Ninguno._",
    "",
  );

  lines.push(
    "### Títulos snapshot con fecha no parseable",
    "",
    invalidDates.length
      ? invalidDates
          .slice(0, 20)
          .map((b) => `- \`${b.rawName}\` (${b.id})`)
          .join("\n") + (invalidDates.length > 20 ? `\n- … y ${invalidDates.length - 20} más` : "")
      : "_Ninguno._",
    "",
  );

  lines.push(
    "### Fechas muy futuras (>3 meses desde hoy)",
    "",
    farFuture.length
      ? farFuture.map((b) => `- ${b.projectCode} — ${b.snapshotDate} (\`${b.rawName}\`)`).join("\n")
      : "_Ninguna._",
    "",
  );

  lines.push(
    "### Fechas anteriores a 2024",
    "",
    veryOld.length
      ? veryOld.map((b) => `- ${b.projectCode} — ${b.snapshotDate}`).join("\n")
      : "_Ninguna._",
    "",
  );

  lines.push(
    "### Tableros sin código de proyecto (muestra)",
    "",
    unparsed.length
      ? unparsed
          .slice(0, 25)
          .map(
            (b) =>
              `- \`${b.rawName}\` — ${b.itemsCount} items, ${b.groupTitles.length} grupos`,
          )
          .join("\n") + (unparsed.length > 25 ? `\n- … y ${unparsed.length - 25} más` : "")
      : "_Ninguno._",
    "",
  );

  lines.push(
    "## Notas para migración",
    "",
    `- **${multiSnapshot.length}** proyectos tienen historial de snapshots (≥2 fechas); priorizar mapeo a \`project.code\` + dimensión fecha/snapshot.`,
    `- Los tableros de subelementos duplican estructura por fecha; validar si se fusionan en un solo \`element\` tree por proyecto.`,
    `- Grupos Monday (SOCIETARIO, ESTADO PROYECTO, …) deben alinearse con \`master_group\` del catálogo Excel.`,
    `- Workspace esperado en operación: nombre tipo **«Actas Seguim…»** — confirmar en UI que coincide con \`${workspaceName}\`.`,
    "",
    "## Comando",
    "",
    "```bash",
    "npm run actas:monday-explore",
    "```",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const workspaceId = process.env.MONDAY_WORKSPACE_ID_ACTAS?.trim();
  if (!workspaceId) {
    throw new Error("Falta MONDAY_WORKSPACE_ID_ACTAS en .env.local");
  }

  console.log("Obteniendo workspace…");
  const workspaceName = await fetchWorkspaceName(workspaceId);
  console.log(`Workspace: ${workspaceName} (${workspaceId})`);

  console.log("Listando tableros (con grupos)…");
  const raw = await fetchAllBoards(workspaceId);
  const parsed = raw.map(parseBoard);

  console.log(`Parseados: ${parsed.length} tableros`);
  const md = buildInventory(workspaceName, workspaceId, parsed);
  writeFileSync(OUTPUT_PATH, md, "utf8");
  console.log(`Escrito ${OUTPUT_PATH}`);

  const projects = new Set(
    parsed.filter((b) => b.kind === "snapshot" && b.projectCode).map((b) => b.projectCode),
  );
  console.log(`Proyectos (snapshots): ${projects.size}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
