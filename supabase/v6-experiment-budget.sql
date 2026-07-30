begin;

create table if not exists public.experiment_budgets (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id) on delete cascade,

  owner_user_id uuid not null
    references auth.users(id) on delete cascade,

  visibility public.record_visibility not null default 'private',

  name text not null default 'AI experiment budget'
    check (char_length(name) between 1 and 80),

  limit_amount numeric(10, 2) not null default 15
    check (
      limit_amount >= 0
      and limit_amount <= 25
    ),

  notes text
    check (
      notes is null
      or char_length(notes) <= 1000
    ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (household_id, owner_user_id)
);

create index if not exists experiment_budgets_household_idx
  on public.experiment_budgets(
    household_id,
    owner_user_id
  );

alter table public.experiment_budgets
  enable row level security;

create policy "Users read their experiment budgets"
on public.experiment_budgets
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
);

create policy "Members create their experiment budgets"
on public.experiment_budgets
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
);

create policy "Owners update their experiment budgets"
on public.experiment_budgets
for update
to authenticated
using (
  owner_user_id = (select auth.uid())
)
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
);

create policy "Owners delete their experiment budgets"
on public.experiment_budgets
for delete
to authenticated
using (
  owner_user_id = (select auth.uid())
);

grant select, insert, update, delete
  on public.experiment_budgets
  to authenticated;

drop trigger if exists experiment_budgets_set_updated_at
  on public.experiment_budgets;

create trigger experiment_budgets_set_updated_at
before update on public.experiment_budgets
for each row
execute function public.set_updated_at();

commit;
