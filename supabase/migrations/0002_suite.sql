-- Suite foundation: profiles, allowlist, tools, per-user tile access, BCM datasets/scenarios.
-- Additive only. Does NOT touch the existing CRM tables (contacts, opportunities, offers, etc.).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  org text,
  role text not null default 'client' check (role in ('client','owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.allowed_emails (
  email text primary key,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  slug text primary key,
  name text not null,
  description text,
  icon text,
  enabled boolean not null default true,
  sort_order int not null default 0,
  default_for_new_users boolean not null default false
);

create table if not exists public.tool_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_slug text not null references public.tools(slug) on delete cascade,
  enabled boolean not null default true,
  primary key (user_id, tool_slug)
);

create table if not exists public.bcm_datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  source_filename text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bcm_scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  dataset_id uuid references public.bcm_datasets(id) on delete cascade,
  name text not null,
  params jsonb not null,
  is_baseline boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so RLS policies do not recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.has_tool(slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner() or exists(
    select 1 from public.tool_access ta
    where ta.user_id = auth.uid() and ta.tool_slug = slug and ta.enabled
  );
$$;

-- Provision an allowlisted user on signup: create profile + default tile grants.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    insert into public.profiles (id, email, role)
    values (
      new.id,
      new.email,
      case when lower(new.email) = 'wouter.dirks@stillpointcommercial.com' then 'owner' else 'client' end
    )
    on conflict (id) do nothing;

    insert into public.tool_access (user_id, tool_slug, enabled)
    select new.id, t.slug, true from public.tools t where t.default_for_new_users
    on conflict (user_id, tool_slug) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.tools         enable row level security;
alter table public.tool_access   enable row level security;
alter table public.bcm_datasets  enable row level security;
alter table public.bcm_scenarios enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_owner());
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- allowed_emails (owner only)
drop policy if exists allowed_emails_owner on public.allowed_emails;
create policy allowed_emails_owner on public.allowed_emails
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- tools (everyone authenticated reads; owner writes)
drop policy if exists tools_select on public.tools;
create policy tools_select on public.tools
  for select to authenticated using (true);
drop policy if exists tools_owner_write on public.tools;
create policy tools_owner_write on public.tools
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- tool_access (self read or owner; owner writes)
drop policy if exists tool_access_select on public.tool_access;
create policy tool_access_select on public.tool_access
  for select to authenticated using (user_id = auth.uid() or public.is_owner());
drop policy if exists tool_access_owner_write on public.tool_access;
create policy tool_access_owner_write on public.tool_access
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- bcm_datasets (owner of row or platform owner reads; only row owner writes)
drop policy if exists bcm_datasets_select on public.bcm_datasets;
create policy bcm_datasets_select on public.bcm_datasets
  for select to authenticated using (owner_id = auth.uid() or public.is_owner());
drop policy if exists bcm_datasets_insert on public.bcm_datasets;
create policy bcm_datasets_insert on public.bcm_datasets
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists bcm_datasets_update on public.bcm_datasets;
create policy bcm_datasets_update on public.bcm_datasets
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists bcm_datasets_delete on public.bcm_datasets;
create policy bcm_datasets_delete on public.bcm_datasets
  for delete to authenticated using (owner_id = auth.uid());

-- bcm_scenarios
drop policy if exists bcm_scenarios_select on public.bcm_scenarios;
create policy bcm_scenarios_select on public.bcm_scenarios
  for select to authenticated using (owner_id = auth.uid() or public.is_owner());
drop policy if exists bcm_scenarios_insert on public.bcm_scenarios;
create policy bcm_scenarios_insert on public.bcm_scenarios
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists bcm_scenarios_update on public.bcm_scenarios;
create policy bcm_scenarios_update on public.bcm_scenarios
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists bcm_scenarios_delete on public.bcm_scenarios;
create policy bcm_scenarios_delete on public.bcm_scenarios
  for delete to authenticated using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants (required for the Data API per the post-Oct-2026 rule)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.profiles       to authenticated, service_role;
grant select, insert, update, delete on public.allowed_emails to authenticated, service_role;
grant select, insert, update, delete on public.tools          to authenticated, service_role;
grant select, insert, update, delete on public.tool_access    to authenticated, service_role;
grant select, insert, update, delete on public.bcm_datasets   to authenticated, service_role;
grant select, insert, update, delete on public.bcm_scenarios  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------
insert into public.allowed_emails (email) values ('wouter.dirks@stillpointcommercial.com')
  on conflict (email) do nothing;

-- Link the owner profile to the existing auth user (if present).
insert into public.profiles (id, email, display_name, org, role)
select u.id, u.email, 'Wouter Dirks', 'StillPoint', 'owner'
from auth.users u
where lower(u.email) = 'wouter.dirks@stillpointcommercial.com'
on conflict (id) do update set role = 'owner', org = 'StillPoint';

insert into public.tools (slug, name, description, icon, enabled, sort_order, default_for_new_users) values
  ('cis','Commercial Intelligence System','CRM, contacts, pipeline, offers and year plan','layout-grid', true, 1, true),
  ('business-case-model','Business Case Model','Revenue scenarios, back-calculated funnel and margin modelling to 2030','bar-chart-3', true, 2, false)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  enabled = excluded.enabled, sort_order = excluded.sort_order, default_for_new_users = excluded.default_for_new_users;

-- Grant every tool to the owner.
insert into public.tool_access (user_id, tool_slug, enabled)
select p.id, t.slug, true
from public.profiles p cross join public.tools t
where p.role = 'owner'
on conflict (user_id, tool_slug) do update set enabled = true;
