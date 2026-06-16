-- Story 2.5 (AC-7): the broadcast_job() matcher.
-- One idempotent notification_log push row per matching VERIFIED provider (trade ∈ service_ids
-- AND same precinct, excluding the resident); excludes wrong-trade / wrong-precinct / unverified;
-- returns only unsent rows that have a token; not callable by clients.
begin;
select * from no_plan();

-- ---- Fixtures (superuser) ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','res@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','carpA@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','carpB@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','carpUnverified@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','plumber@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','66666666-6666-6666-6666-666666666666','authenticated','authenticated','carpOtherPrecinct@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids) values
 ('11111111-1111-1111-1111-111111111111','resident','Ayesha','+923001110001','Precinct 10', false, '{}'),
 -- Two verified carpenters in Precinct 10 → SHOULD match.
 ('22222222-2222-2222-2222-222222222222','provider','Bilal','+923002220002','Precinct 10', true, array[(select id from public.services where slug='carpenter')]),
 ('33333333-3333-3333-3333-333333333333','provider','Cad','+923003330003','Precinct 10', true, array[(select id from public.services where slug='carpenter')]),
 -- Unverified carpenter, right precinct → must NOT match.
 ('44444444-4444-4444-4444-444444444444','provider','Dawood','+923004440004','Precinct 10', false, array[(select id from public.services where slug='carpenter')]),
 -- Verified plumber (wrong trade), right precinct → must NOT match.
 ('55555555-5555-5555-5555-555555555555','provider','Emad','+923005550005','Precinct 10', true, array[(select id from public.services where slug='plumber')]),
 -- Verified carpenter, WRONG precinct → must NOT match.
 ('66666666-6666-6666-6666-666666666666','provider','Faisal','+923006660006','Precinct 12', true, array[(select id from public.services where slug='carpenter')]);

-- Tokens: Bilal has one, Cad does NOT (so Cad is logged but not returned for send).
insert into public.push_tokens (user_id, expo_push_token) values
 ('22222222-2222-2222-2222-222222222222','ExponentPushToken[BILAL]');

-- An OPEN carpenter job in Precinct 10 by Ayesha.
insert into public.jobs (id, resident_id, service_id, description, precinct)
select 'cccc0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111', s.id, 'Build a shelf', 'Precinct 10' from public.services s where s.slug='carpenter';

-- ============================================================
-- broadcast_job — run as superuser (the Edge Function uses service_role)
-- ============================================================
-- Returns only unsent rows WITH a token → just Bilal (Cad matches but has no token).
select results_eq(
  $$ select recipient_id, expo_push_token from public.broadcast_job('cccc0000-0000-0000-0000-000000000001') order by recipient_id $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid, 'ExponentPushToken[BILAL]') $$,
  'broadcast_job returns only matching providers that have a token');

-- It logged exactly the 2 matching verified carpenters in Precinct 10 (Bilal + Cad), nobody else.
select results_eq(
  $$ select recipient_id from public.notification_log where job_id='cccc0000-0000-0000-0000-000000000001' and channel='push' order by recipient_id $$,
  $$ values ('22222222-2222-2222-2222-222222222222'::uuid), ('33333333-3333-3333-3333-333333333333'::uuid) $$,
  'logged exactly the matching verified providers (excludes unverified / wrong-trade / wrong-precinct / resident)');

select is(
  (select count(*)::int from public.notification_log where job_id='cccc0000-0000-0000-0000-000000000001'),
  2, 'exactly 2 notification rows written');

-- Idempotent: re-running inserts no new rows.
select public.broadcast_job('cccc0000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.notification_log where job_id='cccc0000-0000-0000-0000-000000000001'),
  2, 're-running broadcast_job is idempotent (no duplicate rows)');

-- After the dispatcher marks Bilal sent, a retry returns nobody (only unsent rows are returned).
update public.notification_log set sent_at = now()
  where job_id='cccc0000-0000-0000-0000-000000000001' and recipient_id='22222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.broadcast_job('cccc0000-0000-0000-0000-000000000001')),
  0, 'a sent row is not returned again (retry-safe)');

-- ============================================================
-- Authz: clients cannot call the matcher.
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok(
  $$ select public.broadcast_job('cccc0000-0000-0000-0000-000000000001') $$,
  '42501', null, 'broadcast_job is not executable by authenticated');
reset role;

select * from finish();
rollback;
