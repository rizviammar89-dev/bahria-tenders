-- Story 1.3 (AC-9): behavioral RLS / deny assertions.
-- Auth is simulated by switching role + setting request.jwt.claims so auth.uid() resolves.
-- Denial shapes: no GRANT -> 42501; RLS WITH CHECK/USING violation on write -> 42501;
-- RLS-filtered SELECT -> empty result (no error). Fixtures built as superuser (bypass RLS).
begin;
select * from no_plan();

-- ============================================================
-- Fixtures (as superuser — bypasses RLS)
-- ============================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','resA@t.local','',now(),now(),now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','provP@t.local','',now(),now(),now()),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','provQ@t.local','',now(),now(),now()),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','resB@t.local','',now(),now(),now()),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-6666-6666-666666666666','authenticated','authenticated','provU@t.local','',now(),now(),now());

insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin) values
  ('11111111-1111-1111-1111-111111111111','resident','Resident A','+923001110001','Precinct 10', false),
  ('22222222-2222-2222-2222-222222222222','provider','Provider P','+923002220002','Precinct 10', true),
  ('44444444-4444-4444-4444-444444444444','provider','Provider Q','+923004440004','Precinct 10', true),
  ('55555555-5555-5555-5555-555555555555','resident','Resident B','+923005550005','Precinct 10', false),
  ('66666666-6666-6666-6666-666666666666','provider','Provider U','+923006660006','Precinct 10', false);

-- J1: resident A, open
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'aaaa0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Leaky tap', 'Precinct 10'
from public.services s where s.slug = 'plumber';
-- J3: a provider (222) acting as resident on their own job, open (for the bid-on-own-job test)
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'aaaa0000-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222', s.id, 'Provider-owned job', 'Precinct 10'
from public.services s where s.slug = 'plumber';
-- J2: resident A, completed + awarded to P (needs a bid first for the composite FK)
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'aaaa0000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111', s.id, 'Completed job', 'Precinct 10'
from public.services s where s.slug = 'plumber';
insert into public.bids (job_id, provider_id, price_pkr)
values ('aaaa0000-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222', 2000);
update public.jobs set status='completed', awarded_provider_id='22222222-2222-2222-2222-222222222222'
where id='aaaa0000-0000-0000-0000-000000000002';
-- notification for provider P
insert into public.notification_log (recipient_id, channel, idempotency_key)
values ('22222222-2222-2222-2222-222222222222','push','n-1');

-- ============================================================
-- anon: no grants -> permission denied (42501)
-- ============================================================
set local role anon;
select throws_ok('select 1 from public.jobs', '42501', null, 'anon cannot read jobs');
select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');
reset role;

-- ============================================================
-- Reputation lockdown: authenticated cannot write rating_sum; service_role can
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  'update public.profiles set rating_sum = 999 where id = ''22222222-2222-2222-2222-222222222222''',
  '42501', null, 'provider cannot write own rating_sum (no column grant)');
reset role;

set local role service_role;
select lives_ok(
  'update public.profiles set rating_sum = 5, rating_count = 1 where id = ''22222222-2222-2222-2222-222222222222''',
  'service_role CAN write reputation (bypasses RLS, has grant)');
reset role;

-- ============================================================
-- profiles: update own allowed; update other's row silently affects 0 rows
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  'update public.profiles set full_name = ''Provider P v2'' where id = ''22222222-2222-2222-2222-222222222222''',
  'a user can update their own profile name');
select lives_ok(
  'update public.profiles set full_name = ''HACKED'' where id = ''11111111-1111-1111-1111-111111111111''',
  'updating another user''s row does not error (RLS skips the row)');
-- phone column is not granted to authenticated
select throws_ok(
  'select phone from public.profiles where id = ''22222222-2222-2222-2222-222222222222''',
  '42501', null, 'authenticated cannot read the phone column');
reset role;
-- the cross-user update affected 0 rows
select is((select full_name from public.profiles where id='11111111-1111-1111-1111-111111111111'),
          'Resident A', 'another user''s profile was NOT modified');

-- ============================================================
-- ratings: write-once + correct attribution
-- ============================================================
-- valid: the hiring resident rates the awarded provider on a completed job
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  'insert into public.ratings (job_id, provider_id, resident_id, stars) values
    (''aaaa0000-0000-0000-0000-000000000002'',''22222222-2222-2222-2222-222222222222'',''11111111-1111-1111-1111-111111111111'',5)',
  'hiring resident can rate the awarded provider on a completed job');
-- write-once: no update / delete policy
select throws_ok(
  'update public.ratings set stars = 1 where job_id = ''aaaa0000-0000-0000-0000-000000000002''',
  '42501', null, 'a rating cannot be updated (write-once)');
select throws_ok(
  'delete from public.ratings where job_id = ''aaaa0000-0000-0000-0000-000000000002''',
  '42501', null, 'a rating cannot be deleted (write-once)');
reset role;
-- wrong rater: resident B tries to rate resident A''s job
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select throws_ok(
  'insert into public.ratings (job_id, provider_id, resident_id, stars) values
    (''aaaa0000-0000-0000-0000-000000000002'',''22222222-2222-2222-2222-222222222222'',''55555555-5555-5555-5555-555555555555'',5)',
  '42501', null, 'a non-hiring resident cannot rate the job');
reset role;
-- wrong ratee: resident A rates a provider who was not awarded
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  'insert into public.ratings (job_id, provider_id, resident_id, stars) values
    (''aaaa0000-0000-0000-0000-000000000002'',''44444444-4444-4444-4444-444444444444'',''11111111-1111-1111-1111-111111111111'',5)',
  '42501', null, 'cannot rate a provider who was not awarded the job');
reset role;

-- ============================================================
-- bids: verified provider, not own job
-- ============================================================
-- valid: verified provider P bids on resident A''s open job J1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok(
  'insert into public.bids (job_id, provider_id, price_pkr) values
    (''aaaa0000-0000-0000-0000-000000000001'',''22222222-2222-2222-2222-222222222222'',1500)',
  'verified provider can bid on another resident''s open job');
-- bid on own job: provider 222 owns J3
select throws_ok(
  'insert into public.bids (job_id, provider_id, price_pkr) values
    (''aaaa0000-0000-0000-0000-000000000003'',''22222222-2222-2222-2222-222222222222'',1500)',
  '42501', null, 'a provider cannot bid on their own job');
reset role;
-- unverified provider U cannot bid
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select throws_ok(
  'insert into public.bids (job_id, provider_id, price_pkr) values
    (''aaaa0000-0000-0000-0000-000000000001'',''66666666-6666-6666-6666-666666666666'',1200)',
  '42501', null, 'an unverified provider cannot bid');
reset role;

-- ============================================================
-- jobs: cross-tenant isolation
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is_empty(
  'select 1 from public.jobs where id = ''aaaa0000-0000-0000-0000-000000000002''',
  'resident B cannot see resident A''s completed (non-open) job');
select throws_ok(
  'insert into public.jobs (resident_id, service_id, description, precinct)
   select ''11111111-1111-1111-1111-111111111111'', s.id, ''forged'', ''P10'' from public.services s where s.slug=''plumber''',
  '42501', null, 'a resident cannot post a job as another resident');
reset role;

-- ============================================================
-- notification_log: recipient-read, server-write
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select isnt_empty(
  'select 1 from public.notification_log where recipient_id = ''22222222-2222-2222-2222-222222222222''',
  'a recipient can read their own notifications');
select throws_ok(
  'insert into public.notification_log (recipient_id, channel, idempotency_key) values
    (''22222222-2222-2222-2222-222222222222'',''push'',''hack'')',
  '42501', null, 'a client cannot insert a notification_log row');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is_empty(
  'select 1 from public.notification_log where recipient_id = ''22222222-2222-2222-2222-222222222222''',
  'a user cannot read another user''s notifications');
reset role;

-- ============================================================
-- services: readable, not client-writable
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*) from public.services)::int, 6, 'authenticated can read the 6 services');
select throws_ok(
  'insert into public.services (slug, display_en, display_ur) values (''x'',''X'',''X'')',
  '42501', null, 'authenticated cannot insert a service');
reset role;

select * from finish();
rollback;
