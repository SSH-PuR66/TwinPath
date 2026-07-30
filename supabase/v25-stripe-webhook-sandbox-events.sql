-- Signed Stripe webhook records are retained in their delivery mode. Only a
-- later transaction posting remains restricted to verified live USD revenue.
-- This migration intentionally does not alter RLS policies or grants.

create or replace function public.enforce_stripe_revenue_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

revoke all on function public.enforce_stripe_revenue_integrity()
  from public, anon, authenticated;
