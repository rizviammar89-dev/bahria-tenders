-- Story 6.1 (AC-6): haversine distance + the >3km / Rs 250 visiting-charge rule.
-- Pure DB. Coordinates chosen with known separations: 1° latitude ≈ 111.19 km, so
-- ~0.018° ≈ 2.0 km (under 3 → charge 0) and ~0.036° ≈ 4.0 km (over 3 → charge 250).
begin;
select * from no_plan();

-- ---- haversine_km sanity ----
select is(public.haversine_km(24.8, 67.0, 24.8, 67.0), 0::double precision, 'same point is 0 km');
-- ~2 km apart (0.018° lat).
select ok(
  abs(public.haversine_km(24.8000, 67.0000, 24.8180, 67.0000) - 2.0) < 0.1,
  'haversine ~2.0 km for 0.018° latitude (within tolerance)');
-- ~4 km apart (0.036° lat).
select ok(
  abs(public.haversine_km(24.8000, 67.0000, 24.8360, 67.0000) - 4.0) < 0.1,
  'haversine ~4.0 km for 0.036° latitude (within tolerance)');

-- ---- Fixtures ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','res@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','near@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','far@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','noloc@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids) values
 ('11111111-1111-1111-1111-111111111111','resident','Ayesha','+923001110001','Precinct 10', false, '{}'),
 ('22222222-2222-2222-2222-222222222222','provider','Near','+923002220002','Precinct 10', true, array[(select id from public.services where slug='carpenter')]),
 ('33333333-3333-3333-3333-333333333333','provider','Far','+923003330003','Precinct 10', true, array[(select id from public.services where slug='carpenter')]),
 ('44444444-4444-4444-4444-444444444444','provider','NoLoc','+923004440004','Precinct 10', true, array[(select id from public.services where slug='carpenter')]);

-- Job WITH coordinates.
insert into public.jobs (id, resident_id, service_id, description, precinct, lat, lng)
select 'cccc0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Shelf', 'Precinct 10', 24.8000, 67.0000 from public.services s where s.slug='carpenter';
-- Job WITHOUT coordinates (legacy/POC job).
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', s.id, 'Door', 'Precinct 10' from public.services s where s.slug='carpenter';

-- Provider locations: Near ~2.0 km, Far ~4.0 km, NoLoc has none.
insert into public.provider_locations (provider_id, lat, lng) values
 ('22222222-2222-2222-2222-222222222222', 24.8180, 67.0000),
 ('33333333-3333-3333-3333-333333333333', 24.8360, 67.0000);

-- ---- visiting_charge as the owning resident ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

-- Near provider (~2 km, under 3) → no charge.
select is(
  (select charge_pkr from public.visiting_charge('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222')),
  0, 'within 3 km → charge 0');
-- Far provider (~4 km, over 3) → Rs 250.
select is(
  (select charge_pkr from public.visiting_charge('cccc0000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333')),
  250, 'beyond 3 km → charge 250');
select ok(
  (select distance_km from public.visiting_charge('cccc0000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333')) > 3,
  'far provider distance is > 3 km');
-- Provider with NO location row → (null, 0).
select is(
  (select charge_pkr from public.visiting_charge('cccc0000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444')),
  0, 'missing provider location → charge 0');
select ok(
  (select distance_km is null from public.visiting_charge('cccc0000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444')),
  'missing provider location → distance null');
-- Job with NO coordinates → (null, 0).
select is(
  (select charge_pkr from public.visiting_charge('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222')),
  0, 'job without coordinates → charge 0');
select ok(
  (select distance_km is null from public.visiting_charge('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222')),
  'job without coordinates → distance null');
reset role;

select * from finish();
rollback;
