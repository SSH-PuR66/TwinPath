begin;

drop policy if exists "Members create their spend proposals"
on public.spend_proposals;

create policy "Members create their spend proposals"
on public.spend_proposals
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
  and amount <= 5
  and recurring = false
);

drop policy if exists "Owners update their spend proposals"
on public.spend_proposals;

create policy "Owners update their spend proposals"
on public.spend_proposals
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
  and amount <= 5
  and recurring = false
);

drop policy if exists "Owners delete their spend proposals"
on public.spend_proposals;

create policy "Owners delete their spend proposals"
on public.spend_proposals
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

drop policy if exists "Users read their experiment budgets"
on public.experiment_budgets;

create policy "Users read their experiment budgets"
on public.experiment_budgets
for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
);

drop policy if exists "Members create their experiment budgets"
on public.experiment_budgets;

create policy "Members create their experiment budgets"
on public.experiment_budgets
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
);

drop policy if exists "Owners update their experiment budgets"
on public.experiment_budgets;

create policy "Owners update their experiment budgets"
on public.experiment_budgets
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (
  owner_user_id = (select auth.uid())
  and public.is_household_member(
    household_id,
    (select auth.uid())
  )
);

drop policy if exists "Owners delete their experiment budgets"
on public.experiment_budgets;

create policy "Owners delete their experiment budgets"
on public.experiment_budgets
for delete
to authenticated
using (owner_user_id = (select auth.uid()));

alter function public.review_spend_proposal(uuid, text)
set search_path = '';

commit;

notify pgrst, 'reload schema';
