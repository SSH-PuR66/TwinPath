begin;

create extension if not exists pgcrypto;

-- =========================================================
-- TYPES
-- =========================================================

do $$
begin
  create type public.record_visibility as enum ('private', 'shared');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.household_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end
$$;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 50),
  invite_code text not null unique
    check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null
    references public.households(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  title text not null check (char_length(title) between 1 and 180),
  category text check (category is null or char_length(category) <= 50),
  priority text not null default 'medium'
    check (priority in ('urgent', 'high', 'medium', 'low')),
  due_date date,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  title text not null check (char_length(title) between 1 and 180),
  starts_at timestamptz not null,
  location text check (location is null or char_length(location) <= 180),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category text check (category is null or char_length(category) <= 60),
  description text check (
    description is null or char_length(description) <= 180
  ),
  transaction_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_opportunities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'shared',
  title text not null check (char_length(title) between 1 and 180),
  organization text check (
    organization
    is null or char_length(organization) <= 180
  ),
  status text not null default 'Idea'
    check (
      status in (
        'Idea',
        'Applied',
        'Interviewing',
        'Active',
        'Paid',
        'Archived'
      )
    ),
  estimated_monthly numeric(12, 2) not null default 0
    check (estimated_monthly >= 0),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  file_name text not null
    check (char_length(file_name) between 1 and 255),
  storage_path text not null unique
    check (char_length(storage_path) between 1 and 1000),
  file_size bigint not null
    check (file_size > 0 and file_size <= 10485760),
  mime_type text check (
    mime_type is null or char_length(mime_type) <= 180
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists household_members_user_id_idx
  on public.household_members(user_id);

create index if not exists household_members_household_id_idx
  on public.household_members(household_id);

create index if not exists tasks_household_id_idx
  on public.tasks(household_id);

create index if not exists tasks_owner_user_id_idx
  on public.tasks(owner_user_id);

create index if not exists tasks_due_date_idx
  on public.tasks(due_date);

create index if not exists appointments_household_id_idx
  on public.appointments(household_id);

create index if not exists appointments_owner_user_id_idx
  on public.appointments(owner_user_id);

create index if not exists appointments_starts_at_idx
  on public.appointments(starts_at);

create index if not exists transactions_household_id_idx
  on public.transactions(household_id);

create index if not exists transactions_owner_user_id_idx
  on public.transactions(owner_user_id);

create index if not exists transactions_date_idx
  on public.transactions(transaction_date desc);

create index if not exists income_opportunities_household_id_idx
  on public.income_opportunities(household_id);

create index if not exists income_opportunities_owner_user_id_idx
  on public.income_opportunities(owner_user_id);

create index if not exists documents_household_id_idx
  on public.documents(household_id);

create index if not exists documents_owner_user_id_idx
  on public.documents(owner_user_id);

create index if not exists documents_storage_path_idx
  on public.documents(storage_path);

-- =========================================================
-- SHARED UTILITY FUNCTIONS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_record_reassignment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'The household for an existing record cannot be changed.';
  end if;

  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'The owner of an existing record cannot be changed.';
  end if;

  return new;
end;
$$;

create or replace function public.is_household_member(
  requested_household_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = requested_household_id
      and hm.user_id = requested_user_id
  );
$$;

create or replace function public.is_household_owner(
  requested_household_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = requested_household_id
      and hm.user_id = requested_user_id
      and hm.role = 'owner'
  );
$$;

create or replace function public.can_access_record(
  requested_household_id uuid,
  requested_owner_user_id uuid,
  requested_visibility public.record_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      requested_owner_user_id = auth.uid()
      or (
        requested_visibility = 'shared'
        and public.is_household_member(
          requested_household_id,
          auth.uid()
        )
      )
    );
$$;

-- Storage access checks use document metadata instead of trusting a filename.
create or replace function public.can_access_document_path(
  requested_path text
)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
    from public.documents d
    where d.storage_path = requested_path
      and public.can_access_record(
        d.household_id,
        d.owner_user_id,
        d.visibility
      )
  );
$$;

-- Allows the frontend to upload a file before inserting its metadata row.
-- The expected path is:
-- household_id/user_id/randomized-file-name
create or replace function public.can_upload_document_path(
  requested_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  path_parts text[];
  path_household_id uuid;
  path_owner_id uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  path_parts := string_to_array(requested_path, '/');

  if array_length(path_parts, 1) < 3 then
    return false;
  end if;

  begin
    path_household_id := path_parts[1]::uuid;
    path_owner_id := path_parts[2]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return
    path_owner_id = auth.uid()
    and public.is_household_member(
      path_household_id,
      auth.uid()
    );
end;
$$;

-- =========================================================
-- PROFILE CREATION
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    display_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, 'Member'), '@', 1)
    )
  )
  on conflict (id) do update
    set
      email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert or update of email on auth.users
for each row
execute function public.handle_new_user();

-- Backfill profiles for users who existed before this SQL was run.
insert into public.profiles (
  id,
  email,
  display_name
)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(u.email, 'Member'), '@', 1)
  )
from auth.users u
on conflict (id) do update
set
  email = excluded.email,
  updated_at = now();

-- =========================================================
-- HOUSEHOLD FUNCTIONS
-- =========================================================

create or replace function public.generate_household_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  generated_code text := '';
  character_index integer;
begin
  for character_index in 1..8 loop
    generated_code :=
      generated_code ||
      substr(
        alphabet,
        floor(random() * length(alphabet) + 1)::integer,
        1
      );
  end loop;

  return generated_code;
end;
$$;

create or replace function public.create_household(
  household_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_household_id uuid;
  new_invite_code text;
  normalized_name text;
  attempt_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if exists (
    select 1
    from public.household_members hm
    where hm.user_id = current_user_id
  ) then
    raise exception 'This account already belongs to a household.';
  end if;

  normalized_name := trim(coalesce(household_name, ''));

  if char_length(normalized_name) < 1
     or char_length(normalized_name) > 50 then
    raise exception 'Household name must contain 1 to 50 characters.';
  end if;

  loop
    attempt_count := attempt_count + 1;
    new_invite_code := public.generate_household_invite_code();

    exit when not exists (
      select 1
      from public.households h
      where h.invite_code = new_invite_code
    );

    if attempt_count >= 20 then
      raise exception 'Could not generate a unique invitation code.';
    end if;
  end loop;

  insert into public.households (
    name,
    invite_code,
    created_by
  )
  values (
    normalized_name,
    new_invite_code,
    current_user_id
  )
  returning id into new_household_id;

  insert into public.household_members (
    household_id,
    user_id,
    role
  )
  values (
    new_household_id,
    current_user_id,
    'owner'
  );

  return new_household_id;
end;
$$;

create or replace function public.join_household(
  join_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_household_id uuid;
  normalized_code text;
  existing_member_count integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in.';
  end if;

  if exists (
    select 1
    from public.household_members hm
    where hm.user_id = current_user_id
  ) then
    raise exception 'This account already belongs to a household.';
  end if;

  normalized_code := upper(trim(coalesce(join_code, '')));

  if normalized_code !~ '^[A-Z0-9]{8}$' then
    raise exception 'Enter a valid eight-character invitation code.';
  end if;

  select h.id
  into selected_household_id
  from public.households h
  where h.invite_code = normalized_code
  for update;

  if selected_household_id is null then
    raise exception 'Invitation code not found.';
  end if;

  select count(*)
  into existing_member_count
  from public.household_members hm
  where hm.household_id = selected_household_id;

  if existing_member_count >= 2 then
    raise exception 'This household already has two members.';
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    role
  )
  values (
    selected_household_id,
    current_user_id,
    'member'
  );

  return selected_household_id;
end;
$$;

create or replace function public.rotate_household_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  selected_household_id uuid;
  new_invite_code text;
  attempt_count integer := 0;
begin
  select hm.household_id
  into selected_household_id
  from public.household_members hm
  where hm.user_id = current_user_id
    and hm.role = 'owner';

  if selected_household_id is null then
    raise exception 'Only the household owner can rotate the code.';
  end if;

  loop
    attempt_count := attempt_count + 1;
    new_invite_code := public.generate_household_invite_code();

    exit when not exists (
      select 1
      from public.households h
      where h.invite_code = new_invite_code
    );

    if attempt_count >= 20 then
      raise exception 'Could not generate a unique invitation code.';
    end if;
  end loop;

  update public.households
  set
    invite_code = new_invite_code,
    updated_at = now()
  where id = selected_household_id;

  return new_invite_code;
end;
$$;

-- Do not allow anonymous/public execution of privileged RPCs.
revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
revoke all on function public.rotate_household_invite_code() from public;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.rotate_household_invite_code() to authenticated;

-- Utility functions are used by RLS.
revoke all on function public.is_household_member(uuid, uuid) from public;
revoke all on function public.is_household_owner(uuid, uuid) from public;
revoke all on function public.can_access_record(
  uuid,
  uuid,
  public.record_visibility
) from public;
revoke all on function public.can_access_document_path(text) from public;
revoke all on function public.can_upload_document_path(text) from public;

grant execute on function public.is_household_member(uuid, uuid)
  to authenticated;

grant execute on function public.is_household_owner(uuid, uuid)
  to authenticated;

grant execute on function public.can_access_record(
  uuid,
  uuid,
  public.record_visibility
) to authenticated;

grant execute on function public.can_access_document_path(text)
  to authenticated;

grant execute on function public.can_upload_document_path(text)
  to authenticated;

-- =========================================================
-- UPDATED_AT AND IDENTITY-PROTECTION TRIGGERS
-- =========================================================

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists income_opportunities_set_updated_at
  on public.income_opportunities;
create trigger income_opportunities_set_updated_at
before update on public.income_opportunities
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists tasks_prevent_reassignment on public.tasks;
create trigger tasks_prevent_reassignment
before update on public.tasks
for each row execute function public.prevent_record_reassignment();

drop trigger if exists appointments_prevent_reassignment
  on public.appointments;
create trigger appointments_prevent_reassignment
before update on public.appointments
for each row execute function public.prevent_record_reassignment();

drop trigger if exists transactions_prevent_reassignment
  on public.transactions;
create trigger transactions_prevent_reassignment
before update on public.transactions
for each row execute function public.prevent_record_reassignment();

drop trigger if exists income_opportunities_prevent_reassignment
  on public.income_opportunities;
create trigger income_opportunities_prevent_reassignment
before update on public.income_opportunities
for each row execute function public.prevent_record_reassignment();

drop trigger if exists documents_prevent_reassignment on public.documents;
create trigger documents_prevent_reassignment
before update on public.documents
for each row execute function public.prevent_record_reassignment();

-- =========================================================
-- ENABLE ROW-LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.transactions enable row level security;
alter table public.income_opportunities enable row level security;
alter table public.documents enable row level security;

-- =========================================================
-- PROFILE POLICIES
-- =========================================================

drop policy if exists "Users read their own profile"
  on public.profiles;

create policy "Users read their own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users update their own profile"
  on public.profiles;

create policy "Users update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Profile rows are created by the auth trigger.
-- Direct profile deletion is intentionally disabled.

-- =========================================================
-- HOUSEHOLD POLICIES
-- =========================================================

drop policy if exists "Members read their household"
  on public.households;

create policy "Members read their household"
on public.households
for select
to authenticated
using (
  public.is_household_member(id, auth.uid())
);

drop policy if exists "Owners update their household"
  on public.households;

create policy "Owners update their household"
on public.households
for update
to authenticated
using (
  public.is_household_owner(id, auth.uid())
)
with check (
  public.is_household_owner(id, auth.uid())
  and created_by = (
    select h.created_by
    from public.households h
    where h.id = id
  )
);

-- Household creation and joining occur only through secured RPC functions.

-- =========================================================
-- HOUSEHOLD MEMBER POLICIES
-- =========================================================

drop policy if exists "Members read household membership"
  on public.household_members;

create policy "Members read household membership"
on public.household_members
for select
to authenticated
using (
  public.is_household_member(household_id, auth.uid())
);

-- Direct inserts, updates and deletes are disabled.
-- Membership is managed through secured functions.

-- =========================================================
-- TASK POLICIES
-- =========================================================

drop policy if exists "Users read accessible tasks"
  on public.tasks;

create policy "Users read accessible tasks"
on public.tasks
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members create their own tasks"
  on public.tasks;

create policy "Members create their own tasks"
on public.tasks
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

drop policy if exists "Users update accessible tasks"
  on public.tasks;

create policy "Users update accessible tasks"
on public.tasks
for update
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
)
with check (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Users delete accessible tasks"
  on public.tasks;

create policy "Users delete accessible tasks"
on public.tasks
for delete
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

-- =========================================================
-- APPOINTMENT POLICIES
-- =========================================================

drop policy if exists "Users read accessible appointments"
  on public.appointments;

create policy "Users read accessible appointments"
on public.appointments
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members create their own appointments"
  on public.appointments;

create policy "Members create their own appointments"
on public.appointments
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

drop policy if exists "Users update accessible appointments"
  on public.appointments;

create policy "Users update accessible appointments"
on public.appointments
for update
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
)
with check (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Users delete accessible appointments"
  on public.appointments;

create policy "Users delete accessible appointments"
on public.appointments
for delete
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

-- =========================================================
-- TRANSACTION POLICIES
-- =========================================================

drop policy if exists "Users read accessible transactions"
  on public.transactions;

create policy "Users read accessible transactions"
on public.transactions
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members create their own transactions"
  on public.transactions;

create policy "Members create their own transactions"
on public.transactions
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

drop policy if exists "Users update accessible transactions"
  on public.transactions;

create policy "Users update accessible transactions"
on public.transactions
for update
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
)
with check (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Users delete accessible transactions"
  on public.transactions;

create policy "Users delete accessible transactions"
on public.transactions
for delete
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

-- =========================================================
-- INCOME OPPORTUNITY POLICIES
-- =========================================================

drop policy if exists "Users read accessible income opportunities"
  on public.income_opportunities;

create policy "Users read accessible income opportunities"
on public.income_opportunities
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members create their own income opportunities"
  on public.income_opportunities;

create policy "Members create their own income opportunities"
on public.income_opportunities
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

drop policy if exists "Users update accessible income opportunities"
  on public.income_opportunities;

create policy "Users update accessible income opportunities"
on public.income_opportunities
for update
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
)
with check (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Users delete accessible income opportunities"
  on public.income_opportunities;

create policy "Users delete accessible income opportunities"
on public.income_opportunities
for delete
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

-- =========================================================
-- DOCUMENT METADATA POLICIES
-- =========================================================

drop policy if exists "Users read accessible documents"
  on public.documents;

create policy "Users read accessible documents"
on public.documents
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members create their own document metadata"
  on public.documents;

create policy "Members create their own document metadata"
on public.documents
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and public.can_upload_document_path(storage_path)
);

drop policy if exists "Users update accessible document metadata"
  on public.documents;

create policy "Users update accessible document metadata"
on public.documents
for update
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
)
with check (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Users delete accessible document metadata"
  on public.documents;

create policy "Users delete accessible document metadata"
on public.documents
for delete
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

-- =========================================================
-- TABLE GRANTS
-- =========================================================

grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;

grant select, insert, update, delete
  on public.tasks
  to authenticated;

grant select, insert, update, delete
  on public.appointments
  to authenticated;

grant select, insert, update, delete
  on public.transactions
  to authenticated;

grant select, insert, update, delete
  on public.income_opportunities
  to authenticated;

grant select, insert, update, delete
  on public.documents
  to authenticated;

-- =========================================================
-- PRIVATE STORAGE BUCKET
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'vault',
  'vault',
  false,
  10485760
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760;

drop policy if exists "Authenticated users upload vault files"
  on storage.objects;

create policy "Authenticated users upload vault files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vault'
  and public.can_upload_document_path(name)
);

drop policy if exists "Users read accessible vault files"
  on storage.objects;

create policy "Users read accessible vault files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'vault'
  and public.can_access_document_path(name)
);

drop policy if exists "Users delete accessible vault files"
  on storage.objects;

create policy "Users delete accessible vault files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vault'
  and public.can_access_document_path(name)
);

-- File replacement is intentionally disabled.
-- Upload a new file and delete the old one instead.

-- =========================================================
-- REALTIME
-- =========================================================

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime
    add table public.appointments;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime
    add table public.transactions;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime
    add table public.income_opportunities;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime
    add table public.documents;
exception
  when duplicate_object then null;
end
$$;

commit;
