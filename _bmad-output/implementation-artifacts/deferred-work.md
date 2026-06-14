# Deferred Work

## Deferred from: code review of story-1.2 (2026-06-12)

- ~~**Resident can bid on own job**~~ — ✅ CLOSED by Story 1.3: `bids_insert_provider` RLS WITH CHECK requires `job.resident_id <> auth.uid()` + verified-provider role; proven by deny test (42501).
- ~~**Rating attribution + completed-status**~~ — ✅ CLOSED by Story 1.3: `ratings_insert_valid` RLS WITH CHECK enforces `resident_id=auth.uid()` AND a `jobs` subquery requiring own job, awarded provider match, and `status='completed'`; proven by deny tests. (RLS subquery, not a trigger — cleaner than the 1.2 plan anticipated.)
- **`bids.updated_at` not auto-maintained** — column defaults to `now()` but never advances on UPDATE. The bid-edit flow (Story 2.4) maintains it or adds a `BEFORE UPDATE` trigger.
- **Missing indexes on some FK columns** — `jobs.resident_id`, `disputes.job_id`, `notification_log.recipient_id` are unindexed. Negligible at POC scale; add when Epic 2 query patterns are known.
- **No dedup guard on identical job posts** — a resident can post the same service/precinct/description twice. Product/app-layer decision for Epic 2.

## Deferred from: code review of story-2.4 (2026-06-13)

- **`bids.note` length cap** — no max length on the bid note; add a sensible client `maxLength` + server check post-POC (same theme as the deferred `jobs.description`/`precinct` caps).
- **Same-tick double-submit ref guard** — the `if (busy) return` is async-state; a same-tick double tap could fire twice. The DB `UNIQUE(job_id,provider_id)` rejects a duplicate insert and the keyed-remount resets `busy` per open, so it's DB-safe; add a `useRef` synchronous guard only if it surfaces.

## Deferred from: code review of story-2.3b (2026-06-12)

- **No fetch timeouts** — `auth.tsx` role fetch (and `getSession` in 1.4) can hang `loading` forever on a never-settling socket. Add a global Supabase fetch timeout/abort post-POC (rare on LAN).
- **Silent role-fetch error** — a failed `profiles.role` fetch silently degrades to role=null (only Home shows) with no notification/retry. Fold into Epic-2 error handling (ties to the deferred session/401 handler).
- **Splash vs role-fetch timing** — if the role fetch exceeds the fixed 600ms splash, a brief blank screen appears (Gate returns null). Couple the splash overlay to `loading`, or render a real loading skeleton, post-POC.

## Deferred from: code review of story-2.3 (2026-06-12)

- **Empty-`service_ids` provider guidance** — a provider who hasn't selected trades sees "No open jobs" with no nudge; show "Select your trades to see jobs." Owned by role-nav/provider-onboarding.
- **Very-old-date cap in `timeAgo`** — no upper bound ("60 days ago"); cap or add job aging post-POC.
- **Feed excludes already-bid jobs** — the provider feed shows jobs they've already bid on; refine in Story 2.4 (bidding) once bids exist.
- **Feed loading indicator** — brief blank list before the first fetch resolves; add a loading state post-POC.

## Deferred from: code review of story-2.1 (2026-06-12)

- **Role-gated navigation** — the "Post a Job" tab (and later provider screens) are visible to all authenticated users; a provider could post a job (RLS binds the row to them, so no security hole, but wrong UX). Build role-gated nav (residents: Post Job / My Jobs; providers: Feed / My Bids) as an Epic-2 cross-cutting task — likely a dedicated story before the demo. Also remove the 1.1 Push Spike tab from the shipping nav once the push gate is decided.
- **Session-expired-mid-action UX** — `createJob` (and future authed actions) show a generic error when the session expired; pair with the deferred stale-session/401 handler (from 1.4 review) in the Epic-2 data layer to redirect to login.
- **Content length caps** — `jobs.description`/`precinct` are unbounded; add sensible client `maxLength` + a server check post-POC.

## Deferred from: code review of story-1.4 (2026-06-12)

- **Stale-session-while-backgrounded → silent 401s** — after the JWT expires while backgrounded, the app may re-foreground with a stale session; the gate shows the app but every RLS query 401s. Needs a global query-error/401 handler that signs out on auth failure. Owned by the Epic 2 data-fetching layer.
- **Login error branching** — network errors and bad credentials both show "Phone or PIN is incorrect." Add a connectivity-specific message with the Epic 2 data layer.
- **Auth-gate loading skeleton** — `Gate()` returns `null` while loading; depending on splash timing this can flash blank. Add a real loading state post-POC.
- **Synthetic-email enumerability + PIN strength** — the no-SMS scheme makes the login email derivable from a public phone; eliminated by the post-POC phone-OTP migration (which replaces PIN-as-sole-credential). See the PIN-strength decision in the 1.4 story.
- **PIN non-numeric input filter / unicode-digit phone input** — post-POC input hardening.
- **`supabase.ts` env module-load throw** — fail-fast is fine for POC; graceful degradation post-POC.

## Deferred from: code review of story-1.3 (2026-06-12)

- **Profiles SELECT exposes `full_name`/`precinct` to all authenticated users** — intended for provider-card discovery; phone is locked. Tighten to counterparties (job/bid relationship) via a view post-POC if resident-name privacy becomes a concern.
- **`service_ids` self-claimable by providers** — no validation that a provider is competent in a claimed trade. Acceptable at POC scale (founder personally vets ~20 providers). Add admin-gated trade assignment post-POC.
- **Awarded provider can see losing bids post-award** — `bids_select_party` doesn't filter by status. Design choice, not a trust invariant; revisit in marketplace-fairness work.
- **service_role RLS-bypass tested only on profiles** — extend coverage to jobs/bids/disputes/notification_log when convenient.
- **Job state-machine ordering not enforced** (founder decision: defer to Epic 2) — RLS lets the resident set any `status`/`awarded_provider_id` value on their own job (e.g. `completed→open`, or jump `open→completed`). The 1.2 composite FK already forces the awarded provider to be a real bidder, so the residual risk is sequencing/griefing, not arbitrary award. Enforce valid transitions in the **award (Story 2.8)** and **mark-complete (Story 2.9)** flows via their Edge Function / a `BEFORE UPDATE` trigger. Until then, the resident legitimately drives these transitions (the intended POC flow).
