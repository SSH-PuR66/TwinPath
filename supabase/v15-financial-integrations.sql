begin;

-- =========================================================
-- FINANCIAL PROVIDER INTEGRATIONS
-- Secrets, cursors, and webhook state are service-role only.
-- Browser clients may read only the deliberately safe account metadata table.
-- Plaid is import-only; this migration creates no payment/transfer primitives.
-- Prerequisites: schema.sql through v13-autonomous-operations.sql
-- (especially public.integration_connections and public.revenue_events).
-- =========================================================

do $$
declare
  missing_objects text[] := '{}'::text[];
begin
  if to_regclass('public.transactions') is null then
    missing_objects := array_append(missing_objects, 'public.transactions');
  end if;

  if to_regclass('public.integration_connections') is null then
    missing_objects := array_append(
      missing_objects,
      'public.integration_connections'
    );
  end if;

  if to_regclass('public.revenue_events') is null then
    missing_objects := array_append(missing_objects, 'public.revenue_events');
  end if;

  if to_regclass('public.households') is null then
    missing_objects := array_append(missing_objects, 'public.households');
  end if;

  if to_regclass('public.household_members') is null then
    missing_objects := array_append(
      missing_objects,
      'public.household_members'
    );
  end if;

  if array_length(missing_objects, 1) is not null then
    raise exception
      'v15 prerequisite check failed. Missing objects: %. Apply supabase/v13-autonomous-operations.sql first.',
      array_to_string(missing_objects, ', ');
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  ) then
    raise exception
      'v15 prerequisite check failed: public.set_updated_at() is missing';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'prevent_record_reassignment'
  ) then
    raise exception
      'v15 prerequisite check failed: public.prevent_record_reassignment() is missing';
  end if;
end
$$;

alter table public.transactions
  add column if not exists external_source text,
  add column if not exists external_id text;

do $$
begin
  alter table public.transactions
    add constraint transactions_external_identity_complete
    check (
      (external_source is null and external_id is null)
      or (
        external_source is not null
        and external_id is not null
        and char_length(external_source) between 1 and 80
        and external_source ~ '^[a-z0-9][a-z0-9._-]*$'
        and char_length(external_id) between 1 and 500
      )
    );
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists transactions_external_identity_uidx
  on public.transactions(household_id, external_source, external_id)
  where external_source is not null and external_id is not null;

-- Keep the v13 generic integration surface from being used to grant Plaid
-- transfer, payment, ACH-auth, or other write capabilities. Legacy Plaid
-- connections are disabled and stripped of browser-visible credential/config
-- fields before the invariant is installed.
update public.integration_connections ic
set
  enabled = false,
  allowed_actions = array(
    select action
    from unnest(ic.allowed_actions) action
    where action = any(array[
      'plaid.accounts.read',
      'plaid.transactions.read',
      'plaid.balance.read',
      'plaid.identity.read',
      'plaid.investments.read',
      'plaid.liabilities.read'
    ]::text[])
  ),
  credential_reference = null,
  configuration = '{}'::jsonb,
  updated_at = now()
where ic.provider = 'plaid';

do $$
begin
  alter table public.integration_connections
    add constraint integration_connections_plaid_read_only
    check (
      provider <> 'plaid'
      or (
        credential_reference is null
        and configuration = '{}'::jsonb
        and allowed_actions <@ array[
          'plaid.accounts.read',
          'plaid.transactions.read',
          'plaid.balance.read',
          'plaid.identity.read',
          'plaid.investments.read',
          'plaid.liabilities.read'
        ]::text[]
      )
    ) not valid;
exception
  when duplicate_object then null;
end
$$;

alter table public.integration_connections
  validate constraint integration_connections_plaid_read_only;

create table if not exists public.financial_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  provider text not null
    check (provider in ('plaid', 'stripe')),
  credential_kind text not null
    check (
      char_length(credential_kind) between 1 and 80
      and credential_kind ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  ciphertext bytea not null
    check (octet_length(ciphertext) between 16 and 65536),
  iv bytea not null
    check (octet_length(iv) = 12),
  key_version integer not null
    check (key_version > 0),
  access_mode text not null default 'read_only'
    check (access_mode = 'read_only'),
  allowed_products text[] not null default '{}'::text[]
    check (
      cardinality(allowed_products) <= 10
      and array_position(allowed_products, null) is null
      and (
        provider <> 'plaid'
        or allowed_products <@ array[
          'transactions',
          'balance',
          'identity',
          'investments',
          'liabilities'
        ]::text[]
      )
    ),
  enabled boolean not null default true,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, provider, credential_kind)
);

-- This table intentionally contains no provider token, external account id,
-- routing number, account number, or arbitrary JSON metadata.
create table if not exists public.financial_provider_account_metadata (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  credential_id uuid not null
    references public.financial_provider_credentials(id) on delete cascade,
  provider text not null
    check (provider in ('plaid', 'stripe')),
  provider_account_key text not null
    check (provider_account_key ~ '^[0-9a-f]{64}$'),
  display_name text not null
    check (char_length(display_name) between 1 and 180),
  institution_name text
    check (
      institution_name is null
      or char_length(institution_name) between 1 and 180
    ),
  account_type text
    check (
      account_type is null
      or (
        char_length(account_type) between 1 and 60
        and account_type ~ '^[A-Za-z0-9][A-Za-z0-9 _-]*$'
      )
    ),
  account_subtype text
    check (
      account_subtype is null
      or (
        char_length(account_subtype) between 1 and 60
        and account_subtype ~ '^[A-Za-z0-9][A-Za-z0-9 _-]*$'
      )
    ),
  account_mask text
    check (
      account_mask is null
      or (
        char_length(account_mask) between 1 and 4
        and account_mask ~ '^[A-Za-z0-9]+$'
      )
    ),
  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credential_id, provider_account_key)
);

create table if not exists public.financial_provider_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  credential_id uuid not null
    references public.financial_provider_credentials(id) on delete cascade,
  account_metadata_id uuid
    references public.financial_provider_account_metadata(id)
    on delete cascade,
  stream text not null
    check (
      char_length(stream) between 1 and 80
      and stream ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  cursor_value text not null
    check (char_length(cursor_value) between 1 and 4000),
  updated_at timestamptz not null default now(),
  unique nulls not distinct
    (credential_id, account_metadata_id, stream)
);

create table if not exists public.financial_provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  credential_id uuid not null
    references public.financial_provider_credentials(id) on delete restrict,
  provider text not null
    check (provider in ('plaid', 'stripe')),
  provider_event_id text not null
    check (char_length(provider_event_id) between 1 and 500),
  event_type text not null
    check (
      char_length(event_type) between 1 and 160
      and event_type ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    ),
  payload_sha256 text not null
    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  signature_verified boolean not null default false,
  livemode boolean not null default false,
  currency text
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  processing_status text not null default 'received'
    check (
      processing_status in ('received', 'processing', 'processed', 'ignored', 'failed')
    ),
  revenue_event_id uuid
    references public.revenue_events(id) on delete restrict,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
    check (last_error is null or char_length(last_error) <= 4000),
  unique (provider, provider_event_id)
);

create index if not exists financial_credentials_household_idx
  on public.financial_provider_credentials(household_id, provider);
create index if not exists financial_account_metadata_household_idx
  on public.financial_provider_account_metadata(household_id, active);
create index if not exists financial_sync_cursors_credential_idx
  on public.financial_provider_sync_cursors(credential_id);
create index if not exists financial_webhook_events_household_idx
  on public.financial_provider_webhook_events(
    household_id,
    received_at desc
  );
create unique index if not exists financial_webhook_revenue_event_uidx
  on public.financial_provider_webhook_events(revenue_event_id)
  where revenue_event_id is not null;

-- =========================================================
-- INTEGRITY
-- =========================================================

create or replace function public.require_financial_service_role()
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'This operation requires the service role.';
  end if;
end;
$$;

create or replace function public.enforce_financial_integration_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_credential public.financial_provider_credentials;
  selected_account public.financial_provider_account_metadata;
  selected_revenue public.revenue_events;
begin
  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = new.household_id
      and hm.user_id = new.owner_user_id
  ) then
    raise exception 'The financial record owner must belong to its household.';
  end if;

  if tg_table_name <> 'financial_provider_credentials' then
    select *
    into selected_credential
    from public.financial_provider_credentials c
    where c.id = new.credential_id;

    if selected_credential.id is null
       or selected_credential.household_id <> new.household_id
       or selected_credential.owner_user_id <> new.owner_user_id then
      raise exception 'The credential must match the household and owner.';
    end if;

    if tg_table_name in (
      'financial_provider_account_metadata',
      'financial_provider_webhook_events'
    ) then
      if selected_credential.provider <> new.provider then
        raise exception 'The credential must match the provider.';
      end if;
    end if;
  end if;

  if tg_table_name = 'financial_provider_sync_cursors' then
    if new.account_metadata_id is not null then
      select *
      into selected_account
      from public.financial_provider_account_metadata a
      where a.id = new.account_metadata_id;

      if selected_account.id is null
         or selected_account.credential_id <> new.credential_id
         or selected_account.household_id <> new.household_id
         or selected_account.owner_user_id <> new.owner_user_id then
        raise exception 'The sync cursor account must match its credential and owner.';
      end if;
    end if;
  end if;

  if tg_table_name = 'financial_provider_webhook_events' then
    if tg_op = 'UPDATE'
       and (
         new.credential_id is distinct from old.credential_id
         or new.provider is distinct from old.provider
         or new.provider_event_id is distinct from old.provider_event_id
         or new.event_type is distinct from old.event_type
         or new.payload_sha256 is distinct from old.payload_sha256
         or new.signature_verified is distinct from old.signature_verified
         or new.livemode is distinct from old.livemode
         or new.currency is distinct from old.currency
       ) then
      raise exception 'A provider webhook verification envelope is immutable.';
    end if;

    if new.revenue_event_id is not null then
      select *
      into selected_revenue
      from public.revenue_events r
      where r.id = new.revenue_event_id;

      if new.provider <> 'stripe'
         or not new.signature_verified
         or not new.livemode
         or new.currency <> 'USD'
         or selected_revenue.id is null
         or selected_revenue.household_id <> new.household_id
         or selected_revenue.owner_user_id <> new.owner_user_id
         or selected_revenue.source <> 'stripe'
         or selected_revenue.external_event_id <> new.provider_event_id
         or selected_revenue.mode <> 'live'
         or selected_revenue.verification_status <> 'verified'
         or selected_revenue.currency <> 'USD' then
        raise exception 'Posted Stripe revenue must remain live, verified, and USD.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_external_transaction_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and (
       new.external_source is distinct from old.external_source
       or new.external_id is distinct from old.external_id
     ) then
    raise exception 'An external transaction identity is immutable.';
  end if;

  if new.external_source is not null then
    perform public.require_financial_service_role();

    if new.external_source not in ('plaid', 'stripe_revenue') then
      raise exception 'Unsupported external transaction source.';
    end if;
  end if;

  if not exists (
    select 1
    from public.household_members hm
    where hm.household_id = new.household_id
      and hm.user_id = new.owner_user_id
  ) then
    raise exception 'The transaction owner must belong to its household.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_stripe_revenue_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'stripe'
     and new.verification_status = 'verified'
     and (new.mode <> 'live' or new.currency <> 'USD') then
    raise exception 'Verified Stripe revenue must be live and USD.';
  end if;

  if tg_op = 'UPDATE'
     and old.source = 'stripe'
     and old.transaction_id is not null
     and (
       new.source is distinct from old.source
       or new.external_event_id is distinct from old.external_event_id
       or new.mode is distinct from old.mode
       or new.verification_status is distinct from old.verification_status
       or new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.occurred_at is distinct from old.occurred_at
       or new.transaction_id is distinct from old.transaction_id
     ) then
    raise exception 'Posted Stripe revenue verification fields are immutable.';
  end if;

  if new.source = 'stripe'
     and new.transaction_id is not null
     and not exists (
       select 1
       from public.financial_provider_webhook_events w
       where w.revenue_event_id = new.id
         and w.household_id = new.household_id
         and w.owner_user_id = new.owner_user_id
         and w.provider = 'stripe'
         and w.provider_event_id = new.external_event_id
         and w.signature_verified
         and w.livemode
         and w.currency = 'USD'
     ) then
    raise exception 'Posted Stripe revenue requires its verified live USD webhook.';
  end if;

  return new;
end;
$$;

drop trigger if exists financial_credentials_set_updated_at
  on public.financial_provider_credentials;
create trigger financial_credentials_set_updated_at
before update on public.financial_provider_credentials
for each row execute function public.set_updated_at();

drop trigger if exists financial_credentials_integrity
  on public.financial_provider_credentials;
create trigger financial_credentials_integrity
before insert or update on public.financial_provider_credentials
for each row execute function public.enforce_financial_integration_integrity();

drop trigger if exists financial_credentials_prevent_reassignment
  on public.financial_provider_credentials;
create trigger financial_credentials_prevent_reassignment
before update on public.financial_provider_credentials
for each row execute function public.prevent_record_reassignment();

drop trigger if exists financial_account_metadata_set_updated_at
  on public.financial_provider_account_metadata;
create trigger financial_account_metadata_set_updated_at
before update on public.financial_provider_account_metadata
for each row execute function public.set_updated_at();

drop trigger if exists financial_account_metadata_integrity
  on public.financial_provider_account_metadata;
create trigger financial_account_metadata_integrity
before insert or update on public.financial_provider_account_metadata
for each row execute function public.enforce_financial_integration_integrity();

drop trigger if exists financial_account_metadata_prevent_reassignment
  on public.financial_provider_account_metadata;
create trigger financial_account_metadata_prevent_reassignment
before update on public.financial_provider_account_metadata
for each row execute function public.prevent_record_reassignment();

drop trigger if exists financial_sync_cursors_integrity
  on public.financial_provider_sync_cursors;
create trigger financial_sync_cursors_integrity
before insert or update on public.financial_provider_sync_cursors
for each row execute function public.enforce_financial_integration_integrity();

drop trigger if exists financial_sync_cursors_prevent_reassignment
  on public.financial_provider_sync_cursors;
create trigger financial_sync_cursors_prevent_reassignment
before update on public.financial_provider_sync_cursors
for each row execute function public.prevent_record_reassignment();

drop trigger if exists financial_webhook_events_integrity
  on public.financial_provider_webhook_events;
create trigger financial_webhook_events_integrity
before insert or update on public.financial_provider_webhook_events
for each row execute function public.enforce_financial_integration_integrity();

drop trigger if exists financial_webhook_events_prevent_reassignment
  on public.financial_provider_webhook_events;
create trigger financial_webhook_events_prevent_reassignment
before update on public.financial_provider_webhook_events
for each row execute function public.prevent_record_reassignment();

drop trigger if exists transactions_external_integrity
  on public.transactions;
create trigger transactions_external_integrity
before insert or update on public.transactions
for each row execute function public.enforce_external_transaction_integrity();

drop trigger if exists revenue_events_stripe_integrity
  on public.revenue_events;
create trigger revenue_events_stripe_integrity
before insert or update on public.revenue_events
for each row execute function public.enforce_stripe_revenue_integrity();

-- =========================================================
-- SERVICE-ONLY IDEMPOTENT INGESTION RPCS
-- =========================================================

create or replace function public.upsert_provider_webhook_event(
  p_household_id uuid,
  p_owner_user_id uuid,
  p_credential_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_signature_verified boolean,
  p_livemode boolean,
  p_currency text default null
)
returns public.financial_provider_webhook_events
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_event public.financial_provider_webhook_events;
begin
  perform public.require_financial_service_role();

  insert into public.financial_provider_webhook_events (
    household_id,
    owner_user_id,
    credential_id,
    provider,
    provider_event_id,
    event_type,
    payload_sha256,
    signature_verified,
    livemode,
    currency
  )
  values (
    p_household_id,
    p_owner_user_id,
    p_credential_id,
    p_provider,
    p_provider_event_id,
    p_event_type,
    lower(p_payload_sha256),
    p_signature_verified,
    p_livemode,
    upper(p_currency)
  )
  on conflict (provider, provider_event_id)
  do update set provider_event_id = excluded.provider_event_id
  returning * into selected_event;

  if selected_event.household_id <> p_household_id
     or selected_event.owner_user_id <> p_owner_user_id
     or selected_event.credential_id <> p_credential_id
     or selected_event.event_type <> p_event_type
     or selected_event.payload_sha256 <> lower(p_payload_sha256)
     or selected_event.signature_verified <> p_signature_verified
     or selected_event.livemode <> p_livemode
     or selected_event.currency is distinct from upper(p_currency) then
    raise exception 'Conflicting replay for provider webhook event.';
  end if;

  return selected_event;
end;
$$;

create or replace function public.upsert_plaid_transaction(
  p_household_id uuid,
  p_owner_user_id uuid,
  p_external_id text,
  p_kind text,
  p_amount numeric,
  p_transaction_date date,
  p_category text default null,
  p_description text default null,
  p_visibility public.record_visibility default 'private'
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_transaction public.transactions;
begin
  perform public.require_financial_service_role();

  insert into public.transactions (
    household_id,
    owner_user_id,
    visibility,
    kind,
    amount,
    category,
    description,
    transaction_date,
    external_source,
    external_id
  )
  values (
    p_household_id,
    p_owner_user_id,
    p_visibility,
    p_kind,
    p_amount,
    p_category,
    p_description,
    p_transaction_date,
    'plaid',
    p_external_id
  )
  on conflict (household_id, external_source, external_id)
    where external_source is not null and external_id is not null
  do update set
    kind = excluded.kind,
    amount = excluded.amount,
    category = excluded.category,
    description = excluded.description,
    transaction_date = excluded.transaction_date,
    updated_at = now()
  returning * into selected_transaction;

  if selected_transaction.owner_user_id <> p_owner_user_id then
    raise exception 'External transaction identity belongs to another owner.';
  end if;

  return selected_transaction;
end;
$$;

create or replace function public.upsert_stripe_revenue_event(
  p_webhook_event_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_category text default null,
  p_description text default null
)
returns public.revenue_events
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_webhook public.financial_provider_webhook_events;
  selected_revenue public.revenue_events;
begin
  perform public.require_financial_service_role();

  select *
  into selected_webhook
  from public.financial_provider_webhook_events w
  where w.id = p_webhook_event_id
  for update;

  if not found then
    raise exception 'Provider webhook event not found.';
  end if;

  if selected_webhook.provider <> 'stripe'
     or not selected_webhook.signature_verified
     or not selected_webhook.livemode
     or selected_webhook.currency <> 'USD' then
    raise exception 'Stripe revenue requires a verified live USD webhook.';
  end if;

  insert into public.revenue_events (
    household_id,
    owner_user_id,
    visibility,
    source,
    external_event_id,
    mode,
    verification_status,
    amount,
    currency,
    category,
    description,
    occurred_at,
    payload
  )
  values (
    selected_webhook.household_id,
    selected_webhook.owner_user_id,
    'private',
    'stripe',
    selected_webhook.provider_event_id,
    'live',
    'verified',
    p_amount,
    'USD',
    p_category,
    p_description,
    p_occurred_at,
    jsonb_build_object(
      'webhook_event_id', selected_webhook.id,
      'payload_sha256', selected_webhook.payload_sha256
    )
  )
  on conflict (owner_user_id, source, external_event_id)
  do update set external_event_id = excluded.external_event_id
  returning * into selected_revenue;

  if selected_revenue.household_id <> selected_webhook.household_id
     or selected_revenue.amount <> p_amount
     or selected_revenue.occurred_at <> p_occurred_at
     or selected_revenue.category is distinct from p_category
     or selected_revenue.description is distinct from p_description
     or selected_revenue.currency <> 'USD'
     or selected_revenue.mode <> 'live'
     or selected_revenue.verification_status <> 'verified' then
    raise exception 'Conflicting replay for Stripe revenue event.';
  end if;

  update public.financial_provider_webhook_events
  set
    revenue_event_id = selected_revenue.id,
    processing_status = 'processed',
    processed_at = coalesce(processed_at, now()),
    last_error = null
  where id = selected_webhook.id;

  return selected_revenue;
end;
$$;

-- Replaces the v13 implementation with a service-only, externally idempotent
-- ledger post. It retains the original signature for compatibility.
create or replace function public.record_revenue_event_transaction(
  p_revenue_event_id uuid
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_event public.revenue_events;
  selected_webhook public.financial_provider_webhook_events;
  selected_transaction public.transactions;
begin
  perform public.require_financial_service_role();

  select *
  into selected_event
  from public.revenue_events r
  where r.id = p_revenue_event_id
  for update;

  if not found then
    raise exception 'Revenue event not found.';
  end if;

  if selected_event.source <> 'stripe'
     or selected_event.mode <> 'live'
     or selected_event.verification_status <> 'verified'
     or selected_event.currency <> 'USD' then
    raise exception 'Only verified live USD Stripe revenue can be posted.';
  end if;

  select *
  into selected_webhook
  from public.financial_provider_webhook_events w
  where w.revenue_event_id = selected_event.id
    and w.provider = 'stripe'
    and w.provider_event_id = selected_event.external_event_id
    and w.signature_verified
    and w.livemode
    and w.currency = 'USD'
  for update;

  if not found then
    raise exception 'A matching verified live Stripe webhook is required.';
  end if;

  if selected_event.transaction_id is not null then
    select *
    into selected_transaction
    from public.transactions t
    where t.id = selected_event.transaction_id;

    if found then
      return selected_transaction;
    end if;
  end if;

  insert into public.transactions (
    household_id,
    owner_user_id,
    visibility,
    kind,
    amount,
    category,
    description,
    transaction_date,
    external_source,
    external_id
  )
  values (
    selected_event.household_id,
    selected_event.owner_user_id,
    selected_event.visibility,
    'income',
    selected_event.amount,
    coalesce(selected_event.category, 'Stripe revenue'),
    coalesce(selected_event.description, 'Verified Stripe revenue'),
    (selected_event.occurred_at at time zone 'UTC')::date,
    'stripe_revenue',
    selected_event.external_event_id
  )
  on conflict (household_id, external_source, external_id)
    where external_source is not null and external_id is not null
  do update set external_id = excluded.external_id
  returning * into selected_transaction;

  update public.revenue_events
  set transaction_id = selected_transaction.id
  where id = selected_event.id
    and transaction_id is null;

  return selected_transaction;
end;
$$;

-- =========================================================
-- RLS AND PRIVILEGES
-- =========================================================

alter table public.financial_provider_credentials
  enable row level security;
alter table public.financial_provider_credentials
  force row level security;
alter table public.financial_provider_account_metadata
  enable row level security;
alter table public.financial_provider_sync_cursors
  enable row level security;
alter table public.financial_provider_sync_cursors
  force row level security;
alter table public.financial_provider_webhook_events
  enable row level security;
alter table public.financial_provider_webhook_events
  force row level security;

drop policy if exists "Members read safe financial account metadata"
  on public.financial_provider_account_metadata;
create policy "Members read safe financial account metadata"
on public.financial_provider_account_metadata
for select
to authenticated
using (public.is_household_member(household_id, auth.uid()));

revoke all on public.financial_provider_credentials
  from public, anon, authenticated;
revoke all on public.financial_provider_account_metadata
  from public, anon, authenticated;
revoke all on public.financial_provider_sync_cursors
  from public, anon, authenticated;
revoke all on public.financial_provider_webhook_events
  from public, anon, authenticated;

grant select on public.financial_provider_account_metadata
  to authenticated;
grant select, insert, update, delete
  on public.financial_provider_credentials,
     public.financial_provider_account_metadata,
     public.financial_provider_sync_cursors,
     public.financial_provider_webhook_events
  to service_role;

revoke all on function public.require_financial_service_role()
  from public, anon, authenticated;
revoke all on function public.enforce_financial_integration_integrity()
  from public, anon, authenticated;
revoke all on function public.enforce_external_transaction_integrity()
  from public, anon, authenticated;
revoke all on function public.enforce_stripe_revenue_integrity()
  from public, anon, authenticated;

revoke all on function public.upsert_provider_webhook_event(
  uuid, uuid, uuid, text, text, text, text, boolean, boolean, text
) from public, anon, authenticated;
revoke all on function public.upsert_plaid_transaction(
  uuid, uuid, text, text, numeric, date, text, text,
  public.record_visibility
) from public, anon, authenticated;
revoke all on function public.upsert_stripe_revenue_event(
  uuid, numeric, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.record_revenue_event_transaction(uuid)
  from public, anon, authenticated;

grant execute on function public.upsert_provider_webhook_event(
  uuid, uuid, uuid, text, text, text, text, boolean, boolean, text
) to service_role;
grant execute on function public.upsert_plaid_transaction(
  uuid, uuid, text, text, numeric, date, text, text,
  public.record_visibility
) to service_role;
grant execute on function public.upsert_stripe_revenue_event(
  uuid, numeric, timestamptz, text, text
) to service_role;
grant execute on function public.record_revenue_event_transaction(uuid)
  to service_role;

-- =========================================================
-- WORKER RUNTIME CONTRACT
-- These narrowly-scoped tables match the Cloudflare provider adapter. Tokens,
-- raw provider payloads, cursors, customer IDs, and webhook envelopes are
-- service-role only. Browser roles can read masked Plaid account metadata.
-- =========================================================

create table if not exists public.plaid_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 500),
  institution_id text check (
    institution_id is null or char_length(institution_id) <= 180
  ),
  institution_name text check (
    institution_name is null or char_length(institution_name) <= 180
  ),
  encrypted_access_token text check (
    encrypted_access_token is null
    or (
      char_length(encrypted_access_token) between 32 and 65536
      and encrypted_access_token like 'v1.%'
    )
  ),
  cursor text check (cursor is null or char_length(cursor) <= 4000),
  status text not null default 'active'
    check (status in ('active', 'error', 'disconnected')),
  provider_environment text not null default 'sandbox'
    check (provider_environment in ('sandbox', 'development', 'production')),
  last_synced_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, item_id),
  check (
    (status = 'disconnected' and encrypted_access_token is null)
    or (status <> 'disconnected' and encrypted_access_token is not null)
  )
);

create table if not exists public.plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  account_id text not null check (char_length(account_id) between 1 and 500),
  name text not null check (char_length(name) between 1 and 180),
  mask text check (mask is null or mask ~ '^[A-Za-z0-9]{1,4}$'),
  type text check (type is null or char_length(type) <= 60),
  subtype text check (subtype is null or char_length(subtype) <= 60),
  current_balance numeric(14, 2),
  available_balance numeric(14, 2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, account_id)
);

create table if not exists public.plaid_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid not null references public.plaid_items(id) on delete cascade,
  transaction_id text not null
    check (char_length(transaction_id) between 1 and 500),
  account_id text not null check (char_length(account_id) between 1 and 500),
  amount numeric(14, 2) not null,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  merchant_name text check (
    merchant_name is null or char_length(merchant_name) <= 180
  ),
  name text not null check (char_length(name) between 1 and 500),
  authorized_date date,
  posted_date date not null,
  pending boolean not null default false,
  provider_data jsonb not null default '{}'::jsonb
    check (octet_length(provider_data::text) <= 131072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, transaction_id)
);

create table if not exists public.stripe_customers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('plaid', 'stripe')),
  external_event_id text not null
    check (char_length(external_event_id) between 1 and 500),
  dedupe_key text not null unique
    check (char_length(dedupe_key) between 3 and 540),
  verification_status text not null
    check (verification_status in ('verified', 'rejected')),
  payload jsonb not null check (octet_length(payload::text) <= 262144),
  received_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create index if not exists plaid_items_household_idx
  on public.plaid_items(household_id, owner_user_id, status);
create index if not exists plaid_accounts_item_idx
  on public.plaid_accounts(plaid_item_id);
create index if not exists plaid_transactions_item_idx
  on public.plaid_transactions(plaid_item_id, posted_date desc);

create or replace function public.enforce_provider_runtime_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_item public.plaid_items;
begin
  if tg_table_name <> 'provider_webhook_events' then
    if not exists (
      select 1 from public.household_members hm
      where hm.household_id = new.household_id
        and hm.user_id = new.owner_user_id
    ) then
      raise exception 'Provider record owner must belong to its household.';
    end if;
  end if;

  if tg_table_name in ('plaid_accounts', 'plaid_transactions') then
    select * into selected_item
    from public.plaid_items pi
    where pi.id = new.plaid_item_id;

    if selected_item.id is null
       or selected_item.household_id <> new.household_id
       or selected_item.owner_user_id <> new.owner_user_id then
      raise exception 'Plaid child record must match its item household and owner.';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and tg_table_name <> 'provider_webhook_events'
     and (
       new.household_id is distinct from old.household_id
       or new.owner_user_id is distinct from old.owner_user_id
     ) then
    raise exception 'Provider record ownership is immutable.';
  end if;

  return new;
end;
$$;

drop trigger if exists plaid_items_set_updated_at on public.plaid_items;
create trigger plaid_items_set_updated_at before update on public.plaid_items
for each row execute function public.set_updated_at();
drop trigger if exists plaid_accounts_set_updated_at on public.plaid_accounts;
create trigger plaid_accounts_set_updated_at before update on public.plaid_accounts
for each row execute function public.set_updated_at();
drop trigger if exists plaid_transactions_set_updated_at on public.plaid_transactions;
create trigger plaid_transactions_set_updated_at before update on public.plaid_transactions
for each row execute function public.set_updated_at();
drop trigger if exists stripe_customers_set_updated_at on public.stripe_customers;
create trigger stripe_customers_set_updated_at before update on public.stripe_customers
for each row execute function public.set_updated_at();

drop trigger if exists plaid_items_runtime_integrity on public.plaid_items;
create trigger plaid_items_runtime_integrity
before insert or update on public.plaid_items
for each row execute function public.enforce_provider_runtime_integrity();
drop trigger if exists plaid_accounts_runtime_integrity on public.plaid_accounts;
create trigger plaid_accounts_runtime_integrity
before insert or update on public.plaid_accounts
for each row execute function public.enforce_provider_runtime_integrity();
drop trigger if exists plaid_transactions_runtime_integrity
  on public.plaid_transactions;
create trigger plaid_transactions_runtime_integrity
before insert or update on public.plaid_transactions
for each row execute function public.enforce_provider_runtime_integrity();
drop trigger if exists stripe_customers_runtime_integrity
  on public.stripe_customers;
create trigger stripe_customers_runtime_integrity
before insert or update on public.stripe_customers
for each row execute function public.enforce_provider_runtime_integrity();

alter table public.plaid_items enable row level security;
alter table public.plaid_items force row level security;
alter table public.plaid_accounts enable row level security;
alter table public.plaid_transactions enable row level security;
alter table public.plaid_transactions force row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_customers force row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.provider_webhook_events force row level security;

drop policy if exists "Owners read masked Plaid account metadata"
  on public.plaid_accounts;
create policy "Owners read masked Plaid account metadata"
on public.plaid_accounts for select to authenticated
using (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

revoke all on public.plaid_items, public.plaid_accounts,
  public.plaid_transactions, public.stripe_customers,
  public.provider_webhook_events
from public, anon, authenticated;

revoke all on function public.enforce_provider_runtime_integrity()
from public, anon, authenticated;

grant select on public.plaid_accounts to authenticated;
grant select, insert, update, delete on public.plaid_items,
  public.plaid_accounts, public.plaid_transactions, public.stripe_customers,
  public.provider_webhook_events
to service_role;

create table if not exists public.stripe_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  stripe_event_id text not null unique
    check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null
    check (event_type in (
      'charge.refunded',
      'charge.dispute.created',
      'charge.dispute.closed',
      'refund.created',
      'refund.updated'
    )),
  status text not null check (char_length(status) between 1 and 80),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.stripe_lifecycle_events enable row level security;
drop trigger if exists stripe_lifecycle_runtime_integrity
  on public.stripe_lifecycle_events;
create trigger stripe_lifecycle_runtime_integrity
before insert or update on public.stripe_lifecycle_events
for each row execute function public.enforce_provider_runtime_integrity();
drop policy if exists "Owners read Stripe lifecycle status"
  on public.stripe_lifecycle_events;
create policy "Owners read Stripe lifecycle status"
on public.stripe_lifecycle_events for select to authenticated
using (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);
revoke all on public.stripe_lifecycle_events from public, anon, authenticated;
grant select on public.stripe_lifecycle_events to authenticated;
grant select, insert on public.stripe_lifecycle_events to service_role;

create table if not exists public.student_perk_tracking (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  perk_id text not null check (
    char_length(perk_id) between 1 and 100
    and perk_id ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  status text not null default 'reviewing'
    check (status in ('reviewing', 'active', 'expired', 'not_eligible')),
  monthly_savings numeric(10, 2) not null default 0
    check (monthly_savings between 0 and 100000),
  last_verified_on date,
  expires_on date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, perk_id)
);

alter table public.student_perk_tracking enable row level security;

drop trigger if exists student_perk_tracking_set_updated_at
  on public.student_perk_tracking;
create trigger student_perk_tracking_set_updated_at
before update on public.student_perk_tracking
for each row execute function public.set_updated_at();

drop trigger if exists student_perk_tracking_prevent_reassignment
  on public.student_perk_tracking;
create trigger student_perk_tracking_prevent_reassignment
before update on public.student_perk_tracking
for each row execute function public.prevent_record_reassignment();

drop policy if exists "Owners manage their student perk tracking"
  on public.student_perk_tracking;
create policy "Owners manage their student perk tracking"
on public.student_perk_tracking for all to authenticated
using (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
)
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

revoke all on public.student_perk_tracking from public, anon;
grant select, insert, update, delete on public.student_perk_tracking
to authenticated, service_role;

-- Bind verified Stripe ledger posting to either the generalized v15 envelope
-- or the Worker's raw-body-verified, replay-protected runtime envelope.
create or replace function public.enforce_stripe_revenue_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'stripe'
     and new.verification_status = 'verified'
     and (new.mode <> 'live' or new.currency <> 'USD') then
    raise exception 'Verified Stripe revenue must be live and USD.';
  end if;

  if tg_op = 'UPDATE'
     and old.source = 'stripe'
     and old.transaction_id is not null
     and (
       new.source is distinct from old.source
       or new.external_event_id is distinct from old.external_event_id
       or new.mode is distinct from old.mode
       or new.verification_status is distinct from old.verification_status
       or new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.occurred_at is distinct from old.occurred_at
       or new.transaction_id is distinct from old.transaction_id
     ) then
    raise exception 'Posted Stripe revenue verification fields are immutable.';
  end if;

  if new.source = 'stripe'
     and new.transaction_id is not null
     and not (
       exists (
         select 1 from public.financial_provider_webhook_events w
         where w.revenue_event_id = new.id
           and w.household_id = new.household_id
           and w.owner_user_id = new.owner_user_id
           and w.provider = 'stripe'
           and w.provider_event_id = new.external_event_id
           and w.signature_verified and w.livemode and w.currency = 'USD'
       )
       or exists (
         select 1 from public.provider_webhook_events w
         where w.provider = 'stripe'
           and w.external_event_id = new.external_event_id
           and w.verification_status = 'verified'
           and w.payload ->> 'livemode' = 'true'
       )
     ) then
    raise exception 'Posted Stripe revenue requires its verified live USD webhook.';
  end if;

  return new;
end;
$$;

create or replace function public.record_revenue_event_transaction(
  p_revenue_event_id uuid
)
returns public.transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_event public.revenue_events;
  selected_transaction public.transactions;
begin
  perform public.require_financial_service_role();

  select * into selected_event
  from public.revenue_events r
  where r.id = p_revenue_event_id
  for update;

  if not found then raise exception 'Revenue event not found.'; end if;

  if selected_event.source <> 'stripe'
     or selected_event.mode <> 'live'
     or selected_event.verification_status <> 'verified'
     or selected_event.currency <> 'USD' then
    raise exception 'Only verified live USD Stripe revenue can be posted.';
  end if;

  if not (
    exists (
      select 1 from public.financial_provider_webhook_events w
      where w.revenue_event_id = selected_event.id
        and w.provider = 'stripe'
        and w.provider_event_id = selected_event.external_event_id
        and w.signature_verified and w.livemode and w.currency = 'USD'
    )
    or exists (
      select 1 from public.provider_webhook_events w
      where w.provider = 'stripe'
        and w.external_event_id = selected_event.external_event_id
        and w.verification_status = 'verified'
        and w.payload ->> 'livemode' = 'true'
    )
  ) then
    raise exception 'A matching verified live Stripe webhook is required.';
  end if;

  if selected_event.transaction_id is not null then
    select * into selected_transaction
    from public.transactions t where t.id = selected_event.transaction_id;
    if found then return selected_transaction; end if;
  end if;

  insert into public.transactions (
    household_id, owner_user_id, visibility, kind, amount, category,
    description, transaction_date, external_source, external_id
  ) values (
    selected_event.household_id, selected_event.owner_user_id,
    selected_event.visibility, 'income', selected_event.amount,
    coalesce(selected_event.category, 'Stripe revenue'),
    coalesce(selected_event.description, 'Verified Stripe revenue'),
    (selected_event.occurred_at at time zone 'UTC')::date,
    'stripe_revenue', selected_event.external_event_id
  )
  on conflict (household_id, external_source, external_id)
    where external_source is not null and external_id is not null
  do update set external_id = excluded.external_id
  returning * into selected_transaction;

  update public.revenue_events
  set transaction_id = selected_transaction.id
  where id = selected_event.id and transaction_id is null;

  return selected_transaction;
end;
$$;

revoke all on function public.record_revenue_event_transaction(uuid)
from public, anon, authenticated;
grant execute on function public.record_revenue_event_transaction(uuid)
to service_role;

commit;

notify pgrst, 'reload schema';
