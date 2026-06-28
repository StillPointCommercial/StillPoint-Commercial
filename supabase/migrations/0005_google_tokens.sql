-- Stores each user's Google OAuth refresh token so server routes can call the
-- Sheets/Drive API on their behalf (Business Case Model import/export).
create table if not exists public.google_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.google_tokens enable row level security;

-- A user may read/write only their own token row; the owner may read (for support).
drop policy if exists google_tokens_self on public.google_tokens;
create policy google_tokens_self on public.google_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists google_tokens_owner_read on public.google_tokens;
create policy google_tokens_owner_read on public.google_tokens
  for select to authenticated using (public.is_owner());

grant select, insert, update, delete on public.google_tokens to authenticated, service_role;
