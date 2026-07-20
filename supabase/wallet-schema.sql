-- ============================================================
-- TwinPath AI Wallet — human-in-the-loop transaction pipeline
-- Flow: proposal (AI/import) -> validated -> pending
--       -> owner MFA approval (single-use, expiring, amount-bound)
--       -> server-side adapter executes -> signed receipt
-- Every hard limit is enforced HERE, server-side. The client and
-- the AI proposer are both untrusted by design.
-- ============================================================

-- ---------- Settings: kill switch + global caps ----------
create table if not exists wallet_settings (
    owner_id uuid primary key references auth.users (id) on delete cascade,
    enabled boolean not null default false,           -- master kill switch (off by default)
    per_tx_cap_cents integer not null default 2500,   -- $25 default per transaction
    daily_cap_cents integer not null default 5000,    -- $50 default per day
    monthly_cap_cents integer not null default 20000, -- $200 default per month
    approval_ttl_seconds integer not null default 300,-- approvals expire in 5 minutes
    updated_at timestamptz not null default now(),
    constraint caps_sane check (
        per_tx_cap_cents > 0
        and daily_cap_cents >= per_tx_cap_cents
        and monthly_cap_cents >= daily_cap_cents
        and approval_ttl_seconds between 60 and 900
    )
);

-- ---------- Provider / recipient allowlist ----------
create table if not exists wallet_recipients (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    provider text not null,            -- adapter key, e.g. 'mock', later a real issuer
    recipient_ref text not null,       -- merchant/recipient identifier at the provider
    label text not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (owner_id, provider, recipient_ref)
);

-- ---------- Proposals (state machine) ----------
create table if not exists wallet_proposals (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    source text not null default 'import',            -- 'import' | 'manual'
    amount_cents integer not null,
    currency text not null default 'USD',
    recipient_id uuid not null references wallet_recipients (id),
    purpose text not null,
    status text not null default 'pending_review',
    -- pending_review -> approved -> executing -> settled
    -- pending_review -> rejected | expired
    -- executing -> failed
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint amount_positive check (amount_cents > 0),
    constraint currency_usd check (currency = 'USD'),
    constraint purpose_present check (length(trim(purpose)) between 3 and 500),
    constraint status_valid check (
        status in ('pending_review','approved','executing','settled',
                   'rejected','expired','failed')
    )
);

-- ---------- Approvals (single-use, expiring, amount-bound) ----------
create table if not exists wallet_approvals (
    id uuid primary key default gen_random_uuid(),
    proposal_id uuid not null unique references wallet_proposals (id) on delete cascade,
    owner_id uuid not null references auth.users (id) on delete cascade,
    -- binds the approval to EXACTLY what was shown to the human:
    bound_hash text not null,      -- sha256(amount_cents||currency||recipient_id||purpose)
    approved_at timestamptz not null default now(),
    expires_at timestamptz not null,
    consumed_at timestamptz        -- set exactly once by the executor
);

-- ---------- Receipts ----------
create table if not exists wallet_receipts (
    id uuid primary key default gen_random_uuid(),
    proposal_id uuid not null unique references wallet_proposals (id),
    owner_id uuid not null references auth.users (id) on delete cascade,
    provider text not null,
    provider_tx_ref text,
    amount_cents integer not null,
    signature text not null,       -- HMAC by the edge function's server-only secret
    raw_response jsonb,
    created_at timestamptz not null default now()
);

-- ---------- Append-only audit log ----------
create table if not exists wallet_events (
    id bigint generated always as identity primary key,
    owner_id uuid not null,
    proposal_id uuid,
    event text not null,
    detail jsonb,
    created_at timestamptz not null default now()
);

create or replace function wallet_events_block_mutation()
returns trigger language plpgsql as $$
begin
    raise exception 'wallet_events is append-only';
end $$;

drop trigger if exists wallet_events_no_update on wallet_events;
create trigger wallet_events_no_update
    before update or delete on wallet_events
    for each row execute function wallet_events_block_mutation();

-- ---------- State machine + caps enforcement ----------
create or replace function wallet_proposals_guard()
returns trigger language plpgsql security definer as $$
declare
    s wallet_settings;
    spent_today integer;
    spent_month integer;
begin
    select * into s from wallet_settings where owner_id = new.owner_id;

    if s is null or not s.enabled then
        raise exception 'wallet disabled';
    end if;

    if tg_op = 'INSERT' then
        if new.status <> 'pending_review' then
            raise exception 'proposals must start in pending_review';
        end if;

        if new.amount_cents > s.per_tx_cap_cents then
            raise exception 'amount exceeds per-transaction cap';
        end if;

        select coalesce(sum(amount_cents), 0) into spent_today
        from wallet_proposals
        where owner_id = new.owner_id
          and status in ('approved','executing','settled')
          and created_at >= date_trunc('day', now());

        if spent_today + new.amount_cents > s.daily_cap_cents then
            raise exception 'daily cap exceeded';
        end if;

        select coalesce(sum(amount_cents), 0) into spent_month
        from wallet_proposals
        where owner_id = new.owner_id
          and status in ('approved','executing','settled')
          and created_at >= date_trunc('month', now());

        if spent_month + new.amount_cents > s.monthly_cap_cents then
            raise exception 'monthly cap exceeded';
        end if;

        if not exists (
            select 1 from wallet_recipients r
            where r.id = new.recipient_id
              and r.owner_id = new.owner_id
              and r.active
        ) then
            raise exception 'recipient not on active allowlist';
        end if;
    end if;

    if tg_op = 'UPDATE' then
        -- immutable core fields after creation
        if new.amount_cents <> old.amount_cents
           or new.recipient_id <> old.recipient_id
           or new.currency <> old.currency
           or new.owner_id <> old.owner_id
           or new.purpose <> old.purpose then
            raise exception 'proposal fields are immutable; reject and re-propose';
        end if;

        -- legal transitions only
        if not (
            (old.status = 'pending_review' and new.status in ('approved','rejected','expired'))
            or (old.status = 'approved'   and new.status in ('executing','expired'))
            or (old.status = 'executing'  and new.status in ('settled','failed'))
        ) then
            raise exception 'illegal status transition % -> %', old.status, new.status;
        end if;
    end if;

    new.updated_at = now();
    return new;
end $$;

drop trigger if exists wallet_proposals_guard_trg on wallet_proposals;
create trigger wallet_proposals_guard_trg
    before insert or update on wallet_proposals
    for each row execute function wallet_proposals_guard();

-- ---------- Row Level Security ----------
alter table wallet_settings   enable row level security;
alter table wallet_recipients enable row level security;
alter table wallet_proposals  enable row level security;
alter table wallet_approvals  enable row level security;
alter table wallet_receipts   enable row level security;
alter table wallet_events     enable row level security;

-- Owner can read everything of their own.
create policy wallet_settings_owner   on wallet_settings   for all    using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy wallet_recipients_owner on wallet_recipients for all    using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy wallet_proposals_read   on wallet_proposals  for select using (auth.uid() = owner_id);
create policy wallet_proposals_insert on wallet_proposals  for insert with check (auth.uid() = owner_id);
create policy wallet_receipts_read    on wallet_receipts   for select using (auth.uid() = owner_id);
create policy wallet_events_read      on wallet_events     for select using (auth.uid() = owner_id);

-- Approvals REQUIRE a recent MFA (aal2) session — this is the human gate.
create policy wallet_approvals_read on wallet_approvals
    for select using (auth.uid() = owner_id);

create policy wallet_approvals_mfa_insert on wallet_approvals
    for insert with check (
        auth.uid() = owner_id
        and (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
    );

-- The owner may review a pending proposal: reject freely, approve ONLY with
-- an MFA (aal2) session. The guard trigger separately blocks any change to
-- amount/recipient/purpose and any illegal status transition.
create policy wallet_proposals_owner_review on wallet_proposals
    for update using (
        auth.uid() = owner_id
        and status = 'pending_review'
    )
    with check (
        auth.uid() = owner_id
        and status in ('approved', 'rejected')
        and (
            status = 'rejected'
            or (select coalesce(auth.jwt() ->> 'aal', 'aal1')) = 'aal2'
        )
    );

-- Indexes for the hot paths.
create index if not exists wallet_proposals_owner_created_idx
    on wallet_proposals (owner_id, created_at desc);
create index if not exists wallet_events_owner_idx
    on wallet_events (owner_id, created_at desc);

-- Status changes to executing/settled/failed and approval consumption are
-- performed ONLY by the edge function using the service role (bypasses RLS);
-- no client policy grants UPDATE on approvals or receipts.
