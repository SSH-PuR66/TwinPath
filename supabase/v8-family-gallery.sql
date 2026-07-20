begin;

create table if not exists public.family_photos (
  id uuid primary key default gen_random_uuid(),

  household_id uuid not null
    references public.households(id) on delete cascade,

  owner_user_id uuid not null
    references auth.users(id) on delete cascade,

  visibility public.record_visibility not null default 'shared',

  storage_path text not null unique
    check (char_length(storage_path) between 1 and 1000),

  file_name text not null
    check (char_length(file_name) between 1 and 255),

  mime_type text not null
    check (
      mime_type in (
        'image/jpeg',
        'image/png',
        'image/webp'
      )
    ),

  file_size bigint not null
    check (
      file_size > 0
      and file_size <= 10485760
    ),

  width integer check (
    width is null or width between 1 and 10000
  ),

  height integer check (
    height is null or height between 1 and 10000
  ),

  album text not null default 'Family'
    check (char_length(album) between 1 and 80),

  caption text
    check (
      caption is null
      or char_length(caption) <= 500
    ),

  captured_on date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_photos_household_idx
  on public.family_photos(
    household_id,
    created_at desc
  );

create index if not exists family_photos_owner_idx
  on public.family_photos(owner_user_id);

alter table public.family_photos enable row level security;

drop policy if exists "Users read accessible family photos"
  on public.family_photos;

create policy "Users read accessible family photos"
on public.family_photos
for select
to authenticated
using (
  public.can_access_record(
    household_id,
    owner_user_id,
    visibility
  )
);

drop policy if exists "Members add family photos"
  on public.family_photos;

create policy "Members add family photos"
on public.family_photos
for insert
to authenticated
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

drop policy if exists "Owners update family photos"
  on public.family_photos;

create policy "Owners update family photos"
on public.family_photos
for update
to authenticated
using (
  owner_user_id = auth.uid()
)
with check (
  owner_user_id = auth.uid()
  and public.is_household_member(
    household_id,
    auth.uid()
  )
);

drop policy if exists "Owners delete family photos"
  on public.family_photos;

create policy "Owners delete family photos"
on public.family_photos
for delete
to authenticated
using (
  owner_user_id = auth.uid()
);

grant select, insert, update, delete
  on public.family_photos
  to authenticated;

drop trigger if exists family_photos_set_updated_at
  on public.family_photos;

create trigger family_photos_set_updated_at
before update on public.family_photos
for each row
execute function public.set_updated_at();

-- Validate upload paths before metadata exists.
-- Required format:
-- household_uuid/user_uuid/random-file-name.webp

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
on function public.can_upload_family_photo_path(text)
from public, anon;

revoke all
on function public.can_read_family_photo_path(text)
from public, anon;

grant execute
on function public.can_upload_family_photo_path(text)
to authenticated;

grant execute
on function public.can_read_family_photo_path(text)
to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'family-gallery',
  'family-gallery',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

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

do $$
begin
  alter publication supabase_realtime
    add table public.family_photos;
exception
  when duplicate_object then null;
end
$$;

commit;

notify pgrst, 'reload schema';
