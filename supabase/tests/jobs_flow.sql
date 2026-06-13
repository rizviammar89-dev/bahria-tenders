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

select * from finish();
rollback;
