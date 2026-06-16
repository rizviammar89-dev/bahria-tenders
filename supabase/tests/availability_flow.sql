-- Story 6.2 (AC-8): provider availability + auto-expiry + RLS.
-- provider_is_available = toggle ON and heartbeat within the window; a provider writes only own
-- availability; reputation columns stay non-client-writable (no regression to 1.3 lockdown).
begin;
select * from no_plan();

-- ---- Fixtures ----
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','provA@t.local','',now(),now()),
 ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','provB@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids) values
 ('22222222-2222-2222-2222-222222222222','provider','Avail','+923002220002','Precinct 10', true, '{}'),
 ('33333333-3333-3333-3333-333333333333','provider','Other','+923003330003','Precinct 10', true, '{}');

-- Default state: not available.
select is(public.provider_is_available('22222222-2222-2222-2222-222222222222'), false,
  'a provider defaults to not available');

-- Available + fresh heartbeat → available.
update public.profiles set is_available = true, availability_updated_at = now()
  where id = '22222222-2222-2222-2222-222222222222';
select is(public.provider_is_available('22222222-2222-2222-2222-222222222222'), true,
  'available with a fresh heartbeat → available');

-- Available but STALE heartbeat (older than the window) → not available (auto-expiry).
update public.profiles set is_available = true, availability_updated_at = now() - interval '30 minutes'
  where id = '22222222-2222-2222-2222-222222222222';
select is(public.provider_is_available('22222222-2222-2222-2222-222222222222', 15), false,
  'available but stale heartbeat → not available (auto-expiry)');

-- Toggle off → not available even if heartbeat is fresh.
update public.profiles set is_available = false, availability_updated_at = now()
  where id = '22222222-2222-2222-2222-222222222222';
select is(public.provider_is_available('22222222-2222-2222-2222-222222222222'), false,
  'toggled off → not available');

-- ---- RLS: a provider writes ONLY their own availability ----
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
-- Own row: allowed.
select lives_ok(
  $$ update public.profiles set is_available = true, availability_updated_at = now() where id = '22222222-2222-2222-2222-222222222222' $$,
  'a provider can set their own availability');
-- Another provider's row: RLS with-check blocks it (0 rows affected, no error) — verify it did NOT change.
update public.profiles set is_available = true, availability_updated_at = now()
  where id = '33333333-3333-3333-3333-333333333333';
-- Reputation columns remain non-writable by the client (no column grant) → still throws.
select throws_ok(
  $$ update public.profiles set rating_sum = 999 where id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'availability grant did NOT open reputation columns to clients');
reset role;

-- The other provider's availability was untouched by the cross-row write attempt.
select is(public.provider_is_available('33333333-3333-3333-3333-333333333333'), false,
  'a provider cannot flip another provider''s availability (RLS)');

select * from finish();
rollback;
