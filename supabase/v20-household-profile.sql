-- v20: Household profile vault for form autofill. Applied live 2026-07-23.
-- Deliberately excludes sensitive identifiers: the Worker rejects keys
-- resembling SSN/passport/license/bank numbers before anything is stored.

create table if not exists public.household_profiles (
  household_id uuid primary key references public.households(id) on delete restrict,
  profile jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint household_profiles_bounded check (pg_column_size(profile) <= 32768)
);

alter table public.household_profiles enable row level security;
revoke all on public.household_profiles from public, anon, authenticated;
grant select on public.household_profiles to authenticated;

drop policy if exists "Members read household profile" on public.household_profiles;
create policy "Members read household profile"
  on public.household_profiles for select
  to authenticated
  using (public.is_household_member(household_id, (select auth.uid())));
