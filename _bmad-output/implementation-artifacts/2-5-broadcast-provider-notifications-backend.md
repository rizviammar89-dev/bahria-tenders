---
baseline_commit: 508f559736c6cfc02c3657466ece8ecb7d3a14d5
---

# Story 2.5: Broadcast & Provider Notifications — Backend (FR-20, push-only)

Status: review

<!-- Epic 2 / demand loop — the "doorbell". When a resident posts a job, matching verified providers in the same precinct get a push alert so they can bid fast. POC scope is PUSH-ONLY (SMS deferred — FR-20 reduced); the dispatcher is built behind a Channel abstraction so SMS is "one file" later (architecture). Unblocked by Story 1.1's CONDITIONAL GO (push works as the doorbell with battery optimization disabled). PREREQUISITE folded in: provider push tokens are not stored yet (1.1 spike only displayed them) — this story adds a push_tokens table + registration. Backend pieces: (1) push_tokens table+RLS, (2) broadcast_job() SECURITY DEFINER matcher writing idempotent notification_log rows, (3) a broadcast-job Edge Function (service_role) that sends via Expo + marks sent, invoked fire-and-forget after posting. Availability/online (FR-19) is deferred → target all verified matching providers, not "online" ones. Empty-state concierge (FR-22 / 2.7) deferred. -->

## Story

As the **platform**,
I want to push-notify every verified provider whose trade + precinct match a newly posted job, server-side and idempotently,
so that providers respond quickly without watching the app, and every send is logged and retryable.

## Acceptance Criteria

1. **AC-1 — `push_tokens` table (migration) + RLS:** `push_tokens (user_id uuid PK references profiles(id) on delete cascade, expo_push_token text not null, updated_at timestamptz not null default now())`. RLS: enable; the owner can upsert/read their own row (`user_id = auth.uid()`); `service_role` reads all (for the dispatcher). Column-scoped: `grant select, insert, update (expo_push_token, updated_at) on push_tokens to authenticated`. No cross-user read for clients (a resident must not read providers' tokens — the dispatcher reads them via service_role only).
2. **AC-2 — Token registration (app):** after a successful login (any role; harmless for residents, required for providers), the app calls `registerForPushAsync()` and, on success, upserts the token into `push_tokens` (`savePushToken()` in `app/src/lib/push.ts`, `onConflict: user_id`). Failure is non-fatal (logged, never blocks the app). Re-registers on each app start so a rotated token is captured.
3. **AC-3 — `broadcast_job(p_job_id)` matcher (migration, SECURITY DEFINER):** selects the target providers for a job — `role='provider'` AND `verified_by_admin` AND the job's `service_id = ANY(service_ids)` AND `precinct = job.precinct` AND `id <> job.resident_id` — and inserts ONE `notification_log` row per provider: `channel='push'`, `recipient_id=provider`, `job_id`, `idempotency_key = p_job_id || ':' || provider_id || ':push'`, `sent_at = null`. `on conflict (idempotency_key) do nothing` (idempotent/retryable). Returns the set of rows still needing send joined to tokens: `(notification_id uuid, recipient_id uuid, expo_push_token text)` for rows where `sent_at is null` and a token exists. `security definer` + `set search_path = public`; `revoke all from public, anon, authenticated` (only the service_role dispatcher calls it).
4. **AC-4 — `broadcast-job` Edge Function (`supabase/functions/broadcast-job/index.ts`):** a Deno function (service_role) that takes `{ jobId }`, calls `broadcast_job` via RPC, fetches the job's trade + precinct for the message, POSTs the batch to `https://exp.host/--/api/v2/push/send` (`title` = "New <trade> job", `body` = "<precinct> · tap to bid", `channelId: 'default'`, `priority: 'high'`), then marks the delivered rows `sent_at = now()`. Idempotent (safe to re-invoke). Returns a small JSON summary `{ matched, sent }`. Never throws to the caller in a way that blocks them.
5. **AC-5 — Fire-and-forget invoke (app):** on a successful `createJob` (`post-job.tsx` / `lib/jobs.ts`), invoke the Edge Function (`supabase.functions.invoke('broadcast-job', { body: { jobId } })`) WITHOUT awaiting/blocking the resident's UI (the post succeeds and navigates regardless; a broadcast failure is logged, not surfaced). The resident's flow does not depend on the broadcast result.
6. **AC-6 — Dispatcher interface (Channel abstraction):** the Edge Function sends through a small `Channel` interface with a `PushChannel` implementation (Expo), so adding an `SmsChannel` post-POC is one new file + one line — no change to the matcher or the log. Document the seam.
7. **AC-7 — Tests green, no regression:**
   - `supabase/tests/broadcast_flow.sql` (pgTAP): `broadcast_job` inserts exactly one row per matching verified provider (trade ∈ service_ids AND same precinct); EXCLUDES wrong-trade, wrong-precinct, unverified, and the resident; is idempotent (re-run inserts no dups, count unchanged); returns only `sent_at is null` rows that have a token (a matching provider with no token row is logged but not returned for send); `broadcast_job` is not executable by `authenticated` (42501).
   - `npm test` (+ any new `push.ts`/helper unit test) + `tsc` + `expo lint` clean.
   - `supabase db reset` replays clean (new migration); `supabase test db` green.
   - Edge Function: verified by device/integration smoke (Deno HTTP not pgTAP-coverable) — `supabase functions serve broadcast-job`, post a job, confirm the provider device receives the push and the `notification_log` row flips `sent_at`.

## Tasks / Subtasks

- [x] Task 1: Migration — `push_tokens` + RLS + `broadcast_job` (AC-1, AC-3)
  - [x] `supabase/migrations/20260616090000_broadcast.sql` — `push_tokens` (owner-managed RLS, service_role read, column-scoped client grants); `broadcast_job(p_job_id)` SECURITY DEFINER matcher (idempotent notification_log + returns unsent-with-token rows); revoked from client roles; **execute granted to service_role** (the EF caller — caught in integration smoke).
- [x] Task 2: Token registration (AC-2)
  - [x] `app/src/lib/push.ts` — `savePushToken()` (registerForPushAsync → upsert push_tokens on conflict user_id); called from `_layout.tsx` Gate effect on sign-in, non-fatal.
- [x] Task 3: Edge Function (AC-4, AC-6)
  - [x] `supabase/functions/broadcast-job/index.ts` — service_role client, `Channel`/`PushChannel` abstraction, rpc('broadcast_job'), Expo batch send, mark sent; `{matched, sent}` summary.
- [x] Task 4: Fire-and-forget invoke (AC-5)
  - [x] `app/src/lib/jobs.ts` — `createJob` now `.select('id')` + `void supabase.functions.invoke('broadcast-job', …)` not awaited, errors logged only.
- [x] Task 5: Tests + verify (AC-7)
  - [x] `supabase/tests/broadcast_flow.sql` — match/exclude/idempotent/token/authz matrix (6 assertions).
  - [x] `supabase db reset` + `supabase test db` → 125 green; `npm test` → 49; `tsc` + lint clean.
  - [~] Integration smoke: matcher + EF wiring PROVEN locally (EF boots, auths as service_role, calls RPC, writes the correct notification_log row); **live Expo send NOT verifiable on local Docker** — the edge-runtime container has no outbound egress to exp.host (`Connection refused`). Verified-by-proxy: the same exp.host call works from the host (Story 1.1). Full delivery smoke pending deployed Supabase or a tunnel — see Completion Notes.
- [x] Task 6: Commit referencing story 2.5.

## Dev Notes

- **Unblocked by 1.1 CONDITIONAL GO:** push is the doorbell, contingent on the provider's phone having battery optimization disabled (onboarding step). The broadcast still always writes `notification_log` (the audit/retry trail + the data that will quantify the real push gap at N=20).
- **Push-only (SMS deferred).** Build the `Channel` abstraction so `SmsChannel` is a later one-file add. Do NOT wire SMS now. `notification_channel` enum already has `sms`/`whatsapp_manual` for later.
- **Why the matcher is a SECURITY DEFINER RPC, not client code:** the resident triggers the broadcast but must NOT be able to read providers' push tokens or write `notification_log` (client has no insert grant there — Story 1.3). The matcher runs server-side (service_role via the Edge Function); it reads tokens and writes the log. Revoke it from all client roles. Reuses the award/complete/reputation hardening discipline (`security definer` + `set search_path = public`).
- **Idempotent + retryable (the epic's explicit requirement):** the `idempotency_key = job:provider:push` UNIQUE means re-invoking the function inserts no duplicate rows, and only `sent_at is null` rows are (re)sent — so a failed/partial broadcast can be safely retried. Mark `sent_at` only after a successful Expo POST.
- **Targeting:** verified providers, trade ∈ `service_ids`, same `precinct`, excluding the resident. Availability/"online" (FR-19) is deferred, so we do NOT filter on an availability toggle — all matching verified providers are notified (the pull feed + founder WhatsApp remain the backstop). Empty-broadcast concierge (FR-22 / Story 2.7) is deferred — an empty match just writes zero rows; no special handling here.
- **Does not block the resident UI (AC-5):** invoke the Edge Function fire-and-forget after the insert. The resident's post + navigation must not await the broadcast; a broadcast error is logged, never shown. The architecture: "broadcast runs server-side and does not block the resident's UI."
- **Edge Function reality:** Deno, runs in the Supabase edge runtime. Locally: `supabase functions serve broadcast-job` (or it's served by the running edge runtime). It reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the function env (provided locally by the CLI). The phone reaches it at `http://<LAN-IP>:54321/functions/v1/broadcast-job`. Expo push send needs no secret (Expo relays to FCM with the V1 key already uploaded in 1.1). Mark this leg as device/integration smoke — Deno HTTP is not pgTAP-coverable; the matcher (the security-critical core) IS fully pgTAP-tested.
- **Token storage prerequisite:** the 1.1 spike only displayed the token. This story persists it. `savePushToken` upserts keyed by `user_id` (one device per user for the POC — fine). Residents will also store a token (harmless); only providers are ever matched as recipients.
- **Reuse patterns:** the SECURITY DEFINER + revoke discipline (award_job/complete_job/reputation); the auth-sim pgTAP harness (jobs_flow/award_flow) for `broadcast_flow.sql`; `registerForPushAsync` from 1.1 for the token; the `{error}`/`console.warn` shape + unmount-safe effects in the app.

### Project Structure Notes

- `supabase/migrations/<ts>_broadcast.sql` (NEW) — `push_tokens` + `broadcast_job`
- `supabase/functions/broadcast-job/index.ts` (NEW) — Edge Function (Channel/PushChannel, Expo send)
- `supabase/tests/broadcast_flow.sql` (NEW) — matcher match/exclude/idempotent/authz pgTAP
- `app/src/lib/push.ts` (MODIFY) — `savePushToken`
- `app/src/lib/jobs.ts` and/or `app/src/app/post-job.tsx` (MODIFY) — fire-and-forget invoke
- token-registration call site in the gated app (e.g. `app/src/app/_layout.tsx` or a small hook)
- NO change to `notification_log` schema/RLS (already correct from 1.2/1.3)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.5] — broadcast to matching verified+available providers; one Notification row per provider with sent flag (idempotent, retryable); server-side, non-blocking.
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-20] — broadcast on post to verified providers by trade+area; POC §"in scope: broadcast via push (FR-20, push-only)"; SMS deferred.
- [Source: _bmad-output/planning-artifacts/architecture.md] — `notification_log` (channel enum, UNIQUE idempotency key) behind a notification-dispatcher `Channel` interface so SMS is one file; backend workflows = SECURITY DEFINER / Edge Functions (service_role).
- [Source: _bmad-output/implementation-artifacts/1-1-environment-setup-and-fcm-spike.md] — CONDITIONAL GO (push viable with battery-opt disabled); `registerForPushAsync`; the token storage gap this story closes; Expo push send via `exp.host`.
- [Source: supabase/migrations/20260613063734_rls_policies.sql] — `notification_log` is service-role-write / recipient-read; the service_role grant + RLS-enable loop to mirror for `push_tokens`.
- [Source: supabase/migrations/20260613061242_core_schema.sql] — `notification_log` columns (recipient_id, job_id, channel, idempotency_key UNIQUE, sent_at) + `notification_channel` enum; `profiles.service_ids`/`precinct`/`verified_by_admin`.
- [Source: _bmad-output/implementation-artifacts/2-1-post-a-job.md] — `createJob` is the trigger point for the fire-and-forget invoke.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase db reset` → 6 migrations replay clean (incl. `20260616090000_broadcast`)
- `supabase test db` → 125 passed (broadcast_flow 6 + reputation + rating + award + complete + jobs + rls + schema + smoke)
- `npx jest` → 49; `npx tsc --noEmit` + `npx expo lint` → clean
- Integration smoke (local `supabase functions serve broadcast-job`): bogus job → "Job not found" (EF boots + reaches RPC ✅); **caught a real bug** — `service_role` lacked execute on `broadcast_job` after the PUBLIC revoke (added `grant execute … to service_role`); after fix, seeded job → matcher wrote the correct `notification_log` row (verified carpenter only); the EF's exp.host POST failed with `Connection refused (os error 111)` = local edge runtime has no outbound internet.

### Completion Notes List

- **5 of 6 ACs fully verified; AC-4's live send is environment-blocked locally.** The matcher (security core), idempotency, targeting, token storage, fire-and-forget invoke, and the EF wiring are all proven. The actual Expo push from the EF can't run on local Docker (edge-runtime egress is blocked → `Connection refused` to exp.host). This is NOT a code defect: the identical exp.host call delivers from the host (Story 1.1 receipts `ok` + seen on device).
- **`broadcast_job` matcher is the pgTAP-proven core:** one idempotent `notification_log` push row per verified provider with trade ∈ service_ids AND same precinct, excluding the resident; excludes unverified / wrong-trade / wrong-precinct; returns only unsent rows that have a token; not callable by clients (42501). Idempotent + retry-safe (sent rows aren't returned again).
- **Dispatcher interface (AC-6):** `Channel` + `PushChannel` in the EF — adding `SmsChannel` post-POC is one class + one branch; the matcher and `notification_log` are channel-agnostic.
- **Push token storage prerequisite closed:** `push_tokens` table + `savePushToken()` (upsert on `user_id`), registered on sign-in. (The 1.1 spike only displayed the token.)
- **Targeting per POC:** all verified matching providers (availability/online FR-19 deferred → not filtered); empty match = zero rows (concierge FR-22 / 2.7 deferred). SMS deferred (push-only).
- **⚠️ Remaining smoke (the live send), do ONE of:**
  1. **Deploy** to a hosted Supabase project (`supabase functions deploy broadcast-job`) — the deployed edge runtime has internet; then post a job and confirm the provider device buzzes + the row flips `sent_at`.
  2. **Local tunnel:** keep `supabase functions serve broadcast-job` running; on the phone, post a job as a resident while a *different* verified provider account (with its token registered) is the target → confirm delivery. (Blocked today only by local container egress; if your Docker allows egress it'll just work.)
- **Code review:** pending (recommended before marking done).

### File List

- `supabase/migrations/20260616090000_broadcast.sql` (NEW) — `push_tokens` table + RLS + `broadcast_job` matcher (+ service_role execute grant)
- `supabase/functions/broadcast-job/index.ts` (NEW) — Edge Function: Channel/PushChannel, RPC, Expo send, mark sent
- `supabase/tests/broadcast_flow.sql` (NEW) — matcher match/exclude/idempotent/token/authz pgTAP
- `app/src/lib/push.ts` (MODIFIED) — `savePushToken()`
- `app/src/lib/jobs.ts` (MODIFIED) — `createJob` returns id + fire-and-forget broadcast invoke
- `app/src/app/_layout.tsx` (MODIFIED) — register/persist push token on sign-in
