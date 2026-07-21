begin;

alter table public.business_experiments
  add column if not exists import_fingerprint text;

create unique index if not exists
  business_experiments_owner_fingerprint_unique
on public.business_experiments(
  owner_user_id,
  import_fingerprint
)
where import_fingerprint is not null;

commit;

notify pgrst, 'reload schema';
