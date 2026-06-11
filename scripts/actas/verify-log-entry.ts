import { createActasServerClient } from "./lib/supabase-server";

async function main(): Promise<void> {
  const supabase = createActasServerClient();

  let authorId: string;
  let tempUserId: string | null = null;

  const { data: users, error: usersErr } =
    await supabase.auth.admin.listUsers({ perPage: 1 });
  if (usersErr) throw new Error(usersErr.message);

  if (users.users.length > 0) {
    authorId = users.users[0].id;
  } else {
    const email = `actas-verify-${Date.now()}@icam.local`;
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email,
        password: `Tmp-${Date.now()}-Aa1`,
        email_confirm: true,
      });
    if (createErr || !created.user) {
      throw new Error(`No se pudo crear usuario de prueba: ${createErr?.message}`);
    }
    authorId = created.user.id;
    tempUserId = created.user.id;
  }

  const code = `TST-LOG-${Date.now()}`;
  const { data: project, error: pErr } = await supabase
    .from("project")
    .insert({
      code,
      name: "Log entry test",
      phase: "desarrollo",
      asset_type: "hotel",
    })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);

  const { data: category, error: cErr } = await supabase
    .from("category")
    .insert({
      project_id: project.id,
      name: "Test category",
      order_index: 0,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const { data: element, error: eErr } = await supabase
    .from("element")
    .insert({
      category_id: category.id,
      name: "Test element",
      status: "not_started",
      order_index: 0,
    })
    .select("id, status")
    .single();
  if (eErr) throw new Error(eErr.message);

  if (element.status !== "not_started") {
    throw new Error(`Estado inicial inesperado: ${element.status}`);
  }

  const { data: log, error: lErr } = await supabase
    .from("log_entry")
    .insert({
      element_id: element.id,
      author_id: authorId,
      content: "Cambio a en progreso",
      status_before: "not_started",
      status_after: "working_on_it",
    })
    .select("id")
    .single();
  if (lErr) throw new Error(lErr.message);

  const { data: updated, error: uErr } = await supabase
    .from("element")
    .select("status")
    .eq("id", element.id)
    .single();
  if (uErr) throw new Error(uErr.message);

  if (updated.status !== "working_on_it") {
    throw new Error(
      `Trigger no actualizó element.status: esperado working_on_it, got ${updated.status}`,
    );
  }

  const { data: latest, error: latestErr } = await supabase
    .from("log_entry")
    .select("id, entry_date")
    .eq("element_id", element.id)
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .limit(1)
    .single();
  if (latestErr) throw new Error(latestErr.message);
  if (latest.id !== log.id) {
    throw new Error("Última entrada no coincide con la insertada");
  }

  const { error: softErr } = await supabase
    .from("log_entry")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", log.id);
  if (softErr) throw new Error(softErr.message);

  const { count, error: countErr } = await supabase
    .from("log_entry")
    .select("id", { count: "exact", head: true })
    .eq("element_id", element.id);
  if (countErr) throw new Error(countErr.message);
  if ((count ?? 0) < 1) {
    throw new Error("Soft delete eliminó la fila (debería conservarse)");
  }

  const pairBad = await supabase.from("log_entry").insert({
    element_id: element.id,
    author_id: authorId,
    content: "Solo before",
    status_before: "not_started",
    status_after: null,
  });
  if (!pairBad.error?.message.includes("log_entry_status_pair_check")) {
    throw new Error("CHECK status_pair debería rechazar pares incompletos");
  }

  await supabase.from("log_entry").delete().eq("id", log.id);
  await supabase.from("element").delete().eq("id", element.id);
  await supabase.from("category").delete().eq("id", category.id);
  await supabase.from("project").delete().eq("id", project.id);
  if (tempUserId) {
    await supabase.auth.admin.deleteUser(tempUserId);
  }

  console.log("OK — trigger de estado, soft-delete y última entrada verificados.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
