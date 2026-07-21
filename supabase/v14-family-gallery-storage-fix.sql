begin;

-- Keep the gallery checks self-contained so this hotfix can repair projects
-- where the v8 helper privileges or storage policies drifted.
create or replace function public.can_upload_family_photo_path(
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
  if auth.uid() is null then
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
    and public.is_household_member(
      path_household_id,
      auth.uid()
    );
end;
$$;

create or replace function public.can_read_family_photo_path(
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
    from public.family_photos fp
    where fp.storage_path = requested_path
      and public.can_access_record(
        fp.household_id,
        fp.owner_user_id,
        fp.visibility
      )
  );
$$;

revoke all
on function public.can_access_document_path(text)
from public, anon;

revoke all
on function public.can_upload_document_path(text)
from public, anon;

revoke all
on function public.can_upload_family_photo_path(text)
from public, anon;

revoke all
on function public.can_read_family_photo_path(text)
from public, anon;

grant execute
on function public.can_access_document_path(text)
to authenticated;

grant execute
on function public.can_upload_document_path(text)
to authenticated;

grant execute
on function public.can_upload_family_photo_path(text)
to authenticated;

grant execute
on function public.can_read_family_photo_path(text)
to authenticated;

drop policy if exists "Members upload family gallery images"
  on storage.objects;

create policy "Members upload family gallery images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'family-gallery'
  and public.can_upload_family_photo_path(name)
);

drop policy if exists "Users read accessible family gallery images"
  on storage.objects;

create policy "Users read accessible family gallery images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'family-gallery'
  and public.can_read_family_photo_path(name)
);

drop policy if exists "Owners delete family gallery images"
  on storage.objects;

create policy "Owners delete family gallery images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'family-gallery'
  and public.can_upload_family_photo_path(name)
);

commit;

notify pgrst, 'reload schema';
