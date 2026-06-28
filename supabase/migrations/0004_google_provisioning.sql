-- Domain-aware provisioning. On first sign-in (Google or magic-link), map the
-- email domain to an org via org_domains. Owner stays owner. Unknown domains get
-- no profile, so the /auth/callback denies them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_domain text := lower(split_part(new.email, '@', 2));
  v_org uuid;
  v_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name');
begin
  -- Platform owner
  if lower(new.email) = 'wouter.dirks@stillpointcommercial.com' then
    insert into public.profiles (id, email, display_name, org, role, org_id)
    values (new.id, new.email, 'Wouter Dirks', 'StillPoint', 'owner', null)
    on conflict (id) do update set role = 'owner';
    return new;
  end if;

  -- Client by company domain
  select org_id into v_org from public.org_domains where domain = v_domain;
  if v_org is not null then
    insert into public.profiles (id, email, display_name, role, org_id)
    values (new.id, new.email, v_name, 'client', v_org)
    on conflict (id) do update set org_id = excluded.org_id, display_name = coalesce(public.profiles.display_name, excluded.display_name);
    return new;
  end if;

  -- Explicit invite guest (no company domain): allowed but unassigned to an org
  if exists (select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)) then
    insert into public.profiles (id, email, display_name, role, org_id)
    values (new.id, new.email, v_name, 'client', null)
    on conflict (id) do nothing;
    return new;
  end if;

  -- Otherwise: no profile -> the app denies access.
  return new;
end;
$$;
