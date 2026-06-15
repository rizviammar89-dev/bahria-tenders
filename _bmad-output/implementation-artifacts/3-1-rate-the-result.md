---
baseline_commit: 0f17ed3d0f2ea5636db5d8a79d0634dbcf5b8c64
---

# Story 3.1: Rate the Result (FR-13)

Status: done

<!-- Epic 3 / reputation — the payoff of the loop: a completed job becomes a permanent Rating. After 2.9 produces the `completed` state, the resident scores the provider 1–5 with an optional review. NO MIGRATION and NO RPC needed — the `ratings` table (1.2) and its RLS (1.3) already enforce everything: correct attribution (resident_id=auth.uid()), the completed-gate + awarded-provider match (ratings_insert_valid), and write-once (SELECT+INSERT grants only, no update/delete, unique(job_id)). So a plain client INSERT is fully constrained — a deliberate contrast to the SECURITY DEFINER RPCs of 2.8/2.9. The reputation INCREMENT (rating_sum/rating_count on profiles) is Story 3.3, NOT this story; Adab (FR-14) is deferred. -->

## Story

As a **resident**,
I want to score a completed job 1–5 and optionally leave a short review,
so that good work is rewarded, bad work has consequences, and the provider's reputation reflects real outcomes.

## Acceptance Criteria

1. **AC-1 — Star helper (`app/src/lib/rating.ts`), unit-tested:** a pure helper that validates an overall rating selection. `isValidStars(n): boolean` → true iff `n` is an integer 1–5. (Optional companion `clampStars`/label if helpful.) Jest covers 0, 1, 5, 6, non-integer. This guards the submit path so the UI never attempts an out-of-range insert (the DB CHECK `stars between 1 and 5` is the backstop).
2. **AC-2 — Data layer (`app/src/lib/my-jobs.ts`):** `submitRating({ jobId, providerId, stars, review }): Promise<{ error: string | null }>` → `supabase.from('ratings').insert({ job_id, provider_id, resident_id: <auth uid>, stars, review: review?.trim() || null })`. Resident id comes from `supabase.auth.getUser()` (same pattern as `fetchMyJobs`). Returns `{ error }` in the established shape. NO RPC — the insert rides RLS `ratings_insert_valid`.
3. **AC-3 — Embed existing rating in `fetchMyJobs` (`app/src/lib/my-jobs.ts`):** extend the select so each job carries its rating (if any) — `rating:ratings(stars, review)` (one-to-one via `ratings_one_per_job` unique; take `[0]`/single). Add `rating: { stars: number; review: string | null } | null` to the `MyJob` type. RLS `ratings_select_all` permits the read. (Only one FK links `jobs`↔`ratings` — `ratings.job_id` — so no PGRST201 ambiguity, unlike jobs↔bids.)
4. **AC-4 — Rate affordance on completed jobs (`app/src/app/my-jobs.tsx`):** for a **completed** job with **no** rating yet, replace the Story-3.1 seam with a rating control: a row of 5 tappable stars (≥44px targets) + an optional multi-line review `TextInput` + a **Submit rating** button (disabled until ≥1 star chosen; uses a per-job in-flight lock like `completingJobId`). On submit → `submitRating` → on success re-load (the embedded rating now renders); on error → calm message + `console.warn`.
5. **AC-5 — Rated state (`my-jobs.tsx`):** for a completed job that **already has** a rating, show the given stars (e.g. ★★★★☆) and the review text if present, in a calm read-only state — no re-rate control (write-once; the DB would reject a second insert anyway). Only completed jobs show any rating UI; open/awarded jobs are unchanged.
6. **AC-6 — Reputation increment is OUT of scope (boundary):** this story does NOT modify `profiles.rating_sum`/`rating_count` and adds NO trigger/RPC for it — that is Story 3.3. Consequence to note for the smoke: until 3.3 ships, a freshly submitted rating will NOT change the `reputationLabel` shown on bid cards (still "New provider"); the rating row is created and visible on the job. Do NOT "helpfully" add the increment here.
7. **AC-7 — Tests green, no regression:**
   - `npm test` — `rating.ts` unit tests pass (+ all existing).
   - `supabase/tests/rating_flow.sql` (pgTAP, reuse the auth-sim harness): resident rates their own completed job awarded to provider P → row created; rate a **non-completed** job (open/awarded) → blocked (RLS with-check → 0 rows / error); rate a job **not yours** → blocked; rate with a **provider who wasn't the awarded provider** → blocked; **double-rate** the same job → blocked (unique `ratings_one_per_job`); attempt **update/delete** a rating → blocked (no grant/policy → write-once); `stars` out of range (0 or 6) → blocked (CHECK).
   - `supabase db reset` replays clean (no new migration, but verify); `supabase test db` green; `tsc` + `expo lint` clean.

## Tasks / Subtasks

- [x] Task 1: Star helper + tests (AC-1, AC-7)
  - [x] `app/src/lib/rating.ts` — `isValidStars`; `app/src/lib/rating.test.ts` — 4 boundary cases (0, 1–5, 6, non-integer).
- [x] Task 2: Data layer (AC-2, AC-3)
  - [x] `app/src/lib/my-jobs.ts` — added `submitRating(...)` (client insert, RLS-enforced); extended `fetchMyJobs` select with `rating:ratings(stars, review)` + normalize array→object; added `rating` to `MyJob`.
- [x] Task 3: Screen — rate control + rated state (AC-4, AC-5)
  - [x] `app/src/app/my-jobs.tsx` — completed branch: 5-star picker (≥44px) + optional review `TextInput` + Submit (per-job `ratingJobId` lock, disabled until ≥1 star, `await load()` ordering); rated state shows ★/☆ + review read-only.
- [x] Task 4: DB tests + verify (AC-7)
  - [x] `supabase/tests/rating_flow.sql` — happy path + deny paths (not-completed, not-owner, wrong-provider, double-rate unique, update/delete write-once, stars range CHECK).
  - [x] `supabase test db` → 110 green; `npm test` → 49; `tsc` + `expo lint` clean. (No migration — ratings table/RLS already exist.)
- [x] Task 5: Commit referencing story 3.1.

## Dev Notes

- **No migration, no RPC — the contrast with 2.8/2.9.** The `ratings` RLS already does the whole job: `ratings_insert_valid` requires `resident_id = auth.uid()` AND an `EXISTS` over jobs proving the caller owns a `completed` job whose `awarded_provider_id` equals the rated `provider_id`. Write-once falls out of the grant model (SELECT+INSERT only; no UPDATE/DELETE policy or grant) plus `unique(job_id)`. So `submitRating` is a plain `supabase.from('ratings').insert(...)`. Do NOT add an RPC or a migration — that would be redundant and untested surface.
- **Resident drives the rating.** `resident_id` must be the caller's uid (the RLS with-check enforces it, but set it explicitly from `auth.getUser()` so the insert isn't relying on a DB default — there is none). `provider_id` is the job's `awarded_provider_id` (pass it from the job row in the UI).
- **The completion gate is already proven** (2.9's `complete_flow` + the ratings RLS): only a `completed` job that the resident owns and that was awarded to that provider can be rated. `rating_flow.sql` must still test every deny path directly — this is the security-critical core of this story (there's no app-side authz, it's all RLS).
- **Reputation does NOT move yet (Story 3.3).** `reputationLabel` (2.8) reads `profiles.rating_sum`/`rating_count`, which only Story 3.3's increment writes. So after rating in the POC, the provider still shows "New provider" on bid cards — expected, not a bug. AC-6 makes this boundary explicit so the dev doesn't pull 3.3 forward. Note it in the device-smoke expectations too.
- **Embed ambiguity check:** `jobs`↔`ratings` has exactly one FK (`ratings.job_id`), so `rating:ratings(...)` is unambiguous (no PGRST201). Contrast [[jobs-bids-embed-ambiguity]] (jobs↔bids has two FKs and needs `bids!bids_job_id_fkey`). `ratings`↔`profiles` has two FKs (provider_id, resident_id) but we do NOT embed profiles from ratings here, so it's moot.
- **Reuse the established screen patterns** (all present in `my-jobs.tsx`): per-job in-flight lock (`completingJobId` → add `ratingJobId`), `mounted` ref + `await load()` (the 2.9 review patch ordering), `{error}` + `console.warn`, `setMessage` calm notice, Themed components, ≥44px tap targets, `RefreshControl`. Star buttons should be ≥44px and clearly show filled vs empty.
- **Scope:** overall 1–5 + optional review ONLY. NO Adab (FR-14 / Story 3.2 — deferred), NO reputation increment (3.3), NO provider-facing view of ratings (3.4 humanized card — deferred), NO neighbor social proof (3.5). Resist scaffolding ahead.
- **Testing reality:** `isValidStars` pure → jest. The insert authz + write-once → pgTAP `rating_flow.sql` (test EVERY deny path; this is the whole security story since there's no RPC). The rate control render/submit → device/Expo manual smoke (reuse the resident + a completed job from the 2.9 smoke; re-provision + reseed after any `db reset`).

### Project Structure Notes

- `app/src/lib/rating.ts` (NEW) + `app/src/lib/rating.test.ts` (NEW) — `isValidStars` helper
- `app/src/lib/my-jobs.ts` (MODIFY) — add `submitRating`; embed `rating` in `fetchMyJobs`; extend `MyJob`
- `app/src/app/my-jobs.tsx` (MODIFY) — completed-branch rate control + rated state
- `supabase/tests/rating_flow.sql` (NEW) — insert authz + write-once + range deny matrix
- NO migration (ratings table + RLS already exist from 1.2/1.3); NO new route/tab.

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-13] — resident gives a completed job an overall 1–5 rating + optional review; rating updates cumulative reputation (the increment itself is Story 3.3).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.1] — only a Completed Job can be rated; creating a Rating triggers a server-side reputation update (Story 3.3).
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md] — Epic 3 reduced to write-once rating + aggregates; Adab/social-proof deferred.
- [Source: supabase/migrations/20260613061242_core_schema.sql] — `ratings` table (stars CHECK 1–5, `ratings_one_per_job` unique, job_id/provider_id/resident_id FKs).
- [Source: supabase/migrations/20260613063734_rls_policies.sql] — `ratings_insert_valid` (attribution + completed-gate + awarded-provider match), `ratings_select_all`, write-once via grant model.
- [Source: _bmad-output/implementation-artifacts/2-9-offline-completion-mark-complete.md] — the `completed` state this story builds on; My Jobs screen patterns (per-job lock, await load(), {error} shape).
- [Source: _bmad-output/implementation-artifacts/2-8-compare-and-award.md] — `reputationLabel` reads profiles.rating_sum/rating_count (why reputation won't move until 3.3); fetchMyJobs embed pattern.

### Review Findings (code review 2026-06-15)

**Note:** the Blind Hunter + Acceptance Auditor subagents hit sustained API 529 overloads (returned no output after retries), so those two layers were run as a **self-review** (less independent) by the orchestrator. The **Edge Case Hunter layer ran independently**. The security core (ratings insert authz + write-once) is fully pgTAP-proven regardless.

- [x] [Review][Patch] Stale `starDraft`/`reviewDraft` entries lingered after a successful submit — FIXED: `onSubmitRating` now drops the job's drafts on success (rated state is read-only). [app/src/app/my-jobs.tsx:124]
- [x] [Review][Defer] Global `ratingJobId` lock disables all submit buttons while any one is in flight — intended single-flight, mirrors `completingJobId`. [app/src/app/my-jobs.tsx] — deferred, consistent with 2.9
- [x] [Review][Defer] Shared `message` can be clobbered by a concurrent handler — pre-existing pattern shared across onAward/onComplete/onShowContacts. [app/src/app/my-jobs.tsx] — deferred, pre-existing

**Dismissed (verified false positives):** "rating embed could be a truthy empty object → stars undefined" (`ratings.stars` is NOT NULL and is in the select, so a present row always has stars); "null `awarded_provider_id` on a completed job → silent submit no-op" (schema CHECK `jobs_awarded_requires_provider_chk` guarantees completed ⇒ provider non-null); "draft-map sync race" (not grounded — drafts are keyed by job id, set synchronously).

**Self-review (correctness + acceptance):** star math safe (`5 - stars` with stars ∈ NOT-NULL CHECK 1..5 → never negative); `submitRating` gates on uid then defers to RLS; `await load()` ordering carries the 2.9 fix; all 7 ACs verified satisfied incl. AC-6 boundary (no reputation increment pulled forward).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase test db` → 110 passed (rating_flow 9 + award_flow + complete_flow + jobs_flow + rls + schema + smoke) — All tests successful
- `npx jest` → 49 passed (4 new `rating` + all existing)
- `npx tsc --noEmit` + `npx expo lint` → clean
- No migration needed — `ratings` table (1.2) + RLS (1.3) already enforce the full contract.

### Completion Notes List

- All 7 ACs satisfied. **Turns a completed job into a permanent Rating** — the Epic-3 payoff.
- **No migration, no RPC (the deliberate contrast with 2.8/2.9):** `submitRating` is a plain `supabase.from('ratings').insert(...)` fully constrained by RLS `ratings_insert_valid` (attribution + completed-gate + awarded-provider match) and write-once (SELECT/INSERT grants only + `unique(job_id)`). `rating_flow.sql` proves the entire deny matrix (not-completed, non-owner, wrong-provider, double-rate, update/delete, stars range) — this IS the security story since there's no app-side authz.
- **`fetchMyJobs` embeds `rating:ratings(stars, review)`** (unambiguous — one FK jobs↔ratings, unlike [[jobs-bids-embed-ambiguity]]) and normalizes a possible array→object so the screen reads `job.rating` directly.
- **Reputation does NOT move yet (AC-6 boundary, Story 3.3):** `reputationLabel` reads `profiles.rating_sum`/`rating_count`, which only 3.3's increment writes. So a rated provider still shows "New provider" on bid cards in the POC — expected, documented, NOT a bug. Did not pull 3.3 forward.
- **Scope held:** overall 1–5 + optional review only. No Adab (3.2), no reputation increment (3.3), no provider-facing card (3.4), no social proof (3.5).
- **✅ Device E2E smoke CONFIRMED 2026-06-15:** on the Android dev build against LAN-IP Supabase, resident logged in → My Jobs → on a completed job: star picker filled correctly, Submit disabled until ≥1 star, submitted with a review → flipped to the read-only rated state (★ + review), re-rate control gone (write-once). Confirmed reputation does NOT move yet (provider still "New provider" — AC-6 boundary, Story 3.3). Reused the two completed jobs from the 2.9 smoke (no reseed needed). The insert authz + write-once core is also fully pgTAP-proven.

### File List

- `app/src/lib/rating.ts` (NEW) — `isValidStars` helper
- `app/src/lib/rating.test.ts` (NEW) — boundary unit tests
- `app/src/lib/my-jobs.ts` (MODIFIED) — `submitRating`; `rating` embed + normalize; `MyJob.rating`
- `app/src/app/my-jobs.tsx` (MODIFIED) — completed-branch rate control (star picker + review + submit) + rated state + styles
- `supabase/tests/rating_flow.sql` (NEW) — ratings insert authz + write-once + range deny matrix (pgTAP)
