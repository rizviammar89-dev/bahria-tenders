---
baseline_commit: b2613f169d96b287e91ad2102a30601ed0f7b1ec
---

# Story 2.9: Offline Completion & Mark Complete (FR-11, FR-12)

Status: done

<!-- Epic 2 / demand loop — the close-out step. After 2.8 turns the loop into a HIRE (award + contact exchange), the job is executed and paid OFFLINE (cash, no in-app payment — FR-11). This story gives the resident the action to mark the awarded job COMPLETED (FR-12), which is the gate that unlocks rating (Epic 3 / Story 3.1). One small MIGRATION: a third SECURITY DEFINER RPC `complete_job`, mirroring 2.8's `award_job` (enforces the awarded→completed transition + ownership, which plain RLS can't). Plus a "Mark complete" affordance + a completed state on the existing My Jobs screen. NO rating here (3-1), NO payment (FR-11 is a deliberate non-feature), NO auto-prompt fallback (deferred). -->

## Story

As a **resident**,
I want to mark an awarded job as completed after the provider finishes the work (paid offline in cash),
so that the job is closed out and I can then rate it.

## Acceptance Criteria

1. **AC-1 — `complete_job` RPC (migration, SECURITY DEFINER):** `complete_job(p_job_id uuid)` updates the job to `status='completed'` ONLY when ALL hold: the caller is the job's resident (`resident_id = auth.uid()`) AND the job is currently `status='awarded'`. If none updated → `raise exception` with a clear message, `errcode = '42501'`. `security definer` + `set search_path = public`; `revoke all ... from public, anon`; `grant execute ... to authenticated`. (Enforces the awarded→completed transition + ownership — closing the completion step of the deferred state-machine gap, exactly as `award_job` closed the award step. Plain RLS `jobs_update_own` permits the `status` column write but cannot constrain *which* transition.)
2. **AC-2 — No in-app payment (FR-11):** This story adds NO payment gateway, charge, price-collection, or money-movement of any kind. Completion is a pure status transition; execution + payment happen offline. (Negative AC — assert the absence; nothing to build here beyond the status change.)
3. **AC-3 — Data layer (`app/src/lib/my-jobs.ts`):** add `completeJob(jobId): Promise<{ error: string | null }>` → `supabase.rpc('complete_job', { p_job_id: jobId })`, returning `{ error }` in the established 2.4/2.8 shape (error message on failure, `console.warn` at the call site). Extend the `MyJob.status` handling as needed (the type already includes `'completed'`).
4. **AC-4 — Mark-complete on the My Jobs screen (`app/src/app/my-jobs.tsx`):** for an **awarded** job, show a **"Mark complete"** button (≥44px tap target, alongside the existing "Show contact details" affordance — the resident coordinates via contact, then marks complete when done). Tapping it calls `completeJob` → on success the job flips to **completed** and re-loads. Use a per-job in-flight lock (mirror 2.8's `awardingBidId` pattern with a `completingJobId`) so only the tapped job's button shows "Completing…" and disables. On RPC error → calm message + `console.warn`. Confirmation message shown on success.
5. **AC-5 — Completed state (`my-jobs.tsx`):** for a **completed** job, render a calm completed state (the `STATUS_LABEL.completed = 'Completed'` already exists). Do NOT show the award/bids UI or the mark-complete button. (A "Rate this job" affordance is **out of scope** — Story 3.1; leave a clear seam but do not build it.) The awarded provider + contact reveal MAY remain available on a completed job (`get_job_contacts` already allows `status in ('awarded','completed')`).
6. **AC-6 — Tests green, no regression:**
   - `supabase/tests/complete_flow.sql` (pgTAP, reuse the 2.8 auth-sim harness): resident completes their own **awarded** job → status becomes `completed`; complete a job that is **not awarded** (open) → raises 42501 + status unchanged; complete an **already-completed** job → raises; complete **another resident's** awarded job → raises; complete as the **awarded provider** (not the resident) → raises; null `auth.uid()` → raises (default-deny).
   - `supabase db reset` replays clean (new migration); `supabase test db` green (existing 93 + the new complete_flow assertions).
   - `npm test` green (no regression; add a unit test only if a pure helper is introduced — none is required).
   - `tsc --noEmit` + `expo lint` clean.

## Tasks / Subtasks

- [x] Task 1: Migration — `complete_job` RPC (AC-1)
  - [x] `supabase/migrations/20260615120000_complete_job.sql` — `complete_job(p_job_id)`: `update jobs set status='completed' where id=p_job_id and resident_id=auth.uid() and status='awarded'; if not found raise exception ... using errcode='42501';`. `security definer` + `set search_path = public`; `revoke all from public, anon`; `grant execute to authenticated`. Modeled on `award_job` (WHERE-clause identity check → null `auth.uid()` yields 0 rows → raises; no separate null guard needed).
- [x] Task 2: Data layer (AC-3)
  - [x] `app/src/lib/my-jobs.ts` — added `completeJob(jobId)` (`supabase.rpc('complete_job', { p_job_id })`, `{ error }` shape).
- [x] Task 3: Screen — mark-complete + completed state (AC-4, AC-5)
  - [x] `app/src/app/my-jobs.tsx` — `completingJobId` lock; "Mark complete" button on awarded jobs (distinct green); calm completed state with a 3.1 rating seam; success/error message; reuses the `mounted` ref + `load()` unmount-safe path.
- [x] Task 4: DB tests + verify (AC-6)
  - [x] `supabase/tests/complete_flow.sql` — happy path + every deny path (not-awarded, already-completed, non-owner, awarded-provider, null uid) + "denied attempts left it awarded".
  - [x] `supabase db reset` (4 migrations replay clean) + `supabase test db` → 101 green; `npm test` → 45; `tsc` + `expo lint` clean.
- [x] Task 5: Commit referencing story 2.9.

## Dev Notes

- **Why `complete_job` is an RPC, not a client UPDATE (the load-bearing decision):** RLS `jobs_update_own` (`using/with check resident_id = auth.uid()`) plus the column-scoped `grant update (status, awarded_provider_id, cancelled_at)` lets the resident write `status` on their own job — but it CANNOT enforce "only from `awarded`". Without the RPC a resident could push an `open` job (or any state) straight to `completed`. The DB CHECK `jobs_awarded_requires_provider_chk` blocks completing a job with no `awarded_provider_id` (i.e. a never-awarded job), but that's a side-effect guard, not the transition rule, and it wouldn't stop, e.g., re-completing or other odd writes cleanly. A `SECURITY DEFINER` function with explicit `resident_id = auth.uid()` + `status = 'awarded'` in the WHERE makes the transition atomic and exact — identical shape to `award_job`. **This is the third such RPC; keep the hardening identical** (`set search_path = public`, revoked from public/anon, execute to authenticated only). The full deny matrix MUST be pgTAP-proven (the security-critical core), per the 2.8 precedent.
- **`award_job` is the template — copy its safety reasoning.** Its null-`auth.uid()` safety comes from the identity check living in a WHERE clause (null → 0 rows → `if not found` raises). `complete_job` uses the same WHERE-clause form, so it inherits that safety — do NOT switch to an IF-based check (that's the form that needed the explicit null guard in `get_job_contacts`).
- **FR-11 is a non-feature, on purpose.** There is no payment in v1 — do not add one, do not add a "mark paid" field, do not collect the final amount. Completion is purely the status flip that unlocks rating. AC-2 exists to make that explicit so the dev doesn't "helpfully" scaffold payment.
- **Scope seam to 3-1 (rating):** completion is the gate — `ratings` RLS already requires `j.status = 'completed'` (see `rls_policies.sql`, the ratings insert policy). So this story's only job toward Epic 3 is producing the `completed` state. Render the completed state cleanly and leave an obvious spot for the future "Rate this job" button, but **do not build rating here**.
- **No auto-prompt fallback.** FR-12's `[ASSUMPTION: ... auto-prompt for completion after a set period]` is explicitly out of POC scope — resident-initiated completion only. Don't build timers/cron.
- **Reuse the established screen patterns (all already in `my-jobs.tsx`):** the `mounted` ref + `load()` reload, the `{error}` + `console.warn` shape from `awardJob`/`submitBid`, the per-item in-flight lock (`awardingBidId` → add a parallel `completingJobId`), `setMessage` calm-copy notice, Themed components, ≥44px tap targets, `RefreshControl` pull-to-refresh. The "Mark complete" button can reuse `styles.awardButton`/`awardLabel`.
- **`get_job_contacts` already covers completed jobs** (`status in ('awarded','completed')`), so the contact reveal can stay visible after completion with no migration change — handy if the resident needs to re-contact the provider.
- **Testing reality:** the transition + authz core → pgTAP `complete_flow.sql` (test EVERY deny path — this is the security-critical part, mirroring `award_flow.sql`). The screen render / mark-complete tap → device/Expo manual smoke (the resident accounts + the awarded job from the 2.8 smoke can be reused — `scripts/provision_user.ts`; note a `db reset` wipes them, re-provision after). No new pure helper is needed, so no new jest unless one is introduced.

### Project Structure Notes

- `supabase/migrations/<timestamp>_complete_job.sql` (NEW) — `complete_job` RPC
- `supabase/tests/complete_flow.sql` (NEW) — transition happy + deny matrix
- `app/src/lib/my-jobs.ts` (MODIFY) — add `completeJob`
- `app/src/app/my-jobs.tsx` (MODIFY) — mark-complete button + completed state + `completingJobId` lock
- No new route, no `role-tabs`/`app-tabs` change (My Jobs tab already exists from 2.8).

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-11] — offline completion, no in-app payment; provides a way to mark Completed to enable rating.
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-12] — resident marks an Awarded job Completed; only a Completed job can be rated; auto-prompt fallback is an ASSUMPTION (deferred).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.9] — offline completion & mark complete (FR11, FR12); job lifecycle Open → Awarded → Completed.
- [Source: _bmad-output/implementation-artifacts/2-8-compare-and-award.md] — the `award_job`/`get_job_contacts` SECURITY DEFINER pattern, the My Jobs screen, `award_flow.sql` harness, per-bid in-flight lock — all directly extended here.
- [Source: supabase/migrations/20260614082522_award_and_contacts.sql] — `award_job` is the exact template for `complete_job` (transition + ownership in WHERE, hardening trio).
- [Source: supabase/migrations/20260613063734_rls_policies.sql] — `jobs_update_own` + column-scoped `grant update (status, …)` (why RLS alone can't enforce the transition); ratings insert policy requires `status='completed'` (the completion→rating gate); `jobs_awarded_requires_provider_chk` CHECK.
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-schema.md] — `job_status` enum (open/awarded/completed/cancelled), `jobs_awarded_requires_provider_chk`.
- [Source: _bmad-output/implementation-artifacts/1-3-rls-and-grants.md] — the pgTAP auth-sim harness (`set local role authenticated` + `request.jwt.claims`) to reuse for `complete_flow.sql`.

### Review Findings (code review 2026-06-15)

3-layer adversarial panel (Blind Hunter + Edge Case Hunter + Acceptance Auditor). The SECURITY DEFINER `complete_job` RPC was confirmed authorization-correct and atomic by all three (no TOCTOU, fail-closed on null `auth.uid()`, one-way transition, hardening trio present, full deny matrix pgTAP-proven). All 6 ACs verified satisfied.

- [x] [Review][Patch] Spurious error toast on re-tap during the post-success `load()` window — FIXED: `onComplete` now `await`s `load()` and clears `completingJobId` only after the refresh lands (button stays disabled through the refresh; the row then renders as completed). [app/src/app/my-jobs.tsx:82]
- [x] [Review][Defer] Shared `message` state can be clobbered by a concurrent `onShowContacts` — minor UX; pre-existing pattern, applies equally to 2.8's `onAward`. [app/src/app/my-jobs.tsx] — deferred, pre-existing
- [x] [Review][Defer] "Mark complete" button on all awarded jobs disables while any one completion is in flight — intended single-flight, mirrors 2.8's `awardingBidId` coupling. [app/src/app/my-jobs.tsx:209] — deferred, pre-existing
- [x] [Review][Defer] `42501` + generic client message conflates distinct failures (forbidden / not-awarded / already-completed) — no info leak; matches `award_job`. [supabase/migrations/20260615120000_complete_job.sql:26] — deferred, pre-existing

**Dismissed (verified false positives):** `completingJobId` "stuck across remounts" (local state resets on unmount); complete_job "missing null awarded_provider_id guard" (CHECK constraint makes that state impossible); "stale contacts map" (completed branch never renders contacts); "double-tap race" (guarded by the in-flight check + sync setState).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase db reset` → all 4 migrations replay clean (incl. `20260615120000_complete_job`)
- `supabase test db` → 101 passed (complete_flow 8 + award_flow + jobs_flow + rls + schema + smoke) — All tests successful
- `npx jest` → 45 passed (no new pure helper introduced → no new jest; no regression)
- `npx tsc --noEmit` + `npx expo lint` → clean
- Fixed during dev: `complete_flow.sql` fixture initially inserted J1 already-awarded before the bid existed → composite FK `jobs_awarded_provider_bid_fk` violation. Reordered to insert jobs open → bids → `update` J1 to awarded (same approach award_flow uses).

### Completion Notes List

- All 6 ACs satisfied. **Closes out the demand loop**: award (2.8) → work done offline → resident marks complete (2.9) → unlocks rating (3.1).
- **`complete_job` is the third SECURITY DEFINER RPC**, identical hardening to `award_job`/`get_job_contacts` (`set search_path = public`, revoked from public/anon, execute to authenticated only). It enforces the **awarded→completed** transition + ownership, which RLS alone can't (RLS grants the status-column write but not the transition rule). Null-`auth.uid()` is safe via the WHERE-clause identity check (0 rows → raises) — same pattern as `award_job`. Full deny matrix pgTAP-proven.
- **FR-11 honored as a non-feature:** no payment, no charge, no "mark paid" field — completion is a pure status flip (AC-2).
- **Scope held:** no rating (3.1 — left a clear seam in the completed state), no auto-prompt fallback (deferred). No new route/tab (My Jobs already exists from 2.8).
- **✅ Device E2E smoke CONFIRMED 2026-06-15:** on the Android dev build against LAN-IP Supabase, resident logged in → My Jobs → tapped "Mark complete" on an awarded job (flipped to the completed state, button gone) AND walked the full lifecycle on a second job (open → Award → awarded → Mark complete → completed). Completed jobs correctly show no Award/bids and no Mark-complete button. (Re-provisioned via `scripts/provision_user.ts` + seeded an awarded + an open job after the dev `db reset`.) The transition + authz core is also fully pgTAP-proven.
- **Note:** this `db reset` cleared the device-test accounts + seed data from the 2.8 smoke — re-run provisioning + reseed before the next device smoke.

### File List

- `supabase/migrations/20260615120000_complete_job.sql` (NEW) — `complete_job` SECURITY DEFINER RPC
- `supabase/tests/complete_flow.sql` (NEW) — transition happy path + full deny matrix (pgTAP)
- `app/src/lib/my-jobs.ts` (MODIFIED) — added `completeJob`
- `app/src/app/my-jobs.tsx` (MODIFIED) — "Mark complete" button + completed state + `completingJobId` lock + `completeButton` style
