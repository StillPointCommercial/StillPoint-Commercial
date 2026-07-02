-- Security-advisor hardening (2026-07-02). Applied via Supabase MCP as
-- migration "function_hardening"; this file mirrors it for the repo history.
-- 1) handle_new_user is a trigger on auth.users; it must not be callable via
--    /rest/v1/rpc. Trigger firing does not require EXECUTE for the DML role,
--    so revoking from the API roles is safe.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) RLS helper functions: policies all run as authenticated (verified in
--    pg_policies), and the app calls has_tool() from signed-in sessions only.
--    Drop the default PUBLIC grant, keep authenticated + service_role.
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated, service_role;

revoke execute on function public.user_org() from public, anon;
grant execute on function public.user_org() to authenticated, service_role;

revoke execute on function public.has_tool(text) from public, anon;
grant execute on function public.has_tool(text) to authenticated, service_role;

-- 3) Pin search_path on the two trigger functions flagged as mutable.
--    update_updated_at touches only NEW, so '' is safe.
--    update_last_contact_date updates public.contacts UNQUALIFIED, so pin to
--    'public' (pinning to '' would break the trigger).
alter function public.update_updated_at() set search_path = '';
alter function public.update_last_contact_date() set search_path = 'public';
