# Deferred Work

## Deferred from: code review of story-1.2 (2026-06-12)

- ~~**Resident can bid on own job**~~ — ✅ CLOSED by Story 1.3: `bids_insert_provider` RLS WITH CHECK requires `job.resident_id <> auth.uid()` + verified-provider role; proven by deny test (42501).
- ~~**Rating attribution + completed-status**~~ — ✅ CLOSED by Story 1.3: `ratings_insert_valid` RLS WITH CHECK enforces `resident_id=auth.uid()` AND a `jobs` subquery requiring own job, awarded provider match, and `status='completed'`; proven by deny tests. (RLS subquery, not a trigger — cleaner than the 1.2 plan anticipated.)
- **`bids.updated_at` not auto-maintained** — column defaults to `now()` but never advances on UPDATE. The bid-edit flow (Story 2.4) maintains it or adds a `BEFORE UPDATE` trigger.
- **Missing indexes on some FK columns** — `jobs.resident_id`, `disputes.job_id`, `notification_log.recipient_id` are unindexed. Negligible at POC scale; add when Epic 2 query patterns are known.
- **No dedup guard on identical job posts** — a resident can post the same service/precinct/description twice. Product/app-layer decision for Epic 2.
