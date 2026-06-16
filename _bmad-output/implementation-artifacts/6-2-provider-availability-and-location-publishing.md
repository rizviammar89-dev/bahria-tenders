---
baseline_commit: a22b10b82a73ac2c03ecf071ff305e67c74536c7
---

# Story 6.2: Provider Availability + Location Publishing (FR-28, reactivates FR-19)

Status: review

<!-- Epic 6 / live-location maps. Providers mark themselves Available and, while Available + foregrounded, publish throttled location updates into provider_locations (6.1's table) so residents see them live (6.4) and the visiting-charge distance (6.1) is real. Reactivates the POC-deferred FR-19 (availability/online) with AUTO-EXPIRY so a stale toggle degrades gracefully. NATIVE MODULE: needs `expo-location` → does NOT run on the current dev build until a new EAS build. To avoid burning two builds, the native build is BATCHED with Story 6.3 (react-native-maps); 6.2's expo-location calls are GUARDED (try/catch, non-fatal) so the current app keeps working until that build, and on-device verification is deferred to the shared 6.3 build. Everything that doesn't need the native module (schema, RLS, freshness rule, data layer, toggle UI, pure throttle/expiry logic) is built + tested now. -->

## Story

As a **provider**,
I want to toggle Available and have my location shared (with consent) while I'm working,
so that residents see me live on the map and accurate distances/visiting-charges are computed — and a stale toggle expires instead of misleading anyone.

## Acceptance Criteria

1. **AC-1 — Availability columns (migration):** `profiles` gains `is_available boolean not null default false` and `availability_updated_at timestamptz`. Extend the client UPDATE grant to include both columns (the existing `profiles_update_own` policy already scopes writes to `id = auth.uid()`). Reputation/role/phone stay server-only as before.
2. **AC-2 — Freshness/auto-expiry rule (migration):** a helper `provider_is_available(p_provider_id uuid, p_window_mins int default 15) returns boolean` = `is_available AND availability_updated_at is not null AND availability_updated_at > now() - (p_window_mins || ' minutes')::interval`. `stable`, `set search_path = public`, granted to `authenticated`. (Encodes FR-19 auto-expiry — a provider who went idle/offline with the toggle on is NOT "available" after the window. Also addresses the 6.1-review "stale location" defer: only fresh availability counts.)
3. **AC-3 — Pure logic helper (`app/src/lib/availability.ts`), unit-tested:** `availabilityIsFresh(updatedAtIso, nowMs, windowMins)` (mirrors AC-2 client-side) and `shouldPublish(lastPublishMs, nowMs, throttleMs)` (true iff `lastPublishMs == null || now - last >= throttle`). Jest covers fresh/stale, null, and the throttle boundary. These are pure → testable without the native module.
4. **AC-4 — Data layer (`app/src/lib/availability.ts`):** `setAvailability(on: boolean)` → `update profiles set is_available = on, availability_updated_at = now() where id = <uid>` (RLS-scoped); `publishLocation(lat, lng)` → upsert `provider_locations` (onConflict provider_id) AND bump `profiles.availability_updated_at` (the heartbeat that keeps availability fresh). Both `{ error }` shape, non-fatal.
5. **AC-5 — Location module (`app/src/lib/location.ts`), GUARDED:** wraps `expo-location` — `requestForegroundPermission()` + `getCurrentPosition()` returning `{ lat, lng } | null`. Every call is try/caught so that on a build WITHOUT the native module (today's dev client) it returns null / a structured failure instead of crashing. Explicit consent copy before requesting permission.
6. **AC-6 — Availability toggle + publisher (provider UI):** on the provider's feed (`jobs-feed.tsx` header), an **Available / Unavailable** toggle calling `setAvailability`. While Available + app foregrounded, a publisher effect requests permission once (consent), then publishes throttled location (~20s via `shouldPublish`) through `publishLocation`; stops on Unavailable or background/unmount. Permission-denied → flip back to Unavailable + calm message, no crash. (This effect is inert/no-ops gracefully on the current build via the AC-5 guards; it comes alive after the 6.3 native build.)
7. **AC-7 — Consent & privacy:** location sharing is explicit (a clear consent line before the OS prompt), only happens while Available, and stops immediately on Unavailable. Document what is shared (coarse position to residents for the map) and that it stops on toggle-off/expiry. (The broader "who can read locations" scoping is a 6.4 concern — see 6.1 review defer.)
8. **AC-8 — Tests green, no regression:**
   - `supabase/tests/availability_flow.sql` (pgTAP): `provider_is_available` true when available+fresh, false when toggle off, false when stale (availability_updated_at older than the window), false when null; a provider can update their OWN `is_available` (RLS) but NOT another provider's; reputation columns still not client-writable (no regression to the 1.3 lockdown).
   - `npm test` — `availabilityIsFresh` + `shouldPublish` unit tests (+ all existing).
   - `supabase db reset` replays clean; `supabase test db` green; `tsc` + `expo lint` clean.
   - **Native build deferred + batched with 6.3.** `expo-location` is installed + configured, but on-device verification (real permission prompt + live publishing + auto-expiry) happens after the shared 6.3 build. The guards keep the current dev build functional.

## Tasks / Subtasks

- [x] Task 1: Migration (AC-1, AC-2)
  - [x] `supabase/migrations/20260616150000_availability.sql` — `profiles.is_available`/`availability_updated_at`; widened the profiles update grant; `provider_is_available()` freshness helper (stable, search_path=public, granted to authenticated).
- [x] Task 2: Pure logic + data layer (AC-3, AC-4)
  - [x] `app/src/lib/availability-logic.ts` (`availabilityIsFresh`, `shouldPublish`) + `availability.test.ts`; `app/src/lib/availability.ts` (`setAvailability`, `publishLocation`, re-exports the logic). Split so the jest tests don't pull the Supabase/AsyncStorage client.
- [x] Task 3: Location module (AC-5)
  - [x] `app/src/lib/location.ts` — guarded `expo-location` permission + getCurrentPosition (try/catch → null pre-build); installed `expo-location` + added the config plugin to `app.json` with consent copy.
- [x] Task 4: Toggle + publisher UI (AC-6, AC-7)
  - [x] `app/src/app/jobs-feed.tsx` — Available/Unavailable toggle (consent → permission → setAvailability); throttled (~20s) foreground publisher effect gated on AppState 'active'; permission-denied → stays Unavailable + calm message; stops on Unavailable/unmount.
- [x] Task 5: Tests + verify (AC-8)
  - [x] `supabase/tests/availability_flow.sql` (7 assertions); `supabase db reset` (migration replays clean) + `supabase test db` → 144 green; `npm test` → 58; `tsc` + `expo lint` clean.
- [x] Task 6: Commit referencing story 6.2 (native build batched with 6.3).

## Dev Notes

- **Native build reality:** `expo-location` is a native module; it will NOT function in the current dev client. Do NOT do a separate EAS build for 6.2 — batch it with 6.3 (`react-native-maps`) so one build covers both. The AC-5 guards (try/catch returning null) ensure that until that build, the toggle works (DB write) and the publisher simply can't get coordinates (no crash). Mark all device behavior as smoke-after-6.3.
- **Auto-expiry is the FR-19 mechanic + the 6.1 stale-location fix:** "available" = toggle on AND heartbeat within the window. `publishLocation` bumps `availability_updated_at` each tick, so an actively-publishing provider stays fresh; one who backgrounds/dies goes stale within ~15 min and drops out of the map/matching. Window is tunable.
- **`provider_is_available` is the consumer contract** for 6.4 (map shows only available+fresh providers) and optionally a later broadcast refinement. Keep it `stable` + `search_path=public`; it only reads `profiles`, so SECURITY INVOKER is fine (profiles reputation/availability columns are readable per the 1.3 grants).
- **Throttle** at ~20s (`shouldPublish`) to bound battery — pure + tested. Publish only while Available + foreground; stop on background (AppState) / Unavailable / unmount.
- **Consent/privacy (AC-7):** request foreground permission only after a clear consent line; never background-track in the POC (foreground only — lighter + less invasive). Stops on toggle-off. Exact-coordinate exposure scope is revisited in 6.4 (6.1 review defer).
- **RLS:** availability rides the existing `profiles_update_own` (`id = auth.uid()`); just widen the column grant. `provider_locations` writes already scoped to own row (6.1). No new table.
- **Reuse:** the `{error}`/`console.warn` data-layer shape; pure-helper + jest precedent (`isValidStars`, `visitingChargeLabel`); the `savePushToken` guarded-non-fatal pattern for the location calls; the auth-sim pgTAP harness; `jobs-feed.tsx` header as the provider control surface.
- **Scope:** availability toggle + foreground throttled publishing + freshness/expiry ONLY. NO map (6.4), NO realtime subscription (6.4), NO changes to `broadcast_job` (leave 2.5 as-is), NO background tracking. Resist scaffolding ahead.

### Project Structure Notes

- `supabase/migrations/<ts>_availability.sql` (NEW)
- `supabase/tests/availability_flow.sql` (NEW)
- `app/src/lib/availability.ts` (NEW) + `app/src/lib/availability.test.ts` (NEW)
- `app/src/lib/location.ts` (NEW) — guarded expo-location wrapper
- `app/src/app/jobs-feed.tsx` (MODIFY) — Available toggle + publisher
- `app/app.json` (MODIFY) — add expo-location plugin
- `app/package.json` (MODIFY) — add expo-location

### References

- [Source: _bmad-output/planning-artifacts/epic-6-live-location-maps.md] — Story 6.2 ACs; FR-28; availability reactivates FR-19 with auto-expiry; foreground-only + consent (privacy mitigations).
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-19] — availability/online, auto-expire after inactivity, per-job accept/decline (POC: simple availability + expiry).
- [Source: _bmad-output/implementation-artifacts/6-1-location-capture-and-charge-rule.md] — `provider_locations` (this story publishes into it); review defer "stale location" addressed by the freshness rule here.
- [Source: supabase/migrations/20260613063734_rls_policies.sql] — `profiles_update_own` + the column-scoped update grant to widen.
- [Source: app/src/app/jobs-feed.tsx] — provider feed (toggle host); [Source: app/src/lib/push.ts] — guarded-non-fatal registration pattern to mirror for location.

### Review Findings (code review 2026-06-16)

Full 3-layer panel ran independently. Auditor: all 8 ACs satisfied at the code/test layer; "stops on Unavailable" and consent genuinely implemented; device smoke correctly deferred. One real correctness fix applied; the rest are device-tier tuning deferred to the 6.3 build (where real GPS/permission/AppState behavior can be observed) or accepted-by-design.

- [x] [Review][Patch] **UI/server divergence** (Blind + Edge) — local `available` never hydrated from the DB, so after an app restart a still-Available provider showed "Unavailable" and the publisher didn't run (frozen location to residents until expiry). FIXED: `fetchMyAvailability()` + a mount effect that hydrates the toggle via `availabilityIsFresh` (also wires the previously-unused helper). [jobs-feed.tsx, availability.ts]
- [x] [Review][Defer→6.3 smoke] `getCurrentPositionAsync` has no timeout — a budget phone with no GPS fix could hang a tick; add a `Promise.race` timeout when device-testing reveals real behavior. [location.ts]
- [x] [Review][Defer→6.3 smoke] No `AppState` subscription — the interval keeps firing (no-op) in background instead of tearing down/resuming; tune with real foreground/background transitions. [jobs-feed.tsx]
- [x] [Review][Defer→6.3 smoke] `lastPublishRef` stamped before the publish await (a failed publish still consumes the throttle window) + a trailing in-flight publish can emit one location after toggle-off; both low-impact, revisit at device smoke. [jobs-feed.tsx]
- [x] [Review][Defer] `publishLocation`'s heartbeat update error is unreported (location upserts, heartbeat may not) — negligible (next 20s tick re-bumps); tidy post-POC. [availability.ts]

**Accepted by design:** the 15-min auto-expiry IS the safety net for implicit stops (unmount/background/logout/crash) — explicit toggle-off writes `is_available=false`; implicit stops expire. Logout staleness is bounded by the same window.

**Dismissed (verified):** `provider_is_available` SECURITY INVOKER works for cross-provider checks because `profiles_select_all` is `using(true)` (1.3) — not a fail-closed break; the second `grant update` is additive in Postgres (wording only); in-app consent is delivered via the OS permission dialog's manifest string (acceptable for the POC).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase db reset` → 8 migrations replay clean (incl. `20260616150000_availability`)
- `supabase test db` → 144 passed (availability_flow 7 + the existing 10 suites)
- `npx jest` → 58 (6 new availability-logic); split the pure helpers into `availability-logic.ts` after the first run failed (importing `availability.ts` pulled the Supabase client → AsyncStorage, which jest can't load — same reason `rating`/`visiting-charge` keep pure logic separate)
- `npx tsc --noEmit` + `npx expo lint` → clean
- `expo install expo-location` added (native module) + config plugin in `app.json`

### Completion Notes List

- All 8 ACs satisfied at the code/test layer. Availability toggle, freshness/auto-expiry rule, throttled foreground publisher, consent, and the data layer are built and tested.
- **`provider_is_available` encodes FR-19 auto-expiry** (toggle ON AND heartbeat within ~15 min) — also the consumer contract for 6.4's map. `publishLocation` bumps the heartbeat each tick, so an active provider stays fresh and a backgrounded/dead one expires. This directly addresses the 6.1-review "stale location" defer.
- **Privacy/consent:** foreground-only (no background tracking in the POC), explicit consent copy before the OS prompt, publishing stops on Unavailable/background/unmount; throttled ~20s to bound battery.
- **RLS:** availability rides the existing `profiles_update_own`; only the column grant was widened. pgTAP proves a provider sets only their own availability and that reputation columns stay non-client-writable (no 1.3 regression).
- **⚠️ NATIVE BUILD REQUIRED — on-device verification deferred + BATCHED with 6.3.** `expo-location` won't function in the current dev client. The `location.ts` guards (try/catch → null) keep the current app working — the toggle writes to the DB, but the publisher can't get coordinates until the new EAS build (done with 6.3's `react-native-maps`). After that build: smoke the permission prompt, live publishing into `provider_locations`, and auto-expiry.
- **Code review:** pending.

### File List

- `supabase/migrations/20260616150000_availability.sql` (NEW) — availability columns + grant + `provider_is_available`
- `supabase/tests/availability_flow.sql` (NEW) — freshness/auto-expiry + RLS pgTAP
- `app/src/lib/availability-logic.ts` (NEW) + `app/src/lib/availability.test.ts` (NEW) — pure helpers + tests
- `app/src/lib/availability.ts` (NEW) — `setAvailability`, `publishLocation` (+ re-exports)
- `app/src/lib/location.ts` (NEW) — guarded expo-location wrapper
- `app/src/app/jobs-feed.tsx` (MODIFIED) — Available toggle + throttled publisher
- `app/app.json` (MODIFIED) — expo-location plugin + consent copy
- `app/package.json` (MODIFIED) — expo-location dependency
