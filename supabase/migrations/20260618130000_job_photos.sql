-- Quick-dev: photo attachments for jobs. Residents attach pictures of the problem; providers
-- (who can see the job) view them to bid accurately.
--
-- Storage layout: bucket 'job-photos', object path = "<resident_uid>/<job_id>/<n>.jpg".
-- The bucket is public-read (unguessable paths) so the app renders photos via public URLs without
-- minting signed URLs — providers can see them, matching the chosen visibility. Writes are locked
-- to the authenticated owner's own top-level folder.

-- Column holding the uploaded object paths (relative to the bucket), in display order.
alter table public.jobs
  add column photo_paths text[] not null default '{}';

comment on column public.jobs.photo_paths is
  'Storage object paths in the job-photos bucket (resident-attached problem photos), in order.';

-- Bucket (public read; idempotent).
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', true)
on conflict (id) do nothing;

-- Anyone may READ (bucket is public; explicit policy keeps it readable even if RLS is strict).
create policy job_photos_read on storage.objects
  for select to public
  using (bucket_id = 'job-photos');

-- Authenticated users may upload only into their OWN top-level folder (= their uid).
create policy job_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owners may delete their own objects (e.g. when a job is removed / a photo re-picked).
create policy job_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
