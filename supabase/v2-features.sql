begin;

create table if not exists public.twin_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  label text not null check (label in ('Twin A', 'Twin B')),
  nickname text check (
    nickname is null or char_length(nickname) <= 60
  ),
  clinician_due_date date,
  notes text check (
    notes is null or char_length(notes) <= 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, label)
);

create table if not exists public.growth_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  twin_profile_id uuid
    references public.twin_profiles(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  measured_on date not null,
  gestational_weeks integer check (
    gestational_weeks is null
    or gestational_weeks between 1 and 45
  ),
  gestational_days integer check (
    gestational_days is null
    or gestational_days between 0 and 6
  ),
  length_cm numeric(6, 2) check (
    length_cm is null or length_cm > 0
  ),
  weight_g numeric(8, 2) check (
    weight_g is null or weight_g > 0
  ),
  comparison text check (
    comparison is null or char_length(comparison) <= 80
  ),
  source text not null default 'Entered manually'
    check (char_length(source) <= 120),
  notes text check (
    notes is null or char_length(notes) <= 1000
  ),
  created_at timestamptz not null default now()
);

alter table public.twin_profiles enable row level security;
alter table public.growth_entries enable row level security;

create policy "Users read accessible twin profiles"
on public.twin_profiles
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

create policy "Members create their twin profiles"
on public.twin_profiles
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

create policy "Owners update their twin profiles"
on public.twin_profiles
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

create policy "Owners delete their twin profiles"
on public.twin_profiles
for delete
to authenticated
using (owner_user_id = auth.uid());

create policy "Users read accessible growth entries"
on public.growth_entries
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

create policy "Members create growth entries"
on public.growth_entries
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

create policy "Owners update their growth entries"
on public.growth_entries
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

create policy "Owners delete their growth entries"
on public.growth_entries
for delete
to authenticated
using (owner_user_id = auth.uid());

grant select, insert, update, delete
  on public.twin_profiles
  to authenticated;

grant select, insert, update, delete
  on public.growth_entries
  to authenticated;

commit;
