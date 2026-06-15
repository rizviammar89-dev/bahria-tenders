-- Story 3.1 (AC-7): the ratings insert path — enforced entirely by RLS (no RPC).
-- Only the owning resident, only on a COMPLETED job awarded to that provider, once (write-once),
-- with stars 1–5. Every other path is rejected.
begin;
select * from no_plan();

-- ---- Fixtures (superuser) ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','resA@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','resB@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','provP@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','provQ@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids) values
 ('11111111-1111-1111-1111-111111111111','resident','Ayesha','+923001110001','Precinct 10', false, '{}'),
 ('55555555-5555-5555-5555-555555555555','resident','Sara','+923005550005','Precinct 10', false, '{}'),
 ('22222222-2222-2222-2222-222222222222','provider','Bilal','+923002220002','Precinct 10', true, array[(select id from public.services where slug='carpenter')]),
 ('44444444-4444-4444-4444-444444444444','provider','Qadir','+923004440004','Precinct 10', true, array[(select id from public.services where slug='carpenter')]);

-- J1: COMPLETED, awarded to Bilal (ratable). J2: OPEN (not ratable). Both owned by Ayesha; Bilal bid on both.
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Build a shelf', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', s.id, 'Fix a door', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.bids (job_id, provider_id, price_pkr) values
 ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', 3000),
 ('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222', 4000);
update public.jobs set status='awarded', awarded_provider_id='22222222-2222-2222-2222-222222222222' where id='cccc0000-0000-0000-0000-000000000001';
update public.jobs set status='completed' where id='cccc0000-0000-0000-0000-000000000001';

-- ============================================================
-- ratings insert — deny paths
-- ============================================================
-- An OPEN (not-completed) job cannot be rated.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars) values ('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',5) $$,
  '42501', null, 'cannot rate a job that is not completed');

-- Rating with a provider who was NOT the awarded provider is rejected.
select throws_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars) values ('cccc0000-0000-0000-0000-000000000001','44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111',5) $$,
  '42501', null, 'cannot rate a provider who was not the awarded provider');

-- stars out of range is rejected by the CHECK constraint.
select throws_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars) values ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',6) $$,
  '23514', null, 'stars > 5 violates the CHECK constraint');
reset role;

-- A different resident cannot rate Ayesha's job (attribution + ownership).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars) values ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','55555555-5555-5555-5555-555555555555',4) $$,
  '42501', null, 'a non-owner resident cannot rate the job');
reset role;

-- ============================================================
-- ratings insert — happy path + write-once
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars, review) values ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',5,'Great work') $$,
  'the owning resident can rate their completed job');

-- Write-once: a second rating on the same job is rejected (unique ratings_one_per_job).
select throws_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars) values ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111',3) $$,
  '23505', null, 'a job cannot be rated twice (unique violation)');

-- Write-once: no UPDATE permitted (no grant/policy).
select throws_ok(
  $$ update public.ratings set stars = 1 where job_id = 'cccc0000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a rating cannot be updated (write-once)');

-- Write-once: no DELETE permitted.
select throws_ok(
  $$ delete from public.ratings where job_id = 'cccc0000-0000-0000-0000-000000000001' $$,
  '42501', null, 'a rating cannot be deleted (write-once)');
reset role;

-- The rating landed.
select results_eq(
  $$ select stars::int, review from public.ratings where job_id='cccc0000-0000-0000-0000-000000000001' $$,
  $$ values (5, 'Great work') $$,
  'the rating row persists with stars + review');

select * from finish();
rollback;
