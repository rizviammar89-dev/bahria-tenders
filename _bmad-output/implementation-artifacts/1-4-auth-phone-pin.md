---
baseline_commit: 395378bfc09e5d7f88d8ae2c6067c38fae8ded38
---

# Story 1.4: Founder-Provisioned Phone+PIN Authentication

Status: review

<!-- Translates the Bubble-era epic story 1.4 ("Provider sign-up", FR-1) to the POC's no-SMS, founder-onboards-everyone model (poc-spec §4, local-code-pivot). There is NO in-app self-signup and NO OTP in the POC: the founder provisions every account with a service_role script and hands the person a PIN; they log in with phone + PIN. Identity stays phone-keyed so the post-POC switch to real phone OTP is a backfill, not a migration. -->

## Story

As the **founder** (and the residents/providers I onboard),
I want to provision accounts with a service-role script and let people log in with their phone number + a PIN,
so that the ~20 hand-picked POC users can authenticate without SMS/OTP, while the database identity stays keyed to a verified phone number for a clean post-POC upgrade to real OTP.

## Acceptance Criteria

1. **AC-1 — Phone normalization helper (`app/src/lib/phone.ts`), unit-tested:**
   - `normalizePkPhone(raw: string): string | null` accepts the common Pakistani input forms and returns canonical E.164 `+923XXXXXXXXX`, or `null` if invalid:
     - `03001234567` → `+923001234567`; `+923001234567` → unchanged; `923001234567` → `+923001234567`; `3001234567` → `+923001234567`; tolerates spaces/dashes (`0300-123 4567`).
     - Rejects (→ null): non-mobile (not starting 3 after country code), wrong length, letters, landline `021…`.
   - `phoneToSyntheticEmail(e164: string): string` → `${e164}@phone.bahria-tenders.local` (matches the POC-spec convention; the synthetic-email auth key).
   - Jest unit tests cover every case above (valid forms + rejects + the synthetic-email mapping). `npm test` green.
2. **AC-2 — Supabase client singleton (`app/src/lib/supabase.ts`):** `createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }})`. Wire the `AppState` `startAutoRefresh`/`stopAutoRefresh` pattern. Reads config from `EXPO_PUBLIC_` env vars via static `process.env.EXPO_PUBLIC_SUPABASE_URL` dot-access (dynamic access is NOT inlined). `.env.local` (gitignored) documented with the LAN-IP gotcha for physical devices.
3. **AC-3 — Provisioning script (`scripts/provision_user.ts`), service_role:**
   - Run with `npx tsx` from the `app/` dir (shares `@supabase/supabase-js`). Reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from env (never committed; admin client `{ auth: { autoRefreshToken:false, persistSession:false }}`).
   - Args: `--phone --pin --role <resident|provider> --name --precinct [--services ac_technician,plumber,...]`.
   - Normalizes the phone (reuses the AC-1 helper); derives synthetic email; `auth.admin.createUser({ email, password: pin, email_confirm: true })`; then inserts the `public.profiles` row (`id = created user id`, `role`, `full_name`, `phone = e164`, `precinct`, `phone_verified_at = now()`, `verified_by_admin = (role==='provider')` [founder vouches], `service_ids` resolved from the `--services` slugs for providers).
   - **Idempotent/safe:** if the phone already exists (profiles.phone UNIQUE) or createUser fails on a duplicate email, the script exits non-zero with a clear message and does NOT leave an orphan auth user (delete the auth user it just created if the profile insert fails — no orphans).
4. **AC-4 — Login screen (`app/src/app/login.tsx`):** phone + PIN inputs (numeric keypad, generous tap targets per the localization locks); on submit, normalize the phone (invalid → inline friendly error, no network call), derive synthetic email, `supabase.auth.signInWithPassword({ email, password: pin })`; wrong creds → calm friendly error ("Phone or PIN is incorrect"), never a raw auth error. On success the session persists and the user lands in the app.
5. **AC-5 — Auth session gate:** unauthenticated → login screen; authenticated → the tab app. Implemented via `supabase.auth.getSession()` + `onAuthStateChange` driving an expo-router redirect (a root layout guard / auth provider). A **Sign out** control (`supabase.auth.signOut()`) exists somewhere reachable (e.g. a header/profile action) and returns to login.
6. **AC-6 — Phone-keyed identity preserved (one-way door):** `profiles.phone` (UNIQUE, E.164, from Story 1.2) is the canonical identity; the synthetic email is a derived auth handle only. Document (in the script + a note) that the post-POC migration to Supabase phone OTP is "backfill `auth.users.phone` from `profiles.phone`, flip the provider" — no schema/identity change.
7. **AC-7 — Tests green, no regression:**
   - `npm test` (jest) → phone helper unit tests pass.
   - Provisioning script **integration-verified against local Supabase**: run it for one sample provider + one resident, then assert (psql/SQL) that each has a matching `auth.users` row AND a `profiles` row with `phone_verified_at` set, correct `role`/`verified_by_admin`, and (provider) resolved `service_ids`. A duplicate-phone run exits non-zero with no orphan auth user.
   - `supabase test db` still green (no DB regression; this story adds no migration unless a helper is chosen — see Dev Notes).

## Tasks / Subtasks

- [x] Task 1: Phone helper + tests (AC-1, AC-7)
  - [x] `app/src/lib/phone.ts`: `normalizePkPhone`, `phoneToSyntheticEmail`
  - [x] jest infra: jest-expo + jest + @types/jest (devDeps); `"test":"jest"`, `jest.preset=jest-expo`, testMatch
  - [x] `app/src/lib/phone.test.ts` — 11 cases (all valid forms, all network prefixes, rejects, synthetic email); `npm test` green
- [x] Task 2: Supabase client (AC-2)
  - [x] `@supabase/supabase-js` 2.108.1 + `@react-native-async-storage/async-storage` 2.2.0
  - [x] `app/src/lib/supabase.ts` singleton + AppState autoRefresh; throws a helpful error if env missing
  - [x] `app/.env.local` (gitignored, LAN IP + local anon key) + committed `app/.env.example` template (gitignore `!.env.example` exception)
- [x] Task 3: Provisioning script (AC-3, AC-6)
  - [x] `app/scripts/provision_user.ts` (relocated from root `scripts/` — tsx resolves node_modules from the script dir, so it must live under `app/`)
  - [x] service_role admin client, arg parsing, normalize, service-slug resolution, createUser + profile insert, orphan-safe rollback, clear duplicate error
- [x] Task 4: Login screen + session gate (AC-4, AC-5)
  - [x] `app/src/components/login-screen.tsx` (phone+PIN → normalize → synthetic email → signInWithPassword; calm error copy)
  - [x] Auth gate via `AuthProvider`/`useAuth` (`app/src/lib/auth.tsx`) + conditional render in `_layout.tsx`; sign-out on the home screen
- [x] Task 5: Verify + commit (AC-7)
  - [x] `npm test` green (11); provisioning script run for provider + resident against local → SQL-verified (correct role/verified_by_admin/phone_verified/service_ids, matching auth user, auth_users==profiles==2, no orphans); duplicate-phone run exits non-zero with no orphan
  - [x] `supabase test db` green (75) on a clean reset — no DB regression

## Dev Notes

- **No SMS, no OTP, no self-signup (POC model).** The login screen is sign-in ONLY. Account creation is the founder running `provision_user.ts`. Do NOT build a registration screen, an OTP flow, or CNIC/selfie capture — all deferred (poc-spec §5). This is the deliberate translation of FR-1 for the POC.
- **Synthetic-email auth (the key trick).** Supabase has no first-class phone+password without SMS, so we use **password auth on a synthetic email** derived from the verified phone (`+923001234567@phone.bahria-tenders.local`). The client derives the same email from the typed phone to sign in. Identity stays phone-keyed (AC-6) so post-POC OTP is a backfill. This was decided in the roundtable (local-code-pivot memory; poc-spec §4).
- **Verified API facts (June 2026, sourced):**
  - `@supabase/supabase-js` v2 (2.108.x). Admin: `createClient(url, SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false, persistSession:false}})` then `await supabase.auth.admin.createUser({ email, password, email_confirm: true })` (server-only — service_role must NEVER ship in the app).
  - Client: `createClient(url, anonKey, { auth:{ storage: AsyncStorage, autoRefreshToken:true, persistSession:true, detectSessionInUrl:false }})`. `detectSessionInUrl:false` is required for RN. AppState: `startAutoRefresh()` on `active`, `stopAutoRefresh()` otherwise.
  - `signInWithPassword({ email, password })` → `{ data:{session,user}, error }` (v2, unchanged).
  - Env: only `EXPO_PUBLIC_`-prefixed vars are inlined, via **static** `process.env.EXPO_PUBLIC_X` (not bracket access). **Device gotcha:** a physical phone cannot reach `localhost:54321` — use the dev machine's **LAN IP** (`http://192.168.x.x:54321`) in `.env.local`. `supabase status` prints the ANON key/URL.
  - **Storage choice:** POC uses plain **AsyncStorage** (simple). The official guide's `LargeSecureStore` (SecureStore key + AES-encrypted AsyncStorage, because SecureStore caps at 2KB and JWTs exceed it) is the **post-POC hardening** — note it, don't build it now.
  - Script runner: `npx tsx scripts/provision_user.ts ...` run **from `app/`** so it resolves `@supabase/supabase-js` from `app/node_modules`.
- **Testing approach:** `phone.ts` is pure logic → jest unit tests (jest-expo preset; the helper imports nothing RN/Expo, so tests are fast). The provisioning script and login screen are integration/manual: script verified by running it against local Supabase + a SQL assertion (AC-7); the login screen's only pure logic (phone→email) is already covered by the phone tests. Full RN component testing (RTL) is deferred — not worth it for a POC login form.
- **Secrets discipline:** `SUPABASE_SERVICE_ROLE_KEY` is a SECRET — passed via env to the script, NEVER committed, never in the app bundle. `.env*` already gitignored (Story 1.1). The app only ever holds the **anon** key (safe; RLS from Story 1.3 is what protects data).
- **RLS interaction (Story 1.3):** profile rows are created by the script as **service_role** (bypasses the "no client INSERT on profiles" rule — correct, that rule exists precisely so only the server creates profiles). Once logged in, the user is `authenticated` and Story 1.3's policies govern them. Verify a freshly provisioned user can read their own profile and (provider) can see open jobs — the RLS + auth now compose.
- **Migration?** Default: **no new migration** — auth lives in Supabase's `auth` schema + the existing `profiles` table. Only add a migration if you choose to implement normalization as a Postgres function too (NOT required; the TS helper is the single source for the POC). Keep `profiles` insert in the script, not a DB trigger.
- **Scope:** auth provisioning + login + session gate only. NO Edge Functions (the provisioning script is a local founder tool, not deployed), NO broadcast/notification, NO job/bid screens (Epic 2).

### Project Structure Notes

- `app/src/lib/phone.ts` (NEW) + `app/src/lib/phone.test.ts` (NEW)
- `app/src/lib/supabase.ts` (NEW) — client singleton
- `app/src/app/login.tsx` (NEW) — login route; `app/src/app/_layout.tsx` (MODIFY) — auth gate/redirect
- `app/package.json` (MODIFY) — jest config + `test` script; new deps
- `app/.env.local` (NEW, gitignored) — Supabase URL/anon key
- `scripts/provision_user.ts` (NEW) — founder onboarding tool
- No `supabase/migrations` change expected.

### References

- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md#4] — founder-provisioned phone+PIN, synthetic email, no SMS; §5 deferrals (CNIC, OTP, self-signup)
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/addendum.md] — "POC auth = founder-provisioned phone+PIN (synthetic email derived from a UNIQUE E.164 phone), keeping identity phone-keyed so post-POC OTP is a backfill"
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns] — phone stored canonical `03XXXXXXXXX`/E.164, single reusable normalization, transform to `+92…`; localization locks (numeric, tap targets); calm error copy
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4] — superseded Bubble FR-1 provider sign-up this translates
- [Source: _bmad-output/implementation-artifacts/1-3-rls-and-grants.md] — RLS that now composes with auth; profiles created by service_role; `profiles.phone` UNIQUE/E.164 is the identity key
- [Source: _bmad-output/implementation-artifacts/1-1-environment-setup-and-fcm-spike.md] — Expo SDK 56 app (src/app/ routing, expo-router), `.env*` gitignored, `supabase status` keys/URL
- External (verified 2026-06-12, sourced): supabase.com/docs/reference/javascript/auth-admin-createuser; .../auth-signinwithpassword; supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native (storage adapter, AppState); docs.expo.dev/guides/environment-variables (EXPO_PUBLIC_, LAN-IP gotcha); docs.expo.dev/develop/unit-testing (jest-expo); npmjs.com/package/tsx

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `npx jest` → 11 passed (phone normalization + synthetic email)
- `npx tsc --noEmit` → clean (after switching the test to `import {…} from '@jest/globals'` — ambient @types/jest wasn't resolving under expo's bundler tsconfig)
- `npx expo lint` → clean (after consolidating a split react-native import)
- Provisioning run (local): provider "Bilal Carpenter" + resident "Ayesha Khan" provisioned; duplicate-phone run → `✗ createUser failed: A user with this email address has already been registered`, exit 1
- SQL verify: provider verified_by_admin=t + 2 service_ids; resident verified_by_admin=f; both phone_verified_at set + matching auth.users; `auth_users=2, profiles=2` (no orphans)
- `supabase test db` (clean reset) → 75 tests, All tests successful

### Completion Notes List

- All 7 ACs satisfied. POC auth model implemented: founder provisions accounts (no SMS/OTP/self-signup); users log in with phone+PIN via synthetic email; identity stays phone-keyed (AC-6) for a one-line post-POC OTP migration.
- **Two course-corrections during dev (both honest fixes, not scope changes):**
  1. The provisioning script moved from root `scripts/` to **`app/scripts/`** — `tsx` resolves `node_modules` from the script's own directory, so a root-level script can't see `@supabase/supabase-js` in `app/node_modules`. Import path is now `../src/lib/phone`. (Story Project-Structure note said root `scripts/`; corrected to reality.)
  2. Test globals imported from `@jest/globals` rather than relying on ambient `@types/jest` (which expo's `moduleResolution: bundler` tsconfig didn't pick up) — keeps `tsc` clean.
- **Orphan-safety:** the duplicate run failed at `createUser` (duplicate email) → no auth user created, so the profile-insert rollback path wasn't exercised by this test; that rollback (delete auth user if profile insert fails) remains as defensive code for the rarer phone-unique-collision case.
- **`.env`:** `app/.env.example` committed as a template; `app/.env.local` gitignored with the local anon key + LAN IP (`172.21.16.1`) so a physical device can reach local Supabase.
- **⚠️ Device E2E not exercised by me (manual smoke recommended):** the live login round-trip (launch app on a device/emulator against the LAN-IP Supabase, log in as a provisioned account, confirm the gate flips to the app, sign out returns to login) needs a running device — same physical constraint as Story 1.1. All underlying logic is verified (phone normalization unit-tested, signInWithPassword is the documented v2 API, provisioning integration-verified). To smoke it: `cd app; npx expo start`, open the dev build / Expo Go, and log in as `0300 1112233` / PIN `1234` (re-run the provisioning script first — the regression reset wiped the test accounts).
- **Note for reviewer:** the session gate uses conditional render (`!session → <LoginScreen/>`) rather than an expo-router redirect/route-group restructure — deliberately minimal for the POC; revisit if deep-linking to protected routes is needed later.

### File List

- `app/src/lib/phone.ts` (NEW) — phone normalization + synthetic-email helper
- `app/src/lib/phone.test.ts` (NEW) — 11 jest unit tests
- `app/src/lib/supabase.ts` (NEW) — Supabase client singleton (AsyncStorage session, AppState autoRefresh)
- `app/src/lib/auth.tsx` (NEW) — AuthProvider + useAuth (session state)
- `app/src/components/login-screen.tsx` (NEW) — phone+PIN login UI
- `app/scripts/provision_user.ts` (NEW) — founder provisioning tool (service_role)
- `app/src/app/_layout.tsx` (MODIFIED) — wrap in AuthProvider + auth gate
- `app/src/app/index.tsx` (MODIFIED) — sign-out control
- `app/package.json` (MODIFIED) — jest config + test script; deps (supabase-js, async-storage; devDeps jest/jest-expo/@types/jest)
- `app/.env.example` (NEW) — env template
- `app/.env.local` (NEW, gitignored) — local Supabase URL/anon key
- `.gitignore` (MODIFIED) — `!.env.example` exception
