-- Story 6.2: provider availability + auto-expiry (Epic 6, FR-28 / reactivates FR-19).
-- Availability columns on profiles + a freshness rule so a stale toggle doesn't mislead.
-- Providers publish location into provider_locations (6.1); availability_updated_at is the heartbeat.

-- ============================================================
-- (1) Availability state on profiles.
-- ============================================================
alter table public.profiles
  add column is_available boolean not null default false,
  add column availability_updated_at timestamptz;

-- Widen the column-scoped client UPDATE grant (self-write only; reputation/role/phone stay server-only).
-- Story 1.3 granted (full_name, precinct, service_ids); add the two availability columns.
grant update (is_available, availability_updated_at) on public.profiles to authenticated;

-- ============================================================
-- (2) provider_is_available — toggle ON and heartbeat within the window (FR-19 auto-expiry).
-- A provider who backgrounded/died with the toggle on goes stale and is no longer "available".
-- ============================================================
create or replace function public.provider_is_available(p_provider_id uuid, p_window_mins int default 15)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select p.is_available
        and p.availability_updated_at is not null
        and p.availability_updated_at > now() - make_interval(mins => p_window_mins)
     from public.profiles p
     where p.id = p_provider_id),
    false
  );
$$;

revoke all on function public.provider_is_available(uuid, int) from public, anon;
grant execute on function public.provider_is_available(uuid, int) to authenticated;
