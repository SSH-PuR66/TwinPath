begin;

-- =========================================================
-- AUTONOMOUS OPERATIONS
-- Sandbox is the default. Live external actions require an enabled
-- integration, two allowlist checks, and a fresh human approval.
-- =========================================================

create table if not exists public.automation_projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  experiment_id uuid
    references public.business_experiments(id) on delete set null,
  name text not null
    check (char_length(name) between 1 and 180),
  objective text not null
    check (char_length(objective) between 1 and 4000),
  mode text not null default 'sandbox'
    check (mode in ('sandbox', 'live')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  max_steps integer not null default 25
    check (max_steps between 1 and 100),
  instructions jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(instructions) = 'object'
      and octet_length(instructions::text) <= 32768
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  provider text not null
    check (
      char_length(provider) between 1 and 80
      and provider ~ '^[a-z0-9][a-z0-9._-]*$'
    ),
  display_name text not null
    check (char_length(display_name) between 1 and 180),
  enabled boolean not null default false,
  allowed_actions text[] not null default '{}'::text[]
    check (
      cardinality(allowed_actions) <= 50
      and array_position(allowed_actions, null) is null
      and octet_length(array_to_string(allowed_actions, ',')) <= 4000
    ),
  credential_reference text
    check (
      credential_reference is null
      or char_length(credential_reference) between 1 and 500
    ),
  configuration jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(configuration) = 'object'
      and octet_length(configuration::text) <= 16384
    ),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, provider, display_name)
);

create table if not exists public.authorized_scopes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  integration_connection_id uuid not null
    references public.integration_connections(id) on delete cascade,
  action text not null
    check (
      char_length(action) between 1 and 120
      and action ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    ),
  scope_key text not null default '*'
    check (char_length(scope_key) between 1 and 500),
  enabled boolean not null default false,
  constraints jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(constraints) = 'object'
      and octet_length(constraints::text) <= 16384
    ),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (integration_connection_id, action, scope_key)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  automation_project_id uuid not null
    references public.automation_projects(id) on delete cascade,
  integration_connection_id uuid
    references public.integration_connections(id) on delete restrict,
  mode text not null default 'sandbox'
    check (mode in ('sandbox', 'live')),
  status text not null default 'queued'
    check (
      status in (
        'queued',
        'running',
        'awaiting_approval',
        'authorized',
        'succeeded',
        'failed',
        'cancelled'
      )
    ),
  action text
    check (
      action is null
      or (
        char_length(action) between 1 and 120
        and action ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
      )
    ),
  input jsonb not null default '{}'::jsonb
    check (octet_length(input::text) <= 32768),
  output jsonb
    check (
      output is null
      or octet_length(output::text) <= 65536
    ),
  error_message text
    check (
      error_message is null
      or char_length(error_message) <= 4000
    ),
  authorization_expires_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (integration_connection_id is null and action is null)
    or (integration_connection_id is not null and action is not null)
  )
);

create table if not exists public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  agent_run_id uuid not null
    references public.agent_runs(id) on delete cascade,
  integration_connection_id uuid not null
    references public.integration_connections(id) on delete restrict,
  action text not null
    check (
      char_length(action) between 1 and 120
      and action ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    ),
  request_hash text not null
    check (request_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'revoked',
        'consumed',
        'expired'
      )
    ),
  rationale text
    check (
      rationale is null
      or char_length(rationale) <= 2000
    ),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_run_id, request_hash),
  check (expires_at > requested_at),
  check (
    approved_at is null
    or expires_at <= approved_at + interval '15 minutes'
  )
);

create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  agent_run_id uuid not null
    references public.agent_runs(id) on delete cascade,
  artifact_type text not null
    check (
      char_length(artifact_type) between 1 and 80
      and artifact_type ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    ),
  file_name text not null
    check (char_length(file_name) between 1 and 255),
  storage_path text not null unique
    check (char_length(storage_path) between 1 and 1000),
  mime_type text not null
    check (char_length(mime_type) between 1 and 180),
  file_size bigint not null
    check (file_size > 0 and file_size <= 10485760),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 16384
    ),
  created_at timestamptz not null default now()
);

create table if not exists public.revenue_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete cascade,
  owner_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility public.record_visibility not null default 'private',
  automation_project_id uuid
    references public.automation_projects(id) on delete set null,
  business_experiment_id uuid
    references public.business_experiments(id) on delete set null,
  agent_run_id uuid
    references public.agent_runs(id) on delete set null,
  source text not null
    check (char_length(source) between 1 and 120),
  external_event_id text not null
    check (char_length(external_event_id) between 1 and 500),
  mode text not null default 'sandbox'
    check (mode in ('sandbox', 'live')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  amount numeric(12, 2) not null
    check (amount > 0),
  currency text not null default 'USD'
    check (currency ~ '^[A-Z]{3}$'),
  category text
    check (category is null or char_length(category) <= 60),
  description text
    check (description is null or char_length(description) <= 180),
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
    check (octet_length(payload::text) <= 32768),
  transaction_id uuid
    references public.transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (owner_user_id, source, external_event_id)
);

create table if not exists public.agent_audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete restrict,
  owner_user_id uuid not null
    references auth.users(id) on delete restrict,
  visibility public.record_visibility not null default 'private',
  automation_project_id uuid
    references public.automation_projects(id) on delete restrict,
  agent_run_id uuid
    references public.agent_runs(id) on delete restrict,
  actor_user_id uuid
    references auth.users(id) on delete restrict,
  event_type text not null
    check (
      char_length(event_type) between 1 and 120
      and event_type ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    ),
  event_data jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(event_data) = 'object'
      and octet_length(event_data::text) <= 32768
    ),
  created_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists automation_projects_household_idx
  on public.automation_projects(household_id, created_at desc);
create index if not exists automation_projects_owner_idx
  on public.automation_projects(owner_user_id);
create index if not exists automation_projects_experiment_idx
  on public.automation_projects(experiment_id);

create index if not exists integration_connections_household_idx
  on public.integration_connections(household_id, created_at desc);
create index if not exists authorized_scopes_connection_idx
  on public.authorized_scopes(integration_connection_id, enabled);
create index if not exists authorized_scopes_household_idx
  on public.authorized_scopes(household_id);

create index if not exists agent_runs_project_idx
  on public.agent_runs(automation_project_id, created_at desc);
create index if not exists agent_runs_household_idx
  on public.agent_runs(household_id, created_at desc);
create index if not exists agent_runs_connection_idx
  on public.agent_runs(integration_connection_id);

create index if not exists agent_approvals_run_idx
  on public.agent_approvals(agent_run_id, created_at desc);
create index if not exists agent_approvals_connection_idx
  on public.agent_approvals(integration_connection_id);
create index if not exists agent_artifacts_run_idx
  on public.agent_artifacts(agent_run_id, created_at desc);
create index if not exists agent_artifacts_household_idx
  on public.agent_artifacts(household_id);

create index if not exists revenue_events_household_idx
  on public.revenue_events(household_id, occurred_at desc);
create index if not exists revenue_events_project_idx
  on public.revenue_events(automation_project_id);
create index if not exists revenue_events_experiment_idx
  on public.revenue_events(business_experiment_id);
create index if not exists revenue_events_run_idx
  on public.revenue_events(agent_run_id);
create index if not exists revenue_events_transaction_idx
  on public.revenue_events(transaction_id);

create index if not exists agent_audit_events_household_idx
  on public.agent_audit_events(household_id, created_at desc);
create index if not exists agent_audit_events_project_idx
  on public.agent_audit_events(automation_project_id, created_at desc);
create index if not exists agent_audit_events_run_idx
  on public.agent_audit_events(agent_run_id, created_at desc);
create index if not exists agent_audit_events_actor_idx
  on public.agent_audit_events(actor_user_id);

-- =========================================================
-- INTEGRITY AND IMMUTABILITY
-- =========================================================

create or replace function public.enforce_agent_record_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'automation_projects' and new.experiment_id is not null then
    if not exists (
      select 1
      from public.business_experiments be
      where be.id = new.experiment_id
        and be.household_id = new.household_id
        and be.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The business experiment must have the same household and owner.';
    end if;
  elsif tg_table_name = 'authorized_scopes' then
    if not exists (
      select 1
      from public.integration_connections ic
      where ic.id = new.integration_connection_id
        and ic.household_id = new.household_id
        and ic.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The integration must have the same household and owner.';
    end if;
  elsif tg_table_name = 'agent_runs' then
    if not exists (
      select 1
      from public.automation_projects ap
      where ap.id = new.automation_project_id
        and ap.household_id = new.household_id
        and ap.owner_user_id = new.owner_user_id
        and ap.mode = new.mode
    ) then
      raise exception 'The run must match its project household, owner, and mode.';
    end if;

    if new.integration_connection_id is not null and not exists (
      select 1
      from public.integration_connections ic
      where ic.id = new.integration_connection_id
        and ic.household_id = new.household_id
        and ic.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The integration must have the same household and owner.';
    end if;
  elsif tg_table_name = 'agent_approvals' then
    if not exists (
      select 1
      from public.agent_runs ar
      where ar.id = new.agent_run_id
        and ar.household_id = new.household_id
        and ar.owner_user_id = new.owner_user_id
        and ar.integration_connection_id = new.integration_connection_id
        and ar.action = new.action
    ) then
      raise exception 'The approval must exactly match its run and integration.';
    end if;
  elsif tg_table_name = 'agent_artifacts' then
    if not exists (
      select 1
      from public.agent_runs ar
      where ar.id = new.agent_run_id
        and ar.household_id = new.household_id
        and ar.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The artifact must have the same household and owner as its run.';
    end if;
  elsif tg_table_name = 'revenue_events' then
    if new.automation_project_id is not null and not exists (
      select 1
      from public.automation_projects ap
      where ap.id = new.automation_project_id
        and ap.household_id = new.household_id
        and ap.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The automation project must have the same household and owner.';
    end if;

    if new.business_experiment_id is not null and not exists (
      select 1
      from public.business_experiments be
      where be.id = new.business_experiment_id
        and be.household_id = new.household_id
        and be.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The business experiment must have the same household and owner.';
    end if;

    if new.agent_run_id is not null and not exists (
      select 1
      from public.agent_runs ar
      where ar.id = new.agent_run_id
        and ar.household_id = new.household_id
        and ar.owner_user_id = new.owner_user_id
    ) then
      raise exception 'The agent run must have the same household and owner.';
    end if;

    if new.transaction_id is not null and not exists (
      select 1
      from public.transactions t
      where t.id = new.transaction_id
        and t.household_id = new.household_id
        and t.owner_user_id = new.owner_user_id
        and t.kind = 'income'
        and t.amount = new.amount
    ) then
      raise exception 'The transaction must be matching income owned by the same household member.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_agent_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'Agent audit events are append-only.';
end;
$$;

create or replace function public.write_agent_audit_event(
  p_household_id uuid,
  p_owner_user_id uuid,
  p_project_id uuid,
  p_run_id uuid,
  p_event_type text,
  p_event_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if auth.uid() <> p_owner_user_id
     or not public.is_household_member(p_household_id, auth.uid()) then
    raise exception 'Record ownership and household membership required.';
  end if;

  if char_length(p_event_type) not between 1 and 120
     or p_event_type !~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
     or jsonb_typeof(coalesce(p_event_data, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_event_data, '{}'::jsonb)::text) > 32768 then
    raise exception 'Invalid audit event.';
  end if;

  insert into public.agent_audit_events (
    household_id,
    owner_user_id,
    automation_project_id,
    agent_run_id,
    actor_user_id,
    event_type,
    event_data
  )
  values (
    p_household_id,
    p_owner_user_id,
    p_project_id,
    p_run_id,
    auth.uid(),
    p_event_type,
    coalesce(p_event_data, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

-- Updated-at and immutable household/owner triggers.
drop trigger if exists automation_projects_set_updated_at
  on public.automation_projects;
create trigger automation_projects_set_updated_at
before update on public.automation_projects
for each row execute function public.set_updated_at();
drop trigger if exists automation_projects_prevent_reassignment
  on public.automation_projects;
create trigger automation_projects_prevent_reassignment
before update on public.automation_projects
for each row execute function public.prevent_record_reassignment();
drop trigger if exists automation_projects_integrity
  on public.automation_projects;
create trigger automation_projects_integrity
before insert or update on public.automation_projects
for each row execute function public.enforce_agent_record_integrity();

drop trigger if exists integration_connections_set_updated_at
  on public.integration_connections;
create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.set_updated_at();
drop trigger if exists integration_connections_prevent_reassignment
  on public.integration_connections;
create trigger integration_connections_prevent_reassignment
before update on public.integration_connections
for each row execute function public.prevent_record_reassignment();

drop trigger if exists authorized_scopes_set_updated_at
  on public.authorized_scopes;
create trigger authorized_scopes_set_updated_at
before update on public.authorized_scopes
for each row execute function public.set_updated_at();
drop trigger if exists authorized_scopes_prevent_reassignment
  on public.authorized_scopes;
create trigger authorized_scopes_prevent_reassignment
before update on public.authorized_scopes
for each row execute function public.prevent_record_reassignment();
drop trigger if exists authorized_scopes_integrity
  on public.authorized_scopes;
create trigger authorized_scopes_integrity
before insert or update on public.authorized_scopes
for each row execute function public.enforce_agent_record_integrity();

drop trigger if exists agent_runs_set_updated_at on public.agent_runs;
create trigger agent_runs_set_updated_at
before update on public.agent_runs
for each row execute function public.set_updated_at();
drop trigger if exists agent_runs_prevent_reassignment on public.agent_runs;
create trigger agent_runs_prevent_reassignment
before update on public.agent_runs
for each row execute function public.prevent_record_reassignment();
drop trigger if exists agent_runs_integrity on public.agent_runs;
create trigger agent_runs_integrity
before insert or update on public.agent_runs
for each row execute function public.enforce_agent_record_integrity();

drop trigger if exists agent_approvals_prevent_reassignment
  on public.agent_approvals;
create trigger agent_approvals_prevent_reassignment
before update on public.agent_approvals
for each row execute function public.prevent_record_reassignment();
drop trigger if exists agent_approvals_integrity
  on public.agent_approvals;
create trigger agent_approvals_integrity
before insert or update on public.agent_approvals
for each row execute function public.enforce_agent_record_integrity();

drop trigger if exists agent_artifacts_integrity on public.agent_artifacts;
create trigger agent_artifacts_integrity
before insert or update on public.agent_artifacts
for each row execute function public.enforce_agent_record_integrity();
drop trigger if exists agent_artifacts_prevent_reassignment
  on public.agent_artifacts;
create trigger agent_artifacts_prevent_reassignment
before update on public.agent_artifacts
for each row execute function public.prevent_record_reassignment();

drop trigger if exists revenue_events_integrity on public.revenue_events;
create trigger revenue_events_integrity
before insert or update on public.revenue_events
for each row execute function public.enforce_agent_record_integrity();
drop trigger if exists revenue_events_prevent_reassignment
  on public.revenue_events;
create trigger revenue_events_prevent_reassignment
before update on public.revenue_events
for each row execute function public.prevent_record_reassignment();

drop trigger if exists agent_audit_events_append_only
  on public.agent_audit_events;
create trigger agent_audit_events_append_only
before update or delete on public.agent_audit_events
for each row execute function public.prevent_agent_audit_mutation();

-- =========================================================
-- STORAGE PATH HELPERS
-- Expected path: household_uuid/owner_uuid/randomized-file-name
-- =========================================================

create or replace function public.can_upload_agent_artifact_path(
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
  if auth.uid() is null
     or requested_path is null
     or char_length(requested_path) > 1000 then
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
    and public.is_household_member(path_household_id, auth.uid());
end;
$$;

create or replace function public.can_read_agent_artifact_path(
  requested_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.agent_artifacts aa
    where aa.storage_path = requested_path
      and public.can_access_record(
        aa.household_id,
        aa.owner_user_id,
        aa.visibility
      )
  );
$$;

-- =========================================================
-- APPROVAL AND STATE TRANSITION RPCS
-- =========================================================

create or replace function public.request_agent_approval(
  p_run_id uuid,
  p_rationale text default null
)
returns public.agent_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_run public.agent_runs;
  selected_project public.automation_projects;
  selected_connection public.integration_connections;
  inserted_approval public.agent_approvals;
  calculated_hash text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into selected_run
  from public.agent_runs
  where id = p_run_id
    and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Agent run not found.';
  end if;

  if not public.is_household_member(selected_run.household_id, auth.uid()) then
    raise exception 'Household membership required.';
  end if;

  select *
  into selected_project
  from public.automation_projects
  where id = selected_run.automation_project_id;

  select *
  into selected_connection
  from public.integration_connections
  where id = selected_run.integration_connection_id;

  if selected_run.status not in ('queued', 'awaiting_approval') then
    raise exception 'This run cannot request approval in its current state.';
  end if;

  if selected_run.mode <> 'live'
     or selected_project.mode <> 'live'
     or selected_project.status <> 'active' then
    raise exception 'Live approval requires an active live-mode project.';
  end if;

  if selected_connection.id is null
     or not selected_connection.enabled then
    raise exception 'An enabled integration is required.';
  end if;

  if not coalesce(
       selected_run.action = any(selected_connection.allowed_actions),
       false
     )
     or not exists (
       select 1
       from public.authorized_scopes scope
       where scope.integration_connection_id = selected_connection.id
         and scope.household_id = selected_run.household_id
         and scope.owner_user_id = selected_run.owner_user_id
         and scope.action = selected_run.action
         and scope.enabled
         and (scope.expires_at is null or scope.expires_at > now())
     ) then
    raise exception 'The requested action is not allowlisted.';
  end if;

  calculated_hash := encode(
    digest(
      selected_run.id::text
      || '|' || selected_run.automation_project_id::text
      || '|' || selected_connection.id::text
      || '|' || selected_run.action
      || '|' || selected_run.input::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.agent_approvals (
    household_id,
    owner_user_id,
    visibility,
    agent_run_id,
    integration_connection_id,
    action,
    request_hash,
    rationale,
    expires_at
  )
  values (
    selected_run.household_id,
    selected_run.owner_user_id,
    selected_run.visibility,
    selected_run.id,
    selected_connection.id,
    selected_run.action,
    calculated_hash,
    p_rationale,
    now() + interval '10 minutes'
  )
  on conflict (agent_run_id, request_hash)
  do update set
    status = 'pending',
    rationale = excluded.rationale,
    requested_at = now(),
    reviewed_at = null,
    approved_at = null,
    expires_at = now() + interval '10 minutes',
    consumed_at = null
  where
    public.agent_approvals.status in (
      'rejected',
      'revoked',
      'expired'
    )
    or (
      public.agent_approvals.status = 'pending'
      and public.agent_approvals.expires_at <= now()
    )
  returning * into inserted_approval;

  if inserted_approval.id is null then
    select *
    into inserted_approval
    from public.agent_approvals
    where agent_run_id = selected_run.id
      and request_hash = calculated_hash;
  end if;

  update public.agent_runs
  set status = 'awaiting_approval'
  where id = selected_run.id;

  perform public.write_agent_audit_event(
    selected_run.household_id,
    selected_run.owner_user_id,
    selected_run.automation_project_id,
    selected_run.id,
    'approval.requested',
    jsonb_build_object(
      'approval_id', inserted_approval.id,
      'action', selected_run.action
    )
  );

  return inserted_approval;
end;
$$;

create or replace function public.review_agent_approval(
  p_approval_id uuid,
  p_decision text,
  p_rationale text default null
)
returns public.agent_approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_approval public.agent_approvals;
  selected_run public.agent_runs;
  selected_project public.automation_projects;
  selected_connection public.integration_connections;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  select *
  into selected_approval
  from public.agent_approvals
  where id = p_approval_id
    and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Approval not found.';
  end if;

  if not public.is_household_member(
    selected_approval.household_id,
    auth.uid()
  ) then
    raise exception 'Household membership required.';
  end if;

  if selected_approval.status <> 'pending'
     or selected_approval.expires_at <= now() then
    raise exception 'Approval is no longer pending and fresh.';
  end if;

  select * into selected_run
  from public.agent_runs
  where id = selected_approval.agent_run_id
  for update;

  select * into selected_project
  from public.automation_projects
  where id = selected_run.automation_project_id;

  select * into selected_connection
  from public.integration_connections
  where id = selected_approval.integration_connection_id;

  if p_decision = 'approved' then
    if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
      raise exception 'A recent MFA session is required to approve live actions.';
    end if;

    if selected_run.status <> 'awaiting_approval'
       or selected_run.mode <> 'live'
       or selected_project.mode <> 'live'
       or selected_project.status <> 'active'
       or not selected_connection.enabled
       or selected_approval.action <> selected_run.action
       or not coalesce(
         selected_approval.action = any(selected_connection.allowed_actions),
         false
       )
       or not exists (
         select 1
         from public.authorized_scopes scope
         where scope.integration_connection_id = selected_connection.id
           and scope.household_id = selected_run.household_id
           and scope.owner_user_id = selected_run.owner_user_id
           and scope.action = selected_run.action
           and scope.enabled
           and (scope.expires_at is null or scope.expires_at > now())
       ) then
      raise exception 'Live authorization requirements are not satisfied.';
    end if;
  end if;

  update public.agent_approvals
  set
    status = p_decision,
    rationale = p_rationale,
    reviewed_at = now(),
    approved_at = case when p_decision = 'approved' then now() else null end,
    expires_at = case
      when p_decision = 'approved'
        then least(expires_at, now() + interval '10 minutes')
      else expires_at
    end
  where id = selected_approval.id
  returning * into selected_approval;

  if p_decision = 'rejected' then
    update public.agent_runs
    set
      status = 'cancelled',
      finished_at = now(),
      error_message = 'Live action rejected by its owner.'
    where id = selected_run.id;
  end if;

  perform public.write_agent_audit_event(
    selected_approval.household_id,
    selected_approval.owner_user_id,
    selected_run.automation_project_id,
    selected_run.id,
    'approval.' || p_decision,
    jsonb_build_object(
      'approval_id', selected_approval.id,
      'action', selected_approval.action
    )
  );

  return selected_approval;
end;
$$;

create or replace function public.transition_agent_run(
  p_run_id uuid,
  p_status text,
  p_output jsonb default null,
  p_error_message text default null
)
returns public.agent_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_run public.agent_runs;
  selected_project public.automation_projects;
  selected_connection public.integration_connections;
  selected_approval public.agent_approvals;
  transition_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_status not in (
    'running',
    'awaiting_approval',
    'authorized',
    'succeeded',
    'failed',
    'cancelled'
  ) then
    raise exception 'Invalid run state.';
  end if;

  if p_output is not null and octet_length(p_output::text) > 65536 then
    raise exception 'Run output is too large.';
  end if;

  if p_error_message is not null
     and char_length(p_error_message) > 4000 then
    raise exception 'Run error message is too large.';
  end if;

  select *
  into selected_run
  from public.agent_runs
  where id = p_run_id
    and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Agent run not found.';
  end if;

  if not public.is_household_member(selected_run.household_id, auth.uid()) then
    raise exception 'Household membership required.';
  end if;

  select * into selected_project
  from public.automation_projects
  where id = selected_run.automation_project_id;

  transition_allowed := case selected_run.status
    when 'queued' then p_status in (
      'running',
      'awaiting_approval',
      'cancelled'
    )
    when 'running' then p_status in (
      'awaiting_approval',
      'succeeded',
      'failed',
      'cancelled'
    )
    when 'awaiting_approval' then p_status in (
      'authorized',
      'failed',
      'cancelled'
    )
    when 'authorized' then p_status in (
      'running',
      'failed',
      'cancelled'
    )
    else false
  end;

  if not transition_allowed then
    raise exception 'Invalid agent run state transition.';
  end if;

  if p_status = 'awaiting_approval'
     and (
       selected_run.mode <> 'live'
       or selected_run.integration_connection_id is null
       or selected_run.action is null
     ) then
    raise exception 'Only a live external action may await approval.';
  end if;

  if selected_run.mode = 'live'
     and selected_run.integration_connection_id is not null
     and p_status = 'running'
     and selected_run.status <> 'authorized' then
    raise exception 'A live external action must be authorized first.';
  end if;

  if p_status = 'authorized' then
    select * into selected_connection
    from public.integration_connections
    where id = selected_run.integration_connection_id;

    select *
    into selected_approval
    from public.agent_approvals approval
    where approval.agent_run_id = selected_run.id
      and approval.integration_connection_id =
        selected_run.integration_connection_id
      and approval.action = selected_run.action
      and approval.status = 'approved'
      and approval.approved_at >= now() - interval '15 minutes'
      and approval.expires_at > now()
      and approval.consumed_at is null
    order by approval.approved_at desc
    limit 1
    for update;

    if selected_project.mode <> 'live'
       or selected_project.status <> 'active'
       or selected_run.mode <> 'live'
       or selected_connection.id is null
       or not selected_connection.enabled
       or not coalesce(
         selected_run.action = any(selected_connection.allowed_actions),
         false
       )
       or selected_approval.id is null
       or not exists (
         select 1
         from public.authorized_scopes scope
         where scope.integration_connection_id = selected_connection.id
           and scope.household_id = selected_run.household_id
           and scope.owner_user_id = selected_run.owner_user_id
           and scope.action = selected_run.action
           and scope.enabled
           and (scope.expires_at is null or scope.expires_at > now())
       ) then
      raise exception 'Live authorization requirements are not satisfied.';
    end if;

    update public.agent_approvals
    set
      status = 'consumed',
      consumed_at = now()
    where id = selected_approval.id;
  end if;

  if selected_run.status = 'authorized'
     and p_status = 'running'
  then
    select * into selected_connection
    from public.integration_connections
    where id = selected_run.integration_connection_id;

    if selected_run.authorization_expires_at is null
       or selected_run.authorization_expires_at <= now()
       or selected_project.mode <> 'live'
       or selected_project.status <> 'active'
       or selected_connection.id is null
       or not selected_connection.enabled
       or not coalesce(
         selected_run.action = any(selected_connection.allowed_actions),
         false
       )
       or not exists (
         select 1
         from public.authorized_scopes scope
         where scope.integration_connection_id = selected_connection.id
           and scope.household_id = selected_run.household_id
           and scope.owner_user_id = selected_run.owner_user_id
           and scope.action = selected_run.action
           and scope.enabled
           and (scope.expires_at is null or scope.expires_at > now())
       ) then
      raise exception 'The live authorization is expired or no longer valid.';
    end if;
  end if;

  update public.agent_runs
  set
    status = p_status,
    output = case
      when p_output is not null then p_output
      else output
    end,
    error_message = case
      when p_error_message is not null then p_error_message
      when p_status in ('running', 'authorized', 'succeeded') then null
      else error_message
    end,
    authorization_expires_at = case
      when p_status = 'authorized' then selected_approval.expires_at
      else authorization_expires_at
    end,
    started_at = case
      when p_status = 'running' then coalesce(started_at, now())
      else started_at
    end,
    finished_at = case
      when p_status in ('succeeded', 'failed', 'cancelled') then now()
      else null
    end
  where id = selected_run.id
  returning * into selected_run;

  perform public.write_agent_audit_event(
    selected_run.household_id,
    selected_run.owner_user_id,
    selected_run.automation_project_id,
    selected_run.id,
    'run.' || p_status,
    jsonb_build_object('mode', selected_run.mode)
  );

  return selected_run;
end;
$$;

-- Idempotently materialize a revenue event in the existing transactions table.
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
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select *
  into selected_event
  from public.revenue_events
  where id = p_revenue_event_id
    and owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Revenue event not found.';
  end if;

  if not public.is_household_member(
    selected_event.household_id,
    auth.uid()
  ) then
    raise exception 'Household membership required.';
  end if;

  if selected_event.mode <> 'live'
     or selected_event.verification_status <> 'verified' then
    raise exception 'Only verified live revenue can be posted to the ledger.';
  end if;

  if selected_event.currency <> 'USD' then
    raise exception
      'The existing transactions table has no currency column; only USD revenue can be materialized.';
  end if;

  if selected_event.transaction_id is not null then
    select *
    into selected_transaction
    from public.transactions
    where id = selected_event.transaction_id;

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
    transaction_date
  )
  values (
    selected_event.household_id,
    selected_event.owner_user_id,
    selected_event.visibility,
    'income',
    selected_event.amount,
    coalesce(selected_event.category, 'Autonomous revenue'),
    coalesce(
      selected_event.description,
      'Revenue from ' || left(selected_event.source, 160)
    ),
    (selected_event.occurred_at at time zone 'UTC')::date
  )
  returning * into selected_transaction;

  update public.revenue_events
  set transaction_id = selected_transaction.id
  where id = selected_event.id;

  perform public.write_agent_audit_event(
    selected_event.household_id,
    selected_event.owner_user_id,
    selected_event.automation_project_id,
    selected_event.agent_run_id,
    'revenue.transaction_recorded',
    jsonb_build_object(
      'revenue_event_id', selected_event.id,
      'transaction_id', selected_transaction.id
    )
  );

  return selected_transaction;
end;
$$;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.automation_projects enable row level security;
alter table public.integration_connections enable row level security;
alter table public.authorized_scopes enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_artifacts enable row level security;
alter table public.revenue_events enable row level security;
alter table public.agent_audit_events enable row level security;

drop policy if exists "Users read accessible automation projects"
  on public.automation_projects;
create policy "Users read accessible automation projects"
on public.automation_projects for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));
drop policy if exists "Members create sandbox automation projects"
  on public.automation_projects;
create policy "Members create sandbox automation projects"
on public.automation_projects for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and mode = 'sandbox'
  and status = 'draft'
);
drop policy if exists "Owners update automation projects"
  on public.automation_projects;
create policy "Owners update automation projects"
on public.automation_projects for update to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);
drop policy if exists "Owners delete automation projects"
  on public.automation_projects;
create policy "Owners delete automation projects"
on public.automation_projects for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Users read accessible integration connections"
  on public.integration_connections;
create policy "Users read accessible integration connections"
on public.integration_connections for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));
drop policy if exists "Members create disabled integration connections"
  on public.integration_connections;
create policy "Members create disabled integration connections"
on public.integration_connections for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and not enabled
);
drop policy if exists "Owners update integration connections"
  on public.integration_connections;
create policy "Owners update integration connections"
on public.integration_connections for update to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);
drop policy if exists "Owners delete integration connections"
  on public.integration_connections;
create policy "Owners delete integration connections"
on public.integration_connections for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Users read accessible authorized scopes"
  on public.authorized_scopes;
create policy "Users read accessible authorized scopes"
on public.authorized_scopes for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));
drop policy if exists "Members create disabled authorized scopes"
  on public.authorized_scopes;
create policy "Members create disabled authorized scopes"
on public.authorized_scopes for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and not enabled
);
drop policy if exists "Owners update authorized scopes"
  on public.authorized_scopes;
create policy "Owners update authorized scopes"
on public.authorized_scopes for update to authenticated
using (owner_user_id = auth.uid())
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);
drop policy if exists "Owners delete authorized scopes"
  on public.authorized_scopes;
create policy "Owners delete authorized scopes"
on public.authorized_scopes for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Users read accessible agent runs"
  on public.agent_runs;
create policy "Users read accessible agent runs"
on public.agent_runs for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));
drop policy if exists "Members queue their agent runs"
  on public.agent_runs;
create policy "Members queue their agent runs"
on public.agent_runs for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and status = 'queued'
);
drop policy if exists "Owners delete terminal agent runs"
  on public.agent_runs;
create policy "Owners delete terminal agent runs"
on public.agent_runs for delete to authenticated
using (
  owner_user_id = auth.uid()
  and status in ('succeeded', 'failed', 'cancelled')
);

drop policy if exists "Users read accessible agent approvals"
  on public.agent_approvals;
create policy "Users read accessible agent approvals"
on public.agent_approvals for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));

drop policy if exists "Users read accessible agent artifacts"
  on public.agent_artifacts;
create policy "Users read accessible agent artifacts"
on public.agent_artifacts for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));
drop policy if exists "Owners create agent artifact metadata"
  on public.agent_artifacts;
create policy "Owners create agent artifact metadata"
on public.agent_artifacts for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and public.can_upload_agent_artifact_path(storage_path)
);
drop policy if exists "Owners delete agent artifact metadata"
  on public.agent_artifacts;
create policy "Owners delete agent artifact metadata"
on public.agent_artifacts for delete to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Users read accessible revenue events"
  on public.revenue_events;
create policy "Users read accessible revenue events"
on public.revenue_events for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));
drop policy if exists "Members create their revenue events"
  on public.revenue_events;
create policy "Members create their revenue events"
on public.revenue_events for insert to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
  and transaction_id is null
  and mode = 'sandbox'
  and verification_status = 'unverified'
);

drop policy if exists "Users read accessible agent audit events"
  on public.agent_audit_events;
create policy "Users read accessible agent audit events"
on public.agent_audit_events for select to authenticated
using (public.can_access_record(household_id, owner_user_id, visibility));

-- Deliberately omit direct UPDATE grants for runs, approvals, artifacts,
-- revenue events, and audit events. Their controlled mutations use RPCs.
grant select, insert, update, delete
  on public.automation_projects,
     public.integration_connections,
     public.authorized_scopes
  to authenticated;
grant select, insert, delete on public.agent_runs to authenticated;
grant select on public.agent_approvals to authenticated;
grant select, insert, delete on public.agent_artifacts to authenticated;
grant select, insert on public.revenue_events to authenticated;
grant select on public.agent_audit_events to authenticated;

revoke all
on function public.enforce_agent_record_integrity()
from public, anon, authenticated;
revoke all
on function public.prevent_agent_audit_mutation()
from public, anon, authenticated;
revoke all
on function public.write_agent_audit_event(
  uuid, uuid, uuid, uuid, text, jsonb
)
from public, anon, authenticated;

revoke all
on function public.can_upload_agent_artifact_path(text)
from public, anon;
revoke all
on function public.can_read_agent_artifact_path(text)
from public, anon;
grant execute
on function public.can_upload_agent_artifact_path(text)
to authenticated;
grant execute
on function public.can_read_agent_artifact_path(text)
to authenticated;

revoke all
on function public.request_agent_approval(uuid, text)
from public, anon;
revoke all
on function public.review_agent_approval(uuid, text, text)
from public, anon;
revoke all
on function public.transition_agent_run(uuid, text, jsonb, text)
from public, anon;
revoke all
on function public.record_revenue_event_transaction(uuid)
from public, anon;
grant execute
on function public.request_agent_approval(uuid, text)
to authenticated;
grant execute
on function public.review_agent_approval(uuid, text, text)
to authenticated;
grant execute
on function public.transition_agent_run(uuid, text, jsonb, text)
to authenticated;
grant execute
on function public.record_revenue_event_transaction(uuid)
to authenticated;

-- =========================================================
-- PRIVATE ARTIFACT STORAGE
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit
)
values (
  'agent-artifacts',
  'agent-artifacts',
  false,
  10485760
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760;

drop policy if exists "Owners upload agent artifacts"
  on storage.objects;
create policy "Owners upload agent artifacts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'agent-artifacts'
  and public.can_upload_agent_artifact_path(name)
);

drop policy if exists "Users read accessible agent artifacts"
  on storage.objects;
create policy "Users read accessible agent artifacts"
on storage.objects for select to authenticated
using (
  bucket_id = 'agent-artifacts'
  and public.can_read_agent_artifact_path(name)
);

drop policy if exists "Owners delete agent artifacts"
  on storage.objects;
create policy "Owners delete agent artifacts"
on storage.objects for delete to authenticated
using (
  bucket_id = 'agent-artifacts'
  and public.can_upload_agent_artifact_path(name)
);

-- File replacement is intentionally disabled.

-- =========================================================
-- REALTIME
-- =========================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'automation_projects',
    'integration_connections',
    'authorized_scopes',
    'agent_runs',
    'agent_approvals',
    'agent_artifacts',
    'revenue_events',
    'agent_audit_events'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    exception
      when duplicate_object then null;
    end;
  end loop;
end
$$;

commit;

notify pgrst, 'reload schema';
