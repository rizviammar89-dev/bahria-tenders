-- Story 1.3: Row-Level Security, grants, and integrity lockdown for the POC schema.
-- Order: revoke-all (deny baseline) -> grant precisely -> enable RLS -> create policies.
-- service_role bypasses RLS (the founder / Edge Function context) and is granted full table access.
-- All reputation/verification/contact/notification/dispute-resolution writes are server-only by design.

-- ============================================================
-- 0. Deny baseline + service_role full access
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','services','jobs','bids','ratings','notification_log','disputes']
  loop
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ============================================================
-- services — public reference data (read-only for clients)
-- ============================================================
grant select on public.services to authenticated;
create policy services_select_all on public.services
  for select to authenticated using (true);

-- ============================================================
-- profiles — public reputation readable; phone private; reputation/verification server-only
-- ============================================================
-- Column-scoped SELECT: NOT phone / phone_verified_at (contact shared post-award via service_role).
grant select (id, role, full_name, precinct, verified_by_admin, service_ids, rating_sum, rating_count, created_at)
  on public.profiles to authenticated;
-- Column-scoped UPDATE: only self-editable fields (reputation, verification, role, phone are server-only).
grant update (full_name, precinct, service_ids) on public.profiles to authenticated;

create policy profiles_select_all on public.profiles
  for select to authenticated using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- No client INSERT/DELETE: rows are created by the signup flow (service_role, Story 1.4).

-- ============================================================
-- jobs — resident-owned; providers see open jobs
-- ============================================================
grant select, insert, update on public.jobs to authenticated;

create policy jobs_select_visible on public.jobs
  for select to authenticated
  using (resident_id = auth.uid() or awarded_provider_id = auth.uid() or status = 'open');
create policy jobs_insert_own on public.jobs
  for insert to authenticated with check (resident_id = auth.uid());
create policy jobs_update_own on public.jobs
  for update to authenticated using (resident_id = auth.uid()) with check (resident_id = auth.uid());
-- No client DELETE: soft-cancel only.

-- ============================================================
-- bids — provider-owned; cannot bid on own job; verified providers only
-- ============================================================
grant select, insert, update on public.bids to authenticated;

create policy bids_select_party on public.bids
  for select to authenticated
  using (
    provider_id = auth.uid()
    or exists (select 1 from public.jobs j where j.id = bids.job_id and j.resident_id = auth.uid())
  );
create policy bids_insert_provider on public.bids
  for insert to authenticated
  with check (
    provider_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'provider' and p.verified_by_admin
    )
    and exists (
      select 1 from public.jobs j
      where j.id = bids.job_id and j.status = 'open' and j.resident_id <> auth.uid()
    )
  );
create policy bids_update_own on public.bids
  for update to authenticated using (provider_id = auth.uid()) with check (provider_id = auth.uid());
-- No client DELETE.

-- ============================================================
-- ratings — write-once, correct attribution; public read
-- ============================================================
-- Grant SELECT + INSERT only — NO update/delete grant, NO update/delete policy => write-once.
grant select, insert on public.ratings to authenticated;

create policy ratings_select_all on public.ratings
  for select to authenticated using (true);
create policy ratings_insert_valid on public.ratings
  for insert to authenticated
  with check (
    resident_id = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = ratings.job_id
        and j.resident_id = auth.uid()
        and j.awarded_provider_id = ratings.provider_id
        and j.status = 'completed'
    )
  );
-- Deliberately NO ratings_update_* / ratings_delete_* policy: a rating is permanent.

-- ============================================================
-- notification_log — server-write, recipient-read
-- ============================================================
grant select on public.notification_log to authenticated;
create policy notification_log_select_own on public.notification_log
  for select to authenticated using (recipient_id = auth.uid());
-- No client INSERT/UPDATE/DELETE: written only by the broadcast Edge Function (service_role).

-- ============================================================
-- disputes — resident-raise, founder-resolve (clients cannot mutate)
-- ============================================================
grant select, insert on public.disputes to authenticated;

create policy disputes_select_party on public.disputes
  for select to authenticated
  using (
    raised_by = auth.uid()
    or exists (select 1 from public.jobs j where j.id = disputes.job_id and j.awarded_provider_id = auth.uid())
  );
create policy disputes_insert_own on public.disputes
  for insert to authenticated
  with check (
    raised_by = auth.uid()
    and exists (
      select 1 from public.jobs j
      where j.id = disputes.job_id and j.resident_id = auth.uid() and j.status = 'completed'
    )
  );
-- No client UPDATE/DELETE: adjudication + provider response applied by service_role (Epic 4).
