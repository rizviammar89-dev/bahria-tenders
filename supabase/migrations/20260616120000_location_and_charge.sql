-- Story 6.1: location capture + distance & visiting-charge rule (Epic 6, FR-26/FR-27 foundation).
-- PURE DB — no maps/realtime/native module. Proves the >3km / Rs 250 rule before any UI exists.
-- (1) jobs.lat/lng (nullable); (2) provider_locations; (3) haversine_km; (4) visiting_charge.

-- ============================================================
-- (1) Job coordinates — captured at post-time (GPS capture UI lands with the native build later).
-- ============================================================
alter table public.jobs
  add column lat double precision,
  add column lng double precision,
  -- Reject out-of-range coordinates (partial guard against bad/garbled GPS; nullable when absent).
  add constraint jobs_lat_range_chk check (lat is null or (lat between -90 and 90)),
  add constraint jobs_lng_range_chk check (lng is null or (lng between -180 and 180));

-- ============================================================
-- (2) provider_locations — latest position per provider. Provider writes own; residents read
--     (needed for the live map in 6.4); service_role all.
-- ============================================================
create table public.provider_locations (
  provider_id uuid primary key references public.profiles (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  updated_at  timestamptz not null default now()
);

revoke all on public.provider_locations from anon, authenticated;
grant all on public.provider_locations to service_role;
alter table public.provider_locations enable row level security;

grant select on public.provider_locations to authenticated;
grant insert on public.provider_locations to authenticated;
grant update (lat, lng, updated_at) on public.provider_locations to authenticated;

-- Residents need to see providers on the map → authenticated may read all locations.
create policy provider_locations_select_all on public.provider_locations
  for select to authenticated using (true);
-- A provider writes ONLY their own row.
create policy provider_locations_insert_own on public.provider_locations
  for insert to authenticated with check (provider_id = auth.uid());
create policy provider_locations_update_own on public.provider_locations
  for update to authenticated using (provider_id = auth.uid()) with check (provider_id = auth.uid());

-- ============================================================
-- (3) haversine_km — great-circle distance (km), pure/immutable. No PostGIS needed at this scale.
-- ============================================================
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision
language sql
immutable
as $$
  -- least(1.0, …) clamps the asin argument: float rounding can nudge it just past 1.0 for
  -- near-antipodal points, which would otherwise raise "input is out of range".
  select 2 * 6371 * asin(
    least(1.0, sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2
      + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
    ))
  );
$$;

-- ============================================================
-- (4) visiting_charge — distance job↔provider + the Rs 250 / >3km rule.
-- Missing either location → (null, 0): the UI surfaces nothing. SECURITY INVOKER: a resident
-- reads their own job (RLS) + a provider's location (granted select); no DEFINER needed.
-- ============================================================
create or replace function public.visiting_charge(p_job_id uuid, p_provider_id uuid)
returns table (distance_km double precision, charge_pkr integer)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_jlat double precision; v_jlng double precision;
  v_plat double precision; v_plng double precision;
  v_dist double precision;
begin
  select j.lat, j.lng into v_jlat, v_jlng from public.jobs j where j.id = p_job_id;
  select pl.lat, pl.lng into v_plat, v_plng from public.provider_locations pl where pl.provider_id = p_provider_id;

  if v_jlat is null or v_jlng is null or v_plat is null or v_plng is null then
    distance_km := null;
    charge_pkr := 0;
    return next;
    return;
  end if;

  v_dist := public.haversine_km(v_jlat, v_jlng, v_plat, v_plng);
  distance_km := v_dist;
  charge_pkr := case when v_dist > 3 then 250 else 0 end;  -- threshold/amount: build-time tunable
  return next;
end;
$$;

revoke all on function public.visiting_charge(uuid, uuid) from public, anon;
grant execute on function public.visiting_charge(uuid, uuid) to authenticated;
