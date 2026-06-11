"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { searchLogEntriesInProject } from "@/modules/pm/actas/data/searchRepository";
import type { ActasLogSearchResult } from "@/modules/pm/actas/types";

export type SearchLogEntriesInput = {
  projectId: string;
  query: string;
  limit?: number;
};

export type SearchLogEntriesResult =
  | { ok: true; results: ActasLogSearchResult[] }
  | { ok: false; error: string };

export async function searchLogEntries(
  input: SearchLogEntriesInput,
): Promise<SearchLogEntriesResult> {
  const ctx = await requireCurrentUser();
  const { results, error } = await searchLogEntriesInProject(
    ctx,
    input.projectId,
    input.query,
    input.limit ?? 50,
  );
  if (error) {
    return { ok: false, error };
  }
  return { ok: true, results };
}
