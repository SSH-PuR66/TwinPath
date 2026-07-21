begin;

create or replace function
  public.enforce_family_savings_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status in ('approved', 'denied')
     and new.decision_on is null then
    new.decision_on := current_date;
  end if;

  if new.status not in ('approved', 'denied') then
    new.decision_on := null;
  end if;

  if new.status = 'approved'
     and new.last_verified_on is null then
    new.last_verified_on := current_date;
  end if;

  if new.approved_monthly_value < 0
     or new.approved_one_time_value < 0 then
    raise exception
      'Approved values cannot be negative.';
  end if;

  if new.official_url is not null
     and new.official_url !~* '^https://[^[:space:]]+$' then
    raise exception
      'Official URLs must use HTTPS.';
  end if;

  return new;
end;
$$;

drop trigger if exists
  family_savings_integrity_trigger
  on public.family_savings_routes;

create trigger family_savings_integrity_trigger
before insert or update
on public.family_savings_routes
for each row
execute function
  public.enforce_family_savings_integrity();

revoke all
on function
  public.enforce_family_savings_integrity()
from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
