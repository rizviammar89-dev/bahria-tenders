---
baseline_commit: 3e959a838c22264f43068d6b606aff66566c0244
---

# Story 1.3: Row-Level Security, Grants & Integrity Lockdown

Status: review

<!-- Translates the Bubble-era epic story 1.3 ("Lock restrictive-first privacy rules") to Supabase RLS + Postgres GRANTs. This is the POC security keystone: it makes the Story 1.2 tables safe to expose to the client, enforces the day-one "reputation is server-side-only / ratings are write-once" integrity rules, and lands the cross-row rules deferred from 1.2 (resident-can't-bid-own-job, rating attribution). -->

## Story

As the **founder/platform**,
I want every table locked deny-by-default with role-scoped RLS policies and column grants, reputation aggregates writable only by the server, ratings write-once, and the bid/rating cross-row rules enforced,
so that no client can read another household's contact details, forge reputation, edit a rating, bid on their own job, or rate a provider they never hired — the trust invariants the whole product depends on.

## Acceptance Criteria

1. **AC-1 — RLS enabled, deny-by-default:** `alter table ... enable row level security` on all 7 tables (`profiles`, `services`, `jobs`, `bids`, `ratings`, `notification_log`, `disputes`). With no matching policy, access is denied. The **`anon`** role gets NO grants on any business table (an unauthenticated request reads nothing). `service_role` bypasses RLS (it is the founder/Edge-Function context).
2. **AC-2 — `services` readable by all authenticated:** `grant select on services to authenticated` + a permissive SELECT policy (reference data; the 6 trades are public). No INSERT/UPDATE/DELETE for `authenticated`.
3. **AC-3 — `profiles` reputation is server-only + phone is private:**
   - Column grants: `authenticated` may `select` only the public columns (`id, role, full_name, precinct, verified_by_admin, service_ids, rating_sum, rating_count, created_at`) — **NOT `phone` / `phone_verified_at`** (contact is shared post-award via a service_role Edge Function in Epic 2).
   - `authenticated` may `update` only `full_name, precinct, service_ids` on their **own** row (RLS `using (id = auth.uid())`); **`rating_sum`, `rating_count`, `verified_by_admin`, `role`, `phone`, `phone_verified_at` are NOT in the update grant** → only `service_role` writes them.
   - SELECT policy: any authenticated user may read profile rows (provider discovery needs it); column grant is what hides phone.
   - No client INSERT/DELETE on profiles (rows are created by the auth/signup flow in Story 1.4 via service_role).
4. **AC-4 — `jobs` owner-scoped + provider-visible:**
   - A resident may `insert` a job only with `resident_id = auth.uid()` (WITH CHECK).
   - SELECT: the owning resident sees their own jobs; a provider may see `status='open'` jobs (the feed). 
   - UPDATE: only the owning resident (cancel / mark-complete / award) via `using (resident_id = auth.uid())`. No client DELETE (soft-cancel only).
5. **AC-5 — `bids`: provider-owned, NOT on own job (cross-row from 1.2):**
   - INSERT policy WITH CHECK: `provider_id = auth.uid()` AND the bidder is a verified provider (`exists` profiles row, `role='provider'`, `verified_by_admin`) AND the job is `status='open'` AND the job's `resident_id <> auth.uid()` (cannot bid on own job).
   - UPDATE: a provider may edit only their own bid (`using (provider_id = auth.uid())`) while the job is still open. No client DELETE.
   - SELECT: the bidding provider sees their own bids; the job's resident sees all bids on their job (to compare/award).
6. **AC-6 — `ratings`: write-once, correct attribution (cross-row from 1.2):**
   - INSERT policy WITH CHECK: `resident_id = auth.uid()` AND `exists` a job where `id = job_id`, `resident_id = auth.uid()`, `awarded_provider_id = provider_id`, `status = 'completed'` (only the hiring resident, only the awarded provider, only after completion).
   - **NO UPDATE policy and NO DELETE policy for `authenticated`** → a rating is write-once; even the author cannot edit or delete it (the permanence promise).
   - SELECT: any authenticated user may read ratings (public reputation feeds the provider card).
7. **AC-7 — `disputes`: resident-raise, founder-resolve:**
   - INSERT WITH CHECK: `raised_by = auth.uid()` AND the job is the resident's own completed job. 
   - SELECT: the raising resident sees their own disputes; the named provider sees disputes on jobs awarded to them. (Founder sees all via service_role.)
   - **No client UPDATE/DELETE** — adjudication (`status`, `admin_notes`) and the provider response are applied by service_role (admin in Studio / Edge Function). Provider-right-to-respond is wired in Epic 4; for 1.3 the lockdown is: clients cannot mutate a dispute.
8. **AC-8 — `notification_log`: server-write, recipient-read:** No client INSERT/UPDATE/DELETE (written only by the broadcast Edge Function via service_role). SELECT: a user may read rows where `recipient_id = auth.uid()`.
9. **AC-9 — pgTAP RLS/deny suite green (`supabase/tests/rls.sql`):** behavioral assertions simulating real auth context. MUST include at minimum:
   - **anon denied:** as `anon`, SELECT on `jobs`/`profiles`/`bids` returns no rows / is denied.
   - **reputation lockdown:** as `authenticated` (a provider), `update profiles set rating_sum = 999 where id = auth.uid()` → fails (`42501` column or RLS). As `service_role`, the same update succeeds.
   - **ratings write-once:** as the author resident, `update ratings ...` and `delete from ratings ...` → both denied (no policy). A valid first insert (own completed job, awarded provider) → succeeds; a rating by a non-hiring resident or for a non-awarded provider → denied.
   - **bid-not-own-job:** a provider bidding on a job whose `resident_id = auth.uid()` → denied; bidding on someone else's open job (as a verified provider) → succeeds.
   - **phone privacy:** as `authenticated`, `select phone from profiles` → denied (`42501`).
   - **cross-tenant:** resident A cannot SELECT resident B's jobs; cannot insert a job with `resident_id` = someone else.
   - Use the auth-simulation harness (see Dev Notes). `supabase test db` passes (rls.sql + schema.sql + smoke.sql all green).
10. **AC-10 — Replay clean & no regression:** `supabase db reset` applies 1.2 + 1.3 migrations in order with zero errors; the full `supabase test db` suite (schema.sql structural + rls.sql behavioral + smoke.sql) is green.

## Tasks / Subtasks

- [x] Task 1: RLS migration scaffold (AC-1..AC-8)
  - [x] `supabase migration new rls_policies` → `20260613063734_rls_policies.sql` (ordered after `core_schema`)
  - [x] `enable row level security` on all 7 tables; `revoke all from anon, authenticated` baseline + `grant all to service_role` (in a loop)
  - [x] Column-scoped `grant select (...)`/`grant update (full_name,precinct,service_ids)` on `profiles` (phone + reputation excluded); table grants on the rest per ACs
  - [x] `create policy` per AC-2..AC-8 (`<table>_<cmd>_<who>` naming; cross-row `WITH CHECK ... exists(...)` for bids/ratings/disputes)
- [x] Task 2: pgTAP RLS suite (AC-9)
  - [x] `supabase/tests/rls.sql` — auth-simulation harness (`set local role` + `request.jwt.claims`) + 23 assertions covering all AC-9 minimums
  - [x] `supabase test db` → all green
- [x] Task 3: Replay + regression (AC-10)
  - [x] `supabase db reset` applies 1.2 + 1.3 in order; full suite (67 tests) green; 1.2 structural tests unaffected (no regression)
- [x] Task 4: Commit (migration + tests referencing story 1.3)

## Dev Notes

- **Auth-simulation harness for pgTAP (the key technique).** RLS policies key off `auth.uid()`, which reads the JWT `sub` claim. In a test, simulate a logged-in user inside the transaction:
  ```sql
  -- become an authenticated user with a given uuid
  set local role authenticated;
  select set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true);
  -- ... assertions run as that user ...
  -- reset to superuser to set up next fixture / become another user
  set local role postgres;  -- (or reset role)
  ```
  Build the fixture rows (auth.users + profiles + jobs + bids) as `postgres`/superuser FIRST (bypasses RLS), then switch roles to assert. `auth.uid()` returns the `sub` uuid; `service_role` is simulated with `set local role service_role`.
- **RLS denial shapes:** a SELECT blocked by RLS returns **0 rows** (no error) → assert with `is_empty(...)` or `is((select count(*)...),0,...)`. An INSERT/UPDATE violating a `WITH CHECK`/`USING` policy **throws `42501`** ("new row violates row-level security policy") → assert with `throws_ok(..., '42501', ...)`. A **column** privilege denial also throws `42501` ("permission denied for column/table"). Distinguish by the message if needed.
- **Grants are required, not optional (config.toml lines 19-24):** new `public` tables are NOT auto-exposed; without `grant`, even `service_role`-bypassed RLS won't matter because PostgREST uses `authenticated`/`anon`. So the GRANT layer and the RLS layer BOTH must be right. Order: revoke-all → grant-precisely → enable RLS → create policies.
- **`service_role` bypasses RLS by design** (it has `bypassrls`). All reputation writes (Story 3.3), broadcast/notification writes (2.5), contact-sharing on award (2.8), verification flips, and dispute adjudication (Epic 4) run as `service_role` inside Edge Functions — that is precisely why the client grants here are so tight. Do NOT add client policies to cover those; they are server-only by design.
- **Cross-row rules land HERE, not 1.2 (deferred-work.md):** resident-can't-bid-own-job and rating-attribution were intentionally left to RLS because they need a subquery against `jobs` — exactly what a `WITH CHECK ... exists(...)` policy expresses. This story closes those two deferred-work items; update `deferred-work.md` when done.
- **Don't break 1.2's structural tests:** `schema.sql` runs on the direct DB connection as superuser, which bypasses RLS/grants — so it is unaffected by this story. Keep it green as a regression check.
- **Phone privacy via column grant, not RLS:** RLS is row-level; hiding the `phone` column needs a column-scoped GRANT (omit `phone` from the `grant select (...) on profiles`). Reading own/awarded contact is a service_role Edge Function concern (Epic 2) — note it, don't build a client path here.
- **profiles UPDATE is column-scoped:** `grant update (full_name, precinct, service_ids) on profiles to authenticated` + RLS `using (id = auth.uid())`. This is the actual enforcement of "reputation/verification fields are non-client-writable" — the naming convention alone does not enforce it (architecture.md Enforcement rules).
- **Scope:** RLS + grants + the deny suite only. NO auth/signup wiring (Story 1.4), NO Edge Functions (Epic 2+), NO reputation-aggregation trigger (Story 3.3 — this story only LOCKS those columns; it doesn't compute them).

### Project Structure Notes

- `supabase/migrations/<timestamp>_rls_policies.sql` (NEW) — grants + RLS enable + policies (ordered after `20260613061242_core_schema.sql`)
- `supabase/tests/rls.sql` (NEW) — behavioral RLS/deny assertions with the auth-simulation harness
- No `app/` changes.

### References

- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#6] — day-one must-be-right: ratings write-once (no UPDATE/DELETE policy), reputation aggregates zero client write grants, RLS deny-by-default, pgTAP before UI
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security] — roles Resident/Provider/Admin via privacy rules; reputation fields non-client-writable; deny-by-default privacy table; secrets/server-only writes
- [Source: _bmad-output/planning-artifacts/architecture.md#Platform-Revision] — Bubble privacy rules → Postgres RLS; BE– workflows → SECURITY DEFINER fns / service_role Edge Functions
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.3] — superseded Bubble "restrictive-first privacy rules" story this translates
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the two cross-row items (resident-bid-own-job, rating attribution) this story closes
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-schema.md] — the schema being secured; config.toml note that new tables need explicit grants; `supabase test db` harness proven; auth.users fixture insert pattern (reused for RLS fixtures)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase db reset` → applies `core_schema` then `rls_policies` clean
- `supabase test db` → `rls.sql ..... ok / schema.sql .. ok / smoke.sql ... ok / All tests successful` — **67 tests** (23 RLS + 43 schema + 1 smoke)
- RLS suite passed first run; the `set local role` + `set_config('request.jwt.claims', ...)` harness resolves `auth.uid()` correctly (pgTAP funcs execute as `authenticated` because EXECUTE defaults to PUBLIC).

### Completion Notes List

- All 10 ACs satisfied. The POC's trust invariants are now physically enforced and proven by negative tests:
  - **Reputation server-only:** provider `update rating_sum` → 42501 (no column grant); `service_role` same update → succeeds.
  - **Ratings write-once:** author's UPDATE and DELETE both → 42501 (no policy exists); valid insert (own completed job, awarded provider) succeeds.
  - **Rating attribution:** non-hiring resident and wrong-provider inserts → 42501 (WITH CHECK subquery against jobs).
  - **Bid integrity:** bid on own job → 42501; unverified provider bid → 42501; verified provider on another's open job → succeeds. (Closes both cross-row items deferred from Story 1.2.)
  - **Phone privacy:** `select phone` as authenticated → 42501 (column not granted).
  - **Cross-tenant:** resident B can't see resident A's non-open job (RLS filters to empty); can't forge a job as another resident (42501).
  - **anon:** no grants → 42501 on every business table.
- Layering: `revoke all from anon,authenticated` → precise grants → `enable rls` → policies; `service_role` granted all + bypasses RLS (the Edge Function/founder context).
- **Regression:** the 1.2 structural suite runs as superuser (bypasses RLS) and stays green — confirms RLS didn't break the schema contract.
- **Note for reviewer:** disputes policies (resident-raise / founder-resolve / no client mutate) are implemented per AC-7 but have lighter test coverage than the bid/rating paths (AC-9 didn't mandate dispute assertions). Provider-right-to-respond mutation path is Epic 4. The `phone`-contact-sharing-on-award read path is a service_role Edge Function in Epic 2 (intentionally no client path here).

### File List

- `supabase/migrations/20260613063734_rls_policies.sql` (NEW) — grants + RLS enable + 13 policies across 7 tables
- `supabase/tests/rls.sql` (NEW) — 23 behavioral RLS/deny assertions with the auth-simulation harness
