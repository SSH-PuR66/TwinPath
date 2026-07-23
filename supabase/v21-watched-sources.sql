-- v21: Site Watcher — monitor chosen public pages for changes; changes
-- surface as agent proposals. Applied live 2026-07-24. Read-only, polite
-- (6h interval, 5 per tick, honest User-Agent, 200KB cap, https only).

create table if not exists public.watched_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  label text not null check (char_length(label) between 3 and 80),
  url text not null check (char_length(url) <= 500 and url ~ '^https://'),
  active boolean not null default true,
  last_hash text,
  last_status integer,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, url)
);

create index if not exists watched_sources_active_idx
  on public.watched_sources (active, last_checked_at);

alter table public.watched_sources enable row level security;
revoke all on public.watched_sources from public, anon, authenticated;
grant select on public.watched_sources to authenticated;

drop policy if exists "Members read household watchers" on public.watched_sources;
create policy "Members read household watchers"
  on public.watched_sources for select
  to authenticated
  using (public.is_household_member(household_id, (select auth.uid())));
