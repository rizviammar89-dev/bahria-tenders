---
baseline_commit: 069e824fc80a66833ba5cbad1e4ffdf7d3af911a
---

# Story 2.3b: Role-Gated Navigation

Status: done

<!-- Cross-cutting Epic-2 story (not in the Bubble epics) created to resolve the role-nav debt flagged in the 2.1 and 2.3 code reviews (deferred-work.md). After 2.1 + 2.3, residents and providers see the same tabs (Post a Job + Jobs). This story shows the right tabs per profile.role. Pure client; no backend change. -->

## Story

As a **resident or provider**,
I want to see only the tabs that apply to my role,
so that the app is clear — residents post jobs, providers find jobs — rather than showing both sides to everyone.

## Acceptance Criteria

1. **AC-1 — Auth context exposes role, resolved before the tabbed app mounts.** `useAuth()` returns `{ session, role, loading }` where `role: 'resident' | 'provider' | null`. After a session is established, the provider/resident `role` is fetched from `profiles`. **`loading` stays `true` until BOTH the session AND (when signed in) the role are known** — so the tab navigator mounts exactly once with the correct tab set (per the Expo docs: dynamically toggling tabs remounts the navigator and resets state, so role must be known pre-mount).
2. **AC-2 — Pure `roleTabs` helper (`app/src/lib/role-tabs.ts`), unit-tested.** `roleTabs(role): { postJob: boolean; jobs: boolean }` → resident `{ postJob: true, jobs: false }`, provider `{ postJob: false, jobs: true }`, null `{ postJob: false, jobs: false }`. Jest covers all three.
3. **AC-3 — Tabs reflect role (`app/src/components/app-tabs.tsx`).** The **Post a Job** trigger renders only for residents; the **Jobs** trigger only for providers (conditional render — NOT the `hidden` prop, which has an open Android bug #41781). **Home** always renders. **Push Spike** stays visible for now (the 1.1 push gate is still pending; remove post-gate — noted).
4. **AC-4 — No flicker / no wrong-tab flash.** Because role is resolved before `AppTabs` mounts (AC-1), a provider never briefly sees "Post a Job" and vice-versa. While `loading`, the gate shows the splash/null (existing behavior).
5. **AC-5 — Tests green, no regression.** `npm test` — `roleTabs` unit tests pass (plus all existing). `supabase test db` still green (no DB change). tsc + lint clean.

## Tasks / Subtasks

- [x] Task 1: `roleTabs` helper + tests (AC-2)
  - [x] `app/src/lib/role-tabs.ts` (`Role` type + `roleTabs`) + `role-tabs.test.ts` (3 cases: resident/provider/null)
- [x] Task 2: Role in auth context (AC-1)
  - [x] `app/src/lib/auth.tsx` — `{session, role, loading}`; session effect (sync setState only, no awaited supabase in the auth callback → no deadlock); separate role effect (async IIFE, fetches `profiles.role` when signed in); `loading = !sessionLoaded || !roleResolved` (role tagged by uid → resolved-for-current-session without a sync-setState reset)
- [x] Task 3: Role-gated tabs (AC-3, AC-4)
  - [x] `app/src/components/app-tabs.tsx` — `roleTabs(useAuth().role)`; conditional `{postJob && …}` / `{jobs && …}` triggers (not `hidden`, per the Android bug); Home + Push Spike always
- [x] Task 4: Verify (AC-5)
  - [x] `npm test` → 27 green; `supabase test db` → 78 green (no regression); `tsc --noEmit` + `expo lint` clean
- [x] Task 5: Commit referencing story 2.3b

## Dev Notes

- **Pure client, no backend.** No migration, no RLS, no data-layer change. The role already lives on `profiles.role` (Story 1.2) and is readable by the owner under RLS (Story 1.3 `profiles_select_all`).
- **Resolve role BEFORE mounting tabs (the load-bearing decision).** Expo docs: "Dynamically hiding tabs will remount the navigator and the state will be reset. Change visibility only before the navigator is mounted." So `AppTabs` must mount only once role is known. Implementation: fold the role fetch into `AuthProvider` and keep `loading=true` until it resolves; the existing `Gate` already renders `null` while `loading`, then `AppTabs`. Net: tabs mount once, correct set, no flash (AC-4).
- **Conditional render, not `hidden`.** The `hidden` prop exists but is **not respected on Android** (expo/expo#41781) — our target is budget Android, so use `{postJob && <Trigger .../>}`. A route file with no trigger stays registered/navigable but isn't shown — harmless (verified in the Expo docs).
- **Push Spike stays (for now).** It's the pending 1.1 push-gate dev tool, visible to both roles. Once the founder runs the gate, remove it from nav (tracked in deferred-work.md).
- **Auth role fetch shape:** `select('role').eq('id', session.user.id).single()`. On error → role stays null (the user sees only Home + Push Spike — degraded but not broken). On `SIGNED_OUT` → role null.
- **Testing:** the pure `roleTabs` mapping → jest. The auth role fetch + the conditional tab render are device/Expo-Go manual smoke (log in as the provisioned resident → see Post a Job, not Jobs; as the provider → see Jobs, not Post a Job). No new pgTAP (no DB change).
- **Patterns to reuse:** `auth.tsx` getSession/onAuthStateChange + the `.catch/.finally` loading discipline (1.4 review); `@jest/globals` import; the existing `Gate` in `_layout.tsx`.

### Project Structure Notes

- `app/src/lib/role-tabs.ts` (NEW) + `app/src/lib/role-tabs.test.ts` (NEW)
- `app/src/lib/auth.tsx` (MODIFY) — add `role`, fetch it, gate `loading`
- `app/src/components/app-tabs.tsx` (MODIFY) — conditional triggers
- No `supabase/` change.

### References

- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — "Role-gated navigation" (from 2.1 + 2.3 reviews) — the debt this story pays
- [Source: _bmad-output/implementation-artifacts/1-4-auth-phone-pin.md] — `auth.tsx` AuthProvider/useAuth, the `.catch/.finally` loading discipline, the `Gate` in `_layout.tsx`
- [Source: _bmad-output/implementation-artifacts/2-1-post-a-job.md] + [2-3](2-3-provider-job-discovery.md) — the post-job (resident) and jobs-feed (provider) tabs being gated
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Structure] — res_* / prov_* surface separation intent (role decided once at login, routed hard)
- External (verified 2026-06-12): docs.expo.dev/router/advanced/native-tabs (conditional triggers + remount caveat); expo/expo#41781 (`hidden` Android bug → use conditional render)

### Review Findings (code review 2026-06-12)

Acceptance Auditor: **PASS** (all 5 ACs met, zero backend change, no scope creep). Hunters found real auth-state-machine issues — the sign-out stale-role being a genuine (currently-masked) bug.

**Patch (applied 2026-06-12):**
- [x] [Review][Patch] **Sign-out stale role** — fixed in `deriveAuth`: `role` is exposed only when `signedIn && roleResolved`, so sign-out (and a stale `roleState`) yields `role: null`. Proven by a dedicated jest case.
- [x] [Review][Patch] **Token-refresh churn** — role effect now deps on `[session?.user?.id]`; a hourly `TOKEN_REFRESHED` (same uid) no longer re-fetches the role.
- [x] [Review][Patch] **Extracted + unit-tested derivation** — `app/src/lib/auth-state.ts` `deriveAuth(...)` + `auth-state.test.ts` (6 cases: loading-until-session, signed-out, signed-out-no-leak, signed-in-pre-fetch, resolved, cross-user-no-flash). `auth.tsx` now calls `deriveAuth` (removes the non-obvious inline ternary). 33 jest green.

**Deferred (real, later / post-POC):**
- [x] [Review][Defer] Role fetch with no timeout could hang `loading` forever on a never-settling socket — add global fetch timeouts post-POC (same pattern as 1.4 getSession; rare on LAN). (Blind #2)
- [x] [Review][Defer] Role-fetch error is silent (no notification/retry) — Epic-2 error handling (ties to the deferred 401/session handler).
- [x] [Review][Defer] If the role fetch exceeds the 600ms splash, a brief blank screen — couple the splash to `loading` or add a real loading skeleton post-POC. (Edge #3, #8)

**Dismissed:**
- `roleTabs` purity, `useAuth()`-in-argument — verified fine.
- Role-change-mid-session remount — no in-app role-change path exists; revisit if one is added.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `npx jest` → 27 passed (added 3 roleTabs cases)
- `npx tsc --noEmit` clean (after switching the role fetch from `.then().catch()` to an async IIFE try/catch — the Supabase query builder is a `PromiseLike`, no `.catch`)
- `npx expo lint` clean; `supabase test db` → 78 (no DB change, no regression)

### Completion Notes List

- All 5 ACs satisfied. Pure client; no migration/RLS/data change.
- **The load-bearing decision:** role is resolved BEFORE the tab navigator mounts. `AuthProvider.loading` stays true until session AND (when signed in) role are known; the existing `Gate` renders `null`/splash while loading, so `AppTabs` mounts once with the correct tab set — no wrong-tab flash, no Expo navigator remount/state-reset (the documented hazard of toggling tabs after mount).
- **Two design choices grounded in verified Expo facts:** (1) conditional render, not the `hidden` prop — `hidden` is not respected on Android (expo/expo#41781), our target platform; (2) the role fetch is decoupled from `onAuthStateChange` into a separate session-reactive effect, because awaiting a supabase query inside the auth callback can deadlock the client.
- Role tagged by uid (`roleState.uid === session.user.id`) so "resolved for the current session" is derivable without a synchronous setState in an effect body (avoids the `react-hooks/purity`/`set-state-in-effect` trip without an eslint-disable).
- Resolves the role-nav debt from the 2.1 + 2.3 reviews (deferred-work.md): residents now see Home + Post a Job; providers see Home + Jobs. Push Spike stays for both (pending 1.1 gate).
- **⚠️ Device E2E = manual smoke:** log in as the provisioned resident → see Post a Job (not Jobs); as the provider → see Jobs (not Post a Job). The `roleTabs` mapping is jest-proven; the role fetch + conditional render need a device.

### File List

- `app/src/lib/role-tabs.ts` (NEW) + `app/src/lib/role-tabs.test.ts` (NEW)
- `app/src/lib/auth.tsx` (MODIFIED) — `role` + loading gate
- `app/src/components/app-tabs.tsx` (MODIFIED) — conditional role triggers
- `app/src/lib/auth-state.ts` (NEW, review) — pure `deriveAuth` (role/loading) + `auth-state.test.ts` (6 cases)
