---
baseline_commit: 3170d7e0263a7942d412ecb2e114dcef46da4db4
---

# Story 2.1: Post a Job (FR-6)

Status: review

<!-- Epic 2 / the demand loop — the FIRST real product screen ("the screen that IS the product", poc-spec build order). Translates the Bubble-era epic story 2.1 (FR-6) to the POC stack: an Expo screen that inserts a jobs row via the authed Supabase client; RLS jobs_insert_own (Story 1.3) already enforces resident_id = auth.uid(). Backend (jobs table, services seed, RLS) is DONE — this story is the client. -->

## Story

As a **resident**,
I want to post a small job — pick a trade, describe the problem, confirm my precinct,
so that nearby providers can see it and bid.

## Acceptance Criteria

1. **AC-1 — Pure validation helper (`app/src/lib/job-draft.ts`), unit-tested:** `validateJobDraft({ serviceId, description, precinct })` returns `{ ok: true }` or `{ ok: false, error }` with a calm, specific message. Rules: a trade must be selected; description must be non-empty after trim; precinct must be non-empty after trim. Trims inputs. Jest covers each rule + the happy path.
2. **AC-2 — Data layer (`app/src/lib/jobs.ts`):** `createJob({ serviceId, description, precinct })` inserts one row into `public.jobs` via the authed client with `resident_id = (await supabase.auth.getUser()).data.user.id`, `service_id`, trimmed `description`, trimmed `precinct` (status defaults to `'open'` in the DB). Returns `{ error }` (Supabase shape). Does NOT set `status`/`id`/`created_at` (DB defaults). `fetchServices()` returns the 6 trades (`id, slug, display_en, display_ur` ordered by `display_en`). `fetchMyPrecinct()` returns the signed-in resident's `precinct` from their profile (to prefill).
3. **AC-3 — Post-a-Job screen (`app/src/app/post-job.tsx`):**
   - Loads the 6 trades (from `fetchServices`) as **selectable buttons/chips** (NOT a tiny dropdown — generous tap targets, localization lock). Shows `display_en` (with `display_ur` alongside).
   - Description: multiline `TextInput`.
   - Precinct: `TextInput` **prefilled** from the resident's profile precinct (editable).
   - A **Post** button: disabled while submitting; runs `validateJobDraft` (inline calm error on failure, NO network call) then `createJob`.
   - On success: a clear confirmation ("Your job is posted — providers nearby will be notified") and the form resets. On DB/RLS error: a calm error ("Couldn't post your job — please try again").
4. **AC-4 — Reachable in the app:** a third tab (e.g. "Post a Job") routes to the screen, leaving the existing Home and Push Spike tabs intact (the 1.1 push gate still needs Push Spike). Reuse an existing tab icon as a placeholder (no new asset).
5. **AC-5 — Required fields enforced (FR-6 consequence):** a job cannot be posted without a Trade and a Precinct (and a description — schema `NOT NULL`); the screen blocks submit and shows which field is missing. The DB also rejects a missing trade/precinct (NOT NULL) as the backstop.
6. **AC-6 — Tests green, no regression:**
   - `npm test` (jest) — `validateJobDraft` unit tests pass (plus existing phone tests).
   - `supabase/tests/jobs_flow.sql` (pgTAP): an authed resident inserts their own job → succeeds and lands in `status='open'` with `resident_id = auth.uid()`; (the deny case — posting as another resident — is already covered in `rls.sql`). `supabase test db` green.
   - tsc + lint clean.

## Tasks / Subtasks

- [x] Task 1: Validation helper + tests (AC-1, AC-6)
  - [x] `app/src/lib/job-draft.ts` — `validateJobDraft`
  - [x] `app/src/lib/job-draft.test.ts` — 5 cases (happy path, missing trade, empty/whitespace description + precinct, trim-only-valid); `@jest/globals` import
- [x] Task 2: Data layer (AC-2)
  - [x] `app/src/lib/jobs.ts` — `createJob` (resident_id from getUser, trims, omits status), `fetchServices` (ordered), `fetchMyPrecinct`
- [x] Task 3: Screen (AC-3, AC-5)
  - [x] `app/src/app/post-job.tsx` — trade chips (display_en · display_ur), multiline description, prefilled precinct, Post button, posted/error states; tap targets ≥48–52px; calm copy
- [x] Task 4: Navigation (AC-4)
  - [x] `app/src/components/app-tabs.tsx` — "Post a Job" trigger for `post-job` (home.png placeholder icon); Push Spike + Home preserved
- [x] Task 5: DB flow test + verify (AC-6)
  - [x] `supabase/tests/jobs_flow.sql` — resident-posts-own-job lives_ok + results_eq(status='open', resident_id=auth.uid())
  - [x] `supabase test db` → 77 green; `npm test` → 17 green; `tsc --noEmit` + `expo lint` clean
- [x] Task 6: Commit referencing story 2.1

## Dev Notes

- **Backend is already built and secured — do NOT touch migrations.** `jobs` table (Story 1.2), `jobs_insert_own` RLS `WITH CHECK (resident_id = auth.uid())` and `jobs_select_visible` (Story 1.3), and the 6 seeded services all exist. This story is the **client only** + one positive pgTAP test. No new migration, no RLS change.
- **`resident_id` must equal `auth.uid()`** or the insert is rejected by RLS (42501). Get it from `supabase.auth.getUser()` (or the session). The insert does NOT pass `status` (DB default `'open'`), `id`, or `created_at`.
- **Trade selection = tappable chips, not a dropdown.** RN core has no `Picker`; do NOT add `@react-native-picker/picker` (new dep). Six trades render fine as a wrap of selectable `Pressable` chips — and that honors the localization lock (generous tap targets, icon+text). Show `display_en`; `display_ur` can sit beside it.
- **Precinct prefill:** the resident's profile already has a `precinct` (set at provisioning). Prefill the field from `fetchMyPrecinct()` so the common case is one tap. Keep it editable (FR-6: the resident specifies the precinct). `precinct` is free text in the POC (7-table contract; no precinct lookup).
- **No navigation-after-post yet.** "My Jobs" / the bids list are later stories — on success, show a confirmation in-place and reset the form. Do NOT build a job list or navigate to one here.
- **Role-based navigation is a known gap, not this story.** Right now both residents and providers would see the same tabs. Proper role-gated nav (residents see Post Job / My Jobs; providers see the Feed) is a cross-cutting Epic-2 concern — flag it, don't solve it in 2.1. Adding the tab is enough to make Post-a-Job reachable for the demo.
- **i18n:** the POC localization plan is two static string files (no framework). 2.1 uses plain English labels for now with `display_en`/`display_ur` from the DB for trade names. A formal string-table pass is a separate cross-cutting task — keep copy calm and centralized-ish so it's easy to extract later.
- **Testing reality:** `validateJobDraft` is pure → jest. `createJob`/`fetchServices` are thin Supabase calls → covered by the pgTAP positive-insert test against local Supabase (the RLS deny side is already in `rls.sql`). The screen itself is device/Expo-Go manual smoke (same constraint as 1.1/1.4) — verify the autonomous layers (jest + pgTAP + tsc + lint) and flag the device smoke.
- **Previous-story patterns to reuse:** the `@jest/globals` import (Story 1.4 — ambient `@types/jest` doesn't resolve under expo's tsconfig); the `set local role authenticated` + `request.jwt.claims` pgTAP auth-sim harness (Story 1.3 `rls.sql`); `ThemedView`/`ThemedText`/`Spacing` + `Pressable` patterns and calm-error copy (Story 1.4 `login-screen.tsx`); `supabase` client from `@/lib/supabase`.

### Project Structure Notes

- `app/src/lib/job-draft.ts` (NEW) + `app/src/lib/job-draft.test.ts` (NEW)
- `app/src/lib/jobs.ts` (NEW) — createJob / fetchServices / fetchMyPrecinct
- `app/src/app/post-job.tsx` (NEW) — the screen/route
- `app/src/components/app-tabs.tsx` (MODIFY) — third tab
- `supabase/tests/jobs_flow.sql` (NEW) — positive insert pgTAP
- No `supabase/migrations` change.

### References

- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-6] — Post a job: Trade + free-text description + Precinct; enters Open, visible to verified providers in that Trade; cannot post without Trade and Precinct
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#2] — in-scope core loop "post job (FR-6)"; §6 jobs table; localization locks (tap targets, calm copy)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1] — superseded Bubble FR-6 story this translates
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-schema.md] — jobs table shape (resident_id, service_id, description, precinct, status default 'open', awarded_provider_id)
- [Source: _bmad-output/implementation-artifacts/1-3-rls-and-grants.md] — `jobs_insert_own` (WITH CHECK resident_id=auth.uid()), `jobs_select_visible`; the auth-sim pgTAP harness in `supabase/tests/rls.sql`
- [Source: _bmad-output/implementation-artifacts/1-4-auth-phone-pin.md] — `supabase` client, auth session, `@jest/globals` import pattern, ThemedView/calm-copy UI conventions

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `npx jest` → 17 passed (12 phone + 5 job-draft)
- `supabase test db` → 77 tests (jobs_flow.sql 2 + rls 23 + schema 43 + smoke 1) — All tests successful
- `npx tsc --noEmit` clean; `npx expo lint` clean

### Completion Notes List

- All 6 ACs satisfied. First Epic-2 product screen built purely on the existing secured backend — no migration, no RLS change.
- Validation is a pure unit-tested helper (`validateJobDraft`), reused by the screen; the data layer (`jobs.ts`) does the authed insert with `resident_id` from `getUser()` and lets the DB default `status='open'`. The new positive pgTAP test proves a resident's own insert lands `open`/owned; the deny side (posting as another) was already covered in `rls.sql`.
- Trade selection is tappable chips (no `@react-native-picker/picker` dependency); precinct prefills from the resident's profile; success shows an in-place confirmation (no list screen to navigate to yet).
- **Known gaps flagged in the story, NOT solved here (deliberate):** role-based navigation (residents vs providers see the same tabs) and a formal i18n string table — both Epic-2 cross-cutting concerns.
- **⚠️ Device E2E not exercised (manual smoke):** the screen rendering + a real authed insert through the UI needs the app on a device/emulator against LAN-IP Supabase (same constraint as 1.1/1.4). All autonomous layers verified (jest, pgTAP positive insert, tsc, lint). Smoke: `cd app; npx expo start`, log in as a provisioned resident, open "Post a Job", pick a trade, post, and confirm the row appears (Studio at :54323).
- **Note for reviewer:** the post-job route sits as a plain tab alongside Home/Push Spike; providers would also see it until role-gated nav lands. The 1.1 Push Spike tab is intentionally preserved (its gate is still pending).

### File List

- `app/src/lib/job-draft.ts` (NEW) — pure job-draft validation
- `app/src/lib/job-draft.test.ts` (NEW) — 5 jest cases
- `app/src/lib/jobs.ts` (NEW) — createJob / fetchServices / fetchMyPrecinct
- `app/src/app/post-job.tsx` (NEW) — Post-a-Job screen/route
- `app/src/components/app-tabs.tsx` (MODIFIED) — third "Post a Job" tab
- `supabase/tests/jobs_flow.sql` (NEW) — positive post-job pgTAP
