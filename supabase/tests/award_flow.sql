-- Story 2.8 (AC-8): the award + contact-reveal RPCs.
-- award_job: only the owning resident, only from 'open', only to a provider who bid.
-- get_job_contacts: only a party (resident / awarded provider) of an awarded job.
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

-- Two open carpenter jobs owned by Ayesha; Bilal (222) bids on both.
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Build a shelf', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', s.id, 'Fix a door', 'Precinct 10' from public.services s where s.slug='carpenter';
insert into public.bids (job_id, provider_id, price_pkr) values
 ('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', 3000),
 ('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222', 4000);

-- ============================================================
-- award_job
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
-- Ayesha awards J1 to Bilal (who bid) → succeeds.
select lives_ok(
  $$ select public.award_job('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222') $$,
  'the owning resident can award an open job to a bidder');
-- Re-awarding the now-awarded job is rejected.
select throws_ok(
  $$ select public.award_job('cccc0000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'cannot re-award a job that is no longer open');
-- Awarding J2 to Qadir (who did NOT bid) is rejected.
select throws_ok(
  $$ select public.award_job('cccc0000-0000-0000-0000-000000000002','44444444-4444-4444-4444-444444444444') $$,
  '42501', null, 'cannot award to a provider who did not bid');
reset role;

-- The award landed: J1 is awarded to Bilal.
select results_eq(
  $$ select status::text, awarded_provider_id from public.jobs where id='cccc0000-0000-0000-0000-000000000001' $$,
  $$ values ('awarded', '22222222-2222-2222-2222-222222222222'::uuid) $$,
  'award_job set status=awarded and the awarded provider');

-- A different resident cannot award Ayesha's job.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$ select public.award_job('cccc0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'a resident cannot award another resident''s job');
reset role;

-- ============================================================
-- get_job_contacts (J1 is awarded to Bilal)
-- ============================================================
-- The resident sees both contacts (incl. the provider's phone).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select results_eq(
  $$ select provider_name, provider_phone from public.get_job_contacts('cccc0000-0000-0000-0000-000000000001') $$,
  $$ values ('Bilal'::text, '+923002220002'::text) $$,
  'the resident can read the awarded provider''s contact');
-- An un-awarded job has no contacts.
select throws_ok(
  $$ select public.get_job_contacts('cccc0000-0000-0000-0000-000000000002') $$,
  '42501', null, 'no contacts for a job that is not awarded');
reset role;
-- The awarded provider can read contacts too.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  $$ select public.get_job_contacts('cccc0000-0000-0000-0000-000000000001') $$,
  'the awarded provider can read the contacts');
reset role;
-- A stranger cannot.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  $$ select public.get_job_contacts('cccc0000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a non-party cannot read the contacts');
reset role;

select * from finish();
rollback;
