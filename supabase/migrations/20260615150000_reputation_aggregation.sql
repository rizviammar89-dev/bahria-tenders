-- Story 3.3: reputation aggregation (FR-4, NFR-1).
-- Turns 3.1's ratings rows into the cached raw components (profiles.rating_sum / rating_count)
-- that reputationLabel (2.8) reads. Both functions are SECURITY DEFINER + `set search_path = public`:
-- the reputation columns are server-only (authenticated has no update grant — Story 1.3), so an
-- INVOKER function would be permission-denied. No new client grant on the reputation columns.

-- ============================================================
-- apply_rating_to_reputation — AFTER INSERT ON ratings: increment the rated provider's
-- raw components immediately (same txn as the rating insert → FR-13 "immediately").
-- INSERT-only is sufficient because ratings are write-once (Story 1.3: SELECT/INSERT grants
-- only, no update/delete, unique(job_id)). If an update/delete grant is ever added, add the
-- matching trigger(s) OR rely on recompute_reputation() to rebuild from source.
-- ============================================================
create or replace function public.apply_rating_to_reputation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set rating_sum = rating_sum + new.stars,
        rating_count = rating_count + 1
    where id = new.provider_id;
  return new;
end;
$$;

create trigger ratings_reputation_after_insert
  after insert on public.ratings
  for each row execute function public.apply_rating_to_reputation();

-- ============================================================
-- recompute_reputation — NFR-1 rebuild-from-source fallback. Rebuilds EVERY profile's
-- raw components from the ratings table (anyone with no ratings resets to 0/0). Covers ALL
-- profiles, not just providers, so it is the authoritative source-of-truth: if a rating ever
-- landed on a non-provider profile (only possible via a service_role insert bypassing RLS),
-- this still reconciles that row — closing any trigger↔recompute divergence.
-- Admin/service_role only — revoked from all client roles; the founder runs it via Studio:
--   select public.recompute_reputation();
-- ============================================================
create or replace function public.recompute_reputation()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles p
    set rating_sum = coalesce(agg.s, 0),
        rating_count = coalesce(agg.c, 0)
    from (
      select pr.id,
             (select sum(r.stars) from public.ratings r where r.provider_id = pr.id) as s,
             (select count(*)     from public.ratings r where r.provider_id = pr.id) as c
      from public.profiles pr
    ) agg
    where p.id = agg.id;
end;
$$;

revoke all on function public.recompute_reputation() from public, anon, authenticated;
