# Deferred Work

## Deferred from: code review of story-1.2 (2026-06-12)

- **Resident can bid on own job** — no single-row schema guard expresses "bidder ≠ job's resident AND bidder.role='provider'". Owned by RLS (Story 1.3) + the bid Edge Function (Story 2.4).
- **Rating attribution + completed-status** — schema does not enforce that `ratings.resident_id = jobs.resident_id`, `ratings.provider_id = jobs.awarded_provider_id`, or that `jobs.status='completed'` before a rating. Cross-row; owned by the rate flow (Story 3.1) + RLS (1.3). Requires a trigger, explicitly out of 1.2 scope.
- **`bids.updated_at` not auto-maintained** — column defaults to `now()` but never advances on UPDATE. The bid-edit flow (Story 2.4) maintains it or adds a `BEFORE UPDATE` trigger.
- **Missing indexes on some FK columns** — `jobs.resident_id`, `disputes.job_id`, `notification_log.recipient_id` are unindexed. Negligible at POC scale; add when Epic 2 query patterns are known.
- **No dedup guard on identical job posts** — a resident can post the same service/precinct/description twice. Product/app-layer decision for Epic 2.
