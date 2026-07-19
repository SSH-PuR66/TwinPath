begin;

create table if not exists public.account_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  account_name text not null
    check (char_length(account_name) between 1 and 80),
  account_type text not null
    check (
      account_type in (
        'Cash',
        'Checking',
        'Savings',
        'PayPal',
        'Chime',
        'Investment',
        'Other'
      )
    ),
  balance numeric(12, 2) not null,
  captured_at timestamptz not null default now(),
  note text check (
    note is null or char_length(note) <= 500
  ),
  created_at timestamptz not null default now()
);

create index if not exists account_snapshots_household_idx
  on public.account_snapshots(
    household_id,
    captured_at desc
  );

alter table public.account_snapshots
  enable row level security;

create policy "Users read accessible account snapshots"
on public.account_snapshots
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

create policy "Members create account snapshots"
on public.account_snapshots
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

create policy "Owners update account snapshots"
on public.account_snapshots
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

create policy "Owners delete account snapshots"
on public.account_snapshots
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

grant select, insert, update, delete
  on public.account_snapshots
  to authenticated;

do $$
begin
  alter publication supabase_realtime
    add table public.account_snapshots;
exception
  when duplicate_object then null;
end
$$;

commit;
