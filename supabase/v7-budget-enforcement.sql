begin;

create or replace function public.review_spend_proposal(
  proposal_id uuid,
  requested_status text
)
returns public.spend_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_proposal public.spend_proposals;
  budget_limit numeric(10, 2);
  purchased_total numeric(10, 2);
  approved_total numeric(10, 2);
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if requested_status not in (
    'approved',
    'rejected',
    'purchased',
    'cancelled'
  ) then
    raise exception 'Invalid proposal status.';
  end if;

  select *
  into selected_proposal
  from public.spend_proposals
  where id = proposal_id
    and owner_user_id = current_user_id
  for update;

  if not found then
    raise exception 'Proposal not found.';
  end if;

  if not public.is_household_member(
    selected_proposal.household_id,
    current_user_id
  ) then
    raise exception 'Household membership required.';
  end if;

  if selected_proposal.amount > 5 then
    raise exception 'Individual proposals cannot exceed $5.';
  end if;

  if selected_proposal.recurring then
    raise exception 'Recurring purchases are prohibited.';
  end if;

  select eb.limit_amount
  into budget_limit
  from public.experiment_budgets eb
  where eb.household_id = selected_proposal.household_id
    and eb.owner_user_id = current_user_id
  for update;

  if budget_limit is null then
    raise exception 'Create an experiment budget first.';
  end if;

  select coalesce(sum(sp.amount), 0)
  into purchased_total
  from public.spend_proposals sp
  where sp.household_id = selected_proposal.household_id
    and sp.owner_user_id = current_user_id
    and sp.status = 'purchased'
    and sp.id <> selected_proposal.id;

  select coalesce(sum(sp.amount), 0)
  into approved_total
  from public.spend_proposals sp
  where sp.household_id = selected_proposal.household_id
    and sp.owner_user_id = current_user_id
    and sp.status = 'approved'
    and sp.id <> selected_proposal.id;

  if requested_status = 'approved'
     and purchased_total
       + approved_total
       + selected_proposal.amount
       > budget_limit then
    raise exception 'Approval would exceed the experiment budget.';
  end if;

  if requested_status = 'purchased'
     and purchased_total
       + selected_proposal.amount
       > budget_limit then
    raise exception 'Purchase would exceed the experiment budget.';
  end if;

  update public.spend_proposals
  set
    status = requested_status,
    reviewed_at = now(),
    updated_at = now()
  where id = selected_proposal.id
  returning *
  into selected_proposal;

  return selected_proposal;
end;
$$;

revoke all
on function public.review_spend_proposal(uuid, text)
from public, anon;

grant execute
on function public.review_spend_proposal(uuid, text)
to authenticated;

commit;

notify pgrst, 'reload schema';
