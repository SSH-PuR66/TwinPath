begin;

-- Simplify household-owner updates.
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
);

-- Only transaction owners may alter financial records.
drop policy if exists "Users update accessible transactions"
  on public.transactions;

create policy "Owners update their transactions"
on public.transactions
for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

-- Only document owners may alter vault metadata.
drop policy if exists "Users update accessible document metadata"
  on public.documents;

create policy "Owners update their document metadata"
on public.documents
for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(household_id, auth.uid())
);

-- Owner-only record deletion.
drop policy if exists "Users delete accessible tasks"
  on public.tasks;

create policy "Owners delete their tasks"
on public.tasks
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

drop policy if exists "Users delete accessible appointments"
  on public.appointments;

create policy "Owners delete their appointments"
on public.appointments
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

drop policy if exists "Users delete accessible transactions"
  on public.transactions;

create policy "Owners delete their transactions"
on public.transactions
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

drop policy if exists "Users delete accessible income opportunities"
  on public.income_opportunities;

create policy "Owners delete their income opportunities"
on public.income_opportunities
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

drop policy if exists "Users delete accessible documents"
  on public.documents;

create policy "Owners delete their document metadata"
on public.documents
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

drop policy if exists "Users delete accessible vault files"
  on storage.objects;

create policy "Owners delete their vault files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vault'
  and exists (
    select 1
    from public.documents d
    where d.storage_path = name
      and d.owner_user_id = auth.uid()
  )
);

commit;
