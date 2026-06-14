---
baseline_commit: 04030e900cd89a579b60da1955f811e175c9665c
---

# Story 2.8: Compare Bids & Award (FR-9, FR-10)

Status: done

<!-- Epic 2 / demand loop — the resident's payoff: see bids, choose on reputation (not price), award, exchange contact. Turns the loop into a HIRE. Translates the Bubble-era epic story 2.8 (FR-9, FR-10). This story has a MIGRATION (the first since 1.3): two SECURITY DEFINER RPCs — award_job (enforces open→awarded + provider-must-have-bid, which plain RLS can't) and get_job_contacts (reveals phones, which RLS hides from clients, only to the two parties of an awarded job). Plus a new resident "My Jobs" screen (no resident job-list existed). Adab (FR-14) + neighbor social proof (FR-5) are POC-deferred → bid cards show price + provider name + reputation-or-"New". -->

## Story

As a **resident**,
I want to see the bids on my job with each provider's price and reputation, choose one, and award the job,
so that I hire on merit (not just lowest price) and we get each other's contact details to coordinate the visit.

## Acceptance Criteria

1. **AC-1 — `award_job` RPC (migration, SECURITY DEFINER):** `award_job(p_job_id uuid, p_provider_id uuid)` updates the job to `status='awarded'`, `awarded_provider_id=p_provider_id` ONLY when ALL hold: the caller is the job's resident (`resident_id = auth.uid()`), the job is currently `status='open'`, and `p_provider_id` has a bid on it. If none updated → `raise exception` (a clear message). `security definer` + `set search_path = public`. `revoke ... from public, anon; grant execute to authenticated`. (Enforces the open→awarded transition + award-to-a-real-bidder, which RLS alone can't — closes part of the deferred state-machine gap for the award step.)
2. **AC-2 — `get_job_contacts` RPC (migration, SECURITY DEFINER):** `get_job_contacts(p_job_id uuid)` returns `(resident_name, resident_phone, provider_name, provider_phone)` ONLY when the job is `awarded`/`completed` AND `auth.uid()` is the resident or the awarded provider; otherwise `raise exception` (42501). `security definer` + `set search_path = public`; execute granted to `authenticated` only. This is the FR-10 contact channel — it reads the `phone` column that client grants withhold (Story 1.3).
3. **AC-3 — Reputation label helper (`app/src/lib/reputation.ts`), unit-tested:** `reputationLabel({ ratingCount, ratingSum }): string` → `ratingCount === 0` → `"New provider"`; else `"<avg, 1 dp> from <count> jobs"` (e.g. `"4.6 from 12 jobs"`), Western Arabic numerals. Jest covers zero-state + a rated case.
4. **AC-4 — Data layer (`app/src/lib/my-jobs.ts`):** `fetchMyJobs()` returns the resident's own jobs with bids embedded — each bid carries price, note, and the provider's `id`, `full_name`, `rating_sum`, `rating_count` (RLS: resident sees all bids on their own jobs; profiles embed exposes public reputation, NOT phone). `awardJob(jobId, providerId)` → `supabase.rpc('award_job', …)`; `getJobContacts(jobId)` → `supabase.rpc('get_job_contacts', …)`. Each returns `{ error }` (and contacts data where applicable).
5. **AC-5 — "My Jobs" screen (`app/src/app/my-jobs.tsx`), resident-only tab:** lists the resident's jobs (trade · precinct · status · description). For an **open** job, shows its bids — each card: **price** (`Rs N`), **provider name**, and `reputationLabel` — with an **Award** button. **Bids are NOT default-sorted cheapest-first** (FR-9): sort by `created_at` (arrival order). For an **awarded** job, shows the awarded provider + a **"Contact details"** affordance that calls `getJobContacts` and reveals both phones (so the resident can call). Empty/zero states are calm; load-error reuses the established pattern.
6. **AC-6 — Award flow (FR-9, FR-10):** tapping **Award** calls `awardJob` → on success the job flips to `awarded`, closes to further bids (enforced in the RPC), and the contact details become available (resident sees the provider's phone via `getJobContacts`). On RPC error (e.g. already awarded) → calm message + `console.warn`. Confirmation shown.
7. **AC-7 — Navigation:** add a **"My Jobs"** tab gated to **residents** (via `roleTabs` from Story 2.3b — extend it). Providers do not see it.
8. **AC-8 — Tests green, no regression:**
   - `npm test` — `reputationLabel` unit tests pass (+ all existing).
   - `supabase/tests/award_flow.sql` (pgTAP, auth-sim harness): a resident awards their own open job to a bidder → job becomes `awarded`+provider set; re-award (now not open) → raises; award to a non-bidder → raises; award another resident's job → raises. `get_job_contacts`: as the resident of an awarded job → returns both phones; as the awarded provider → returns; as a stranger → raises (42501); on an open (un-awarded) job → raises.
   - `supabase db reset` replays clean (new migration); `supabase test db` green; tsc + lint clean.

## Tasks / Subtasks

- [x] Task 1: Migration — the two RPCs (AC-1, AC-2)
  - [x] `20260614082522_award_and_contacts.sql` — `award_job` + `get_job_contacts`, both `security definer` + `set search_path = public`, revoked from public/anon + execute granted to authenticated
- [x] Task 2: Reputation helper + tests (AC-3, AC-8)
  - [x] `app/src/lib/reputation.ts` (`reputationLabel` — "New provider" zero-state / "avg from N jobs") + `reputation.test.ts` (4 cases)
- [x] Task 3: Data layer (AC-4)
  - [x] `app/src/lib/my-jobs.ts` — `fetchMyJobs` (jobs + bids + provider embed, bids in arrival order), `awardJob`/`getJobContacts` (rpc); `MyJob`/`BidWithProvider`/`JobContacts` types
- [x] Task 4: Role tab (AC-7)
  - [x] `role-tabs.ts` — added `myJobs: role==='resident'` (+ test updated); `app-tabs.tsx` — conditional "My Jobs" trigger (resident)
- [x] Task 5: Screen (AC-5, AC-6)
  - [x] `app/src/app/my-jobs.tsx` — jobs list → per-job bids (name · Rs price · reputation, arrival order not cheapest) → Award; awarded → "Show contact details" reveals the provider's phone; calm message/empty/error states; cancelled-guard + load()
- [x] Task 6: DB tests + verify (AC-8)
  - [x] `award_flow.sql` — award succeeds for owner+open+bidder; rejects re-award / non-bidder / non-owner; `get_job_contacts` returns for resident + awarded provider, rejects un-awarded + stranger (42501)
  - [x] `supabase db reset` (migration replays clean) + `supabase test db` → 91 green; `npm test` → 45; `tsc` + `lint` clean
- [x] Task 7: Commit referencing story 2.8

## Dev Notes

- **This story has a MIGRATION (first since 1.3).** The two RPCs are the load-bearing security pieces:
  - **Why `award_job` is an RPC, not a client UPDATE:** RLS `jobs_update_own` lets the resident update their job's `status`/`awarded_provider_id` but can't enforce "only from `open`" (the deferred state-machine gap) nor "only to a real bidder" beyond the 1.2 composite FK. A `SECURITY DEFINER` function with explicit `auth.uid()`+`status='open'`+`exists(bid)` checks does both, atomically. It still respects identity (checks `resident_id = auth.uid()` itself).
  - **Why `get_job_contacts` is an RPC:** client column grants withhold `phone` (Story 1.3, by design). FR-10 needs both parties' phones post-award. A `SECURITY DEFINER` function reads `phone` and returns it ONLY to the two parties of an awarded/completed job. This is the deliberate, audited hole in the phone privacy — keep its authz check exact.
  - **SECURITY DEFINER safety:** every such function MUST `set search_path = public` (prevents search-path hijacking) and be `revoke`d from `public`/`anon` then `grant execute` to `authenticated`. Non-negotiable.
- **Bids NOT cheapest-sorted (FR-9):** sort by `created_at` (arrival), never `price asc`. The card surfaces reputation alongside price so the resident chooses on merit. (Architecture: "default presentation surfaces reputation alongside price rather than sorting purely by cheapest.")
- **Reputation is 0 until Epic 3.** No ratings exist yet → `rating_count = 0` for everyone → show **"New provider"** (the architecture's deliberate new-provider zero-state, FR-3), not "0 stars". The `reputationLabel` helper encodes this.
- **RLS already supports the reads.** A resident sees their own jobs (`jobs_select_visible`) and ALL bids on them (`bids_select_party`: `exists(job where resident_id=auth.uid())`). The provider embed reads public profile columns (`full_name`, `rating_sum`, `rating_count`) — `profiles_select_all` allows it; `phone` stays hidden (only the RPC exposes it). So `fetchMyJobs` needs NO new policy.
- **`supabase.rpc('award_job', { p_job_id, p_provider_id })`** returns `{ data, error }`; a `raise exception` in the function surfaces as `error`. `get_job_contacts` returns `{ data }` as an array of rows (take `[0]`).
- **Scope:** compare + award + contact reveal only. NO mark-complete (Story 2.9), NO rating (Epic 3), NO broadcast/notify (2.5), NO Adab/social-proof (deferred). The awarded provider's *own* view of the contact (their side) can reuse `getJobContacts` later; 2.8 focuses on the resident's award action + their contact reveal.
- **Testing reality:** `reputationLabel` pure → jest. The RPCs (award transitions + contact authz) → pgTAP `award_flow.sql` (the security-critical core — test every deny path). The resident screen render/award tap → device/Expo-Go manual smoke. `fetchMyJobs` shape is exercised implicitly by the screen + the RLS already proven.
- **Patterns to reuse:** 2.4's `submitBid` `{error}` shape + `console.warn`; 2.3's feed `loadError`/empty/`useEffect` cancelled-guard + `now`-at-load; 2.3b's `roleTabs` (extend it) + role-gated tab; 1.3's `set local role authenticated` + `request.jwt.claims` pgTAP harness; the `jobs_flow.sql` fixtures (resident 111, provider 222 carpenter, jobs) as a model for `award_flow.sql`; `@jest/globals`; Themed components + calm copy + ≥48px tap targets.

### Project Structure Notes

- `supabase/migrations/<timestamp>_award_and_contacts.sql` (NEW) — `award_job` + `get_job_contacts`
- `supabase/tests/award_flow.sql` (NEW) — RPC happy/deny + contact authz
- `app/src/lib/reputation.ts` (NEW) + `app/src/lib/reputation.test.ts` (NEW)
- `app/src/lib/my-jobs.ts` (NEW) — fetchMyJobs / awardJob / getJobContacts
- `app/src/app/my-jobs.tsx` (NEW) — resident My Jobs screen/route
- `app/src/lib/role-tabs.ts` (MODIFY) — add `myJobs`
- `app/src/components/app-tabs.tsx` (MODIFY) — "My Jobs" tab (resident)

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-9] — Compare bids: price + rating + Adab + distance + social proof; not default-sorted cheapest. #FR-10 — Award → Awarded, closes to bids, share each party's contact.
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#2] — in-scope: compare on stars + completed-job count; award & connect; Adab/social-proof deferred
- [Source: _bmad-output/planning-artifacts/architecture.md] — reputation = raw components on profiles; humanized provider card / new-provider zero-state; "reputation alongside price, not cheapest sort"; SECURITY DEFINER for server-only reads; contact shared post-award via a service-role path
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.8] — superseded Bubble FR-9/FR-10 story
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-schema.md] — jobs (status, awarded_provider_id, composite FK awarded→bidder), profiles (full_name, phone, rating_sum, rating_count), bids
- [Source: _bmad-output/implementation-artifacts/1-3-rls-and-grants.md] — phone column withheld from clients; jobs_update_own/jobs_select_visible/bids_select_party; the pgTAP auth-sim harness in rls.sql
- [Source: _bmad-output/implementation-artifacts/2-3b-role-gated-navigation.md] — `roleTabs` + role-gated tab pattern to extend
- [Source: _bmad-output/implementation-artifacts/2-4-submit-a-bid.md] — bids data-layer + RLS-safe embed; jobs_flow.sql fixtures as the model for award_flow.sql

### Review Findings (code review 2026-06-13)

**Note:** the 3-reviewer adversarial panel hit the session rate limit (returned no output), so this is a **self-review** (less independent) focused on the SECURITY DEFINER functions per the request. One Critical bug found and empirically verified.

**Patch (applied 2026-06-13):**
- [x] [Review][Patch] **CRITICAL leak fixed** — `get_job_contacts` now guards `auth.uid() is null` (default-deny) before the membership check. A null-identity caller raises 42501 instead of receiving the phones. Proven closed by the new pgTAP assertion.
- [x] [Review][Patch] **pgTAP regression guard added** — `award_flow.sql`: "no contacts leaked when auth.uid() is null" (throws 42501) + "resident can still read contacts on a completed job" (lives_ok). 93 pgTAP green.
- [x] [Review][Patch] **Per-bid award lock** — `awardingBidId` replaces the screen-global `busy`; only the tapped bid shows "Awarding…" and disables. Added an unmount guard on the async path too.

**Deferred (later / post-POC):**
- [x] [Review][Defer] Client double-award flashes a generic error on the loser — DB-safe (the RPC's `status='open'` guard rejects the second); polish later.
- [x] [Review][Defer] `onShowContacts` has no loading/guard state — minor; add post-POC.
- [x] [Review][Defer] The `referencedTable` bids-ordering in `fetchMyJobs` isn't unit-testable — verify in the device smoke.

**Dismissed (correct / intended):**
- "Both parties get both phones" — intended (FR-10 *mutual* exchange; the provider needs the resident's phone to coordinate).
- `set search_path = public` + `revoke from public; grant authenticated` — correct hardening (Postgres grants EXECUTE to PUBLIC by default; the revoke removes it). Verified the lockdown is right.
- `award_job` null-`auth.uid()` — SAFE: the `resident_id = auth.uid()` lives in a WHERE clause, so null → 0 rows → raises (unlike the IF-based `get_job_contacts`). Nice contrast that makes the fix obvious.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `npx jest` → 45 passed (incl. 4 reputation + updated role-tabs)
- `supabase db reset` → migration `award_and_contacts` applies clean
- `supabase test db` → 91 (award_flow 9 + jobs_flow 7 + rls 23 + schema 43 + smoke 1) — All tests successful
- `tsc --noEmit` + `expo lint` clean

### Completion Notes List

- All 8 ACs satisfied. **Turns the demand loop into a hire** — resident sees bids, awards on merit, exchanges contact. First migration since 1.3.
- **The two SECURITY DEFINER RPCs are the load-bearing design:** `award_job` enforces the open→awarded transition + award-to-a-real-bidder (closing the award step of the deferred state-machine gap — plain RLS couldn't), and `get_job_contacts` is the deliberate, authz-gated FR-10 channel that reads the phone column clients can't. Both `set search_path = public`, revoked from public/anon, execute-granted to authenticated only. The full deny matrix is pgTAP-proven.
- **FR-9 honored:** bids sorted by `created_at` (arrival), never price-asc; each card surfaces reputation (`reputationLabel`) alongside price. New providers show "New provider" (the architecture's zero-state), not "0 stars", since no ratings exist until Epic 3.
- RLS already supported the reads — `fetchMyJobs` needed no new policy (resident sees own jobs + all bids on them; provider embed exposes public reputation, not phone).
- **⚠️ Device E2E = manual smoke:** the My Jobs screen render + award tap + contact reveal need a device against LAN-IP Supabase. The RPCs (the security core) are fully pgTAP-proven; `reputationLabel` by jest.
- **Note:** the `db reset` cleared any device-test accounts — re-run `scripts/provision_user.ts` before a phone smoke.

### File List

- `supabase/migrations/20260614082522_award_and_contacts.sql` (NEW) — `award_job` + `get_job_contacts` RPCs
- `supabase/tests/award_flow.sql` (NEW) — RPC happy + deny + contact-authz pgTAP
- `app/src/lib/reputation.ts` (NEW) + `app/src/lib/reputation.test.ts` (NEW)
- `app/src/lib/my-jobs.ts` (NEW) — fetchMyJobs / awardJob / getJobContacts
- `app/src/app/my-jobs.tsx` (NEW) — resident My Jobs screen/route
- `app/src/lib/role-tabs.ts` (MODIFIED) + `app/src/lib/role-tabs.test.ts` (MODIFIED) — `myJobs`
- `app/src/components/app-tabs.tsx` (MODIFIED) — "My Jobs" tab
