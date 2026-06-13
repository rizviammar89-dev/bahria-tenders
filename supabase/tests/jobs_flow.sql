-- Story 2.1 (AC-6): the demand-loop flow — positive path that the deny suite (rls.sql) doesn't cover.
-- A resident can post their own job, and it lands in status 'open'. (Posting as another resident
-- is already proven denied in rls.sql.)
begin;
select * from no_plan();

-- Fixtures (as superuser — bypasses RLS)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','res@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct)
values ('11111111-1111-1111-1111-111111111111','resident','Ayesha','+923001110001','Precinct 10');

-- As the resident: posting their own job succeeds.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.jobs (resident_id, service_id, description, precinct)
     select '11111111-1111-1111-1111-111111111111', s.id, 'Leaky tap', 'Precinct 10'
     from public.services s where s.slug = 'plumber' $$,
  'a resident can post their own job');
reset role;

-- The posted job is visible, owned by the resident, and defaulted to status 'open'.
select results_eq(
  $$ select status::text, resident_id from public.jobs where description = 'Leaky tap' $$,
  $$ values ('open', '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'the posted job defaults to status=open and is owned by the resident');

-- ============================================================
-- Story 2.3 (AC-6): provider job-discovery feed query.
-- A verified carpenter sees open carpenter jobs, not other trades, not non-open.
-- ============================================================
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','prov@t.local','',now(),now());
insert into public.profiles (id, role, full_name, phone, precinct, verified_by_admin, service_ids)
values ('22222222-2222-2222-2222-222222222222','provider','Bilal','+923002220002','Precinct 10', true,
        array[(select id from public.services where slug = 'carpenter')]);

-- An open carpenter job (should appear), and a cancelled carpenter job (should NOT).
-- (The existing 'Leaky tap' plumber job should NOT appear — wrong trade.)
insert into public.jobs (resident_id, service_id, description, precinct)
select '11111111-1111-1111-1111-111111111111', s.id, 'Build a shelf', 'Precinct 10'
from public.services s where s.slug = 'carpenter';
insert into public.jobs (resident_id, service_id, description, precinct, status, cancelled_at)
select '11111111-1111-1111-1111-111111111111', s.id, 'Cancelled carpentry', 'Precinct 10', 'cancelled', now()
from public.services s where s.slug = 'carpenter';
-- An OPEN carpenter job the provider posted themselves — must be excluded (resident_id <> me).
insert into public.jobs (resident_id, service_id, description, precinct)
select '22222222-2222-2222-2222-222222222222', s.id, 'My own carpentry', 'Precinct 10'
from public.services s where s.slug = 'carpenter';

-- The feed query, run AS the provider (mirrors the client: status=open, my trades, not my own).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select results_eq(
  $$ select description from public.jobs
     where status = 'open'
       and service_id in (select unnest(service_ids) from public.profiles where id = auth.uid())
       and resident_id <> auth.uid()
     order by created_at $$,
  $$ values ('Build a shelf'::text) $$,
  'the feed returns only the open job in the provider''s trade (not other-trade, not cancelled)');

-- Story 2.4 (AC-6): the verified provider submits a bid on the open in-trade job, then edits it.
select lives_ok(
  $$ insert into public.bids (job_id, provider_id, price_pkr)
     select id, '22222222-2222-2222-2222-222222222222', 3000
     from public.jobs where description = 'Build a shelf' $$,
  'a verified provider can bid on an open in-trade job');
select results_eq(
  $$ select price_pkr from public.bids b
     join public.jobs j on j.id = b.job_id
     where j.description = 'Build a shelf' and b.provider_id = auth.uid() $$,
  $$ values (3000) $$,
  'the submitted bid is stored at the given price');
select lives_ok(
  $$ update public.bids set price_pkr = 3500
     where provider_id = '22222222-2222-2222-2222-222222222222'
       and job_id = (select id from public.jobs where description = 'Build a shelf') $$,
  'the provider can edit their bid while the job is open');
select results_eq(
  $$ select price_pkr from public.bids b
     join public.jobs j on j.id = b.job_id
     where j.description = 'Build a shelf' and b.provider_id = auth.uid() $$,
  $$ values (3500) $$,
  'the edited bid reflects the new price');
reset role;

select * from finish();
rollback;
