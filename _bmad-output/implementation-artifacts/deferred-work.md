# Deferred Work

## Deferred from: code review of story-1.2 (2026-06-12)

- ~~**Resident can bid on own job**~~ — ✅ CLOSED by Story 1.3: `bids_insert_provider` RLS WITH CHECK requires `job.resident_id <> auth.uid()` + verified-provider role; proven by deny test (42501).
- ~~**Rating attribution + completed-status**~~ — ✅ CLOSED by Story 1.3: `ratings_insert_valid` RLS WITH CHECK enforces `resident_id=auth.uid()` AND a `jobs` subquery requiring own job, awarded provider match, and `status='completed'`; proven by deny tests. (RLS subquery, not a trigger — cleaner than the 1.2 plan anticipated.)
- **`bids.updated_at` not auto-maintained** — column defaults to `now()` but never advances on UPDATE. The bid-edit flow (Story 2.4) maintains it or adds a `BEFORE UPDATE` trigger.
- **Missing indexes on some FK columns** — `jobs.resident_id`, `disputes.job_id`, `notification_log.recipient_id` are unindexed. Negligible at POC scale; add when Epic 2 query patterns are known.
- **No dedup guard on identical job posts** — a resident can post the same service/precinct/description twice. Product/app-layer decision for Epic 2.

## Deferred from: code review of story-1.3 (2026-06-12)

- **Profiles SELECT exposes `full_name`/`precinct` to all authenticated users** — intended for provider-card discovery; phone is locked. Tighten to counterparties (job/bid relationship) via a view post-POC if resident-name privacy becomes a concern.
- **`service_ids` self-claimable by providers** — no validation that a provider is competent in a claimed trade. Acceptable at POC scale (founder personally vets ~20 providers). Add admin-gated trade assignment post-POC.
- **Awarded provider can see losing bids post-award** — `bids_select_party` doesn't filter by status. Design choice, not a trust invariant; revisit in marketplace-fairness work.
- **service_role RLS-bypass tested only on profiles** — extend coverage to jobs/bids/disputes/notification_log when convenient.
- **Job state-machine ordering not enforced** (founder decision: defer to Epic 2) — RLS lets the resident set any `status`/`awarded_provider_id` value on their own job (e.g. `completed→open`, or jump `open→completed`). The 1.2 composite FK already forces the awarded provider to be a real bidder, so the residual risk is sequencing/griefing, not arbitrary award. Enforce valid transitions in the **award (Story 2.8)** and **mark-complete (Story 2.9)** flows via their Edge Function / a `BEFORE UPDATE` trigger. Until then, the resident legitimately drives these transitions (the intended POC flow).
