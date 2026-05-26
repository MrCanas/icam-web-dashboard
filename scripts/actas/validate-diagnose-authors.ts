import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { MONDAY_EXTRACTS_DIR } from "./lib/monday-extract";
import type {
  MondayExtractBoard,
  MondayExtractColumnValue,
} from "./lib/monday-extract";
import { isMondaySubitemsGroup } from "./lib/migration-resolve";
import { loadTransformedPayload, transformedPath } from "./lib/monday-validate";
import {
  compareBoardsChronologically,
  selectCanonicalBoards,
} from "./lib/monday-transform";
import { isOwnerColumn, normalizeKey } from "./lib/normalize";

config({ path: resolve(process.cwd(), ".env.local") });

interface UserMappingFile {
  mappings: Record<string, string | null>;
  users: {
    monday_user_id: string;
    monday_name: string | null;
    monday_email: string | null;
    supabase_user_id: string | null;
    mapped?: boolean;
  }[];
}

interface OwnerAtObservation {
  monday_user_id: string | null;
  owner_display: string;
  board_id: string;
  board_name: string;
}

type OwnerBucket = "monday_no_owner" | "monday_owner_unmapped";

function parseProjectCodeArg(argv: string[]): string {
  const code = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!code) {
    throw new Error(
      "Uso: npm run actas:validate-diagnose-authors -- <CÓDIGO_PROYECTO>\n  Ejemplo: npm run actas:validate-diagnose-authors -- GQ8",
    );
  }
  return code.toUpperCase();
}

function parseOwnerFromColumn(
  columnValues: MondayExtractColumnValue[],
): { monday_user_id: string | null; owner_display: string } {
  const col = columnValues.find((cv) =>
    isOwnerColumn(cv.column_title, cv.column_type),
  );
  const owner_display = (col?.text ?? "").trim();
  if (!col?.value) {
    return { monday_user_id: null, owner_display };
  }
  try {
    const parsed = JSON.parse(col.value) as {
      personsAndTeams?: { id: string | number; kind?: string }[];
    };
    const person = parsed.personsAndTeams?.find((p) => p.kind === "person");
    const id = person?.id ?? parsed.personsAndTeams?.[0]?.id;
    return {
      monday_user_id: id != null ? String(id) : null,
      owner_display,
    };
  } catch {
    return { monday_user_id: null, owner_display };
  }
}

function rowKey(
  groupTitle: string,
  itemName: string,
  parentItemName: string | null,
): string {
  const g = normalizeKey(groupTitle);
  const n = normalizeKey(itemName);
  if (parentItemName) {
    return `${g}|${normalizeKey(parentItemName)}|${n}`;
  }
  return `${g}|${n}`;
}

function buildOwnerIndex(
  boards: readonly MondayExtractBoard[],
): Map<string, OwnerAtObservation> {
  const index = new Map<string, OwnerAtObservation>();

  for (const board of boards) {
    const ts = board.updated_at?.trim();
    if (!ts) continue;

    for (const group of board.groups) {
      if (isMondaySubitemsGroup(group.title)) continue;

      for (const item of group.items) {
        const owner = parseOwnerFromColumn(item.column_values);
        const key = `${ts}|${rowKey(group.title, item.name, null)}`;
        index.set(key, {
          ...owner,
          board_id: board.id,
          board_name: board.name,
        });

        for (const sub of item.subitems) {
          const subOwner = parseOwnerFromColumn(sub.column_values);
          const subKey = `${ts}|${rowKey(group.title, sub.name, item.name)}`;
          index.set(subKey, {
            ...subOwner,
            board_id: board.id,
            board_name: board.name,
          });
        }
      }
    }
  }

  return index;
}

function buildLatestOwnerByRowKey(
  boards: readonly MondayExtractBoard[],
): Map<string, OwnerAtObservation> {
  const latest = new Map<string, OwnerAtObservation>();
  const sorted = [...boards].sort(compareBoardsChronologically);

  for (const board of sorted) {
    for (const group of board.groups) {
      if (isMondaySubitemsGroup(group.title)) continue;

      for (const item of group.items) {
        const owner = parseOwnerFromColumn(item.column_values);
        const rk = rowKey(group.title, item.name, null);
        latest.set(rk, { ...owner, board_id: board.id, board_name: board.name });

        for (const sub of item.subitems) {
          const subOwner = parseOwnerFromColumn(sub.column_values);
          const subRk = rowKey(group.title, sub.name, item.name);
          latest.set(subRk, {
            ...subOwner,
            board_id: board.id,
            board_name: board.name,
          });
        }
      }
    }
  }

  return latest;
}

function classifyOwner(
  owner: OwnerAtObservation | undefined,
  mappings: Record<string, string | null>,
  mondayUserById: Map<string, UserMappingFile["users"][0]>,
): { bucket: OwnerBucket; email: string | null; monday_user_id: string | null } {
  if (!owner) {
    return { bucket: "monday_no_owner", email: null, monday_user_id: null };
  }

  const { monday_user_id, owner_display } = owner;

  if (!monday_user_id) {
    if (!owner_display) {
      return { bucket: "monday_no_owner", email: null, monday_user_id: null };
    }
    const asEmail = owner_display.includes("@") ? owner_display : null;
    return {
      bucket: "monday_owner_unmapped",
      email: asEmail,
      monday_user_id: null,
    };
  }

  if (mappings[monday_user_id]) {
    return {
      bucket: "monday_no_owner",
      email: null,
      monday_user_id,
    };
  }

  const user = mondayUserById.get(monday_user_id);
  const email =
    user?.monday_email?.trim() ||
    (user?.monday_name?.includes("@") ? user.monday_name.trim() : null) ||
    (owner_display.includes("@") ? owner_display : null);

  return {
    bucket: "monday_owner_unmapped",
    email,
    monday_user_id,
  };
}

function findOwnerForLogEntry(
  ownerByTsAndRow: Map<string, OwnerAtObservation>,
  entryDate: string,
  rk: string,
): OwnerAtObservation | undefined {
  const exact = ownerByTsAndRow.get(`${entryDate}|${rk}`);
  if (exact) return exact;

  const day = entryDate.slice(0, 10);
  const suffix = `|${rk}`;
  for (const [key, owner] of ownerByTsAndRow) {
    if (key.endsWith(suffix) && key.startsWith(day)) return owner;
  }
  return undefined;
}

function emailForUnmapped(
  classified: ReturnType<typeof classifyOwner>,
  mondayUserById: Map<string, UserMappingFile["users"][0]>,
): string {
  if (classified.email) return classified.email;
  if (classified.monday_user_id) {
    const u = mondayUserById.get(classified.monday_user_id);
    return (
      u?.monday_email?.trim() ||
      (u?.monday_name?.includes("@") ? u.monday_name.trim() : "") ||
      `(monday_id=${classified.monday_user_id}, sin email en 06)`
    );
  }
  return "(sin email — solo nombre en columna Owner)";
}

function printSection(title: string): void {
  console.log(`\n## ${title}\n`);
}

function main(): void {
  const projectCode = parseProjectCodeArg(process.argv.slice(2));
  const transformedPath_ = transformedPath(projectCode);
  const extractPath = resolve(MONDAY_EXTRACTS_DIR, `${projectCode}.json`);
  const userMappingPath = resolve(
    process.cwd(),
    "docs/actas/06-user-mapping.json",
  );

  if (!existsSync(transformedPath_)) {
    throw new Error(`No existe ${transformedPath_}`);
  }
  if (!existsSync(extractPath)) {
    throw new Error(`No existe ${extractPath}`);
  }

  const payload = loadTransformedPayload(transformedPath_);
  const extract = JSON.parse(readFileSync(extractPath, "utf8")) as {
    boards: MondayExtractBoard[];
  };
  const userDoc = JSON.parse(
    readFileSync(userMappingPath, "utf8"),
  ) as UserMappingFile;
  const mappings = userDoc.mappings ?? {};
  const mondayUserById = new Map(
    (userDoc.users ?? []).map((u) => [u.monday_user_id, u]),
  );

  const { canonical } = selectCanonicalBoards(extract.boards, projectCode, {
    logDiscards: false,
  });
  const ownerByTsAndRow = buildOwnerIndex(canonical);
  const latestOwnerByRow = buildLatestOwnerByRowKey(canonical);

  const elementsById = new Map(payload.elements.map((e) => [e.id, e]));
  const categoriesById = new Map(payload.categories.map((c) => [c.id, c]));

  function elementRowKeyFor(el: (typeof payload.elements)[0]): string {
    const cat = categoriesById.get(el.category_id);
    const groupTitle = cat?.name ?? "?";
    if (el.parent_element_id) {
      const parent = elementsById.get(el.parent_element_id);
      return rowKey(
        groupTitle,
        el.monday_item_name,
        parent?.monday_item_name ?? null,
      );
    }
    return rowKey(groupTitle, el.monday_item_name, null);
  }

  const nullAuthorLogs = payload.log_entries.filter((le) => le.author_id == null);
  const nullOwnerRows = payload.element_owners.filter((eo) => eo.user_id == null);

  console.log(`Diagnóstico authors — ${projectCode}`);
  console.log(`  transform: ${transformedPath_}`);
  console.log(`  extract:   ${extractPath} (${canonical.length} boards canónicos)`);

  let logNoOwner = 0;
  let logUnmapped = 0;
  let logLookupMiss = 0;
  let logMappedButNullAuthor = 0;
  const logEmailCounts = new Map<string, number>();

  for (const le of nullAuthorLogs) {
    const el = elementsById.get(le.element_id);
    if (!el) {
      logLookupMiss += 1;
      continue;
    }
    const rk = elementRowKeyFor(el);
    const owner = findOwnerForLogEntry(ownerByTsAndRow, le.entry_date, rk);
    if (!owner) {
      logLookupMiss += 1;
      continue;
    }

    const classified = classifyOwner(owner, mappings, mondayUserById);
    if (
      owner.monday_user_id &&
      mappings[owner.monday_user_id]
    ) {
      logMappedButNullAuthor += 1;
      continue;
    }
    if (classified.bucket === "monday_no_owner") {
      logNoOwner += 1;
    } else {
      logUnmapped += 1;
      const email = emailForUnmapped(classified, mondayUserById);
      logEmailCounts.set(email, (logEmailCounts.get(email) ?? 0) + 1);
    }
  }

  printSection(`log_entries con author_id null (${nullAuthorLogs.length})`);
  console.log(`  Owner null en Monday (columna vacía):     ${logNoOwner}`);
  console.log(
    `  Owner Monday presente, sin mapa auth.users: ${logUnmapped}`,
  );
  if (logLookupMiss) {
    console.log(`  Sin cruce extract (índice):                 ${logLookupMiss}`);
  }
  if (logMappedButNullAuthor) {
    console.log(
      `  Anomalía (mapeado en 06 pero author null):  ${logMappedButNullAuthor}`,
    );
  }

  let eoNoOwner = 0;
  let eoUnmapped = 0;
  let eoLookupMiss = 0;
  const eoEmailCounts = new Map<string, number>();

  for (const eo of nullOwnerRows) {
    const el = elementsById.get(eo.element_id);
    if (!el) {
      eoLookupMiss += 1;
      continue;
    }
    const rk = elementRowKeyFor(el);
    const owner = latestOwnerByRow.get(rk);
    if (!owner) {
      eoLookupMiss += 1;
      continue;
    }

    const classified = classifyOwner(owner, mappings, mondayUserById);
    if (classified.bucket === "monday_no_owner") {
      eoNoOwner += 1;
    } else {
      eoUnmapped += 1;
      const email = emailForUnmapped(classified, mondayUserById);
      eoEmailCounts.set(email, (eoEmailCounts.get(email) ?? 0) + 1);
    }
  }

  printSection(`element_owners con user_id null (${nullOwnerRows.length})`);
  console.log(`  Owner null en Monday (último snapshot):   ${eoNoOwner}`);
  console.log(
    `  Owner Monday presente, sin mapa auth.users: ${eoUnmapped}`,
  );
  if (eoLookupMiss) {
    console.log(`  Sin cruce extract (índice):                 ${eoLookupMiss}`);
  }

  const mergedEmails = new Map<string, number>();
  for (const [email, n] of logEmailCounts) {
    mergedEmails.set(email, (mergedEmails.get(email) ?? 0) + n);
  }
  for (const [email, n] of eoEmailCounts) {
    mergedEmails.set(email, (mergedEmails.get(email) ?? 0) + n);
  }

  printSection("Emails Monday sin mapeo a auth.users (únicos)");
  if (!mergedEmails.size) {
    console.log("  _Ninguno — todos los null owner son columna vacía._");
  } else {
    const sorted = [...mergedEmails.entries()].sort((a, b) => b[1] - a[1]);
    for (const [email, count] of sorted) {
      console.log(`  ${count.toString().padStart(4)} × ${email}`);
    }
  }

  console.log("");
}

main();
