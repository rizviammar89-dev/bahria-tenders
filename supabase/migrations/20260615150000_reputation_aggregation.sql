-- Story 3.3: reputation aggregation (FR-4, NFR-1).
-- Turns 3.1's ratings rows into the cached raw components (profiles.rating_sum / rating_count)
-- that reputationLabel (2.8) reads. Both functions are SECURITY DEFINER + `set search_path = public`:
-- the reputation columns are server-only (authenticated has no update grant — Story 1.3), so an
-- INVOKER function would be permission-denied. No new client grant on the reputation columns.

-- ============================================================
-- apply_rating_to_reputation — AFTER INSERT ON ratings: increment the rated provider's
-- raw components immediately (same txn as the rating insert → FR-13 "immediately").
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
-- recompute_reputation — NFR-1 rebuild-from-source fallback. Rebuilds EVERY provider's
-- raw components from the ratings table (providers with no ratings reset to 0/0).
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
      where pr.role = 'provider'
    ) agg
    where p.id = agg.id;
end;
$$;

revoke all on function public.recompute_reputation() from public, anon, authenticated;
