import type { UserContext } from "@/lib/auth/currentUser";

import { getActasReadSupabase } from "./readClient";
import type {
  ActasProjectDetail,
  ActasProjectListItem,
  ProjectPhase,
} from "../types";

const PROJECT_PHASES = new Set<ProjectPhase>([
  "adquisicion",
  "desarrollo",
  "comercializacion",
  "operacion",
  "desinversion",
  "cierre",
]);

function toProjectPhase(value: string): ProjectPhase {
  if (PROJECT_PHASES.has(value as ProjectPhase)) {
    return value as ProjectPhase;
  }
  return "desarrollo";
}

export interface FetchActasProjectsResult {
  projects: ActasProjectListItem[];
  error: string | null;
}

export async function fetchActasProjects(
  ctx: UserContext,
): Promise<FetchActasProjectsResult> {
  const supabase = await getActasReadSupabase(ctx);

  const { data, error } = await supabase
    .from("project")
    .select("id, code, name, phase")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error) {
    return { projects: [], error: error.message };
  }

  const projects: ActasProjectListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    phase: toProjectPhase(row.phase),
  }));

  return { projects, error: null };
}

// ---------------------------------------------------------------------------
// Project detail
// ---------------------------------------------------------------------------

export interface FetchActasProjectDetailResult {
  project: ActasProjectDetail | null;
  error: string | null;
}

export async function fetchActasProjectDetail(
  ctx: UserContext,
  projectCode: string,
): Promise<FetchActasProjectDetailResult> {
  const supabase = await getActasReadSupabase(ctx);
  const code = projectCode.trim();

  // Fetch base project row
  const { data: projectRow, error: projectErr } = await supabase
    .from("project")
    .select("id, code, name, phase")
    .is("archived_at", null)
    .eq("code", code)
    .maybeSingle();

  if (projectErr) {
    return { project: null, error: projectErr.message };
  }
  if (!projectRow) {
    return { project: null, error: null };
  }

  const projectId = projectRow.id as string;

  // Fetch latest log_entry date and element count in parallel
  const [logResult, elementResult, ownerResult] = await Promise.all([
    supabase
      .from("log_entry")
      .select("entry_date")
      .eq(
        "element_id",
        supabase
          .from("element")
          .select("id")
          .eq(
            "category_id",
            supabase
              .from("category")
              .select("id")
              .eq("project_id", projectId)
              .is("archived_at", null),
          )
          .is("archived_at", null),
      )
      .order("entry_date", { ascending: false })
      .limit(1),
    // element count via category join
    supabase
      .from("element")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in(
        "category_id",
        // subquery: categories of this project
        (await supabase
          .from("category")
          .select("id")
          .eq("project_id", projectId)
          .is("archived_at", null)
        ).data?.map((c: { id: string }) => c.id) ?? [],
      ),
    // owner: first element_owner user email (lexicographic by user_id)
    supabase
      .from("element_owner")
      .select("user_id")
      .in(
        "element_id",
        (await supabase
          .from("element")
          .select("id")
          .is("archived_at", null)
          .in(
            "category_id",
            (await supabase
              .from("category")
              .select("id")
              .eq("project_id", projectId)
              .is("archived_at", null)
            ).data?.map((c: { id: string }) => c.id) ?? [],
          )
        ).data?.map((e: { id: string }) => e.id) ?? [],
      )
      .limit(1),
  ]);

  // Resolve owner email from auth.users via service role (supabase admin API not available in JS client; read from element_owner.user_id only for now)
  const ownerUserId =
    (ownerResult.data as { user_id: string }[] | null)?.[0]?.user_id ?? null;

  const lastLogEntryAt =
    (logResult.data as { entry_date: string }[] | null)?.[0]?.entry_date ??
    null;

  return {
    project: {
      id: projectId,
      code: projectRow.code as string,
      name: projectRow.name as string,
      phase: toProjectPhase(projectRow.phase as string),
      ownerEmail: ownerUserId,
      lastLogEntryAt,
      elementCount: elementResult.count ?? 0,
    },
    error: null,
  };
}
