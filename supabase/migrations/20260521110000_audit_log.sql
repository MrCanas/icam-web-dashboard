-- Registro de mutaciones del portal. RLS temporal — restringir cuando se active RBAC.

create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  user_email    text,
  action        text not null,
  resource_type text,
  resource_id   text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists audit_log_user_idx on audit_log (user_id, created_at desc);
create index if not exists audit_log_resource_idx on audit_log (resource_type, resource_id);
create index if not exists audit_log_action_idx on audit_log (action, created_at desc);

alter table audit_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_log' and policyname = 'temp_allow_all_audit'
  ) then
    create policy temp_allow_all_audit on audit_log
      for all using (true) with check (true);
  end if;
end $$;

comment on table audit_log is 'Registro de mutaciones del portal. RLS temporal — restringir cuando se active RBAC.';
