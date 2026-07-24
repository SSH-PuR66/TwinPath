-- v23: Net-worth snapshots — periodic household balance-sheet points so
-- Home can show net worth over time. Applied live 2026-07-24 (seeded with
-- the first snapshot: Fidelity Roth $70.55 investments + $0.59 cash).

create table if not exists public.networth_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  as_of date not null,
  cash numeric(14,2) not null default 0,
  investments numeric(14,2) not null default 0,
  other_assets numeric(14,2) not null default 0,
  liabilities numeric(14,2) not null default 0,
  net numeric(14,2) generated always as (cash + investments + other_assets - liabilities) stored,
  source text not null default 'manual' check (source in ('manual','csv','plaid','agent')),
  created_at timestamptz not null default now(),
  unique (household_id, as_of)
);

alter table public.networth_snapshots enable row level security;
revoke all on public.networth_snapshots from public, anon, authenticated;
grant select on public.networth_snapshots to authenticated;

drop policy if exists "Members read networth" on public.networth_snapshots;
create policy "Members read networth"
  on public.networth_snapshots for select
  to authenticated
  using (public.is_household_member(household_id, (select auth.uid())));
