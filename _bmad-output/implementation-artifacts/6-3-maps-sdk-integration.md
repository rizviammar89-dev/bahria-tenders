---
baseline_commit: db6099efd94639379296f6e0b35ac9c9d4f04c00
---

# Story 6.3: Maps SDK Integration + Native Build (Epic 6 infrastructure)

Status: review

<!-- Epic 6 / live-location maps — the INFRASTRUCTURE story. Adds react-native-maps (verified for SDK 56) + the Google Maps Android API key (via env, not committed) + the EAS dev build that includes BOTH react-native-maps AND expo-location (6.2). After this build, 6.2's on-device smoke (permission → live publishing → auto-expiry) AND 6.3's map-renders smoke both become testable. HARD EXTERNAL DEPENDENCY: a Google Maps Android API key on a billing-enabled GCP account + the app's SHA-1 (from `eas credentials`) — founder-only, like the FCM key. Almost nothing here is pgTAP/jest-testable; verification is the build + a device render. The real resident map UI is 6.4 — 6.3 ships only a minimal map to prove the SDK works. -->

## Story

As the **platform/builder**,
I want `react-native-maps` integrated with a Google Maps key in a new dev build,
so that the app can render maps on device — unblocking the live map (6.4) and 6.2's location smoke.

## Acceptance Criteria

1. **AC-1 — Install `react-native-maps`:** `npx expo install react-native-maps` (SDK-56-compatible version) added to `package.json`.
2. **AC-2 — Key config via env (not committed):** the Google Maps Android API key is injected through the `react-native-maps` config plugin **without committing the secret**. Implemented as `app.config.ts` that spreads the existing `app.json` and appends `['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '' }]`. `app.json` stays the base (no key in it); the key comes from an EAS env var / `.env` at build time. Document the GCP key + SHA-1 setup in the runbook.
3. **AC-3 — Minimal map component (`app/src/components/app-map.tsx`):** a thin wrapper over `<MapView provider={PROVIDER_GOOGLE}>` with a sane default region, accepting `style` + optional `children` (markers later). This is the reusable surface 6.4 builds on.
4. **AC-4 — Smoke mount:** render a minimal `<AppMap>` on the **Push Spike (explore) dev screen** (its stated purpose is dev smokes) so the new build can be visually confirmed to render a Google map. (Throwaway — 6.4 mounts the real resident map; this can be removed then.)
5. **AC-5 — New EAS dev build + device render (founder):** `eas build --profile development --platform android` with the key available, install on the device, open the Push Spike tab, confirm a Google map tile renders (not a blank/grey box). This same build includes `expo-location`, so 6.2's smoke runs off it too.
6. **AC-6 — No regression to the testable suites:** `tsc` + `expo lint` clean with the new dep/config; `npm test` (58) + `supabase test db` (144) still green (this story adds no DB/logic — pure native integration). Confirm `app.config.ts` resolves (`npx expo config --type public` shows the maps plugin with the key from env).

## Tasks / Subtasks

- [x] Task 1: Install + config (AC-1, AC-2)
  - [x] `npx expo install react-native-maps` (added to package.json); `app/app.config.ts` spreads `app.json` + appends `['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '' }]`. No key in git.
- [x] Task 2: Map component + smoke mount (AC-3, AC-4)
  - [x] `app/src/components/app-map.tsx` (`<MapView provider={PROVIDER_GOOGLE}>` wrapper, default Bahria-Karachi region); minimal `<AppMap>` rendered on `explore.tsx` (Push Spike) as the smoke.
- [x] Task 3: Verify (AC-6) — `tsc` + `expo lint` clean; `npm test` → 58; `expo config --type public` (with the env key set) shows the react-native-maps plugin + `androidGoogleMapsApiKey`. No DB change → `supabase test db` unaffected (144).
- [ ] Task 4 (FOUNDER, AC-5): obtain the Google Maps Android key (GCP, billing on; restrict by package `com.bahriatenders.app` + the dev SHA-1 from `eas credentials`); set `GOOGLE_MAPS_ANDROID_KEY` (EAS env var / `.env`); `eas build --profile development --platform android`; install; confirm the map renders. Then smoke 6.2 on the same build. — PENDING FOUNDER
- [x] Task 5: Commit referencing story 6.3 (code).

## Dev Notes

- **Verified for SDK 56 (per docs.expo.dev/versions/v56.0.0):** `react-native-maps` (NOT expo-maps); key via the config plugin `androidGoogleMapsApiKey`; `<MapView>` MUST set `provider={PROVIDER_GOOGLE}`.
- **Secret hygiene:** do NOT put the key in `app.json` (committed). Use `app.config.ts` reading `process.env.GOOGLE_MAPS_ANDROID_KEY` (mirrors how the FCM admin key was kept out of git). For EAS builds, the var must be present at build time — an EAS environment variable (or an `.env` the CLI picks up). The Android Maps key is embedded in the APK regardless, so its real protection is the **package + SHA-1 restriction** in GCP, not secrecy — set those restrictions.
- **This build is SHARED with 6.2.** `expo-location` (6.2) is already in `package.json` but absent from the current dev client; this `eas build` includes both. After it: smoke 6.2 (permission → publish → expiry) AND 6.3 (map renders). One build, both stories.
- **Heads-up — the current dev client:** mounting `<AppMap>` on the explore screen means **the Push Spike tab will error on the CURRENT (pre-maps) build** (native module missing), like expo-location. The rest of the app is unaffected. Since this story's whole point is the rebuild, that's expected — just rebuild before opening explore. (If you want zero pre-build breakage, the alternative is to not mount it until the build; we mount it so the build has something to verify.)
- **Almost nothing is unit-testable here** — it's native integration. The gate is the build + a visual render. `tsc`/`lint` and the unchanged DB/jest suites are the only automated checks. No new pgTAP.
- **Scope:** SDK install + key config + a minimal map render ONLY. NO resident map UI, NO markers/realtime, NO visiting-charge display (all 6.4). Resist scaffolding ahead.

### Project Structure Notes

- `app/app.config.ts` (NEW) — extends `app.json`, injects the react-native-maps plugin + env key
- `app/src/components/app-map.tsx` (NEW) — minimal `MapView` wrapper (PROVIDER_GOOGLE)
- `app/src/app/explore.tsx` (MODIFY) — minimal `<AppMap>` smoke mount
- `app/package.json` (MODIFY) — react-native-maps
- NO DB migration, NO new pgTAP, NO logic change.

### References

- [Source: docs.expo.dev/versions/v56.0.0/sdk/map-view] — react-native-maps for SDK 56; config-plugin `androidGoogleMapsApiKey`; `provider={PROVIDER_GOOGLE}`; GCP key + SHA-1.
- [Source: _bmad-output/planning-artifacts/epic-6-live-location-maps.md] — Story 6.3 (maps SDK + native build); Google Maps billing dependency.
- [Source: _bmad-output/implementation-artifacts/6-2-provider-availability-and-location-publishing.md] — expo-location awaiting this shared build; device smoke batched here.
- [Source: _bmad-output/implementation-artifacts/1-1-environment-setup-and-fcm-spike.md] — the EAS dev-build flow + `eas credentials` (SHA-1) precedent; secret-out-of-git discipline.
- [Source: app/src/app/explore.tsx] — Push Spike dev screen (smoke host).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `npx expo install react-native-maps` (SDK-56 version) added
- `app.config.ts` verified: `GOOGLE_MAPS_ANDROID_KEY=TEST npx expo config --type public` shows the `react-native-maps` plugin with `androidGoogleMapsApiKey: 'TEST'` (key injected from env, not committed)
- `npx tsc --noEmit` + `npx expo lint` → clean; `npx jest` → 58 (no DB/logic change; pgTAP unaffected at 144)

### Completion Notes List

- **Code/config side complete + verified.** SDK 56 path confirmed via the versioned docs: `react-native-maps` (not expo-maps), key via the config plugin, `provider={PROVIDER_GOOGLE}`. Key kept out of git via `app.config.ts` + `process.env.GOOGLE_MAPS_ANDROID_KEY`.
- **`AppMap`** is the reusable Google-map surface 6.4 will build the resident map on; a minimal instance is mounted on the Push Spike screen as the render smoke.
- **⚠️ FOUNDER STEPS REMAIN (AC-5) — the story can't be `done` until then:**
  1. **GCP:** create/enable a Google Maps Android API key on a **billing-enabled** project; restrict it to package `com.bahriatenders.app` + the dev **SHA-1** (`cd app && npx eas-cli credentials` → Android → Keystore shows the SHA-1).
  2. **Provide the key to the build:** set `GOOGLE_MAPS_ANDROID_KEY` as an **EAS environment variable** (or a local `.env` the CLI reads) — do NOT commit it.
  3. **Build:** `npx eas-cli build --profile development --platform android` → install the APK. This build **also includes `expo-location`**, so it unblocks 6.2's device smoke too.
  4. **Smoke:** open the Push Spike tab → a Google map renders (not blank/grey) = 6.3 done. Then run 6.2's smoke (Available toggle → permission → live publishing → auto-expiry) on the same build.
- **Heads-up:** on the CURRENT (pre-maps) dev build, opening the Push Spike tab will error (react-native-maps native module absent) — expected; rebuild to fix. Other tabs are unaffected.
- **Code review:** the code surface is thin (a config + a MapView wrapper + a one-line mount) and not logic-heavy; a full 3-layer CR adds little here — recommend reviewing after the device render confirms, or folding into 6.4's review.

### File List

- `app/app.config.ts` (NEW) — extends app.json, injects react-native-maps plugin + env key
- `app/src/components/app-map.tsx` (NEW) — minimal PROVIDER_GOOGLE MapView wrapper
- `app/src/app/explore.tsx` (MODIFIED) — minimal `<AppMap>` smoke mount
- `app/package.json` (MODIFIED) — react-native-maps dependency
