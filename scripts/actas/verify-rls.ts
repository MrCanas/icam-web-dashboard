import { createClient } from "@supabase/supabase-js";

import { createActasAnonClient } from "./lib/supabase-anon";
import { createActasServerClient } from "./lib/supabase-server";
import { getSupabaseAnonKey, getSupabaseUrl, loadActasEnv } from "./lib/env";

const ICAM_ORG_ID = "a0000000-0000-4000-8000-000000000001";

async function ensureUser(email: string, password: string) {
  const admin = createActasServerClient();
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    return { admin, userId: existing.id };
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "createUser failed");
  return { admin, userId: data.user.id };
}

function clientForUser(accessToken: string) {
  loadActasEnv();
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function main(): Promise<void> {
  const admin = createActasServerClient();
  const anon = createActasAnonClient();

  const { count: anonProjects } = await anon
    .from("project")
    .select("id", { count: "exact", head: true });
  const { count: anonMaster } = await anon
    .from("master_group")
    .select("id", { count: "exact", head: true });

  if ((anonProjects ?? 0) > 0 || (anonMaster ?? 0) > 0) {
    throw new Error(
      `anon no debe ver datos (project=${anonProjects}, master_group=${anonMaster})`,
    );
  }
  console.log("[anon] OK — 0 filas en project y master_group");

  const ts = Date.now();
  const memberEmail = `actas-member-${ts}@icam.local`;
  const outsiderEmail = `actas-outsider-${ts}@icam.local`;
  const password = `Tmp-${ts}-Rl1`;

  const member = await ensureUser(memberEmail, password);
  const outsider = await ensureUser(outsiderEmail, password);

  await member.admin.from("org_member").upsert({
    organization_id: ICAM_ORG_ID,
    user_id: member.userId,
    role: "member",
  });

  const code = `RLS-${ts}`;
  const { data: project, error: pErr } = await admin
    .from("project")
    .insert({
      code,
      name: "RLS test project",
      phase: "desarrollo",
      asset_type: "hotel",
      organization_id: ICAM_ORG_ID,
    })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);

  const signOutsider = await outsider.admin.auth.signInWithPassword({
    email: outsiderEmail,
    password,
  });
  if (signOutsider.error || !signOutsider.data.session) {
    throw new Error(signOutsider.error?.message ?? "outsider sign-in failed");
  }
  const outsiderClient = clientForUser(signOutsider.data.session.access_token);
  const { data: outsiderRows } = await outsiderClient
    .from("project")
    .select("id")
    .eq("code", code);
  if ((outsiderRows?.length ?? 0) > 0) {
    throw new Error("Usuario fuera de org no debe ver el proyecto");
  }
  console.log("[authenticated sin org] OK — 0 proyectos ajenos");

  const signMember = await member.admin.auth.signInWithPassword({
    email: memberEmail,
    password,
  });
  if (signMember.error || !signMember.data.session) {
    throw new Error(signMember.error?.message ?? "member sign-in failed");
  }
  const memberClient = clientForUser(signMember.data.session.access_token);
  const { data: memberRows, error: mSelErr } = await memberClient
    .from("project")
    .select("id")
    .eq("code", code);
  if (mSelErr) throw new Error(mSelErr.message);
  if (!memberRows?.length) {
    throw new Error("Miembro de org debe ver el proyecto");
  }
  console.log("[authenticated miembro] OK — ve proyecto de su org");

  const { data: category, error: cErr } = await admin
    .from("category")
    .insert({ project_id: project.id, name: "RLS Cat", order_index: 0 })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const { data: element, error: eErr } = await admin
    .from("element")
    .insert({
      category_id: category.id,
      name: "RLS Element",
      status: "not_started",
      order_index: 0,
    })
    .select("id")
    .single();
  if (eErr) throw new Error(eErr.message);

  const { data: log, error: lErr } = await admin
    .from("log_entry")
    .insert({
      element_id: element.id,
      author_id: member.userId,
      content: "Log RLS test",
      status_before: "not_started",
      status_after: "working_on_it",
    })
    .select("id")
    .single();
  if (lErr) throw new Error(lErr.message);

  const outsiderLog = await outsiderClient
    .from("log_entry")
    .update({ content: "outsider edit" })
    .eq("id", log.id)
    .select("id");
  if (outsiderLog.error) {
    console.log("[log_entry UPDATE] OK — outsider bloqueado (error RLS)");
  } else if ((outsiderLog.data?.length ?? 0) > 0) {
    throw new Error("Outsider no debe UPDATE log_entry");
  } else {
    console.log("[log_entry UPDATE] OK — outsider: 0 filas actualizadas");
  }

  const authorEdit = await memberClient
    .from("log_entry")
    .update({ content: "edit autor", edited_at: new Date().toISOString() })
    .eq("id", log.id)
    .select("content")
    .single();
  if (authorEdit.error) {
    throw new Error(`Autor debe poder editar: ${authorEdit.error.message}`);
  }
  console.log("[log_entry UPDATE] OK — autor permitido");

  await admin.from("log_entry").delete().eq("id", log.id);
  await admin.from("element").delete().eq("id", element.id);
  await admin.from("category").delete().eq("id", category.id);
  await admin.from("project").delete().eq("id", project.id);
  await member.admin.auth.admin.deleteUser(member.userId);
  await outsider.admin.auth.admin.deleteUser(outsider.userId);

  console.log("\nRLS verificado.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
