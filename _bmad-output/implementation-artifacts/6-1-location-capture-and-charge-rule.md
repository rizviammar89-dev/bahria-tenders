---
baseline_commit: 7224a87d58cf7b45824e87d6bb3b6b0825910b6e
---

# Story 6.1: Location Capture + Distance & Visiting-Charge Rule (FR-26/FR-27 foundation)

Status: done

<!-- Epic 6 / live-location maps — the TESTABLE FOUNDATION, built first so the money-affecting Rs 250 rule is pgTAP-proven before any maps/billing/native-build work (6.3/6.4). PURE DB + a thin data-layer helper + jest. NO maps, NO expo-location, NO Realtime, NO native build — so this story ships with zero new infra (hot-reloads like every other JS change). The actual device GPS capture at post-time and the provider location publishing need expo-location (a native module) and land in 6.2/6.3 once the native build exists; here `createJob` just ACCEPTS optional coordinates (plumbing) and the schema + distance/charge functions are proven. -->

## Story

As the **platform**,
I want job and provider locations stored, with a tested haversine distance and the >3 km / Rs 250 visiting-charge rule,
so that the cost-affecting logic is correct and proven before any maps, realtime, or native build exists.

## Acceptance Criteria

1. **AC-1 — Job coordinates (migration):** `jobs` gains `lat double precision` and `lng double precision`, both **nullable** (legacy/POC jobs have none). No backfill. Client write grant for these columns is NOT added (jobs are inserted with them in one statement under the existing `jobs_insert_own`; they are set at insert, not updated later — confirm the existing insert path carries them).
2. **AC-2 — `provider_locations` table (migration) + RLS:** `provider_locations (provider_id uuid primary key references profiles(id) on delete cascade, lat double precision not null, lng double precision not null, updated_at timestamptz not null default now())`. RLS enabled; a provider upserts/reads ONLY their own row (`provider_id = auth.uid()`); residents (authenticated) may **read** locations (needed for the map in 6.4) — `select` policy `using (true)`; `service_role` all. Column-scoped grants mirror the project pattern. (Privacy note: exposing exact coordinates to all authenticated users is the deliberate product choice for the live map; revisit precision/obfuscation in 6.4 if needed.)
3. **AC-3 — `haversine_km` (migration):** `haversine_km(lat1, lng1, lat2, lng2 double precision) returns double precision`, `language sql immutable`, great-circle distance in kilometres (Earth radius 6371). Pure, no table access.
4. **AC-4 — `visiting_charge` (migration):** `visiting_charge(p_job_id uuid, p_provider_id uuid) returns table (distance_km double precision, charge_pkr integer)`. Reads the job's `lat/lng` and the provider's `provider_locations` row; if **either location is missing** → `distance_km = null, charge_pkr = 0` (defined: no charge surfaced). Else `distance_km = haversine_km(...)` and `charge_pkr = 250` iff `distance_km > 3`, else `0`. Threshold (3) and amount (250) are simple literals (build-time tunable). Granted execute to `authenticated` (a resident computes it for their own job + a provider). `set search_path = public`.
5. **AC-5 — Data layer + formatter (`app/src/lib/`):** `createJob` (`lib/jobs.ts`) accepts OPTIONAL `lat?: number; lng?: number` and stores them (omitted today → null; real GPS capture lands with the native-build stories). A new `fetchVisitingCharge(jobId, providerId)` → `supabase.rpc('visiting_charge', …)` returning `{ distanceKm, chargePkr, error }`. A pure helper `visitingChargeLabel({ distanceKm, chargePkr })` (`lib/visiting-charge.ts`) → e.g. `chargePkr > 0` → "Rs 250 visiting charge (≈3.2 km away)"; `chargePkr === 0 && distanceKm != null` → "No visiting charge (within 3 km)"; `distanceKm == null` → "" (location unavailable). Western Arabic numerals, 1 dp.
6. **AC-6 — Tests green, no regression:**
   - `supabase/tests/visiting_charge_flow.sql` (pgTAP): `haversine_km` matches reference distances (0 for same point; ~2 km and ~4 km test points within tolerance); `visiting_charge` → charge 0 just under 3 km, 250 just over 3 km, 0 + null distance when the provider has no location row, 0 + null when the job has no coordinates; executable by `authenticated` for their own job.
   - `npm test` — `visitingChargeLabel` unit tests (charge / no-charge / unavailable) + all existing.
   - `supabase db reset` replays clean (new migration); `supabase test db` green; `tsc` + `expo lint` clean.
   - **No new dependency, no native build** — confirm `expo-location`/`react-native-maps` are NOT added here.

## Tasks / Subtasks

- [x] Task 1: Migration (AC-1–AC-4)
  - [x] `supabase/migrations/20260616120000_location_and_charge.sql` — `jobs.lat/lng` (nullable); `provider_locations` + RLS (provider-writes-own, authenticated-read) + column-scoped grants; `haversine_km` (sql immutable); `visiting_charge` (stable, security invoker, set search_path=public, granted to authenticated; missing-location → null/0).
- [x] Task 2: Data layer + formatter (AC-5)
  - [x] `lib/jobs.ts` — `createJob` optional `lat/lng` (stored, null when absent); `fetchVisitingCharge`.
  - [x] `lib/visiting-charge.ts` + `lib/visiting-charge.test.ts` — `visitingChargeLabel` (charge / no-charge / unavailable).
- [x] Task 3: Tests + verify (AC-6)
  - [x] `supabase/tests/visiting_charge_flow.sql` (10 assertions); `supabase db reset` (migration replays clean) + `supabase test db` → 135 green; `npm test` → 52; `tsc` + `expo lint` clean. No new dependency, no native build.
- [x] Task 4: Commit referencing story 6.1.

## Dev Notes

- **Why build-free:** the whole point of 6.1 is to prove the Rs 250 rule with zero infra. `expo-location` and `react-native-maps` are native modules requiring a new EAS build — they belong to 6.2/6.3. Do NOT add them here. `createJob` only gains optional `lat/lng` params (plumbing); the GPS-capture UI lands when the native build exists. So 6.1 hot-reloads like any JS change.
- **Distance math:** haversine in pure SQL is plenty at this scale — do NOT pull in PostGIS (heavy dependency for one point-to-point distance). Earth radius 6371 km. `immutable` so it can be used in expressions/indexes later.
- **Defined missing-location behavior (the boundary the reviewer will probe):** if the job has no coords OR the provider has no `provider_locations` row, `visiting_charge` returns `distance_km = null, charge_pkr = 0` — the UI shows nothing (not "Rs 0", not an error). This is the safe default until live locations exist.
- **The 3 km boundary is cost-affecting** — test just-under and just-over explicitly. Use coordinates with known separations (1° latitude ≈ 111.19 km, so ~0.018° ≈ 2 km, ~0.036° ≈ 4 km). Assert `charge_pkr` exactly (deterministic) and `distance_km` within a tolerance range.
- **RLS:** mirror the established pattern — `revoke all from anon, authenticated; grant all to service_role; enable RLS`; then column-scoped client grants + owner-write / authenticated-read policies. `provider_locations` is provider-writes-own, authenticated-reads (residents need it for the map). `visiting_charge` is SECURITY INVOKER (a plain function); a resident reading their own job (RLS `jobs_select_visible`) + a provider's location (granted select) is sufficient — no SECURITY DEFINER needed (contrast the broadcast/award RPCs, which needed it to bypass grants).
- **Reuse patterns:** the pgTAP auth-sim harness (award/complete/broadcast flows); the `{error}` data-layer shape; `reputationLabel`-style pure formatter + jest (rating/reputation precedent); RLS migration structure from `rls_policies.sql`.
- **Scope:** schema + distance/charge functions + formatter ONLY. NO map, NO availability toggle (6.2), NO realtime (6.4), NO GPS capture UI, NO native build. Resist scaffolding ahead.

### Project Structure Notes

- `supabase/migrations/<ts>_location_and_charge.sql` (NEW)
- `supabase/tests/visiting_charge_flow.sql` (NEW)
- `app/src/lib/jobs.ts` (MODIFY) — `createJob` optional lat/lng + `fetchVisitingCharge`
- `app/src/lib/visiting-charge.ts` (NEW) + `app/src/lib/visiting-charge.test.ts` (NEW)
- NO maps/location deps, NO app.json change, NO native build.

### References

- [Source: _bmad-output/planning-artifacts/epic-6-live-location-maps.md] — Story 6.1 ACs; decisions (GPS-at-post, charge displayed >3km Rs250, all-available tracking); risks; sequencing (6.1 first, pure DB).
- [Source: _bmad-output/implementation-artifacts/2-1-post-a-job.md] — `createJob` (where lat/lng plumbing attaches).
- [Source: supabase/migrations/20260613063734_rls_policies.sql] — RLS + grant pattern to mirror for `provider_locations`.
- [Source: supabase/migrations/20260616090000_broadcast.sql] — recent migration + SECURITY DEFINER vs INVOKER contrast (this story's functions are INVOKER).
- [Source: _bmad-output/implementation-artifacts/3-1-rate-the-result.md] — pure-formatter + jest precedent (`reputationLabel`/`isValidStars`).

### Review Findings (code review 2026-06-16)

Full 3-layer adversarial panel ran independently. Auditor: all 6 ACs satisfied, build-free confirmed (no expo-location/react-native-maps, app.json untouched). Two cost-affecting fixes applied; the rest deferred to the stories that own them.

- [x] [Review][Patch] **No coordinate range validation** (cost-affecting) — out-of-range/garbled coords silently produced a wrong charge. FIXED: CHECK constraints `lat ∈ [-90,90]` / `lng ∈ [-180,180]` on `jobs` (null-tolerant) and `provider_locations`; pgTAP asserts an out-of-range insert is rejected (23514). Note: this catches out-of-range, not a same-range lat/lng *swap* (not DB-detectable). [migration]
- [x] [Review][Patch] **`asin` domain overflow → NaN/throw** — near-antipodal float rounding could push the arg past 1.0 and raise "out of range", which would surface as "no charge". FIXED: `least(1.0, …)` clamp; pgTAP asserts antipodal points return a finite distance. [migration: haversine_km]
- [x] [Review][Defer] **`provider_locations` world-readable to all authenticated** (`select using(true)`) — exact coords exposed to every user, not just nearby residents. This is the locked "all-available visible" product choice, but precision/scoping should be revisited in **6.4** (e.g. only available providers, or distance-buckets via a DEFINER fn instead of raw coords). No consumer exists until 6.4. — deferred to 6.4
- [x] [Review][Defer] **Stale provider locations** — nothing prunes old `provider_locations`; a moved-away provider yields a wrong charge. Staleness/auto-expiry is **6.2**'s availability mechanic (FR-19). — deferred to 6.2
- [x] [Review][Defer] **`fetchVisitingCharge` returns charge 0 on RPC error** → label shows "" (indistinguishable from "no charge"). The `{error}` field is returned; **6.4** should surface errors distinctly rather than silently hiding the charge. — deferred to 6.4

**Dismissed (intended / spec-faithful):** `> 3` boundary (exactly "more than 3 km" per the requirement; exact-3.0 is float-unreachable and intentionally → no charge); `visiting_charge` not status-aware (it's a pure lookup; the caller decides when to show it); `(0,0)` "null island" (in valid range; real GPS won't emit it; subsumed by the range guard intent).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase db reset` → 7 migrations replay clean (incl. `20260616120000_location_and_charge`); `schema.sql` still green with the new `jobs.lat/lng`
- `supabase test db` → 135 passed (visiting_charge_flow 10 + the existing 9 suites)
- `npx jest` → 52 (3 new `visiting-charge`); `npx tsc --noEmit` + `npx expo lint` → clean
- No new dependency / native build added (confirmed `expo-location`/`react-native-maps` NOT installed)

### Completion Notes List

- All 6 ACs satisfied. The cost-affecting **>3 km / Rs 250 rule is pgTAP-proven** before any maps/realtime/native-build work (the point of sequencing 6.1 first).
- **Pure DB + thin client helper:** `haversine_km` (sql immutable, no PostGIS), `visiting_charge` (security INVOKER — a resident reads their own job via RLS + a provider's granted location; no DEFINER needed, unlike the broadcast/award RPCs). `jobs.lat/lng` nullable; `provider_locations` provider-writes-own / authenticated-read.
- **Defined missing-location behavior:** job or provider lacking coords → `(distance_km null, charge_pkr 0)` → `visitingChargeLabel` renders "" (nothing). Tested both missing cases + the just-under/just-over 3 km boundary (≈2 km → 0, ≈4 km → 250).
- **Build-free as designed:** `createJob` only gained optional `lat/lng` plumbing (null today); real GPS capture + the provider availability/publishing + maps come in 6.2/6.3/6.4 (which carry the native build). Nothing here needs a rebuild — hot-reloads.
- **No device smoke needed for 6.1** (no UI surface yet); the rule is fully covered by pgTAP + jest. The visible charge lands in 6.4.
- **Code review:** pending (recommended before done).

### File List

- `supabase/migrations/20260616120000_location_and_charge.sql` (NEW) — jobs.lat/lng + provider_locations + haversine_km + visiting_charge
- `supabase/tests/visiting_charge_flow.sql` (NEW) — distance + charge-rule pgTAP (10 assertions)
- `app/src/lib/visiting-charge.ts` (NEW) + `app/src/lib/visiting-charge.test.ts` (NEW) — `visitingChargeLabel`
- `app/src/lib/jobs.ts` (MODIFIED) — `createJob` optional lat/lng + `fetchVisitingCharge`
