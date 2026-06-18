-- Quick-dev: provider profile media. A provider has an avatar and a gallery of "work done" photos
-- shown on their profile. Reviews already exist (public ratings) — no change needed there.
--
-- Storage: bucket 'provider-photos', public-read (so residents can view a provider's profile),
-- writes locked to the owner's own folder ("<uid>/avatar.<ext>", "<uid>/work/<...>.<ext>").

alter table public.profiles
  add column avatar_path      text,
  add column work_photo_paths text[] not null default '{}';

comment on column public.profiles.avatar_path is 'provider-photos object path for the profile picture';
comment on column public.profiles.work_photo_paths is 'provider-photos object paths for the work gallery, in order';

-- These columns are public (a profile is publicly viewable) and owner-editable, matching the
-- existing profiles grants.
grant select (avatar_path, work_photo_paths) on public.profiles to authenticated;
grant update (avatar_path, work_photo_paths) on public.profiles to authenticated;

-- Storage bucket (public read; idempotent).
insert into storage.buckets (id, name, public)
values ('provider-photos', 'provider-photos', true)
on conflict (id) do nothing;

create policy provider_photos_read on storage.objects
  for select to public
  using (bucket_id = 'provider-photos');

create policy provider_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE needed so an avatar at a fixed path can be overwritten (upsert).
create policy provider_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy provider_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'provider-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
