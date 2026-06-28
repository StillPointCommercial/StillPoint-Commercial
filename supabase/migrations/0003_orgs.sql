-- Multi-client orgs model. Additive ALTERs; no data dropped except the duplicate
-- auto-seeded Adapta dataset (the BCM first-visit seed ran twice).

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_domains (
  org_id uuid not null references public.orgs(id) on delete cascade,
  domain text unique not null,
  primary key (org_id, domain)
);

create table if not exists public.org_tools (
  org_id uuid not null references public.orgs(id) on delete cascade,
  tool_slug text not null references public.tools(slug) on delete cascade,
  enabled boolean not null default true,
  primary key (org_id, tool_slug)
);

alter table public.profiles      add column if not exists org_id uuid references public.orgs(id);
alter table public.bcm_datasets  add column if not exists org_id uuid references public.orgs(id);
alter table public.bcm_datasets  add column if not exists created_by uuid references public.profiles(id);
alter table public.bcm_scenarios add column if not exists org_id uuid references public.orgs(id);
alter table public.bcm_scenarios add column if not exists created_by uuid references public.profiles(id);

-- caller's org (null for the owner)
create or replace function public.user_org()
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- tools are now gated at the org level (owner always allowed)
create or replace function public.has_tool(slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_owner() or exists(
    select 1 from public.org_tools ot
    where ot.org_id = public.user_org() and ot.tool_slug = slug and ot.enabled
  );
$$;

-- RLS on new tables
alter table public.orgs         enable row level security;
alter table public.org_domains  enable row level security;
alter table public.org_tools    enable row level security;

drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs for select to authenticated using (public.is_owner() or id = public.user_org());
drop policy if exists orgs_write on public.orgs;
create policy orgs_write on public.orgs for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists org_domains_select on public.org_domains;
create policy org_domains_select on public.org_domains for select to authenticated using (public.is_owner() or org_id = public.user_org());
drop policy if exists org_domains_write on public.org_domains;
create policy org_domains_write on public.org_domains for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists org_tools_select on public.org_tools;
create policy org_tools_select on public.org_tools for select to authenticated using (public.is_owner() or org_id = public.user_org());
drop policy if exists org_tools_write on public.org_tools;
create policy org_tools_write on public.org_tools for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- profiles: self, owner, or same-org (so created_by names resolve within a team)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_owner() or (org_id is not null and org_id = public.user_org())
);

-- bcm_datasets: org-scoped
drop policy if exists bcm_datasets_select on public.bcm_datasets;
drop policy if exists bcm_datasets_insert on public.bcm_datasets;
drop policy if exists bcm_datasets_update on public.bcm_datasets;
drop policy if exists bcm_datasets_delete on public.bcm_datasets;
create policy bcm_datasets_select on public.bcm_datasets for select to authenticated using (public.is_owner() or org_id = public.user_org());
create policy bcm_datasets_insert on public.bcm_datasets for insert to authenticated with check (public.is_owner() or (org_id = public.user_org() and created_by = auth.uid()));
create policy bcm_datasets_update on public.bcm_datasets for update to authenticated using (public.is_owner() or org_id = public.user_org()) with check (public.is_owner() or org_id = public.user_org());
create policy bcm_datasets_delete on public.bcm_datasets for delete to authenticated using (public.is_owner() or org_id = public.user_org());

-- bcm_scenarios: org-scoped
drop policy if exists bcm_scenarios_select on public.bcm_scenarios;
drop policy if exists bcm_scenarios_insert on public.bcm_scenarios;
drop policy if exists bcm_scenarios_update on public.bcm_scenarios;
drop policy if exists bcm_scenarios_delete on public.bcm_scenarios;
create policy bcm_scenarios_select on public.bcm_scenarios for select to authenticated using (public.is_owner() or org_id = public.user_org());
create policy bcm_scenarios_insert on public.bcm_scenarios for insert to authenticated with check (public.is_owner() or (org_id = public.user_org() and created_by = auth.uid()));
create policy bcm_scenarios_update on public.bcm_scenarios for update to authenticated using (public.is_owner() or org_id = public.user_org()) with check (public.is_owner() or org_id = public.user_org());
create policy bcm_scenarios_delete on public.bcm_scenarios for delete to authenticated using (public.is_owner() or org_id = public.user_org());

grant select, insert, update, delete on public.orgs        to authenticated, service_role;
grant select, insert, update, delete on public.org_domains to authenticated, service_role;
grant select, insert, update, delete on public.org_tools   to authenticated, service_role;

-- ---- Seed the Adapta client org ----
insert into public.orgs (name, slug) values ('Adapta', 'adapta')
on conflict (slug) do nothing;

insert into public.org_domains (org_id, domain)
select id, 'adapta.nl' from public.orgs where slug = 'adapta'
on conflict (domain) do nothing;

insert into public.org_tools (org_id, tool_slug, enabled)
select o.id, 'business-case-model', true from public.orgs o where o.slug = 'adapta'
on conflict (org_id, tool_slug) do update set enabled = true;

-- Dedupe the duplicate auto-seeded Adapta dataset (keep the earliest); scenarios cascade.
delete from public.bcm_datasets d
where d.name = 'Adapta'
  and d.id <> (select id from public.bcm_datasets where name = 'Adapta' order by created_at asc limit 1);

-- Reassign the remaining dataset + scenarios to the Adapta org.
update public.bcm_datasets
  set org_id = (select id from public.orgs where slug = 'adapta'),
      created_by = coalesce(created_by, owner_id)
  where org_id is null;
update public.bcm_scenarios
  set org_id = (select id from public.orgs where slug = 'adapta'),
      created_by = coalesce(created_by, owner_id)
  where org_id is null;
