-- Story 3.3 (AC-5): reputation aggregation.
-- The AFTER-INSERT trigger increments the rated provider's raw components (via the REAL RLS
-- insert path, proving SECURITY DEFINER fires under a least-privileged resident). recompute_reputation()
-- rebuilds from source and is admin-only.
begin;
select * from no_plan();

-- ---- Fixtures (superuser) ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','resA@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','provP@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','provQ@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids) values
 ('11111111-1111-1111-1111-111111111111','resident','Ayesha','+923001110001','Precinct 10', false, '{}'),
 ('22222222-2222-2222-2222-222222222222','provider','Bilal','+923002220002','Precinct 10', true, array[(select id from public.services where slug='carpenter')]),
 ('44444444-4444-4444-4444-444444444444','provider','Qadir','+923004440004','Precinct 10', true, array[(select id from public.services where slug='carpenter')]);

-- Two completed carpenter jobs owned by Ayesha, both awarded to Bilal (so both are ratable).
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Build a shelf', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', s.id, 'Fix a door', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.bids (job_id, provider_id, price_pkr) values
 ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', 3000),
 ('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222', 4000);
update public.jobs set status='awarded', awarded_provider_id='22222222-2222-2222-2222-222222222222' where id in ('cccc0000-0000-0000-0000-000000000001','cccc0000-0000-0000-0000-000000000002');
update public.jobs set status='completed' where id in ('cccc0000-0000-0000-0000-000000000001','cccc0000-0000-0000-0000-000000000002');

-- Bilal starts with zero reputation.
select results_eq(
  $$ select rating_sum, rating_count from public.profiles where id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (0, 0) $$,
  'provider starts at 0/0');

-- ============================================================
-- Trigger: rating insert (via the RLS path, as the resident) increments reputation
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.ratings (job_id, provider_id, resident_id, stars) values
 ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',5);
reset role;
select results_eq(
  $$ select rating_sum, rating_count from public.profiles where id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (5, 1) $$,
  'a 5-star rating increments to 5/1 (SECURITY DEFINER trigger fired under the resident)');

-- A second rating accumulates.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.ratings (job_id, provider_id, resident_id, stars) values
 ('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',3);
reset role;
select results_eq(
  $$ select rating_sum, rating_count from public.profiles where id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (8, 2) $$,
  'a second 3-star rating accumulates to 8/2');

-- ============================================================
-- recompute_reputation: rebuild-from-source + admin-only
-- ============================================================
-- Not executable by a client (authenticated).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ select public.recompute_reputation() $$,
  '42501', null, 'recompute_reputation is not executable by authenticated');
reset role;

-- Corrupt the cache (Bilal inflated, Qadir given phantom ratings), then rebuild from source.
update public.profiles set rating_sum=999, rating_count=42 where id='22222222-2222-2222-2222-222222222222';
update public.profiles set rating_sum=7, rating_count=2 where id='44444444-4444-4444-4444-444444444444';
select lives_ok($$ select public.recompute_reputation() $$, 'admin/superuser can run recompute_reputation');
select results_eq(
  $$ select rating_sum, rating_count from public.profiles where id='22222222-2222-2222-2222-222222222222' $$,
  $$ values (8, 2) $$,
  'recompute rebuilds Bilal''s components from source (8/2)');
select results_eq(
  $$ select rating_sum, rating_count from public.profiles where id='44444444-4444-4444-4444-444444444444' $$,
  $$ values (0, 0) $$,
  'recompute zeroes a provider with no ratings');

select * from finish();
rollback;
