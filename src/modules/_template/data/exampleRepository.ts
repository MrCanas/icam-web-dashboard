import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import { getTemplateWriteSupabase } from "@/modules/_template/data/readClient";
import type { ExampleItem } from "@/modules/_template/types";

export interface ExampleItemInsert {
  name: string;
}

export async function listExampleItems(ctx: UserContext, limit = 50) {
  const supabase = getTemplateWriteSupabase(ctx);
  return supabase
    .from("example_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function createExampleItem(ctx: UserContext, payload: ExampleItemInsert) {
  return withAudit(
    ctx,
    "template.example_item.create",
    {
      resourceType: "example_item",
      payload,
    },
    async () => {
      const supabase = getTemplateWriteSupabase(ctx);
      return supabase.from("example_items").insert(payload).select("id").single();
    },
  );
}

export function mapExampleRows(data: unknown[] | null): ExampleItem[] {
  return (data ?? []) as ExampleItem[];
}
