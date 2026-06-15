-- Story 2.9 (AC-6): the complete_job RPC.
-- Only the owning resident, only from 'awarded', moves a job to 'completed'.
-- Every other path (not-awarded, already-completed, non-owner, awarded-provider, null uid) raises 42501.
begin;
select * from no_plan();

-- ---- Fixtures (superuser) ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','resA@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','resB@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','provP@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids) values
 ('11111111-1111-1111-1111-111111111111','resident','Ayesha','+923001110001','Precinct 10', false, '{}'),
 ('55555555-5555-5555-5555-555555555555','resident','Sara','+923005550005','Precinct 10', false, '{}'),
 ('22222222-2222-2222-2222-222222222222','provider','Bilal','+923002220002','Precinct 10', true, array[(select id from public.services where slug='carpenter')]);

-- Two open carpenter jobs owned by Ayesha; Bilal (222) bids on both.
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Build a shelf', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', s.id, 'Fix a door', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.bids (job_id, provider_id, price_pkr) values
 ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', 3000),
 ('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222', 4000);
-- Promote J1 to AWARDED (the composite FK now resolves — Bilal has a bid on J1). J2 stays open.
update public.jobs set status='awarded', awarded_provider_id='22222222-2222-2222-2222-222222222222'
  where id='cccc0000-0000-0000-0000-000000000001';

-- ============================================================
-- complete_job — deny paths first (so J1 stays awarded for them)
-- ============================================================
-- An OPEN (not-awarded) job cannot be completed.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ select public.complete_job('cccc0000-0000-0000-0000-000000000002') $$,
  '42501', null, 'cannot complete a job that is not awarded');
reset role;

-- A different resident cannot complete Ayesha's awarded job.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$ select public.complete_job('cccc0000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a resident cannot complete another resident''s job');
reset role;

-- The awarded provider (not the resident) cannot complete it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$ select public.complete_job('cccc0000-0000-0000-0000-000000000001') $$,
  '42501', null, 'the awarded provider cannot complete the job (resident-driven)');
reset role;

-- Default-deny: an authenticated context with NO identity (auth.uid() null) cannot complete.
set local role authenticated;
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select public.complete_job('cccc0000-0000-0000-0000-000000000001') $$,
  '42501', null, 'cannot complete when auth.uid() is null');
reset role;

-- J1 is still awarded after all the denied attempts.
select results_eq(
  $$ select status::text from public.jobs where id='cccc0000-0000-0000-0000-000000000001' $$,
  $$ values ('awarded') $$,
  'denied attempts left the job awarded');

-- ============================================================
-- complete_job — happy path
-- ============================================================
-- The owning resident completes their awarded job.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$ select public.complete_job('cccc0000-0000-0000-0000-000000000001') $$,
  'the owning resident can complete their awarded job');
-- Re-completing an already-completed job is rejected (one-way).
select throws_ok(
  $$ select public.complete_job('cccc0000-0000-0000-0000-000000000001') $$,
  '42501', null, 'cannot complete an already-completed job');
reset role;

-- The completion landed: J1 is completed.
select results_eq(
  $$ select status::text from public.jobs where id='cccc0000-0000-0000-0000-000000000001' $$,
  $$ values ('completed') $$,
  'complete_job set status=completed');

select * from finish();
rollback;
