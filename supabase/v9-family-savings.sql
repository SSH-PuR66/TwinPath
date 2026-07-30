begin;

create table if not exists public.family_savings_routes (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id) on delete cascade,

  owner_user_id uuid not null
    references auth.users(id) on delete cascade,

  visibility public.record_visibility not null default 'shared',

  title text not null
    check (char_length(title) between 1 and 180),

  category text not null
    check (
      category in (
        'Healthcare',
        'Food',
        'Childcare',
        'Housing',
        'Utilities',
        'Transportation',
        'Education',
        'Taxes',
        'Family support',
        'Other'
      )
    ),

  status text not null default 'researching'
    check (
      status in (
        'researching',
        'potential',
        'applying',
        'submitted',
        'documents-requested',
        'approved',
        'denied',
        'renewal-due',
        'closed'
      )
    ),

  official_url text
    check (
      official_url is null
      or char_length(official_url) <= 1000
    ),

  phone text
    check (
      phone is null
      or char_length(phone) <= 40
    ),

  confirmation_number text
    check (
      confirmation_number is null
      or char_length(confirmation_number) <= 120
    ),

  approved_monthly_value numeric(12, 2) not null default 0
    check (approved_monthly_value >= 0),

  approved_one_time_value numeric(12, 2) not null default 0
    check (approved_one_time_value >= 0),

  applied_on date,
  decision_on date,
  renewal_on date,
  next_action_on date,

  next_action text
    check (
      next_action is null
      or char_length(next_action) <= 1000
    ),

  reporting_obligations text
    check (
      reporting_obligations is null
      or char_length(reporting_obligations) <= 2000
    ),

  documents_requested text[]
    not null default array[]::text[],

  notes text
    check (
      notes is null
      or char_length(notes) <= 3000
    ),

  last_verified_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_savings_household_idx
  on public.family_savings_routes(
    household_id,
    status,
    next_action_on
  );

alter table public.family_savings_routes
  enable row level security;

drop policy if exists "Users read accessible savings routes"
  on public.family_savings_routes;

create policy "Users read accessible savings routes"
on public.family_savings_routes
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members create savings routes"
  on public.family_savings_routes;

create policy "Members create savings routes"
on public.family_savings_routes
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

drop policy if exists "Owners update savings routes"
  on public.family_savings_routes;

create policy "Owners update savings routes"
on public.family_savings_routes
for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

drop policy if exists "Owners delete savings routes"
  on public.family_savings_routes;

create policy "Owners delete savings routes"
on public.family_savings_routes
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

grant select, insert, update, delete
  on public.family_savings_routes
  to authenticated;

drop trigger if exists family_savings_routes_set_updated_at
  on public.family_savings_routes;

create trigger family_savings_routes_set_updated_at
before update on public.family_savings_routes
for each row
execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime
    add table public.family_savings_routes;
exception
  when duplicate_object then null;
end
$$;

commit;

notify pgrst, 'reload schema';
