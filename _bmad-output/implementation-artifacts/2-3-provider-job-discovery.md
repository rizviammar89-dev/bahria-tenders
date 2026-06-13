---
baseline_commit: 0654255ab39d437feabd4c27f64de780468a3a13
---

# Story 2.3: Provider Job Discovery (FR-7)

Status: done

<!-- Epic 2 / demand loop — the provider side of the marketplace. Translates the Bubble-era epic story 2.3 (FR-7) to the POC stack: an Expo feed screen + Supabase select. Backend (jobs, services, jobs_select_visible RLS, profiles.service_ids) is DONE. Availability (Story 2.2 / FR-19) is POC-deferred, so the feed shows ALL open matching jobs with no availability filter. -->

## Story

As a **verified provider**,
I want a feed of open jobs that match the trades I offer,
so that I can choose which to bid on.

## Acceptance Criteria

1. **AC-1 — Feed query (`fetchOpenJobsForMyTrades` in `app/src/lib/jobs.ts`):** returns open jobs the signed-in provider should see. Logic:
   - Load the signed-in user's profile (`role`, `service_ids`). If `role !== 'provider'` or `service_ids` is empty → return `{ jobs: [], error: null }` (a resident or trade-less provider sees an empty feed — benign, not an error).
   - Otherwise select from `jobs` where `status = 'open'` AND `service_id = ANY(service_ids)` AND `resident_id <> me` (don't surface a provider's own posted job), embedding the trade name (`services(display_en, display_ur)`), ordered by `created_at` descending.
   - Returns `{ jobs: OpenJob[]; error: string | null }` where `OpenJob = { id, description, precinct, created_at, service: { display_en, display_ur } }`. **No resident identity/phone is selected** (RLS already hides the phone column; the job carries no address/contact field — FR-7 privacy is structural).
2. **AC-2 — "time ago" helper (`app/src/lib/time-ago.ts`), unit-tested:** `timeAgo(iso: string, now: number): string` returns a calm relative label ("just now", "5 min ago", "3 hr ago", "2 days ago") with Western Arabic numerals (localization lock). `now` is injected (no `Date.now()` inside — keeps it pure/testable). Jest covers the boundaries.
3. **AC-3 — Feed screen (`app/src/app/jobs-feed.tsx`):**
   - Loads the feed on mount and supports **pull-to-refresh** (`FlatList` + `RefreshControl`, or `ScrollView` + `RefreshControl`).
   - Each job card shows: trade (`display_en · display_ur`), precinct, description, and the `timeAgo` label. **No resident name/contact** (not available, and not until awarded — FR-7).
   - **Empty state** (calm, per localization lock): "No open jobs in your trades right now — we'll keep this updated." (Never blank/error-looking.)
   - **Load-error state** (reuse the 2.1 pattern): "Couldn't load jobs — pull to refresh."
   - Generous tap targets; calm copy.
4. **AC-4 — Reachable:** a "Jobs" tab routes to the feed, leaving Home, Push Spike, and Post a Job tabs intact.
5. **AC-5 — Privacy + correctness (FR-7 consequences):** the feed shows only `open` jobs in the provider's trades; it does NOT show non-open jobs or jobs in trades the provider doesn't offer; exact address/contact is never shown (none exists pre-award). RLS `jobs_select_visible` is the security backstop (a provider can only read `open` jobs + their own + awarded-to-them); the trade/`resident_id` narrowing is the client relevance filter.
6. **AC-6 — Tests green, no regression:**
   - `npm test` — `timeAgo` unit tests pass (plus existing phone + job-draft tests).
   - `supabase/tests/jobs_flow.sql` extended (pgTAP, auth-sim harness): a provider sees an open job in their trade; does NOT see an open job in a trade they don't offer; does NOT see a non-open (completed) job. `supabase test db` green.
   - tsc + lint clean.

## Tasks / Subtasks

- [x] Task 1: time-ago helper + tests (AC-2, AC-6)
  - [x] `app/src/lib/time-ago.ts` — `timeAgo(iso, now)` (injected clock; just-now/min/hr/day buckets, Western Arabic numerals)
  - [x] `app/src/lib/time-ago.test.ts` — 5 boundary cases; `@jest/globals` import
- [x] Task 2: Feed query (AC-1, AC-5)
  - [x] `app/src/lib/jobs.ts` — `fetchOpenJobsForMyTrades()` + `OpenJob` (role/service_ids guard → empty for residents; `.eq('status','open').in('service_id', ids).neq('resident_id', uid)`; `service:services(display_en,display_ur)` embed; order created_at desc)
- [x] Task 3: Feed screen (AC-3)
  - [x] `app/src/app/jobs-feed.tsx` — FlatList + RefreshControl, job cards (trade · precinct · timeAgo · description), empty + load-error states; `now` stamped at load (Date.now kept out of render per react-hooks/purity)
- [x] Task 4: Navigation (AC-4)
  - [x] `app/src/components/app-tabs.tsx` — "Jobs" trigger for `jobs-feed` (explore.png placeholder); Home/Push Spike/Post a Job preserved
- [x] Task 5: DB tests + verify (AC-6)
  - [x] `jobs_flow.sql` extended — provider feed query returns only the open carpenter job (excludes plumber/other-trade and cancelled/non-open)
  - [x] `supabase test db` → 78 green; `npm test` → 22 green; `tsc --noEmit` + `expo lint` clean
- [x] Task 6: Commit referencing story 2.3

## Dev Notes

- **Backend is built/secured — no migration, no RLS change.** `jobs`, `services`, `profiles.service_ids` (Story 1.2), `jobs_select_visible` RLS (Story 1.3). This story is the client + pgTAP query assertions only.
- **RLS allows MORE than the feed shows — that's intended.** `jobs_select_visible` lets a provider read every `open` job (any trade) plus their own + awarded-to-them. The **trade match** (`service_id = ANY(my service_ids)`) and **exclude-own** (`resident_id <> me`) are CLIENT relevance filters in the query, not security boundaries. The security boundary is RLS (a provider can't read another resident's non-open job — already proven in `rls.sql`). Don't try to push trade-matching into RLS; it's a relevance concern.
- **`service_ids` is a `uuid[]`** on `profiles` (Story 1.2 decision). Match with Supabase `.in('service_id', serviceIds)` after reading the provider's `service_ids`. (Two round-trips: profile then jobs — fine at POC scale. A single RPC/view is a post-POC optimization.)
- **FR-7 privacy is structural here.** The `jobs` row has no address/contact column, and RLS already withholds `profiles.phone` from clients (Story 1.3 column grant). So the feed *cannot* leak contact — there's nothing to leak until the award flow (Story 2.8) shares contact via a service_role path. Just don't add a join that pulls resident identity.
- **Availability (FR-19 / Story 2.2) is POC-deferred** (poc-spec §5) — the feed shows ALL open matching jobs with no availability/online filter. Don't build availability filtering.
- **⚠️ Role-based navigation debt is now acute (deferred-work.md, from 2.1 review).** After this story the app has resident screens (Post a Job) and a provider screen (Jobs feed) all visible to every user. The feed degrades benignly for a resident (empty `service_ids` → empty feed, no error), so this is a UX/cosmetic gap, NOT a correctness/security bug. **Recommendation: do a role-gated-navigation story next** (residents: Post Job / My Jobs; providers: Jobs / My Bids) before more screens stack. Do NOT build role nav inside 2.3 — keep this story tight; just add the tab.
- **Testing reality:** the meaty new logic is the feed query (trade match + status + exclude-own) → tested at the SQL layer in `jobs_flow.sql` (this is exactly what the client `.in()/.eq()/.neq()` compiles to, so it validates feed correctness). `timeAgo` is pure → jest. The screen render + pull-to-refresh is device/Expo-Go manual smoke (same constraint as 1.1/1.4/2.1).
- **Patterns to reuse:** 2.1's `loadError`/empty-state + `useEffect` cancelled-guard + the data-layer `{ data, error }` shape (`jobs.ts`); 1.3's `set local role authenticated` + `request.jwt.claims` pgTAP harness; `@jest/globals` import (1.4); ThemedView/ThemedText/Spacing + calm copy.

### Project Structure Notes

- `app/src/lib/time-ago.ts` (NEW) + `app/src/lib/time-ago.test.ts` (NEW)
- `app/src/lib/jobs.ts` (MODIFY) — add `fetchOpenJobsForMyTrades` + `OpenJob`
- `app/src/app/jobs-feed.tsx` (NEW) — the feed screen/route
- `app/src/components/app-tabs.tsx` (MODIFY) — "Jobs" tab
- `supabase/tests/jobs_flow.sql` (MODIFY) — provider-feed query assertions
- No `supabase/migrations` change.

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-7] — Provider job discovery: sees Open Jobs matching their Trade(s)/area; precinct/distance shown, exact address only after award
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#5] — availability (FR-19) deferred → no availability filter on the feed
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.3] — superseded Bubble FR-7 story this translates
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-schema.md] — jobs (status/service_id/resident_id), profiles.service_ids uuid[], services
- [Source: _bmad-output/implementation-artifacts/1-3-rls-and-grants.md] — `jobs_select_visible` (open OR own OR awarded); phone column withheld from clients; pgTAP auth-sim harness in `rls.sql`
- [Source: _bmad-output/implementation-artifacts/2-1-post-a-job.md] — `jobs.ts` data-layer shape, `loadError`/empty/`useEffect` cancelled-guard patterns, `jobs_flow.sql`, the role-nav deferred item
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — role-gated navigation (Epic-2 cross-cutting; recommend as the next story)

### Review Findings (code review 2026-06-12)

Acceptance Auditor: **ACCEPT** (all 6 ACs met, no violations, no scope creep). The hunters' headline finding (the `service:services(...)` embed shape) was settled empirically — it returns a single object, not an array — so it's a false positive. Remaining findings are cheap client/test hygiene.

**Patch (applied 2026-06-12):**
- [x] [Review][Patch] `time-ago.ts` — `Number.isNaN` guard (invalid ISO → '') + `Math.max(0, …)` clamp (future → "just now"); 2 new jest cases. 24 jest green.
- [x] [Review][Patch] `jobs-feed.tsx` — single `load()` fetch path called by both mount + refresh; `mounted` ref guard makes both unmount-safe; `onRefresh` wrapped in `try/finally` (no stuck spinner). (Lint `set-state-in-effect` on the fetch-on-mount `load()` resolved with a targeted disable + rationale — load() only setStates post-await, matching the 1.1 hydration precedent.)
- [x] [Review][Patch] `jobs_flow.sql` — added a provider-self-posted carpenter-OPEN job; the feed assertion still returns only 'Build a shelf', now genuinely exercising the `resident_id <> auth.uid()` exclusion. 78 pgTAP green.

**Deferred (real, later story / post-POC):**
- [x] [Review][Defer] Empty-`service_ids` provider sees "No open jobs" with no guidance ("select your trades…") — owned by role-nav/provider-onboarding.
- [x] [Review][Defer] No cap on very old dates ("60 days ago") — post-POC; jobs are fresh at POC scale.
- [x] [Review][Defer] Feed doesn't exclude jobs the provider already bid on — Story 2.4 (bidding) territory.
- [x] [Review][Defer] Brief blank list during the very first load (no loading indicator) — minor UX; add a loading state post-POC.

**Dismissed (false positive / cosmetic):**
- `service:services(...)` embed "may be an array" — **verified empirically**: PostgREST returns a single object `{display_en, display_ur}` for the to-one `jobs.service_id → services` FK. Runtime matches `OpenJob.service`; the `as unknown` cast is a smell (the supabase-js inferred type is array-ish) but behavior is correct. Left with a clarifying comment.
- pgTAP order ASC vs client DESC — immaterial for the single-row assertion; client DESC is trivially correct.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `npx jest` → 22 passed (12 phone + 5 job-draft + 5 time-ago)
- `supabase test db` → 78 (jobs_flow 3 + rls 23 + schema 43 + smoke 1) — All tests successful
- `tsc --noEmit` clean; `expo lint` clean

### Completion Notes List

- All 6 ACs satisfied. Provider feed built on the existing secured backend — no migration, no RLS change.
- The feed query mirrors RLS-as-backstop + client-relevance-filter: `status='open'` AND `service_id IN (my service_ids)` AND `resident_id <> me`, trade name embedded via the `services` FK. A resident/trade-less provider gets an empty feed (benign). FR-7 privacy is structural (no contact column; phone withheld by RLS).
- **Two fixes during dev (both honest):**
  1. pgTAP feed query used `= ANY((select service_ids ...))` → `uuid = uuid[]` error (subquery returns one array, not a set). Switched to `IN (select unnest(service_ids) ...)` — which is exactly what the client's `.in('service_id', array)` compiles to. Client code was always correct; only the test SQL was wrong.
  2. `Date.now()` in the render body tripped `react-hooks/purity` (React 19) — moved to a `now` state stamped at load/refresh time.
- **⚠️ Role-nav debt now visible (flagged, not solved):** the app shows Post a Job (resident) and Jobs (provider) tabs to everyone. The feed degrades benignly for a resident (empty service_ids → empty feed). Recommend a role-gated-navigation story next (see deferred-work.md).
- **⚠️ Device E2E = manual smoke:** feed render + pull-to-refresh need the app on a device/emulator vs LAN-IP Supabase. The query logic is proven at the SQL layer; `timeAgo` by jest. Smoke: provision a carpenter provider, post a carpenter job as a resident, log in as the provider, open Jobs.

### File List

- `app/src/lib/time-ago.ts` (NEW) + `app/src/lib/time-ago.test.ts` (NEW)
- `app/src/lib/jobs.ts` (MODIFIED) — `fetchOpenJobsForMyTrades` + `OpenJob`
- `app/src/app/jobs-feed.tsx` (NEW) — provider feed screen/route
- `app/src/components/app-tabs.tsx` (MODIFIED) — "Jobs" tab
- `supabase/tests/jobs_flow.sql` (MODIFIED) — provider feed query assertion
