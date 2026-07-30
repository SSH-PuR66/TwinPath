begin;

create table if not exists public.career_actions (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id) on delete cascade,

  owner_user_id uuid not null
    references auth.users(id) on delete cascade,

  visibility public.record_visibility not null default 'private',

  agency text not null
    check (
      agency in (
        'NSA',
        'CIA',
        'FBI',
        'CISA',
        'DoD',
        'DHS',
        'Other'
      )
    ),

  title text not null
    check (char_length(title) between 1 and 180),

  action_type text not null
    check (
      action_type in (
        'Research',
        'Skill',
        'Portfolio',
        'Application',
        'Interview',
        'Scholarship',
        'Networking',
        'Document'
      )
    ),

  status text not null default 'planned'
    check (
      status in (
        'planned',
        'active',
        'submitted',
        'completed',
        'rejected',
        'paused'
      )
    ),

  official_url text
    check (
      official_url is null
      or char_length(official_url) <= 1000
    ),

  due_on date,

  notes text
    check (
      notes is null
      or char_length(notes) <= 2000
    ),

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_actions_owner_idx
  on public.career_actions(
    owner_user_id,
    status,
    due_on
  );

alter table public.career_actions enable row level security;

create policy "Users read accessible career actions"
on public.career_actions
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

create policy "Members create career actions"
on public.career_actions
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

create policy "Owners update career actions"
on public.career_actions
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

create policy "Owners delete career actions"
on public.career_actions
for delete
to authenticated
using (owner_user_id = auth.uid());

grant select, insert, update, delete
  on public.career_actions
  to authenticated;

drop trigger if exists career_actions_set_updated_at
  on public.career_actions;

create trigger career_actions_set_updated_at
before update on public.career_actions
for each row
execute function public.set_updated_at();

commit;

notify pgrst, 'reload schema';
