---
baseline_commit: NO_VCS
---

# Story 1.1: Environment Setup & FCM-on-Budget-Android Push Spike

Status: ready-for-dev

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

- [ ] Task 1: Toolchain (AC-1)
  - [ ] Install Node 24 LTS (`winget install OpenJS.NodeJS.LTS`), verify ≥ 24
  - [ ] `npm install -g pnpm` (v11), `pnpm add -g eas-cli`
  - [ ] Install Scoop, then `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git; scoop install supabase`
  - [ ] `git init` at `C:\Users\Ammar\Documents\bahria-tenders`, add `.gitignore`, first commit of existing docs
- [ ] Task 2: Local Supabase (AC-2, AC-3)
  - [ ] `supabase init` at repo root → `supabase/` directory
  - [ ] `supabase start` (first run pulls ~2–3 GB of images; needs Docker Desktop running)
  - [ ] Open Studio at localhost:54323, confirm healthy
  - [ ] Write `supabase/tests/smoke.sql`, run `supabase test db`, confirm green
- [ ] Task 3: Expo scaffold (AC-4)
  - [ ] `npx create-expo-app@latest app --template default@sdk-56` (the `@sdk-56` flag is REQUIRED — bare command currently scaffolds SDK 54)
  - [ ] `pnpm start` in `app/`, open in Expo Go on the dev phone, confirm tabs render
- [ ] Task 4: FCM credentials + dev build (AC-5)
  - [ ] Firebase console: new project `bahria-tenders` → Android app → download `google-services.json` into `app/`
  - [ ] `app.json`: set `expo.android.googleServicesFile`, `expo.android.package` (e.g. `com.bahriatenders.app`), add `expo-notifications` plugin
  - [ ] `pnpm expo install expo-notifications expo-device expo-constants`
  - [ ] Firebase → Project settings → Service accounts → Generate New Private Key (FCM V1 JSON) → upload via `eas credentials` (Android → push notifications)
  - [ ] `eas build --profile development --platform android` (cloud build, free tier ~15 Android builds/mo) → install APK on the budget device
- [ ] Task 5: Push spike + verdict (AC-6, AC-7)
  - [ ] Minimal token screen: request notification permission, log `getExpoPushTokenAsync({ projectId })` token
  - [ ] Send test pushes via `curl https://exp.host/--/api/v2/push/send` with the token
  - [ ] Run the 12h-backgrounded test twice: default battery settings, then with optimization disabled for the app
  - [ ] Record outcomes + GO/NO-GO verdict in Dev Agent Record; update sprint status notes

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

### Debug Log References

### Completion Notes List

### File List

### Spike Results (AC-6/AC-7 — fill during execution)

| Condition | Delivered? | Delay | Device |
|---|---|---|---|
| Backgrounded 12h, default battery settings | | | |
| Backgrounded 12h, optimization disabled | | | |

**GO / NO-GO verdict:**
