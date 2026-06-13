---
baseline_commit: 4489d36b769f76a55539bde8e545ff79f98e8f4f
---

# Story 1.2: Core Data-Model Schema (POC, 7 tables)

Status: review

<!-- Translates the Bubble-era epic story 1.2 ("Define the full core data-model skeleton") to the POC code stack (Supabase Postgres migrations). The Bubble-era "create the FULL skeleton now to avoid live-data migrations" rule is DROPPED — Postgres additive migrations are cheap (architecture.md Platform Revision), so this story builds only the POC-scope tables and defers the rest. -->

## Story

As the **founder/builder**,
I want the POC core data model defined as Postgres migrations with locked enums, keys, and integrity constraints,
so that every later story writes against a stable, correct schema and the trust-critical invariants (one bid per provider, one rating per job, phone-keyed identity) are enforced by the database, not by app code.

## Acceptance Criteria

1. **AC-1 — Enums (locked slugs):** Three Postgres enum types exist with EXACTLY these ASCII slug values (architecture.md "Locked enums"):
   - `user_role`: `resident`, `provider`
   - `job_status`: `open`, `awarded`, `completed`, `cancelled`
   - `dispute_status`: `pending_review`, `legit_remedied`, `legit_unresolved`, `not_upheld`
   - `notification_channel`: `push`, `whatsapp_manual`, `sms`
2. **AC-2 — `profiles` (identity, phone-keyed):** `profiles` table with `id uuid PK references auth.users(id) on delete cascade`, `role user_role not null`, `full_name text not null`, `phone text not null`, `phone_verified_at timestamptz`, `precinct text not null`, `verified_by_admin boolean not null default false`, `service_ids uuid[] not null default '{}'` (provider trades), `rating_sum integer not null default 0`, `rating_count integer not null default 0`, `created_at timestamptz not null default now()`.
   - **`phone` is `UNIQUE`** and constrained to Pakistani E.164 mobile by `CHECK (phone ~ '^\+923[0-9]{9}$')`.
3. **AC-3 — `services` (trades) + seed:** `services` table (`id uuid PK default gen_random_uuid()`, `slug text unique not null`, `display_en text not null`, `display_ur text not null`, `created_at`). Seeded (idempotent, in-migration) with EXACTLY the 6 PRD v1 trades: `ac_technician`/A/C Technician, `plumber`/Plumber, `carpenter`/Carpenter, `electrician`/Electrician, `mason`/Mason, `painter`/Painter (Urdu displays included).
4. **AC-4 — `jobs`:** `jobs` (`id uuid PK`, `resident_id uuid not null references profiles(id)`, `service_id uuid not null references services(id)`, `description text not null`, `precinct text not null`, `status job_status not null default 'open'`, `awarded_provider_id uuid references profiles(id)`, `created_at`, `cancelled_at timestamptz`). Soft-cancel via `status='cancelled'` + `cancelled_at` (never hard-delete).
5. **AC-5 — `bids` (one per provider per job):** `bids` (`id uuid PK`, `job_id uuid not null references jobs(id) on delete cascade`, `provider_id uuid not null references profiles(id)`, `price_pkr integer not null check (price_pkr > 0)`, `note text`, `created_at`, `updated_at`). **`UNIQUE (job_id, provider_id)`** — the core "single bid per provider" mechanic, enforced in the DB.
6. **AC-6 — `ratings` (one per job):** `ratings` (`id uuid PK`, `job_id uuid not null references jobs(id)`, `provider_id uuid not null references profiles(id)`, `resident_id uuid not null references profiles(id)`, `stars smallint not null check (stars between 1 and 5)`, `review text`, `created_at`). **`UNIQUE (job_id)`** — one rating per job. (Write-once enforcement is RLS in Story 1.3; the constraint lives here.)
7. **AC-7 — `notification_log`:** `notification_log` (`id uuid PK`, `recipient_id uuid not null references profiles(id)`, `job_id uuid references jobs(id)`, `channel notification_channel not null`, `idempotency_key text not null`, `sent_at timestamptz`, `opened_at timestamptz`, `created_at`). **`UNIQUE (idempotency_key)`** — prevents double-send on retry.
8. **AC-8 — `disputes`:** `disputes` (`id uuid PK`, `job_id uuid not null references jobs(id)`, `raised_by uuid not null references profiles(id)`, `reason text not null`, `status dispute_status not null default 'pending_review'`, `provider_response text`, `admin_notes text`, `created_at`, `resolved_at timestamptz`).
9. **AC-9 — pgTAP structural tests green:** `supabase/tests/schema.sql` asserts: every table exists; `profiles.id`/`jobs.id` etc. are PKs; the four enums have exactly the specified labels; the UNIQUE constraints on `profiles.phone`, `bids(job_id,provider_id)`, `ratings(job_id)`, `notification_log.idempotency_key` exist; a bad phone (`'03001234567'`, no `+92`) is rejected by the CHECK (`throws_ok`); a second bid by the same provider on the same job is rejected (`throws_ok` on the unique violation); the 6 services are seeded. `supabase test db` passes.
10. **AC-10 — Reset-clean:** `supabase db reset` applies all migrations from scratch with zero errors and the seed present (proves migrations are replayable, not just patched onto a running DB).

## Tasks / Subtasks

- [x] Task 1: Create the migration scaffold (AC-1..AC-8)
  - [x] `supabase migration new core_schema` → `20260613061242_core_schema.sql`
  - [x] `create type` for the 4 enums (AC-1)
  - [x] `create table` for all 7 tables with columns, FKs, defaults, CHECK + UNIQUE constraints (AC-2..AC-8)
  - [x] Idempotent seed of the 6 PRD trades via `insert ... on conflict (slug) do nothing` (AC-3)
  - [x] Indexes: `jobs(status)`, `jobs(service_id)`, `bids(job_id)`, `ratings(provider_id)`
- [x] Task 2: Write pgTAP structural tests first, then confirm green (AC-9)
  - [x] `supabase/tests/schema.sql`: 37 assertions — `has_table`, `col_is_pk`, `has_enum`+`enum_has_labels`, `col_is_unique` (incl. composite), `col_not_null`/`col_has_default`, seed count + slug array, `throws_ok` for bad phone / duplicate bid / non-positive price / out-of-range stars
  - [x] `supabase test db` → All tests successful (38 total: 37 schema + 1 smoke)
- [x] Task 3: Prove replayability (AC-10)
  - [x] `supabase db reset` → migration applies clean from scratch; tests re-run green
- [x] Task 4: Commit
  - [x] One commit: migration + tests referencing story 1.2

## Dev Notes

- **Scope = schema only.** NO RLS policies, NO grants, NO auth wiring, NO triggers/functions in this story. RLS + write-once enforcement + the deny-by-default grants are **Story 1.3**; reputation-aggregation triggers are **Story 3.3**; auth (phone+PIN synthetic email) is **Story 1.4**. Resist adding them here.
- **Enum reconciliation (decision):** the POC spec §6 sketched job status as `open→awarded→done→rated`, but the architecture's **Locked enums** table is the authoritative artifact — use `open/awarded/completed/cancelled`. "Rated" is NOT a status; a job is rated iff a `ratings` row exists for it (`LEFT JOIN ratings`). One source of truth, no dual-write.
- **Why not the full Bubble skeleton?** The Bubble-era story 1.2 pre-created every future column to dodge Bubble's no-backfill limitation. Postgres backfills additive columns trivially (`alter table ... add column ... default ...`), so per the architecture Platform Revision we build ONLY POC-scope tables now. Deferred-and-intentionally-absent: availability fields (FR-19), subscription fields/table (FR-17/18), CNIC/`provider_private` (cut entirely), Adab columns (FR-14). Adding them later is a one-line migration.
- **`profiles.id = auth.users(id)`** is the standard Supabase pattern — the profile row shares the auth user's UUID. Story 1.4 creates the auth user (synthetic email from phone) and the matching profile row. For 1.2's tests you can insert into `auth.users` directly in the test transaction, or test `profiles` constraints against a seeded fake auth user — keep test fixtures inside the pgTAP transaction (it rolls back).
- **Provider trades via `service_ids uuid[]`** (array), NOT a join table — honors the POC 7-table contract; job-feed match is `WHERE jobs.service_id = ANY(profiles.service_ids)`. Tradeoff: no FK integrity on array elements; acceptable at ~20 providers. A `provider_services` join table is the post-POC normalization — note it, don't build it.
- **Currency:** `price_pkr integer` = whole rupees (architecture format rule: `Rs 1,500`, no decimals, no paisa). CHECK `> 0`.
- **Timestamps:** all `timestamptz default now()` — store UTC; display-time `Asia/Karachi` formatting is a client concern (later stories), never stored.
- **Phone CHECK regex** `^\+923[0-9]{9}$` = `+92` + `3` (mobile prefix) + 9 digits = `+923XXXXXXXXX` (architecture canonical E.164). Store canonical; the `03XXXXXXXXX`→`+92` normalization helper is Story 1.4.
- **Data API exposure (config.toml lines 19-24):** new `public` tables are NOT auto-exposed to `anon`/`authenticated`/`service_role` without explicit GRANTs (new Supabase default). That GRANT + RLS work is **Story 1.3** — do not add grants here; 1.2 tables are reachable via the direct DB connection (which is what `supabase test db` uses), so structural tests still pass.
- **Migration hygiene:** one forward migration, no editing it after commit (the architecture changelog discipline). If a fix is needed mid-dev before commit, `supabase db reset` and edit freely; once committed, new changes get new migration files.

### Project Structure Notes

- `supabase/migrations/<timestamp>_core_schema.sql` (NEW) — the schema
- `supabase/tests/schema.sql` (NEW) — pgTAP structural assertions (sits beside `smoke.sql` from 1.1)
- `supabase/seed.sql` — leave for local SAMPLE data only (not used here; the 6 services seed deploys via the migration so it reaches hosted too)
- No app/ changes in this story.

### References

- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#6] — 7-table list, day-one must-be-right (UNIQUE phone, UNIQUE(job_id,provider_id), insert-only ratings, relational core with FKs, locked enum slugs)
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns] — Locked enums table (slug+display), naming conventions (snake_case, singular types), currency/date/phone formats, soft-delete rule
- [Source: _bmad-output/planning-artifacts/architecture.md#Platform-Revision] — Bubble→Postgres mapping: UNIQUE constraints replace manual uniqueness search; cheap additive migrations overturn the "full skeleton now" rule
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#3] — Glossary (the 6 v1 Trades; Job/Bid/Rating/Dispute definitions)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] — superseded Bubble skeleton story this translates
- [Source: 1-1-environment-setup-and-fcm-spike.md] — env is up: `supabase test db` harness proven green; Studio at :54323; DB at 54322

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- Red: `supabase test db` before migration → schema.sql 38/38 fail (no schema) ✓ test correctness confirmed
- Green: `supabase db reset` → `Applying migration 20260613061242_core_schema.sql` clean (AC-10)
- `supabase test db` → `schema.sql .. ok / smoke.sql ... ok / All tests successful` (38 tests)
- Plan off-by-one fixed: 37 real assertions (fixtures aren't assertions), corrected `plan(38)`→`plan(37)`

### Completion Notes List

- All 10 ACs satisfied; schema-only scope honored (no RLS/grants/auth/triggers — those are 1.3/1.4/3.3).
- Trust-critical invariants are DB-enforced and proven by `throws_ok`: bad phone rejected (CHECK `^\+923[0-9]{9}$`), duplicate bid rejected (`UNIQUE(job_id,provider_id)`), non-positive price rejected, out-of-range stars rejected.
- 6 PRD trades seeded in-migration (idempotent, with Urdu displays) so they deploy to hosted, not just local.
- Decisions per Dev Notes held: job_status = architecture's locked 4 (`open/awarded/completed/cancelled`), "rated" derived from a ratings row; provider trades as `service_ids uuid[]`; lean POC schema (deferred columns/tables omitted, cheap to add later).
- **Note for 1.3 reviewer:** tables have NO grants/RLS yet → unreachable via PostgREST/`anon`/`authenticated` (Supabase new default; config.toml 19-24). `supabase test db` uses the direct DB connection so structural tests pass regardless. RLS + grants + write-once-ratings enforcement is the next story.
- **Note for 1.4:** `profiles.id` FKs `auth.users(id)`; auth user must be created before the profile row (synthetic-email phone+PIN flow).

### File List

- `supabase/migrations/20260613061242_core_schema.sql` (NEW) — 4 enums, 7 tables, constraints, indexes, 6-trade seed
- `supabase/tests/schema.sql` (NEW) — 37 pgTAP structural + behavioral assertions
