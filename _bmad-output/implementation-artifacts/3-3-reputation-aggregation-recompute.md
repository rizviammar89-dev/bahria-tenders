---
baseline_commit: f11e07ceef943b41eeab2958d1fbf6135a1350a3
---

# Story 3.3: Reputation Aggregation & Recompute (FR-4, NFR-1)

Status: review

<!-- Epic 3 / reputation — the server-side machinery that turns 3.1's Rating rows into the cached raw components (profiles.rating_sum / rating_count) that reputationLabel (2.8) already reads. This CLOSES the 3.1 AC-6 boundary: after this story a rated provider's average shows on bid cards instead of "New provider". MIGRATION-ONLY (DB), NO app code change. Two pieces: (1) a SECURITY DEFINER trigger on `ratings` AFTER INSERT that increments the awarded provider's components — required because `authenticated` has NO update grant on rating_sum/rating_count (Story 1.3); (2) a SECURITY DEFINER `recompute_reputation()` that rebuilds the components from all ratings (the NFR-1 rebuildable-from-source fallback), admin/service_role-only. Adab sums are deferred (Story 3.2 not built → no adab columns exist). The admin "Recompute" BUTTON is deferred (founder runs the SQL via Studio per the POC). -->

## Story

As the **platform**,
I want reputation computed server-side from raw rating components, with a recompute-from-source fallback,
so that it stays permanent, consistent, immediate, and rebuildable — and cannot be tampered with by any in-app provider action.

## Acceptance Criteria

1. **AC-1 — Increment trigger (migration, SECURITY DEFINER):** an `AFTER INSERT ON public.ratings FOR EACH ROW` trigger calls a function that does `update public.profiles set rating_sum = rating_sum + NEW.stars, rating_count = rating_count + 1 where id = NEW.provider_id`. The function is `security definer` + `set search_path = public` (it MUST bypass RLS — `authenticated` has no update grant on those columns, Story 1.3). This makes the reputation update **immediate** on rating insert (FR-13's "immediately"), in the same transaction as the 3.1 insert.
2. **AC-2 — `recompute_reputation()` (migration, SECURITY DEFINER, admin-only):** a function that rebuilds ALL providers' raw components from source: for every `role='provider'` profile, set `rating_sum = COALESCE(sum(stars),0)` and `rating_count = COALESCE(count(*),0)` over that provider's `ratings` (providers with no ratings reset to 0/0). `security definer` + `set search_path = public`; `revoke all ... from public, anon, authenticated` and grant execute to NO client role (callable only by `service_role`/`postgres` via Studio/admin) — this is the NFR-1 rebuild-from-source fallback, not a client action.
3. **AC-3 — Tamper-resistance preserved (no regression):** no new client grant on `profiles.rating_sum`/`rating_count`; the existing lockdown (Story 1.3 — `authenticated` cannot write reputation; only `service_role`) stays intact. No in-app provider action can reset/inflate reputation.
4. **AC-4 — No app code change required:** `reputationLabel` (Story 2.8) already reads `rating_sum`/`rating_count` and computes the average; once the trigger maintains them, a rated provider's average renders wherever reputation shows (bid cards on My Jobs, the provider feed) on the next fetch. This story ships no TS changes (verify `tsc`/`lint`/`jest` still green as a regression gate). The admin "Recompute" button (epic) is POC-deferred → founder runs `select public.recompute_reputation();` in Studio.
5. **AC-5 — Tests green, no regression:**
   - `supabase/tests/reputation_flow.sql` (pgTAP, reuse the auth-sim harness): inserting a rating (as the resident, via the normal RLS path) increments the awarded provider's `rating_sum`/`rating_count` correctly (proves the SECURITY DEFINER trigger fires despite the resident having no profiles-update grant); a second rating on another completed job accumulates (sum + count); `recompute_reputation()` rebuilds correct values after the components are manually corrupted (e.g. set to 999) and zeroes a provider with no ratings; `recompute_reputation()` is NOT executable by `authenticated` (throws 42501 / insufficient_privilege).
   - `supabase db reset` replays clean (new migration); `supabase test db` green (existing 110 + the new reputation_flow assertions); the existing reputation-lockdown assertions in `rls.sql` still pass.
   - `npm test` (49) + `tsc` + `expo lint` clean (no app change → pure regression check).

## Tasks / Subtasks

- [x] Task 1: Migration — increment trigger + recompute (AC-1, AC-2, AC-3)
  - [x] `supabase/migrations/20260615150000_reputation_aggregation.sql`:
    - `apply_rating_to_reputation()` — `security definer` + `set search_path = public`; AFTER-INSERT increments the provider's components by `NEW.stars` / `+1`.
    - `create trigger ratings_reputation_after_insert after insert on public.ratings for each row execute function public.apply_rating_to_reputation();`
    - `recompute_reputation()` — `security definer` + `set search_path = public`; rebuilds all providers from `ratings`; `revoke all ... from public, anon, authenticated` (no client grant). No new grant on reputation columns → lockdown intact.
- [x] Task 2: DB tests (AC-5)
  - [x] `supabase/tests/reputation_flow.sql` — trigger increment (single + accumulate via the RLS insert path), recompute rebuild-after-corruption, recompute zeroes a no-rating provider, recompute denied to authenticated (42501), start-at-0/0.
- [x] Task 3: Verify no app regression (AC-4, AC-5)
  - [x] `supabase db reset` (5 migrations replay clean) + `supabase test db` → 117 green (incl. rls.sql lockdown still passing); `npm test` → 49; `tsc` + `expo lint` clean (no app change).
- [x] Task 4: Commit referencing story 3.3.

## Dev Notes

- **Why the trigger MUST be SECURITY DEFINER:** the rating insert runs as the resident (`authenticated`), who has `grant update (full_name, precinct, service_ids)` on profiles — NOT `rating_sum`/`rating_count` (Story 1.3, `rls_policies.sql:34`). A default (SECURITY INVOKER) trigger would run as that resident and fail with permission denied. `security definer` runs as the function owner (postgres), which can write the locked columns. Keep `set search_path = public` (anti-hijack), same hardening discipline as the award/complete RPCs.
- **This CLOSES Story 3.1's AC-6 boundary.** 3.1 deliberately did not move reputation; this trigger does. After 3.3, a provider who's been rated shows e.g. "4.6 from 12 jobs" (via `reputationLabel`) on bid cards instead of "New provider". That's the visible payoff — call it out in the device smoke.
- **`recompute_reputation()` is the NFR-1 rebuildable-from-source guarantee.** Components are a cache; the `ratings` rows are the source of truth. Recompute must be idempotent and total (also zero out providers whose ratings were somehow removed — though ratings are write-once/no-delete today, the recompute must not assume that). Admin-only: revoke from all client roles; the founder runs it from Studio (`select public.recompute_reputation();`). Do NOT add an in-app button (POC-deferred).
- **No Adab.** Story 3.2 (Adab dimensions) is deferred and no `adab_*` columns exist on profiles. The epic mentions "Adab sums" — out of scope here; only `rating_sum`/`rating_count`. Do not invent columns.
- **No cached `avg_rating` column.** `profiles` stores only the raw components; `reputationLabel` computes the average on read. So the trigger maintains exactly two integers — do not add an avg column or backfill logic.
- **Concurrency:** the increment is a single `UPDATE ... set x = x + n` (atomic read-modify-write under row lock), safe under concurrent rating inserts for different jobs of the same provider. No explicit locking needed.
- **No regression to the lockdown:** do NOT grant any new client privilege on the reputation columns. The existing `rls.sql` assertions (provider cannot write `rating_sum`; service_role can) must still pass — run them.
- **Testing reality:** this is pure DB, so the whole story is pgTAP (`reputation_flow.sql`) + the regression suite. Drive the trigger through the REAL RLS insert path (set the resident's JWT claims, insert into ratings) so the test also proves the SECURITY DEFINER trigger fires under a least-privileged caller. The visible reputation change → device/Expo manual smoke (rate a job from 3.1, then see the provider's average on a bid card).

### Project Structure Notes

- `supabase/migrations/<timestamp>_reputation_aggregation.sql` (NEW) — increment trigger + `recompute_reputation()`
- `supabase/tests/reputation_flow.sql` (NEW) — trigger + recompute + authz pgTAP
- NO app code change (reputationLabel already consumes the components); NO new route/tab; NO migration to profiles columns (rating_sum/rating_count already exist from 1.2).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] — increment raw components + admin recompute-from-source; reputation cannot be reset/deleted by in-app provider action.
- [Source: _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md#FR-13] — rating updates cumulative reputation immediately (the trigger realizes "immediately"). #FR-4 reputation permanence; #NFR-1 rebuildable.
- [Source: _bmad-output/planning-artifacts/poc-spec-2026-06-12.md] — Epic 3 reduced: SECURITY DEFINER fn increments + admin recompute SQL; Adab/social-proof deferred.
- [Source: supabase/migrations/20260613061242_core_schema.sql] — `profiles.rating_sum` / `rating_count` (the cached raw components, default 0); `ratings.stars`/`provider_id`.
- [Source: supabase/migrations/20260613063734_rls_policies.sql] — profiles column-scoped grants (authenticated can't write reputation; line 34) → why the trigger must be SECURITY DEFINER; reputation is service-role-only.
- [Source: supabase/tests/rls.sql] — existing reputation-lockdown assertions (must still pass).
- [Source: _bmad-output/implementation-artifacts/3-1-rate-the-result.md] — produces the `ratings` rows this trigger consumes; AC-6 boundary this story closes.
- [Source: _bmad-output/implementation-artifacts/2-8-compare-and-award.md] — `reputationLabel` reads rating_sum/rating_count (no app change needed here).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- `supabase db reset` → all 5 migrations replay clean (incl. `20260615150000_reputation_aggregation`)
- `supabase test db` → 117 passed (reputation_flow 7 + rating_flow + award_flow + complete_flow + jobs_flow + rls + schema + smoke); `rls.sql` reputation-lockdown assertions still green
- `npx jest` → 49 passed; `npx tsc --noEmit` + `npx expo lint` → clean (no app change)

### Completion Notes List

- All 5 ACs satisfied. **Closes Story 3.1's AC-6 boundary** — ratings now move `reputationLabel`, so a rated provider shows their average on bid cards instead of "New provider".
- **Two SECURITY DEFINER pieces, both `set search_path = public`:** (1) the `AFTER INSERT ON ratings` trigger `apply_rating_to_reputation` increments the awarded provider's `rating_sum`/`rating_count` in the same transaction as the rating insert (FR-13 "immediately") — it MUST be definer because `authenticated` has no update grant on those columns (Story 1.3); proven by inserting through the real RLS path under the resident's JWT. (2) `recompute_reputation()` rebuilds every provider's components from `ratings` (NFR-1 rebuildable-from-source), admin/service_role-only — revoked from public/anon/authenticated; pgTAP proves `authenticated` gets 42501.
- **Tamper-resistance preserved:** no new client grant on the reputation columns; the existing `rls.sql` lockdown (provider can't write rating_sum; only service_role) still passes.
- **Scope held:** only `rating_sum`/`rating_count` (no Adab columns — 3.2 deferred); no cached `avg_rating` column (computed on read by `reputationLabel`); no in-app recompute button (founder runs `select public.recompute_reputation();` in Studio — POC-deferred).
- **No app code change** (the screen already consumes the components) — verified via the regression gate.
- **Code review:** deferred this session due to the API 529 overload affecting the adversarial subagent panel. The security core (trigger authz + recompute lockdown + rebuild-from-source) is fully pgTAP-proven. Recommend an independent `/code-review` pass when the backend recovers.
- **⚠️ Device E2E = manual smoke:** rate a job (3.1) → pull-to-refresh a screen that shows that provider on a bid card → confirm the label changed from "New provider" to "<avg> from <n> jobs".

### File List

- `supabase/migrations/20260615150000_reputation_aggregation.sql` (NEW) — `apply_rating_to_reputation` trigger + `recompute_reputation()`
- `supabase/tests/reputation_flow.sql` (NEW) — trigger increment + recompute rebuild/zero + admin-only authz (pgTAP)
