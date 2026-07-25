-- v24: Manual retirement contribution tracker. No account numbers, provider
-- credentials, market data, or money-movement fields are stored here.

create table if not exists public.retirement_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 80),
  institution text check (institution is null or char_length(institution) <= 120),
  account_type text not null check (
    account_type in ('roth_ira', 'traditional_ira', 'custodial_roth_ira', 'other')
  ),
  tax_year integer not null check (tax_year between 2000 and 2100),
  current_value numeric(12, 2) not null default 0 check (current_value >= 0),
  contributions_ytd numeric(12, 2) not null default 0 check (contributions_ytd >= 0),
  earned_income_ytd numeric(12, 2) not null default 0 check (earned_income_ytd >= 0),
  visibility text not null default 'household'
    check (visibility in ('household', 'private')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists retirement_accounts_household_id_idx
  on public.retirement_accounts (household_id);

alter table public.retirement_accounts enable row level security;
grant select, insert, update, delete on public.retirement_accounts to authenticated;

drop policy if exists "Members read visible retirement accounts" on public.retirement_accounts;
create policy "Members read visible retirement accounts"
  on public.retirement_accounts for select to authenticated
  using (
    public.is_household_member(household_id, (select auth.uid()))
    and (visibility = 'household' or profile_id = (select auth.uid()))
  );

drop policy if exists "Owners create retirement accounts" on public.retirement_accounts;
create policy "Owners create retirement accounts"
  on public.retirement_accounts for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and public.is_household_member(household_id, (select auth.uid()))
  );

drop policy if exists "Owners update retirement accounts" on public.retirement_accounts;
create policy "Owners update retirement accounts"
  on public.retirement_accounts for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (
    profile_id = (select auth.uid())
    and public.is_household_member(household_id, (select auth.uid()))
  );

drop policy if exists "Owners delete retirement accounts" on public.retirement_accounts;
create policy "Owners delete retirement accounts"
  on public.retirement_accounts for delete to authenticated
  using (profile_id = (select auth.uid()));

drop trigger if exists retirement_accounts_set_updated_at on public.retirement_accounts;
create trigger retirement_accounts_set_updated_at
before update on public.retirement_accounts
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
