---
baseline_commit: b05b9a0b5fe535876185d1d190eea33b8f986081
---

# Story 2.4: Submit a Bid (FR-8)

Status: in-progress

<!-- Epic 2 / demand loop — the provider acts on a feed job. Closes post(2.1)→discover(2.3)→BID. Backend is DONE: bids table + UNIQUE(job_id,provider_id) (1.2); bids_insert_provider (verified provider, not own job, job open) + bids_update_own (own bid, while job open) RLS (1.3, hardened in review). ALL the deny cases are already pgTAP-proven in rls.sql. This story is the client (a bid form) + positive-path pgTAP. Subscription gate-check (FR-17) is POC-deferred → no subscription check. -->

## Story

As a **verified provider**,
I want to submit a single price (and an optional short note) on an open job from my feed,
so that the resident can compare me and choose me.

## Acceptance Criteria

1. **AC-1 — Pure bid validation (`app/src/lib/bid-input.ts`), unit-tested:** `validateBidInput(priceText: string): { ok: true; pricePkr: number } | { ok: false; error: string }`. Rules: digits only → a whole-rupee positive integer; reject empty, non-numeric, `0`, and decimals (PKR is whole rupees — architecture format). Trims. Jest covers each. (Note input is optional; validation is on price only — the note is free text, optional.)
2. **AC-2 — Bid data layer (`app/src/lib/bids.ts`):** `submitBid({ jobId, pricePkr, note, existingBidId })` — if `existingBidId` is null, INSERT a `bids` row (`job_id`, `provider_id = auth.uid()`, `price_pkr`, trimmed `note` or null); else UPDATE that bid's `price_pkr`/`note`/`updated_at`. Returns `{ error: string | null }`. The DB/RLS is the backstop (insert rejected if not a verified provider, own job, or job not open; update rejected after award — all already enforced).
3. **AC-3 — Feed shows my bid state (extend `fetchOpenJobsForMyTrades` in `jobs.ts`):** embed the provider's own bid via `bids(id, price_pkr)` (RLS returns only the caller's bid for a job, never other providers'). `OpenJob` gains `myBid: { id: string; pricePkr: number } | null`. Each feed card shows **"Place bid"** when `myBid` is null, or **"Edit bid · Rs N"** when set.
4. **AC-4 — Bid form (`app/src/components/bid-modal.tsx`):** a `Modal` (no routing change) opened from a feed card. Shows the job (trade · precinct · description), a **price** input (`number-pad`, prefixed "Rs"), an optional **note** input, and a **Submit** button. On submit: `validateBidInput` (inline calm error, no network on invalid) → `submitBid`. On success: close, confirm ("Your bid is in — Rs N"), and the feed refreshes so the card flips to "Edit bid". On RLS/DB error: calm "Couldn't submit your bid — please try again" (+ `console.warn` the real error).
5. **AC-5 — Edit while open:** opening the modal on a job where `myBid` is set pre-fills the price/note and submits as an UPDATE (RLS allows it only while the job is `open` — the bid-freeze is already enforced/tested). One bid per provider per job is the DB `UNIQUE` (no duplicate path in the UI).
6. **AC-6 — Tests green, no regression:**
   - `npm test` — `validateBidInput` unit tests pass (+ all existing).
   - `supabase/tests/jobs_flow.sql` extended (pgTAP, auth-sim as a verified provider): a provider submits a valid bid on an open in-trade job → row exists with the price; editing it while open updates the price. (Deny cases — own job, unverified, post-award freeze, immutable job_id — are already in `rls.sql`.) `supabase test db` green.
   - tsc + lint clean.

## Tasks / Subtasks

- [ ] Task 1: Bid validation + tests (AC-1, AC-6)
  - [ ] `app/src/lib/bid-input.ts` — `validateBidInput`
  - [ ] `app/src/lib/bid-input.test.ts` — valid, empty, non-numeric, zero, decimal, whitespace (`@jest/globals`)
- [ ] Task 2: Bid data layer + feed enrichment (AC-2, AC-3)
  - [ ] `app/src/lib/bids.ts` — `submitBid` (insert-or-update)
  - [ ] `app/src/lib/jobs.ts` — extend `OpenJob` with `myBid` + embed `bids(id, price_pkr)` in `fetchOpenJobsForMyTrades`; map `myBid = bids[0] ?? null`
- [ ] Task 3: Bid modal (AC-4, AC-5)
  - [ ] `app/src/components/bid-modal.tsx` — RN `Modal`, price/note inputs, validate→submit, success/error states; pre-fill on edit
- [ ] Task 4: Wire the feed (AC-3, AC-4)
  - [ ] `app/src/app/jobs-feed.tsx` — per-card "Place bid"/"Edit bid · Rs N" button opens the modal for that job; on success refresh the feed
- [ ] Task 5: DB tests + verify (AC-6)
  - [ ] Extend `supabase/tests/jobs_flow.sql` — verified-provider submits a bid (lives_ok) → price present; edit-while-open updates price (lives_ok + results_eq)
  - [ ] `supabase test db`, `npm test`, `tsc --noEmit`, `expo lint` all green
- [ ] Task 6: Commit referencing story 2.4

## Dev Notes

- **Backend is built/secured — no migration, no RLS change.** `bids` (1.2), `bids_insert_provider` + `bids_update_own` (1.3, review-hardened with the job-open guard). The whole security surface (verified-provider, not-own-job, job-open, post-award freeze, one-per-job, immutable job_id) is already enforced AND pgTAP-proven in `rls.sql`. This story trusts that backstop and builds the client + the positive path.
- **`provider_id` from `auth.uid()`** (via `supabase.auth.getUser()`), exactly like `createJob`. Never trust a client-supplied provider id; RLS rejects a mismatch anyway.
- **Insert vs update is decided by `myBid`.** Do NOT upsert — the insert and update RLS policies differ; pick the operation from whether `myBid` exists. The `UNIQUE(job_id, provider_id)` constraint means a stray double-insert is rejected by the DB (defense in depth).
- **Embedding my-bid is RLS-safe.** `bids_select_party` lets a provider read only their OWN bid on a job they don't own → `jobs.select('…, bids(id, price_pkr)')` returns an array of 0-or-1 (the caller's bid), never other providers' bids. So `myBid = data.bids[0] ?? null`. This also addresses the 2.3-review note that the feed didn't reflect bids.
- **Currency:** `price_pkr` is a whole-rupee integer (architecture format `Rs 1,500`, no decimals). `validateBidInput` parses a digit string → int; the input uses `number-pad`. Display with `Rs ` + thousands separators.
- **A Modal, not a route.** Use React Native's `Modal` from the feed — avoids a routing restructure (the feed tab has no Stack). Tapping a card's bid button sets the selected job + opens the modal.
- **Scope:** submit/edit a bid only. NO compare/award (Story 2.8), NO broadcast/notification (2.5), NO subscription gate (FR-17 deferred). On success, just confirm + refresh — do not navigate.
- **Testing reality:** `validateBidInput` pure → jest. `submitBid` + the feed embed → pgTAP positive path (the deny side is already in `rls.sql`). The modal render + the tap-to-open flow is device/Expo-Go manual smoke (same constraint as prior screens).
- **Patterns to reuse:** 2.1's data-layer `{error}` shape + `validate→network` flow + `console.warn` on the real error; 2.3's feed embed (`service:services(...)`), `loadError`/empty/`useEffect` cancelled-guard, the `now`-at-load pattern; 1.3's `set local role authenticated` + `request.jwt.claims` pgTAP harness; `@jest/globals` import; `ThemedView`/`ThemedText`/`Spacing`/`Pressable` + calm copy + ≥48–52px tap targets.

### Project Structure Notes

- `app/src/lib/bid-input.ts` (NEW) + `app/src/lib/bid-input.test.ts` (NEW)
- `app/src/lib/bids.ts` (NEW) — `submitBid`
- `app/src/lib/jobs.ts` (MODIFY) — `OpenJob.myBid` + bids embed
- `app/src/components/bid-modal.tsx` (NEW) — the bid form
- `app/src/app/jobs-feed.tsx` (MODIFY) — per-card bid button + modal wiring
- `supabase/tests/jobs_flow.sql` (MODIFY) — positive bid + edit assertions
- No `supabase/migrations` change.

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-8] — Submit a bid: single price + optional short note; at most one active Bid per Job (editable until awarded); single-price (no tiers)
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#4] — FR-17 subscription gate POC-deferred → no subscription check on bidding
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.4] — superseded Bubble FR-8 (+FR-17 gate) story; the gate is deferred here
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-schema.md] — bids (job_id, provider_id, price_pkr CHECK>0, note, UNIQUE(job_id,provider_id))
- [Source: _bmad-output/implementation-artifacts/1-3-rls-and-grants.md] — `bids_insert_provider`/`bids_update_own` (job-open guard) + the deny pgTAP in `rls.sql`; `bids_select_party` (own-bid visibility)
- [Source: _bmad-output/implementation-artifacts/2-3-provider-job-discovery.md] — `fetchOpenJobsForMyTrades`/`OpenJob`, feed patterns, `jobs_flow.sql` harness
- [Source: _bmad-output/implementation-artifacts/2-1-post-a-job.md] — data-layer `{error}` + validate→network + `console.warn` patterns

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
