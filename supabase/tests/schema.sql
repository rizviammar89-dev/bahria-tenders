-- Story 1.2 (AC-9): structural assertions for the POC core schema.
-- Runs inside a rolled-back transaction (supabase test db).
begin;
select plan(43);

-- ---- Tables exist (AC-2..AC-8) ----
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'services', 'services table exists');
select has_table('public', 'jobs', 'jobs table exists');
select has_table('public', 'bids', 'bids table exists');
select has_table('public', 'ratings', 'ratings table exists');
select has_table('public', 'notification_log', 'notification_log table exists');
select has_table('public', 'disputes', 'disputes table exists');

-- ---- Primary keys ----
select col_is_pk('public', 'profiles', 'id', 'profiles.id is PK');
select col_is_pk('public', 'services', 'id', 'services.id is PK');
select col_is_pk('public', 'jobs', 'id', 'jobs.id is PK');
select col_is_pk('public', 'bids', 'id', 'bids.id is PK');
select col_is_pk('public', 'ratings', 'id', 'ratings.id is PK');
select col_is_pk('public', 'notification_log', 'id', 'notification_log.id is PK');
select col_is_pk('public', 'disputes', 'id', 'disputes.id is PK');

-- ---- Enums have EXACTLY the locked labels (AC-1) ----
select has_enum('user_role', 'user_role enum exists');
select enum_has_labels('user_role', ARRAY['resident', 'provider'], 'user_role labels');
select has_enum('job_status', 'job_status enum exists');
select enum_has_labels('job_status', ARRAY['open', 'awarded', 'completed', 'cancelled'], 'job_status labels');
select has_enum('dispute_status', 'dispute_status enum exists');
select enum_has_labels('dispute_status', ARRAY['pending_review', 'legit_remedied', 'legit_unresolved', 'not_upheld'], 'dispute_status labels');
select has_enum('notification_channel', 'notification_channel enum exists');
select enum_has_labels('notification_channel', ARRAY['push', 'whatsapp_manual', 'sms'], 'notification_channel labels');

-- ---- Identity / key fields (AC-2) ----
select col_not_null('public', 'profiles', 'role', 'profiles.role NOT NULL');
select col_not_null('public', 'profiles', 'phone', 'profiles.phone NOT NULL');
select col_not_null('public', 'profiles', 'precinct', 'profiles.precinct NOT NULL');
select col_has_default('public', 'profiles', 'verified_by_admin', 'profiles.verified_by_admin has default');

-- ---- UNIQUE constraints (AC-2, AC-5, AC-6, AC-7) ----
select col_is_unique('public', 'profiles', 'phone', 'profiles.phone is UNIQUE');
select col_is_unique('public', 'bids', ARRAY['job_id', 'provider_id'], 'bids(job_id,provider_id) UNIQUE — one bid per provider');
select col_is_unique('public', 'ratings', 'job_id', 'ratings.job_id UNIQUE — one rating per job');
select col_is_unique('public', 'notification_log', 'idempotency_key', 'notification_log.idempotency_key UNIQUE');
select col_is_unique('public', 'services', 'slug', 'services.slug UNIQUE');

-- ---- Seed: exactly the 6 PRD trades (AC-3) ----
select is((select count(*) from public.services)::int, 6, 'exactly 6 services seeded');
select is(
  (select array_agg(slug order by slug) from public.services),
  ARRAY['ac_technician','carpenter','electrician','mason','painter','plumber'],
  'seeded service slugs match the 6 PRD trades');

-- ---- Fixtures for behavioral constraint checks ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'res@test.local', '', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'prov@test.local', '', now(), now(), now());

insert into public.profiles (id, role, full_name, phone, precinct)
values
  ('11111111-1111-1111-1111-111111111111', 'resident', 'Test Resident', '+923001112233', 'Precinct 10'),
  ('22222222-2222-2222-2222-222222222222', 'provider', 'Test Provider', '+923004445566', 'Precinct 10');

-- Bad phone (no +92) is rejected by the CHECK (AC-2)
select throws_ok(
  $$ insert into public.profiles (id, role, full_name, phone, precinct)
     values ('11111111-1111-1111-1111-111111111111', 'resident', 'x', '03001234567', 'P10') $$,
  '23514', -- check_violation
  null,
  'profiles.phone CHECK rejects non-E.164 phone');

-- One bid per provider per job: second bid by same provider on same job is rejected (AC-5)
insert into public.jobs (id, resident_id, service_id, description, precinct)
select '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', s.id, 'Leaky tap', 'Precinct 10'
from public.services s where s.slug = 'plumber';

insert into public.bids (job_id, provider_id, price_pkr)
values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 1500);

select throws_ok(
  $$ insert into public.bids (job_id, provider_id, price_pkr)
     values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 1800) $$,
  '23505', -- unique_violation
  null,
  'bids UNIQUE(job_id,provider_id) rejects a second bid by the same provider');

-- price must be positive (AC-5)
select throws_ok(
  $$ insert into public.bids (job_id, provider_id, price_pkr)
     values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 0) $$,
  '23514',
  null,
  'bids.price_pkr CHECK rejects non-positive price');

-- stars must be 1..5 (AC-6)
select throws_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars)
     values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 6) $$,
  '23514',
  null,
  'ratings.stars CHECK rejects out-of-range value');

-- ---- Positive path + behavioral coverage (review hardening) ----

-- A valid rating inserts cleanly
select lives_ok(
  $$ insert into public.ratings (job_id, provider_id, resident_id, stars, review)
     values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 5, 'Great work') $$,
  'a valid rating inserts');

-- Duplicate idempotency_key is rejected (AC-7 behavioral)
insert into public.notification_log (recipient_id, channel, idempotency_key)
values ('22222222-2222-2222-2222-222222222222', 'push', 'job-333-prov-222');
select throws_ok(
  $$ insert into public.notification_log (recipient_id, channel, idempotency_key)
     values ('22222222-2222-2222-2222-222222222222', 'push', 'job-333-prov-222') $$,
  '23505',
  null,
  'notification_log UNIQUE(idempotency_key) rejects a duplicate send');

-- Invalid enum value is rejected at cast time
select throws_ok(
  $$ select 'bogus'::public.job_status $$,
  '22P02',
  null,
  'job_status enum rejects an unknown value');

-- Award integrity (composite FK): awarding a provider who never bid is rejected
select throws_ok(
  $$ update public.jobs set status = 'awarded', awarded_provider_id = '11111111-1111-1111-1111-111111111111'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  '23503', -- foreign_key_violation
  null,
  'jobs cannot be awarded to a provider who did not bid on the job');

-- Award integrity: awarding the actual bidder (provider 222 bid 1500) succeeds
select lives_ok(
  $$ update public.jobs set status = 'awarded', awarded_provider_id = '22222222-2222-2222-2222-222222222222'
     where id = '33333333-3333-3333-3333-333333333333' $$,
  'a job can be awarded to a real bidder');

-- jobs cancel-consistency CHECK: cancelled_at set without status='cancelled' is rejected
select throws_ok(
  $$ insert into public.jobs (resident_id, service_id, description, precinct, status, cancelled_at)
     select '11111111-1111-1111-1111-111111111111', s.id, 'x', 'P10', 'open', now()
     from public.services s where s.slug = 'plumber' $$,
  '23514',
  null,
  'jobs cancel-consistency CHECK rejects cancelled_at without status=cancelled');

select * from finish();
rollback;
