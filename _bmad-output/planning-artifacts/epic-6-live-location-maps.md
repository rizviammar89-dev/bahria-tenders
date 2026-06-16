# Epic 6: Live Provider Location & Distance-Based Visiting Charge

Status: backlog (POST-POC / Phase-1 candidate — drafted 2026-06-16)

> **Scope note:** This epic is NOT part of the POC build (Epics 1–5 per `poc-spec-2026-06-12.md`). It is a new capability requested 2026-06-16. It is drafted here so it can be sequenced after the POC validation gate. Build only on explicit go-ahead.

## Feature summary

Residents see a **live map of available tradesmen** and, when choosing one, are told up front whether a **Rs 250 visiting charge** applies — which it does when the tradesman's live location is **more than 3 km** from the job. The charge is **displayed and folded into the expected (cash) quote**; it is NOT collected in-app (consistent with FR-11, offline payment).

## Decisions locked (founder, 2026-06-16)

1. **Tracking scope:** ALL *available* providers broadcast live location continuously (not just the awarded one). → continuous tracking; gated on an availability state + foreground + throttled (see Risks).
2. **Charge mechanics:** the app **computes distance and displays** "Rs 250 visiting charge (provider is >3 km away)", folded into what the resident expects to pay in cash. No in-app collection (no payment gateway — that stays deferred).
3. **Resident location source:** captured via **device GPS / dropped pin at job-post time**, stored as `lat`/`lng` on the job. Distance is measured from the provider's live location to the job's location.

## New functional requirements (proposed)

- **FR-26 — Live provider map:** A resident can view available providers in their trade on a map with live-updating positions.
- **FR-27 — Distance-based visiting charge:** When a provider's live location is > 3 km from the job location, a Rs 250 visiting charge is surfaced to the resident (and to the provider), folded into the expected cash quote. Threshold (3 km) and amount (Rs 250) are build-time tunable.
- **FR-28 — Provider availability + location publishing (reactivates the deferred FR-19):** A provider can mark themselves Available; while Available (and the app is foregrounded), the device publishes throttled location updates. Availability + location sharing are explicit, consented, and revocable.

## Dependencies & prerequisites

- **Reactivates FR-19 (availability/online), which the POC deferred.** "All *available* providers" is undefined without an availability mechanic — so the availability toggle is a hard dependency of this epic.
- **Google Maps Platform:** an API key with a billing-enabled GCP account (Android Maps SDK). Free tier is generous but billing must be set up.
- **A new native dev build** (`react-native-maps` + foreground/background location are native modules) — another EAS build + reinstall, like the FCM step.
- **Supabase Realtime** enabled for the location stream.

## Risks / explicit trade-offs

- **Battery & privacy (HIGH):** continuous GPS on budget Android drains battery; broadcasting a tradesman's live position all day is privacy-sensitive (and culturally significant in the target market). Mitigations baked into the stories: publish ONLY while Available + app foregrounded; throttle to ~15–30 s; explicit consent; never expose exact coordinates to other providers, only to residents browsing the map.
- **Maps cost:** Google Maps billing is real money at scale; monitor usage.
- **Boundary accuracy at 3 km:** the charge flips at exactly 3 km, so resident + provider coordinates must be accurate (hence GPS-at-post, not precinct centroid). Define behavior on stale/missing provider location (no charge shown vs. "location unavailable").
- **Stale location / availability:** a provider who goes offline with Available still on → must auto-expire (ties to FR-19 mechanics).

## Stories

### Story 6.1: Location capture + distance & visiting-charge rule (backend, no maps)

As the **platform**, I want job locations and provider locations stored, with a tested distance + visiting-charge rule, so the Rs 250 logic is correct before any maps/UI exist.

**Acceptance Criteria:**
- `jobs` gains `lat double precision` + `lng double precision` (nullable for legacy jobs); `createJob` captures and stores them.
- A `provider_locations` table (`provider_id` PK → profiles, `lat`, `lng`, `updated_at`) holds the latest position per provider, with RLS (provider writes own; residents read — or read via a controlled view).
- A pure SQL distance helper (`haversine_km(lat1,lng1,lat2,lng2)`), unit-shaped and pgTAP-tested against known distances.
- A `visiting_charge(p_job_id, p_provider_id)` (or a view/column) returning `{ distance_km, charge_pkr }` where `charge_pkr = 250` iff `distance_km > 3`, else 0; null/zero when either location is missing (defined behavior).
- pgTAP: distances at boundaries (just under / just over 3 km → 0 / 250), missing-location cases, correctness vs. reference values.
- No maps, no realtime, no native build — pure DB + a thin data-layer helper + jest for any client-side formatting.

### Story 6.2: Provider availability + location publishing

As a **provider**, I want to toggle Available and have my location shared while I'm working, so residents see me on the map and accurate distances are computed.

**Acceptance Criteria:**
- An availability state on the provider (`is_available` + `availability_updated_at`), toggle in the provider UI; auto-expire after an inactivity window (FR-19 mechanic, tunable).
- With `expo-location`: on becoming Available (foreground), request permission (explicit consent copy), then publish throttled updates (~15–30 s) into `provider_locations`; stop on Unavailable / background.
- Permission-denied and background transitions handled gracefully (stops publishing, flips to Unavailable, no crash).
- Only Available providers' locations are exposed to residents; going Unavailable removes them from the map feed.
- Privacy: consent is explicit and revocable; document exactly what is shared and with whom.

### Story 6.3: Maps SDK integration (infrastructure + native build)

As the **platform**, I want `react-native-maps` configured with a Google Maps key in a new dev build, so the app can render maps.

**Acceptance Criteria:**
- `react-native-maps` installed; `app.json` configured with the Android Google Maps API key (key via secrets, not committed); iOS left for later if needed.
- `eas build --profile development --platform android` produces an APK with maps working; installed on the device.
- A minimal map renders (centered on the resident's location) as the integration smoke.
- Document the Google Maps key setup + billing in the runbook.

### Story 6.4: Resident live map + visiting-charge display

As a **resident**, I want to see available providers on a live map and know if a visiting charge applies, so I can choose with full cost expectations.

**Acceptance Criteria:**
- A map screen shows the resident's job location + pins for available providers in the relevant trade, updating live via Supabase Realtime as `provider_locations` change.
- Selecting a provider (and on the bid/compare cards) shows distance + the Rs 250 visiting charge when > 3 km, folded into the expected cash total (uses the 6.1 rule).
- Calm states for: no available providers, location unavailable, permission denied, realtime disconnect.
- Device E2E smoke: a moving provider's pin updates; crossing the 3 km boundary flips the displayed charge.

## Sequencing & testing

Build **6.1 first** (pure DB/pgTAP — de-risks the pricing rule with zero infra), then **6.2** (availability + publishing), then **6.3** (maps infra + native build), then **6.4** (the resident map UI). 6.1's correctness core is fully pgTAP-coverable; 6.3/6.4 rely on device smoke (maps + realtime aren't unit-testable). Each story goes through the same create → build → adversarial review → device/live verification loop as the POC.

## References

- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md] — FR-19 (availability) deferred in POC; this epic reactivates it. No in-app payment (FR-11) → charge is displayed, not collected.
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md] — FR-9 (compare bids incl. distance), FR-11 (offline payment) — the visiting charge is informational, folded into the cash quote.
- [Source: _bmad-output/implementation-artifacts/2-1-post-a-job.md] — `createJob` is where resident GPS capture lands (6.1).
- Founder decisions 2026-06-16 (this doc, "Decisions locked").
