-- Two-way reviews: after a completed job, the provider can also rate the resident (not just the
-- resident rating the provider). `author_role` marks who wrote the rating; the subject is the other
-- party. Residents get their own cached reputation (resident_rating_sum / resident_rating_count).

-- 1. Who authored the rating. Existing rows are all resident→provider, so default 'resident'.
alter table public.ratings
  add column author_role text not null default 'resident'
    check (author_role in ('resident', 'provider'));

-- One rating per direction per job (was: one rating total per job).
alter table public.ratings drop constraint ratings_one_per_job;
alter table public.ratings add constraint ratings_one_per_job_per_author unique (job_id, author_role);

-- 2. Resident reputation columns (mirror the provider ones). Server-written only; client may read.
alter table public.profiles
  add column resident_rating_sum integer not null default 0,
  add column resident_rating_count integer not null default 0;
grant select (resident_rating_sum, resident_rating_count) on public.profiles to authenticated;

-- 3. RLS. Resident → provider (recreate to pin author_role); provider → resident (new).
drop policy ratings_insert_valid on public.ratings;

create policy ratings_insert_resident on public.ratings
  for insert to authenticated
  with check (
    author_role = 'resident'
    and resident_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = ratings.job_id
        and j.resident_id = auth.uid()
        and j.awarded_provider_id = ratings.provider_id
        and j.status = 'completed'
    )
  );

create policy ratings_insert_provider on public.ratings
  for insert to authenticated
  with check (
    author_role = 'provider'
    and provider_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = ratings.job_id
        and j.awarded_provider_id = auth.uid()
        and j.resident_id = ratings.resident_id
        and j.status = 'completed'
    )
  );

-- 4. Aggregation: credit the rated party based on who authored the rating.
create or replace function public.apply_rating_to_reputation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_role = 'resident' then
    update public.profiles
      set rating_sum = rating_sum + new.stars, rating_count = rating_count + 1
      where id = new.provider_id;
  else
    update public.profiles
      set resident_rating_sum = resident_rating_sum + new.stars,
          resident_rating_count = resident_rating_count + 1
      where id = new.resident_id;
  end if;
  return new;
end;
$$;

-- 5. Rebuild-from-source for BOTH directions.
create or replace function public.recompute_reputation()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p set
    rating_sum = coalesce(
      (select sum(r.stars) from public.ratings r where r.provider_id = p.id and r.author_role = 'resident'), 0),
    rating_count = coalesce(
      (select count(*) from public.ratings r where r.provider_id = p.id and r.author_role = 'resident'), 0),
    resident_rating_sum = coalesce(
      (select sum(r.stars) from public.ratings r where r.resident_id = p.id and r.author_role = 'provider'), 0),
    resident_rating_count = coalesce(
      (select count(*) from public.ratings r where r.resident_id = p.id and r.author_role = 'provider'), 0);
end;
$$;

revoke all on function public.recompute_reputation() from public, anon, authenticated;
