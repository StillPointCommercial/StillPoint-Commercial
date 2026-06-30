-- Workbook (live Google Sheet) scenarios. Each row is a saved set of revenue
-- inputs linked to its own Google Sheet copy, so a user can iterate Laag / Midden /
-- Hoog (and any custom) scenarios and share each as a sheet in the same format.
-- Org-scoped, mirroring bcm_scenarios. New public table -> explicit GRANTs + RLS.

create table if not exists public.bcm_workbook_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id),
  created_by uuid references public.profiles(id),
  name text not null,
  source_id text,            -- the shared source sheet id (to make fresh copies)
  copy_id text,              -- this scenario's own Google Sheet copy
  copy_url text,
  mapping_id text not null default 'adapta-v12',
  inputs jsonb not null,     -- WorkbookInputs
  blocks jsonb,              -- snapshot of read-only cost/people blocks for instant render
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bcm_workbook_scenarios enable row level security;

create policy bcm_workbook_scenarios_select on public.bcm_workbook_scenarios
  for select to authenticated using (public.is_owner() or org_id = public.user_org());
create policy bcm_workbook_scenarios_insert on public.bcm_workbook_scenarios
  for insert to authenticated with check (public.is_owner() or (org_id = public.user_org() and created_by = auth.uid()));
create policy bcm_workbook_scenarios_update on public.bcm_workbook_scenarios
  for update to authenticated using (public.is_owner() or org_id = public.user_org()) with check (public.is_owner() or org_id = public.user_org());
create policy bcm_workbook_scenarios_delete on public.bcm_workbook_scenarios
  for delete to authenticated using (public.is_owner() or org_id = public.user_org());

grant select, insert, update, delete on public.bcm_workbook_scenarios to authenticated, service_role;
