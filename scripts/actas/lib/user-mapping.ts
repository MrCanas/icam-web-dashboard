import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createActasServerClient } from "./supabase-server";
import { mondayQuery } from "../../../src/services/monday/client";
import { isOwnerColumn, normalizeKey } from "./normalize";

export const USER_MAPPING_OUTPUT = resolve(
  process.cwd(),
  "docs/actas/06-user-mapping.json",
);

const MONDAY_USERS_QUERY = `
  query MondayUsers {
    users {
      id
      name
      email
    }
  }
`;

const SAMPLE_BOARD_OWNERS_QUERY = `
  query SampleBoardOwners($id: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$id]) {
      columns { id title type }
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          column_values { id type value }
        }
      }
    }
  }
`;

export interface MondayUser {
  id: string;
  name: string;
  email: string;
}

export interface UserMappingEntry {
  monday_user_id: string;
  monday_name: string;
  monday_email: string | null;
  supabase_user_id: string | null;
  mapped: boolean;
  unmapped: boolean;
  match_method: "email" | "none";
  notes: string | null;
}

export interface UserMappingPayload {
  generated_at: string;
  description: string;
  mappings: Record<string, string | null>;
  users: UserMappingEntry[];
  unmapped_monday_users: UserMappingEntry[];
  summary: {
    total_monday_users: number;
    mapped: number;
    unmapped: number;
  };
}

export async function fetchMondayUsers(): Promise<MondayUser[]> {
  const data = await mondayQuery<{ users: MondayUser[] }>(MONDAY_USERS_QUERY);
  return data.users ?? [];
}

export async function collectOwnerIdsFromSampleBoard(
  boardId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | null = null;

  for (;;) {
    const data = await mondayQuery<{
      boards: {
        columns: { id: string; title: string; type: string }[];
        items_page: {
          cursor: string | null;
          items: { column_values: { id: string; type: string; value: string }[] }[];
        };
      }[];
    }>(
      SAMPLE_BOARD_OWNERS_QUERY,
      { id: boardId, limit: 100, cursor },
      { timeoutMs: 90_000 },
    );

    const board = data.boards?.[0];
    const ownerCols = new Set(
      (board?.columns ?? [])
        .filter((c) => isOwnerColumn(c.title, c.type))
        .map((c) => c.id),
    );

    for (const item of board?.items_page?.items ?? []) {
      for (const cv of item.column_values) {
        if (!ownerCols.has(cv.id) || cv.type !== "people" || !cv.value) continue;
        try {
          const parsed = JSON.parse(cv.value) as {
            personsAndTeams?: { id: number | string; kind: string }[];
          };
          for (const p of parsed.personsAndTeams ?? []) {
            if (p.kind === "person") ids.add(String(p.id));
          }
        } catch {
          /* ignore */
        }
      }
    }

    cursor = board?.items_page?.cursor ?? null;
    if (!cursor) break;
  }

  return ids;
}

export async function fetchSupabaseUsersByEmail(): Promise<Map<string, string>> {
  const admin = createActasServerClient();
  const map = new Map<string, string>();
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (u.email) map.set(normalizeKey(u.email), u.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return map;
}

export async function buildUserMappingPayload(): Promise<UserMappingPayload> {
  const sampleBoardId =
    process.env.MONDAY_SAMPLE_BOARD_ID?.trim() || "18401743922";

  const mondayUsers = await fetchMondayUsers();
  const ownerIds = await collectOwnerIdsFromSampleBoard(sampleBoardId);
  const supabaseByEmail = await fetchSupabaseUsersByEmail();

  const mondayById = new Map(mondayUsers.map((u) => [u.id, u]));
  for (const id of ownerIds) {
    if (!mondayById.has(id)) {
      mondayById.set(id, { id, name: `(solo en Owner col, id=${id})`, email: "" });
    }
  }

  const mappings: Record<string, string | null> = {};
  const users: UserMappingEntry[] = [];

  for (const u of [...mondayById.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  )) {
    const emailKey = u.email ? normalizeKey(u.email) : "";
    const supabaseId = emailKey ? (supabaseByEmail.get(emailKey) ?? null) : null;
    const mapped = Boolean(supabaseId);

    mappings[u.id] = supabaseId;
    users.push({
      monday_user_id: u.id,
      monday_name: u.name,
      monday_email: u.email || null,
      supabase_user_id: supabaseId,
      mapped,
      unmapped: !mapped,
      match_method: mapped ? "email" : "none",
      notes: !mapped
        ? u.email
          ? "Sin usuario auth.users con el mismo email — completar supabase_user_id a mano o crear usuario"
          : "Sin email en Monday — asignar por nombre en 08-mapping-guide.md"
        : null,
    });
  }

  const unmapped = users.filter((u) => u.unmapped);

  return {
    generated_at: new Date().toISOString(),
    description:
      "Mapa monday_user_id → supabase_user_id (auth.users). Editar supabase_user_id para unmapped antes de migrar.",
    mappings,
    users,
    unmapped_monday_users: unmapped,
    summary: {
      total_monday_users: users.length,
      mapped: users.length - unmapped.length,
      unmapped: unmapped.length,
    },
  };
}

export async function runMondayUserMapping(options?: {
  writePath?: string;
  log?: boolean;
}): Promise<UserMappingPayload> {
  const writePath = options?.writePath ?? USER_MAPPING_OUTPUT;
  const log = options?.log ?? true;

  if (log) {
    console.log("Monday: listando usuarios de cuenta…");
  }
  const payload = await buildUserMappingPayload();

  if (log) {
    console.log(`  ${payload.summary.total_monday_users} usuarios Monday`);
    console.log("Supabase: mapeo por email…");
    console.log(
      `  Mapped: ${payload.summary.mapped} · Unmapped: ${payload.summary.unmapped}`,
    );
  }

  writeFileSync(writePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  if (log) {
    console.log(`Escrito ${writePath}`);
  }

  return payload;
}
