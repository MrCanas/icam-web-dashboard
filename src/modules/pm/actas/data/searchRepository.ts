import type { UserContext } from "@/lib/auth/currentUser";

import { getActasAuthenticatedSupabase } from "./authenticatedClient";
import { resolveUserDisplayMap } from "../logic/user-display";
import type { ActasLogSearchResult } from "../types";

const MIN_QUERY_LEN = 3;

type SearchRpcRow = {
  log_entry_id: string;
  element_id: string;
  element_name: string;
  category_id: string;
  category_name: string;
  content: string;
  entry_date: string;
  author_id: string | null;
  headline: string;
  rank: number;
};

async function assertProjectAccess(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { ok: false, error: auth.error };
  }

  const { data, error } = await auth.client
    .from("project")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Proyecto no encontrado o sin acceso" };
  return { ok: true };
}

export async function searchLogEntriesInProject(
  ctx: UserContext,
  projectId: string,
  query: string,
  limit = 50,
): Promise<{ results: ActasLogSearchResult[]; error: string | null }> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LEN) {
    return { results: [], error: null };
  }

  void ctx;
  const access = await assertProjectAccess(projectId);
  if (!access.ok) {
    return { results: [], error: access.error };
  }

  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { results: [], error: auth.error };
  }

  const { data, error } = await auth.client.rpc("search_log_entries", {
    p_project_id: projectId,
    p_query: trimmed,
    p_limit: limit,
  });

  if (error) {
    return { results: [], error: error.message };
  }

  const rows = (data ?? []) as SearchRpcRow[];
  const authorIds = [
    ...new Set(
      rows
        .map((r) => r.author_id)
        .filter((id): id is string => id != null),
    ),
  ];

  let userDisplayMap: Awaited<ReturnType<typeof resolveUserDisplayMap>>;
  try {
    userDisplayMap = await resolveUserDisplayMap(authorIds);
  } catch (err) {
    return {
      results: [],
      error: err instanceof Error ? err.message : "Error resolviendo autores",
    };
  }

  const results: ActasLogSearchResult[] = rows.map((row) => {
    const authorId = row.author_id ?? null;
    const authorLabel = authorId
      ? (userDisplayMap.get(authorId)?.label ?? authorId.slice(0, 8))
      : "Sin autor";
    return {
      logEntryId: row.log_entry_id,
      elementId: row.element_id,
      elementName: row.element_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      content: row.content,
      entryDate: row.entry_date,
      authorId,
      authorLabel,
      headline: row.headline,
      rank: row.rank,
    };
  });

  return { results, error: null };
}
