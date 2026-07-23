begin;

-- Optional Plaid products are intentionally separated from the core
-- Transactions/Accounts stream. A provider can decline either product without
-- breaking the household's read-only balance and transaction sync.

create table if not exists public.plaid_product_sync_status (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  product text not null check (product in ('balances', 'transactions', 'liabilities', 'recurring')),
  status text not null default 'pending'
    check (status in ('pending', 'enabled', 'unavailable', 'error')),
  provider_error_code text check (provider_error_code is null or char_length(provider_error_code) <= 120),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (plaid_item_id, product)
);

create table if not exists public.plaid_liabilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  account_id text not null check (char_length(account_id) between 1 and 500),
  liability_type text not null check (liability_type in ('credit', 'mortgage', 'student', 'other')),
  current_balance numeric(14, 2),
  minimum_payment numeric(14, 2),
  next_payment_due_date date,
  interest_rate numeric(7, 4),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  unique (plaid_item_id, account_id, liability_type)
);

create table if not exists public.plaid_recurring_streams (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  stream_id text not null check (char_length(stream_id) between 1 and 500),
  account_id text check (account_id is null or char_length(account_id) <= 500),
  kind text not null check (kind in ('inflow', 'outflow')),
  description text not null check (char_length(description) between 1 and 500),
  merchant_name text check (merchant_name is null or char_length(merchant_name) <= 180),
  average_amount numeric(14, 2),
  frequency text check (frequency is null or char_length(frequency) <= 60),
  last_date date,
  next_date date,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now(),
  unique (plaid_item_id, stream_id, kind)
);

create index if not exists plaid_product_sync_status_item_idx
  on public.plaid_product_sync_status(plaid_item_id, product);
create index if not exists plaid_liabilities_household_idx
  on public.plaid_liabilities(household_id, owner_user_id, updated_at desc);
create index if not exists plaid_recurring_streams_household_idx
  on public.plaid_recurring_streams(household_id, owner_user_id, kind, next_date);

create or replace function public.enforce_plaid_product_child_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_item public.plaid_items;
begin
  select * into selected_item from public.plaid_items where id = new.plaid_item_id;
  if selected_item.id is null
     or selected_item.household_id <> new.household_id
     or selected_item.owner_user_id <> new.owner_user_id then
    raise exception 'Plaid product record must match its item household and owner.';
  end if;
  if tg_op = 'UPDATE' and (
    new.household_id is distinct from old.household_id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.plaid_item_id is distinct from old.plaid_item_id
  ) then
    raise exception 'Plaid product record ownership is immutable.';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['plaid_product_sync_status', 'plaid_liabilities', 'plaid_recurring_streams'] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_integrity', table_name);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.enforce_plaid_product_child_integrity()', table_name || '_integrity', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

revoke all on public.plaid_product_sync_status, public.plaid_liabilities,
  public.plaid_recurring_streams from public, anon, authenticated;
revoke all on function public.enforce_plaid_product_child_integrity()
  from public, anon, authenticated;
grant select, insert, update, delete on public.plaid_product_sync_status,
  public.plaid_liabilities, public.plaid_recurring_streams to service_role;

commit;
notify pgrst, 'reload schema';
