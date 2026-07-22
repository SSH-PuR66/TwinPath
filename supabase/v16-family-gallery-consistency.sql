begin;

-- Remove gallery metadata only when Supabase Storage no longer has the
-- referenced object. This repairs stale cards left by the former
-- storage-first client deletion flow. It does not delete any stored object.
delete from public.family_photos as photo
where not exists (
  select 1
  from storage.objects as object
  where object.bucket_id = 'family-gallery'
    and object.name = photo.storage_path
);

commit;

notify pgrst, 'reload schema';
