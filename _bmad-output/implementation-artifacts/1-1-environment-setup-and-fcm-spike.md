---
baseline_commit: 5dea1160076411d5409127b9e290c4a5c4d7d970
---

# Story 1.1: Environment Setup & FCM-on-Budget-Android Push Spike

Status: in-progress (blocked on founder manual steps — see Completion Notes)

<!-- Replaces superseded Bubble story 1.1 ("Create the Bubble app & confirm plan capabilities") per the 2026-06-12 platform pivot — same role: stand up the foundation and confirm the platform's load-bearing capabilities before feature work. This story is the POC Week-1 GO/NO-GO gate (poc-spec-2026-06-12.md §7). -->

## Story

As the **founder/builder**,
I want the local Supabase + Expo development environment running and remote push verified end-to-end on a real budget Android phone,
so that the riskiest platform assumption (push-as-doorbell for provider job alerts) is proven or killed before any feature code is written.

## Acceptance Criteria

1. **AC-1 — Toolchain installed:** Node 24 LTS active (`node --version` ≥ 24), pnpm 11 (`pnpm --version`), Supabase CLI (`supabase --version`), EAS CLI (`eas --version`). Git repo initialized at project root with a `.gitignore` covering `node_modules/`, `.expo/`, `supabase/.temp/`, `.env*`.
2. **AC-2 — Local Supabase up:** `supabase init` + `supabase start` succeed with Docker Desktop; Studio reachable at `http://localhost:54323`; `supabase status` shows all services healthy.
3. **AC-3 — pgTAP harness proven:** `supabase/tests/smoke.sql` exists (a trivial `SELECT plan(1); SELECT ok(true); SELECT finish();` test) and `supabase test db` runs it green. This proves the test harness Story 1.3 depends on — not real tests yet.
4. **AC-4 — Expo app scaffolded:** SDK 56 app created in `app/` (`npx create-expo-app@latest --template default@sdk-56`), TypeScript + Expo Router default template, runs in Expo Go on the dev phone (UI smoke only — push is NOT testable in Expo Go on Android, see Dev Notes).
5. **AC-5 — Dev build with FCM credentials:** Firebase project created; `google-services.json` referenced via `expo.android.googleServicesFile`; FCM **V1 service-account key** uploaded to EAS (`eas credentials`); `eas build --profile development --platform android` produces an APK installed on a **real budget Android device** (Redmi/Tecno/Infinix class — not an emulator, not a flagship).
6. **AC-6 — Push spike (the GO/NO-GO):** App obtains an Expo push token (`Notifications.getExpoPushTokenAsync({ projectId })`). With the app **backgrounded and the phone idle ≥ 12 hours** (default battery-optimization settings, screen off), a notification sent via Expo's push API (`https://exp.host/--/api/v2/push/send`) arrives. Repeat with battery optimization manually disabled for the app; record both outcomes (delivered? delay?) in this file's Dev Agent Record.
7. **AC-7 — Gate decision recorded:** A short verdict is written to the Dev Agent Record and `sprint-status.yaml` notes updated: **GO** (push arrives reliably enough to be the doorbell, with or without the onboarding "disable battery optimization" step) or **NO-GO** (push effectively dead on the target device class → escalate: SMS comes back into POC scope, founder decision required).

## Tasks / Subtasks

- [x] Task 1: Toolchain (AC-1)
  - [x] Install Node 24 LTS (`winget install OpenJS.NodeJS.LTS`), verify ≥ 24 → v24.16.0
  - [x] `npm install -g pnpm` (v11) → 11.6.0; `npm install -g eas-cli` → eas-cli/20.1.0
  - [x] Install Scoop, then `scoop bucket add supabase …; scoop install supabase` → CLI 2.106.0
  - [x] `git init`, add `.gitignore`, first commit of existing docs → commit 5dea116
- [x] Task 2: Local Supabase (AC-2, AC-3)
  - [x] `supabase init` at repo root → `supabase/` directory
  - [x] `supabase start` (pulled images; Docker Desktop running) → exit 0
  - [x] Studio healthy at http://127.0.0.1:54323 (API 54321, DB 54322; imgproxy/pooler stopped = optional, not needed)
  - [x] Write `supabase/tests/smoke.sql`, run `supabase test db` → Result: PASS (1 test)
- [x] Task 3: Expo scaffold (AC-4)
  - [x] `npx create-expo-app@latest app --template default@sdk-56` → expo ~56.0.11, Expo Router + TS
  - [~] `pnpm start` + open in Expo Go on dev phone → **MANUAL (needs physical device)**; code verified via `tsc --noEmit` + `expo lint` (both green)
- [ ] Task 4: FCM credentials + dev build (AC-5) — **BLOCKED: needs Firebase + Expo accounts + device (founder)**
  - [x] `app.json`: `expo.android.googleServicesFile`, `expo.android.package` (`com.bahriatenders.app`), `expo-notifications` plugin added
  - [x] `pnpm expo install expo-notifications expo-device expo-constants` (+ expo-dev-client)
  - [ ] Firebase console: new project → Android app → download `google-services.json` into `app/` — **MANUAL**
  - [ ] Firebase → Service accounts → Generate FCM V1 Private Key → upload via `eas credentials` — **MANUAL**
  - [ ] `eas build --profile development --platform android` → install APK on budget device — **MANUAL** (needs `eas login` + `eas init`)
- [ ] Task 5: Push spike + verdict (AC-6, AC-7) — **BLOCKED: needs dev build + device + 12h wait (founder)**
  - [x] Token screen + `registerForPushAsync` (`getExpoPushTokenAsync({ projectId })`, Android-13+ channel-first) — code complete
  - [ ] Send test pushes via `https://exp.host/--/api/v2/push/send` — **MANUAL** (after dev build installed)
  - [ ] Run the 12h-backgrounded test twice (default vs optimization-disabled) — **MANUAL**
  - [ ] Record outcomes + GO/NO-GO verdict; update sprint status — **MANUAL**

## Dev Notes

- **THE trap this story exists to avoid:** Expo Go on Android **cannot receive remote push** (removed in SDK 53, still true in SDK 56). Any push testing in Expo Go silently fails and wastes the week. The spike is only valid on the **EAS development build** APK. Expo Go is fine for UI work (AC-4) and stays the daily-dev loop for screens in Stories 2.x.
- **Why EAS cloud build, not local:** `eas build --local` does not run on native Windows (macOS/Linux only; WSL2 workaround exists). `npx expo run:android` works natively but requires Android Studio + SDK — explicitly deferred by the POC spec. Cloud build needs neither; free tier (~15 Android builds/mo) is ample since dev builds are rebuilt only when native config changes.
- **Push pipeline choice:** use **Expo's push service** (`getExpoPushTokenAsync` + `exp.host/--/api/v2/push/send`) — free, 600 notifications/sec, and Expo relays to FCM using the uploaded V1 service-account key. Do NOT use `getDevicePushTokenAsync`/raw FCM — that path means managing FCM server creds ourselves for zero POC benefit. Legacy FCM server keys no longer exist; only the V1 service-account JSON works.
- **Device class matters:** the gate is meaningless on a Pixel or in an emulator. Target the real provider device class (Xiaomi/Redmi, Tecno, Infinix — aggressive OEM battery killers). The two-condition test (default vs optimization-disabled) tells us whether the onboarding "founder disables battery optimization on the provider's phone" step (architecture decision) is sufficient mitigation.
- **Supabase CLI on Windows:** Scoop install, native Windows + Docker Desktop is the documented path — WSL2 not required (Docker Desktop uses a WSL2 backend internally; that's transparent). If `supabase start` misbehaves natively, falling back to running the CLI inside WSL2 is the known workaround — half a day budgeted either way.
- **What this story does NOT do:** no schema (Story 1.2), no RLS/real pgTAP tests (Story 1.3), no auth wiring (Story 1.4), no notification dispatcher module (Story 2.5). Resist scaffolding ahead — the smoke test file is the only SQL written here.
- **Secrets discipline from day one:** `google-services.json` is safe to commit (public identifiers only); the FCM V1 service-account JSON is a SECRET — never committed, lives only in EAS credentials storage. `.env*` gitignored now.

### Project Structure Notes

- Repo root = `C:\Users\Ammar\Documents\bahria-tenders` (docs already live in `_bmad-output/`; code joins it):
  - `supabase/` — CLI-managed: `config.toml`, `migrations/` (empty until 1.2), `tests/smoke.sql`
  - `app/` — Expo SDK 56 app (TypeScript, Expo Router; `res_*`/`prov_*` route-group convention starts in Epic 2, not here)
  - `scripts/` — created later (1.4 provisioning script)
- Monorepo tooling (pnpm workspaces) deliberately NOT set up yet — single app + supabase dir doesn't need it; add only if a separate admin web app materializes post-POC.

### References

- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#7] — Week-1 gate definition, build plan
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#8] — tooling list (installed vs missing)
- [Source: _bmad-output/planning-artifacts/architecture.md#Platform-Revision] — Bubble→Supabase/Expo decision mapping; push = doorbell, pull feed = backbone
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] — superseded Bubble story this replaces (same "confirm plan capabilities" intent)
- External (verified 2026-06-12): expo.dev/changelog/sdk-53 + docs.expo.dev/push-notifications/faq (Expo Go Android push removal); docs.expo.dev/push-notifications/push-notifications-setup + /fcm-credentials (V1 setup); docs.expo.dev/build-reference/local-builds (no native-Windows local builds); supabase.com/docs/guides/local-development/cli/getting-started (Scoop install); supabase.com/docs/guides/database/extensions/pgtap + /reference/cli/supabase-test-db (test harness); docs.expo.dev/more/create-expo (`--template default@sdk-56` flag required during SDK transition)

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `node --version` → v24.16.0; `pnpm --version` → 11.6.0; `eas --version` → eas-cli/20.1.0; `supabase --version` → 2.106.0
- `supabase test db` → `smoke.sql .. ok / All tests successful / Result: PASS`
- `npx tsc --noEmit` → clean (after generating `expo-env.d.ts`, which the template creates on first `expo start`)
- `npx expo lint` → clean (after one targeted eslint-disable on the scaffold's `use-color-scheme.web.ts` hydration hook)

### Completion Notes List

**Automatable scope COMPLETE and verified (AC-1, AC-2, AC-3, AC-4 code):**
- Full toolchain installed; local Supabase stack runs on native Windows + Docker Desktop via Scoop CLI (WSL2 NOT needed — earlier assumption corrected).
- pgTAP harness proven green — this is the foundation Story 1.3's RLS tests build on.
- Expo SDK 56 app scaffolds, typechecks, and lints clean. Push spike code written against the **verified v56 API**, including a requirement my pre-story research missed: on Android 13+ `setNotificationChannelAsync` must run **before** `getExpoPushTokenAsync` (handled in `src/lib/push.ts`).
- Used Expo push service (not raw FCM) per Dev Notes; `setNotificationHandler` uses the SDK-56 `shouldShowBanner`/`shouldShowList` shape (not deprecated `shouldShowAlert`).

**⚠️ HALT — remaining ACs require the founder (cannot be done autonomously):** AC-5, AC-6, AC-7 depend on interactive accounts, a physical device, and a 12-hour observation window. These were flagged as manual in the story Dev Notes from the start. **Precise founder checklist:**
1. **Firebase:** create a project → add an Android app with package `com.bahriatenders.app` → download `google-services.json` into `app/` (safe to commit). Then Project settings → Service accounts → *Generate new private key* (FCM V1 JSON — this is a SECRET, do not commit).
2. **EAS:** `cd app; eas login` (free Expo account); `eas init` (sets the `projectId` the token code reads); `eas credentials` → Android → Push Notifications → upload the V1 service-account JSON.
3. **Build:** `eas build --profile development --platform android` → install the APK on a **real budget Android** (Redmi/Tecno/Infinix — not an emulator, not a flagship).
4. **Spike (the GO/NO-GO):** open the app → "Push Spike" tab → *Register for push* → copy the Expo token. Send a test push:
   `curl -H "Content-Type: application/json" -X POST "https://exp.host/--/api/v2/push/send" -d '{"to":"<ExpoPushToken>","title":"Job alert","body":"New plumber job in your area"}'`
   Background the app, screen off, wait ~12h, confirm arrival. Repeat with battery optimization disabled for the app. Fill the Spike Results table + verdict below.
5. **If NO-GO:** push is unreliable on the target device class → SMS must come back into POC scope (founder decision; see poc-spec §5 SMS deferral).

**Note for reviewer:** the `app.json` references `./google-services.json`, which does not exist until step 1 — `eas build`/`expo prebuild` will fail until the founder adds it. This is expected, not a defect.

### File List

- `.gitignore` (NEW) — root ignore incl. secrets/`*service-account*.json`
- `supabase/` (NEW, CLI-generated) — `config.toml`, `.gitignore`
- `supabase/tests/smoke.sql` (NEW) — pgTAP harness proof (AC-3)
- `app/` (NEW) — Expo SDK 56 scaffold (full tree)
- `app/app.json` (MODIFIED) — name/slug, android package + googleServicesFile, expo-notifications plugin
- `app/expo-env.d.ts` (NEW) — standard Expo type reference (CSS module decls for tsc)
- `app/src/lib/push.ts` (NEW) — `registerForPushAsync` push-token helper (AC-6 code)
- `app/src/app/explore.tsx` (MODIFIED) — repurposed Explore tab into the Push Spike screen
- `app/src/app/_layout.tsx` (MODIFIED) — foreground notification handler
- `app/src/components/app-tabs.tsx` (MODIFIED) — tab label "Explore" → "Push Spike"
- `app/src/hooks/use-color-scheme.web.ts` (MODIFIED) — targeted eslint-disable for intended hydration setState

### Spike Results (AC-6/AC-7 — fill during execution)

**Execution device:** Samsung / One UI (NOT the aggressive Transsion/Xiaomi budget class the providers will use — see caveat in verdict).

**Pipeline proven (2026-06-14):** dev build installed; EAS FCM V1 service-account key uploaded; `registerForPushAsync` returned `ExponentPushToken[1JzEtoL-…]`; immediate test push (`exp.host/--/api/v2/push/send`) returned ticket `019ec68c-…` and **getReceipts → status: ok** (FCM accepted + delivered). End-to-end token→Expo→FCM V1→device path confirmed working.

| Condition | Delivered? | Delay | Device |
|---|---|---|---|
| Immediate (app backgrounded), default settings | yes (receipt ok) | ~instant | Samsung/One UI |
| Backgrounded ≥12h, default battery settings | _(soak pending)_ | | Samsung/One UI |
| Backgrounded ≥12h, optimization disabled | _(soak pending)_ | | Samsung/One UI |

**GO / NO-GO verdict:** _PENDING 12h soak._ Immediate delivery confirmed. **Caveat for whoever records the final verdict:** this device is Samsung (One UI), which is materially less battery-aggressive than the Tecno/Infinix/Redmi devices the target providers actually use — a GO here de-risks the *pipeline* but not the *budget-OEM doorbell*. Recommend one soak on a Transsion/Xiaomi device before treating push as field-reliable.
