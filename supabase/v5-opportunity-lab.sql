begin;

create table if not exists public.business_experiments (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id) on delete cascade,

  owner_user_id uuid not null
    references auth.users(id) on delete cascade,

  visibility public.record_visibility not null default 'private',

  title text not null
    check (char_length(title) between 1 and 180),

  hypothesis text not null
    check (char_length(hypothesis) between 1 and 3000),

  target_customer text not null
    check (char_length(target_customer) between 1 and 500),

  offer text not null
    check (char_length(offer) between 1 and 2000),

  status text not null default 'proposed'
    check (
      status in (
        'proposed',
        'approved',
        'building',
        'testing',
        'successful',
        'failed',
        'paused',
        'archived'
      )
    ),

  validation_method text
    check (
      validation_method is null
      or char_length(validation_method) <= 2000
    ),

  success_threshold text
    check (
      success_threshold is null
      or char_length(success_threshold) <= 1000
    ),

  stop_rule text
    check (
      stop_rule is null
      or char_length(stop_rule) <= 1000
    ),

  estimated_hours numeric(8, 2) not null default 0
    check (estimated_hours >= 0),

  estimated_cost numeric(10, 2) not null default 0
    check (estimated_cost >= 0 and estimated_cost <= 10),

  actual_cost numeric(10, 2) not null default 0
    check (actual_cost >= 0 and actual_cost <= 10),

  expected_price numeric(10, 2) not null default 0
    check (expected_price >= 0),

  visitors integer not null default 0
    check (visitors >= 0),

  checkout_clicks integer not null default 0
    check (checkout_clicks >= 0),

  completed_sales integer not null default 0
    check (completed_sales >= 0),

  gross_revenue numeric(12, 2) not null default 0
    check (gross_revenue >= 0),

  fees numeric(12, 2) not null default 0
    check (fees >= 0),

  refunds numeric(12, 2) not null default 0
    check (refunds >= 0),

  source_urls jsonb not null default '[]'::jsonb,

  risks jsonb not null default '[]'::jsonb,

  score integer not null default 0
    check (score between 0 and 100),

  review_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spend_proposals (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id) on delete cascade,

  owner_user_id uuid not null
    references auth.users(id) on delete cascade,

  experiment_id uuid
    references public.business_experiments(id) on delete set null,

  visibility public.record_visibility not null default 'private',

  title text not null
    check (char_length(title) between 1 and 180),

  provider text not null
    check (char_length(provider) between 1 and 180),

  official_url text not null
    check (char_length(official_url) between 1 and 1000),

  amount numeric(10, 2) not null
    check (amount > 0 and amount <= 5),

  purpose text not null
    check (char_length(purpose) between 1 and 2000),

  expected_benefit text not null
    check (char_length(expected_benefit) between 1 and 2000),

  free_alternative text
    check (
      free_alternative is null
      or char_length(free_alternative) <= 2000
    ),

  recurring boolean not null default false,

  reversible boolean not null default false,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'purchased',
        'cancelled'
      )
    ),

  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (recurring = false)
);

create index if not exists business_experiments_household_idx
  on public.business_experiments(household_id, created_at desc);

create index if not exists spend_proposals_household_idx
  on public.spend_proposals(household_id, created_at desc);

alter table public.business_experiments enable row level security;
alter table public.spend_proposals enable row level security;

create policy "Users read accessible business experiments"
on public.business_experiments
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

create policy "Members create their business experiments"
on public.business_experiments
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

create policy "Owners update their business experiments"
on public.business_experiments
for update
to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

create policy "Owners delete their business experiments"
on public.business_experiments
for delete
to authenticated
using (owner_user_id = auth.uid());

create policy "Users read accessible spend proposals"
on public.spend_proposals
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

create policy "Members create their spend proposals"
on public.spend_proposals
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(household_id, (select auth.uid()))
  and amount <= 5
  and recurring = false
);

create policy "Owners update their spend proposals"
on public.spend_proposals
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(household_id, (select auth.uid()))
  and amount <= 5
  and recurring = false
);

create policy "Owners delete their spend proposals"
on public.spend_proposals
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

grant select, insert, update, delete
  on public.business_experiments
  to authenticated;

grant select, insert, update, delete
  on public.spend_proposals
  to authenticated;

drop trigger if exists business_experiments_set_updated_at
  on public.business_experiments;

create trigger business_experiments_set_updated_at
before update on public.business_experiments
for each row
execute function public.set_updated_at();

drop trigger if exists spend_proposals_set_updated_at
  on public.spend_proposals;

create trigger spend_proposals_set_updated_at
before update on public.spend_proposals
for each row
execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime
    add table public.business_experiments;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime
    add table public.spend_proposals;
exception
  when duplicate_object then null;
end
$$;

commit;
