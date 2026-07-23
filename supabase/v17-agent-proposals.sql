-- v17: Agent proposals and feature flags
-- Claude/agents propose app changes; humans approve in-app; approvals flip
-- household-scoped feature flags so gated UI activates without a redeploy.

create table if not exists public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete restrict,
  created_by uuid
    references auth.users(id) on delete restrict,
  origin text not null default 'agent'
    check (origin in ('agent', 'user')),
  kind text not null
    check (kind in (
      'new_button',
      'hidden_route',
      'theme',
      'connector',
      'copy_change',
      'config'
    )),
  title text not null
    check (char_length(title) between 3 and 160),
  rationale text not null
    check (char_length(rationale) between 3 and 2000),
  payload jsonb not null default '{}'::jsonb,
  flag_key text
    check (
      flag_key is null
      or flag_key ~ '^[a-z0-9][a-z0-9_.-]{1,79}$'
    ),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'superseded')),
  decision_note text
    check (decision_note is null or char_length(decision_note) <= 1000),
  decided_by uuid
    references auth.users(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_proposals_household_status_idx
  on public.agent_proposals (household_id, status, created_at desc);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null
    references public.households(id) on delete restrict,
  flag_key text not null
    check (flag_key ~ '^[a-z0-9][a-z0-9_.-]{1,79}$'),
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  source_proposal_id uuid
    references public.agent_proposals(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (household_id, flag_key)
);

alter table public.agent_proposals enable row level security;
alter table public.feature_flags enable row level security;

revoke all on public.agent_proposals from public, anon, authenticated;
revoke all on public.feature_flags from public, anon, authenticated;

grant select on public.agent_proposals to authenticated;
grant select on public.feature_flags to authenticated;

drop policy if exists "Members read household proposals" on public.agent_proposals;
create policy "Members read household proposals"
  on public.agent_proposals for select
  to authenticated
  using (public.is_household_member(household_id, (select auth.uid())));

drop policy if exists "Members read household feature flags" on public.feature_flags;
create policy "Members read household feature flags"
  on public.feature_flags for select
  to authenticated
  using (public.is_household_member(household_id, (select auth.uid())));

-- All writes flow through the service role (control-plane Worker) or the
-- decision RPC below. Direct client writes stay revoked.

create or replace function public.decide_agent_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_note text default null
)
returns public.agent_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  selected public.agent_proposals;
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select * into selected
  from public.agent_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'proposal not found';
  end if;

  if not public.is_household_member(selected.household_id, current_user_id) then
    raise exception 'proposal not found';
  end if;

  if selected.status <> 'pending' then
    raise exception 'proposal was already decided';
  end if;

  update public.agent_proposals
  set
    status = p_decision,
    decision_note = left(p_note, 1000),
    decided_by = current_user_id,
    decided_at = now()
  where id = p_proposal_id
  returning * into selected;

  if p_decision = 'approved' and selected.flag_key is not null then
    insert into public.feature_flags as ff
      (household_id, flag_key, enabled, payload, source_proposal_id, updated_at)
    values
      (
        selected.household_id,
        selected.flag_key,
        true,
        coalesce(selected.payload, '{}'::jsonb),
        selected.id,
        now()
      )
    on conflict (household_id, flag_key)
    do update set
      enabled = true,
      payload = coalesce(excluded.payload, ff.payload),
      source_proposal_id = excluded.source_proposal_id,
      updated_at = now();
  end if;

  return selected;
end;
$$;

revoke all on function public.decide_agent_proposal(uuid, text, text) from public, anon;
grant execute on function public.decide_agent_proposal(uuid, text, text) to authenticated;
