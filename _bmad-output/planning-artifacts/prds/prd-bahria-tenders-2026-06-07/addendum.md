# Addendum — Bahria Town Home-Services Marketplace PRD

Downstream/ops depth that supports the PRD but doesn't belong in its capability spec. See also the brief addendum (`_bmad-output/planning-artifacts/briefs/brief-bahria-tenders-2026-06-07/addendum.md`) for the full parked Phase-2 roadmap.

## Go-to-Market — Supply Seeding (v1 launch)

Supply is the bottleneck, so launch readiness = a real base of providers before residents arrive.

- **Founder-seeded launch supply:** the founder can personally recruit **20–30 tradesmen** across the six trades (personal network + the *mistris* residents already use). This makes launch-day supply real, not hypothetical — a genuine cold-start advantage.
- **Sequence:** seed providers first → only then drive resident demand, so early broadcasts actually find available providers (ties to the supply-aware expectation-setting, FR-21).
- **Building-management partnership** (from brief) is a secondary channel for both vetted providers and resident reach.

## Cold-Start Pricing Rationale

- **2-month free trial per provider** before the flat fee. Chosen over (a) charge-from-day-one (kills empty-app supply) and (b) indefinitely-free (no revenue discipline). Two months lets a provider earn real money and build reputation, so the eventual fee reads as a renewal of something valuable, not a speculative bet.
- Flat fee amount deliberately left TBD until early usage shows what providers will bear.

## Tech-How Notes

- **Platform pivot (2026-06-12):** the no-code (Bubble) build was superseded by a local code build — Supabase (Postgres/RLS/storage/Edge Functions) + Expo/React Native, founder working with AI-agent tooling. Rationale and verified research (no forkable open-source codebase implements the bid loop) recorded in `_bmad-output/planning-artifacts/poc-spec-2026-06-12.md`.
- Real-time broadcast + notifications (FR-20, FR-22) and provider availability (FR-19) remain the most technically demanding v1 pieces. Accepted v1 degradation unchanged: pull-based refresh + push notifications (push as doorbell, in-app feed as source of truth); SMS for provider alerts added post-POC, behind a notification-dispatcher interface built day one so it lands as a one-file change.
- POC auth = founder-provisioned phone+PIN (Supabase password auth on a synthetic email derived from a UNIQUE E.164 phone column), keeping identity phone-keyed so the post-POC switch to real phone OTP is a backfill, not a migration.
