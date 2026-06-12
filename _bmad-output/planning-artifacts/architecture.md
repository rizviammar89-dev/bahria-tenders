---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-06-07'
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/prd.md
  - _bmad-output/planning-artifacts/prds/prd-bahria-tenders-2026-06-07/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-bahria-tenders-2026-06-07/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-bahria-tenders-2026-06-07/addendum.md
workflowType: 'architecture'
project_name: 'bahria-tenders'
user_name: 'Ammar'
date: '2026-06-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## ⚠️ Platform Revision — 2026-06-12 (supersedes "Platform Selection" below)

**The Bubble no-code selection is superseded.** The founder pivoted to a **local code build**: the founder-shipping risk that drove the Bubble choice is now mitigated by AI-agent-assisted development, and a verified GitHub research pass (18 repos, skeptically checked) confirmed no forkable open-source codebase implements the post-job → bids → award → reputation loop — so the product is built on infrastructure blocks. Current build target: `poc-spec-2026-06-12.md` (POC-as-Phase-0, with gate metrics and an accepted kill criterion). The decisions below remain valid as the v1 design; this table maps their Bubble-era mechanics to the new stack:

| Bubble-era decision (below) | New home (Supabase + Expo) |
|---|---|
| Bubble database + privacy rules | **Postgres + row-level security** (deny-by-default policies per role) |
| `Provider` / `Provider Private` split + private-file flag (CNIC/selfie) | Deferred from POC entirely (CNIC cut — founder-manual `verified_by_admin`); at v1: private Storage bucket + RLS, same incognito-403 test |
| `BE –` backend workflows (server-side reputation/money writes) | **`SECURITY DEFINER` Postgres functions / Edge Functions (service role)**; reputation tables get zero client write grants; ratings are insert-only (no UPDATE/DELETE policy) — enforced by **pgTAP tests written before any UI** |
| Manual pre-write uniqueness search (phone/CNIC — Bubble has no unique constraint) | **Real `UNIQUE` constraints**: `profiles.phone` UNIQUE NOT NULL E.164 (identity key from day one); CNIC-hash unique index at v1 |
| `Notification` data type (idempotent, logged broadcasts) | `notification_log` table (channel enum `push/whatsapp_manual/sms`, UNIQUE idempotency key) behind a **notification-dispatcher interface** (`Channel` abstraction) so adding SMS post-POC is one file |
| OneSignal push plugin + SMS gateway | **FCM via Expo Notifications** (push = doorbell; pull-based feed = source of truth) + founder WhatsApp fallback during POC; Veevotech-class SMS gateway post-POC |
| Admin back-office (Bubble admin pages) | **Supabase Studio + SQL views + runbook** for the POC; Refine (or similar) when Studio hurts |
| Option Sets (Trade/Precinct, slug + display) | Postgres enums / lookup tables — same locked slugs and display-label discipline |
| Native wrapper → App/Play Store | **Expo/React Native** single role-switch binary; EAS build; store-readiness gates unchanged at v1 (POC distributes APK to a hand-picked cohort) |
| Phase 0 = Wizard-of-Oz concierge (no build) | **Superseded: the POC *is* Phase 0** — demand validated on the built MVP (founder decision, risk on record: validation clock starts after the build) |

Everything else below — data-integrity principles, naming/enum discipline, localization locks, humanized provider-card UX, empty-marketplace backstop — carries forward unchanged.

## Project Context Analysis

### Requirements Overview
**Functional Requirements:** 25 FRs across 7 features. Core loop: Provider onboards & is verified → posts/holds a reputation → Resident posts a Job → broadcast to available Providers → Bids → Resident compares & awards → offline cash job → Rating + Adab → Dispute path if needed. Subscription gates active bidding after a 2-month free trial.

**Non-Functional Requirements (architecture drivers):**
- **Reputation integrity** — permanent, cumulative, non-resettable; CNIC-unique accounts prevent reputation laundering.
- **Identity & privacy** — CNIC number + selfie stored; admin-only, never public; deliberate retention/handling stance needed.
- **Real-time matching** — availability signal, broadcast to matching providers, push notifications to both sides (the hardest no-code pieces).
- **Manual operations** — founder-operated verification & dispute resolution → requires an admin surface.
- **No-code feasibility** — solo non-technical build; complexity must stay within reliable no-code capability.

### Scale & Complexity
- Primary domain: No-code mobile + web, two consumer surfaces (Resident, Provider) + an Admin surface.
- Complexity level: Low–Medium overall; real-time matching + notifications are the only high-complexity pockets.
- Estimated architectural components: data model (~8 core entities), 3 app surfaces, notification service, subscription/billing, admin tooling.

### Technical Constraints & Dependencies
- Solo, non-technical founder on a **no-code platform** (TBD — a key decision this workflow will make).
- **No in-app job payments** (cash/offline); only provider subscription is collected.
- **No GPS/maps** — location is precinct-based.
- Notifications likely depend on the chosen platform's push/SMS capability (flagged in PRD addendum).

### Cross-Cutting Concerns Identified
- Reputation/ledger integrity across all job flows.
- Identity verification & sensitive-data privacy (CNIC/selfie).
- Real-time availability + multi-party notifications.
- Subscription gating (free-trial → paid) affecting who can bid.
- Manual admin workflows (verification, dispute adjudication, resident-standing tracking).

## Platform Selection (No-Code Foundation)

### Primary Technology Domain
No-code two-sided marketplace — native mobile (iOS + Android) **and** web, plus an admin back-office. Built by a solo non-technical founder; ease-of-build and a single integrated tool are decisive.

### Options Considered (2026 research)
- **Bubble (Web + Mobile)** — *selected.* All-in-one (database + UI + admin in one tool), native mobile + web off one shared database, strongest visual relational modeling, gentlest capable learning curve. ~$59/mo. Real-time is poll-based.
- **FlutterFlow + Supabase** — runner-up. Most powerful (true native + true real-time + Postgres, ~$39–65/mo) but two tools and the steepest curve; backend wiring needs paid help for a non-technical founder.
- **Adalo** — backup only; data layer too weak for a real bidding marketplace.
- **Avoided:** Glide & Softr (no real native apps / broken iOS push), Bravo & Draftbit (built for designers/coders).

### Selected Platform: Bubble (Web + Mobile plan) — ⚠️ SUPERSEDED 2026-06-12 (see Platform Revision above)
**Rationale:** Matches the #1 project risk — *a non-technical solo founder actually shipping*. One tool covers the Resident app, Provider app, and the founder's admin back-office (essential for manual verification & dispute resolution), on one shared database. Native mobile + web from a single build. Bubble's weaker true-real-time is a non-issue because the PRD already specifies a **refresh + push-notification** fallback instead of true real-time.

**Plan & cost:** Bubble **Web + Mobile** entry plan, ~$59/mo (predictable, solo-friendly). Verify current pricing/limits at signup.

**Architectural decisions provided by the platform:**
- **Data layer:** Bubble's built-in database (visual data types + privacy rules) — used for all core entities (Providers, Jobs, Bids, Ratings, Reputation, Disputes, Resident Standing, Availability).
- **Auth & roles:** Bubble user accounts with role-based access (Resident / Provider / Admin) and privacy rules to keep CNIC/selfie admin-only.
- **UI:** Responsive web + native mobile from shared logic/data.
- **Notifications:** Bubble's push notifications (mobile) + email/SMS via plugin/API for the broadcast & bid alerts (FR-20–22).
- **Admin:** an internal admin interface (Bubble pages restricted to Admin role) for verification and dispute adjudication.
- **Real-time approach:** periodic refresh + push notifications (the PRD-accepted degradation of true real-time).
- **Payments:** provider subscription only — via a Pakistan-friendly gateway (e.g., Safepay/PayPro supporting JazzCash/Easypaisa) integrated by API; can start manual and automate later.

**Note:** Setting up the Bubble account + Web+Mobile plan should be the first implementation story.

## Core Architectural Decisions

_Hardened via an architect/PM/engineer roundtable (Party Mode). Several findings below are cheap to build now and expensive to retrofit on Bubble._

### Decision Priority Analysis

**Critical (fix before/at launch — silent or irreversible if missed):**
1. Reputation integrity under Bubble's no-transaction model (raw components + recompute button).
2. CNIC/selfie file privacy (private-file flag + split data types + delete-after-verification).
3. CNIC-uniqueness enforced as an explicit server-side verification gate (anti-reset NFR).
4. App/Play Store review readiness (privacy policy, in-app account deletion, WebView "minimum functionality").

**Important (shape the build):**
5. Notifications: native push via plugin + SMS for the provider job-alert channel; broadcast batched, logged, idempotent.
6. Empty-marketplace concierge backstop.
7. Provider card at hire-time surfaces accountability (incl. dispute outcomes).
8. Availability = toggle + auto-stale + per-job accept/decline.
9. Subscription: manual collection + daily scheduled expiry-flag job.

**Deferred (post-v1):** automated subscription billing (Safepay/PayPro), SMS beyond provider alerts, auto-availability from activity.

### Data Architecture

- **Split the provider into two linked (1:1) data types** to reconcile CNIC privacy with public reputation visibility (names kept faithful to the Glossary term "Provider"):
  - **Provider** — the public-facing record: trades, precinct, availability, and reputation fields. Resident-visible.
  - **Provider Private** — linked child holding CNIC number (or hash/last-4), selfie file, raw verification data. Visible to **owner + admin only**. Privacy rule = *no fields visible by default*, then expose explicitly.
- **Reputation = raw components + cached aggregate.** Store immutable counters — `rating_sum`, `rating_count`, and dispute counts by terminal outcome (`legit_unresolved_count`, `legit_remedied_count`) — and treat any displayed average as a **rebuildable cache**, derivable with `:average` over the Rating list. Build an **admin "recompute reputation from source" button** day one. Increments happen in **server-side backend workflows** (`field = current value + X`), never client-side, to limit the no-transaction race.
- **Reputation reacts to terminal dispute states only.** `Pending Review` must never affect the score.
- **Add a `Notification` data type** — one row per provider per broadcast, with a `sent` flag, so broadcasts are logged, idempotent, and retryable (no native delivery guarantee on Bubble).
- Other entities unchanged: **User** (role), **Resident Profile** (precinct, standing), **Job**, **Bid**, **Rating** (overall + Adab), **Dispute** (lifecycle). **Trade & Precinct = Option Sets** — accepted limitation: *adding a trade is a dev/editor change, not an in-app edit*.

### Authentication & Security

- **Roles:** Resident / Provider / Admin via Bubble accounts + privacy rules.
- **CNIC-uniqueness gate:** the verification workflow must check server-side whether a CNIC already exists before creating/verifying a Provider — this is what actually enforces the anti-reputation-reset NFR (Bubble does not enforce field uniqueness natively).
- **CNIC/selfie file handling:** upload with Bubble's **private-file flag** (field privacy alone does NOT protect the S3 URL). **Verify with an incognito GET → must 403.** Preferred: **delete the CNIC/selfie image after verification** (retain only `verified=yes` + hash/last-4), via a scheduled purge workflow. Pre-launch **pen-test pass with a non-admin test account**.

### API & Communication Patterns (Notifications / Broadcast)

- **Native push requires a plugin** (e.g., OneSignal) wired to the mobile wrapper — budgeted as real setup, not assumed built-in.
- **Provider job alerts use push + SMS.** Rationale (PM): on budget Android devices common to the provider base (Xiaomi/Tecno/Infinix), aggressive battery optimizers silently kill push — and the provider-receives-job step is the single most fragile link in the loop. SMS via a local gateway for the *provider job alert only* (residents stay on push/email). `[OPEN: confirm per-SMS PKR cost and monthly budget.]`
- **Broadcast = batched, scheduled backend workflow** (not a synchronous loop on the resident's "post job" click), **idempotent and logged** via the Notification type, so slow/dropped sends never block the UI and can be retried.
- **In-app lists are poll/eventual**, not real-time — push wakes the user; the list refreshes on page re-run. Communicated honestly to the user (already PRD-aligned).

### Frontend / UX-Architecture Decisions

- **Provider card at hire-time exposes accountability — but humanized, in two layers** (raw "Legitimate–Unresolved count" at a glance would read as a scarlet letter to a non-tech user in her second language and unfairly brand providers):
  - **Glance layer (reads in 2s, works in Urdu):** star rating **with job count** ("4.6 from 83 jobs" — the count is the trust, not the decimal), plus a **plain-language trust line framed positively**: *"83 jobs done · 81 went smoothly"* (same math as "2 disputes," opposite feeling).
  - **Detail layer (one tap):** honest breakdown — "2 disputes: 1 resolved, 1 under review." An **unresolved** dispute is framed as *"we're looking into this"* (the platform's unfinished work), **never as a verdict of guilt.**
  - **Provider's reply is always shown** on a dispute (already FR-23) — converts a one-sided brand into a *fairness* signal; without it, good providers flee.
  - **Adab sub-scores live in the detail layer** (or as labeled icons), not as five competing numbers at glance; named "Adab" in the Urdu UI.
  - **New-provider zero-state is designed deliberately** — "New · verified ID" framed neutrally-to-positively so an empty history reads "fresh start," not "unknown risk" (protects the supply side at birth). `[Refines PRD FR-3/FR-9 presentation; lock the Dispute data model now incl. provider reply.]`
- **Availability = manual toggle + auto-stale rule** (auto-flip to Unavailable after N days inactivity) **plus per-job accept/decline**, so a stale "Available" provider who ignores a job degrades gracefully (resident simply sees responses from those who accept). `[Refines PRD FR-19.]`

### Infrastructure & Deployment

- **Hosting:** Bubble managed. **Mobile:** native wrapper → App Store + Play Store.
- **Store-review readiness is a launch gate, not polish:** write a **privacy policy** + **data-use disclosure** (government-ID collection draws scrutiny), implement an **in-app account-deletion flow** (Apple-mandated, ≤3 taps), and ensure native nav/push so the wrapper clears Apple **4.2 "minimum functionality."** Budget **2–4 review cycles.** Need Apple ($99/yr) + Google ($25) developer accounts.
- **Subscription:** manual *collection* (bank transfer / JazzCash / Easypaisa) + real fields (`trial_start`, `trial_end`, `subscription_status`) + a **daily scheduled workflow** flagging expiring/expired providers (cheap; prevents both revenue leak and wrongly cutting off a scarce provider).

### Empty-Marketplace Backstop (the #1 product risk surfaced)

- When a broadcast yields **no bids within a window**, do not leave the resident in silence: offer a **"we'll find someone — hang tight"** path that **alerts the founder to manually recruit/assign** a provider (founder-as-concierge). Pairs with PRD FR-22 (empty-state capture & notify). This is operational glue that keeps a thin early marketplace from reading as "dead." `[Refines PRD FR-22; add to v1.]`

### Decision Impact Analysis

**Build sequence (first):** (1) Bubble account + plan; (2) data types incl. Provider_Public/Private split + Notification; (3) reputation raw-components + recompute button + incognito file-privacy test — *before any feature work*; (4) CNIC-uniqueness verification gate; (5) store-review prerequisites (privacy policy + account deletion) before first submission.

**PRD alignment notes (feed back into a PRD update):** availability model (FR-19); humanized provider-card accountability display incl. provider reply + new-provider zero-state (FR-3/FR-9/FR-23); SMS-primary for provider alerts; the empty-marketplace concierge backstop (FR-22); and the localization locks (Western Arabic numerals, "Rs", status+Urdu label table) are refinements discovered here that should be reflected in the PRD.

## Implementation Patterns & Consistency Rules

_Adapted to a no-code Bubble build (the consistency layer Bubble doesn't enforce for you), and hardened via an engineer/architect/tech-writer roundtable. Key principle: in Bubble there is no compiler or git diff — **naming + enum discipline + privacy rules are the only structural integrity you get.**_

### Right-sizing for v1 (don't let process delay shipping)
The #1 risk is *not shipping*. So these conventions are tiered — only the irreversible ones are required before launch; the rest activate when they earn their place.

- **v1-ESSENTIAL (do before/at launch — irreversible or trust-critical):**
  1. **Naming + data-model rules** (renaming fields / splitting types after live data = migration pain).
  2. **Privacy rules — CNIC + contact gating** (an exposure is an un-undoable trust/legal breach).
  3. **One environment rule — never test on Live data.**
  4. **Reputation-integrity rule** — aggregate writes server-side + non-client-writable fields (gameable reviews = dead marketplace).
  5. The **enum *slug discipline*** (don't bake display text into logic) + the **one-page CONVENTIONS sheet** as home for all of the above.
- **ACTIVATE-AT-SCALE (defer until a 2nd person joins or data volume grows — note, don't build now):** rehearsed backup/restore *drills*, the changelog, the schema-backfill *checklist*, and the *maintained* enum display-table. For v1, a single sentence suffices ("you're on a plan with backups; here's the restore button"; "backfill ~20 rows by hand").

### Open dependency
- **Confirm the Bubble plan supports (a) API Workflows** (required for server-side reputation/money writes) **and (b) point-in-time restore** (backup safety). Several rules below assume both. `[OPEN: confirm plan tier.]`

### Naming conventions (faithful to the PRD Glossary)
- **Data types:** singular, Title Case. Canonical human type is **`User`** (the account/auth). **`Resident`** and **`Provider`** are role profiles (1:1 to a User). The sensitive split is named to keep the Glossary term visible: **`Provider`** = the public-facing provider record; **`Provider Private`** = its linked child holding CNIC/selfie/raw verification. (Renamed from "Provider Public" so it matches the Glossary's "Provider" verbatim.)
- **Rating vs Reputation (distinct concepts, distinct names):** **`Rating`** = the raw *event* (one Resident scores one Job — written by a user action). **`adab_score`** + reputation counters = *derived aggregates* stored on `Provider`, written **only** by backend math. Different authors → different names.
- **Fields:** lower `snake_case`, mirroring Glossary terms exactly (`availability`, `verified`, `rating_sum`, `trial_end`).
- **Workflows:** prefix **backend (server-side) workflows `BE –`** (load-bearing — it marks where the integrity rules live, e.g. `BE – Recompute Reputation`). Page workflows use plain verb-noun names (`award_job`). (Dropped the `Click –` / `RU –` prefixes as low-value ceremony.)

### Locked enums — Option Sets with slug + display
Stored **internal option names are ASCII slugs** (rename-safe); a **Display** attribute holds the human label. Spelling is fixed (`cancelled`, not `canceled`).

| Option Set | Internal slugs | Display |
|---|---|---|
| Job status | `open` / `awarded` / `completed` / `cancelled` | Open / Awarded / Completed / Cancelled |
| Verification | `pending` / `verified` | Pending / Verified |
| Availability | `available` / `unavailable` | Available / Unavailable |
| Dispute status | `pending_review` / `legit_remedied` / `legit_unresolved` / `not_upheld` | Pending Review / Legitimate–Remedied / Legitimate–Unresolved / Not Upheld |
| Subscription | `trial` / `active` / `expired` | Trial / Active / Expired |

### Format conventions
- **Currency:** PKR, whole rupees, `Rs 2,500` (`:formatted as 1,000`, no decimals).
- **Dates/times:** store UTC; **display with explicit `Asia/Karachi` formatting** (never raw date output — Bubble otherwise renders in the viewer's browser zone).
- **Phone:** store canonical `03XXXXXXXXX`; build a **single reusable normalization** (phone is the identity/dedup key); transform to **E.164 `+923XXXXXXXXX` for SMS sends**.

### Enforcement rules (privacy rules ARE the guardrail, not prose)
- **Privacy = deny-by-default**, defined as a **privacy-rules table** (per data type: which role sees which fields). `Provider Private` → owner + admin only; `cnic_file` → no client role, ever.
- **Reputation/aggregate fields are NOT modifiable by the logged-in user** — only API/admin context writes them. This is what actually enforces "server-side only"; the naming convention alone does not.
- **All reputation, money, notification, and secret-using writes run in `BE –` backend workflows.** Client workflows can fire twice (double-tap) or abort mid-flight.
- **Reputation changes only on terminal dispute states** (never `pending_review`).
- **Broadcasts always write a `Notification` row** (idempotent, logged, retryable).
- **Uniqueness is manual:** signup must do an explicit pre-write search-and-block on phone and CNIC (Bubble has no unique constraint).
- **Soft-delete:** terminal/destructive actions set a status + timestamp (`cancelled`), never hard-delete the parent record.
- **Secrets** (SMS, payment keys) live in Bubble's secure plugin/API-connector storage and are used only in backend workflows — never in client/page logic.

### Consistency UX patterns (for non-tech-savvy users; Urdu/English)
- **Empty states must reassure, not just inform** (low-tech users blame *themselves* for blank screens). Every empty/zero-result screen does three things in order: (1) reassure it's normal and not their fault, (2) say what happens next *without them doing anything*, (3) offer a fallback. E.g. *"No plumbers are free right now — that's normal in the evening. We'll message you the moment one is available. You don't need to keep checking."* Warm illustration, never an error/crash icon. Test each one: *"Could this make her think she broke it?"*
- **Confirmation/pending state** on **irreversible or money/reputation/notification/state-transition writes only** (submit rating, raise dispute, cancel job, award) — not on every trivial save.
- **Localization locks (cheap now, brutal to retrofit):**
  - **Western Arabic numerals (1, 2, 3) app-wide** for all PKR amounts and times — never mix in Eastern Arabic-Indic digits, or prices stop being comparable at a glance.
  - **Currency always reads `Rs 1,500`** — never a bare number, never a `$` glyph.
  - **Status labels paired with a fixed Urdu translation in one table** (one label → one Urdu word, used across all three apps — no drift).
  - **Icon + text, never icon alone** for statuses and Adab scores (a lone glyph is a literacy tax; "🧹 Cleanup" reads instantly).
  - **Generous, well-spaced tap targets** (designed for a budget Android, one thumb, cracked screen).
- **Notification copy:**
  - **Provider job alert = SMS is the primary surface** (push dies on budget Androids). Include enough to *decide* — job type, area, how to claim — so Bilal need not open a slow app on low battery.
  - **"Panic-moment" notifications** (provider cancelled, dispute opened, no one accepted) use a **calm, human tone + a clear next step** — never a cold "Job #4412 status: cancelled."

### Operational discipline (the layer that actually bites a solo founder)
_Only the environment rule is v1-essential; the rest are **activate-at-scale** (see Right-sizing above) — captured here so they're not forgotten, not built now._
- **Environments (v1-ESSENTIAL):** build and test in **Development**; real users only ever touch **Live**; deploy deliberately; never hand-edit logic or data on Live.
- **Schema changes:** Bubble does **not** backfill existing rows when a field is added. Every new field → decide its default **and** whether a one-time bulk backfill of existing records is needed.
- **Backups & recovery:** know the plan's restore window; **CSV-export affected data before any bulk operation**; rehearse a restore once on Development so the first time isn't during a real incident.
- **Changelog:** keep a dead-simple running log (date / what changed / why) — it's the git-substitute that makes the app handoff-able to a freelancer or AI assistant.

### The single source of truth: a one-page CONVENTIONS sheet
Maintain **one authoritative, dated page** (not a wiki) containing: (1) a **Glossary → Data Type map** (term | Bubble type/field | one-line "why if different"), (2) the **prefix legend**, (3) the **locked enums in full**, (4) the **formats**. Top rule: *"If a new name isn't on this sheet, it doesn't exist yet — add it here first, then build it."*

## Project Structure & Boundaries (Bubble app structure)

One Bubble app (Web + Mobile), three **role-gated surfaces** sharing one database: **Resident app** (mobile), **Provider app** (mobile), **Admin back-office** (web).

### Surface → Screen → Feature/FR map

**📱 Resident app (mobile)**
| Screen | Feature / FRs |
|---|---|
| Sign-up / login (Resident) | User + Resident profile |
| **Post a Job** (trade, description, precinct) + supply-aware expectation | FR-6, FR-21 |
| "Finding providers…" / empty-state capture & notify | FR-22 |
| **Bids — Compare & Choose** (humanized provider cards) | FR-9, FR-3, FR-5 |
| Award & Connect (contact shared) | FR-10 |
| My Jobs / job status | FR-11, FR-12 |
| Rate + Adab | FR-13, FR-14 |
| Raise a dispute | FR-15 |

**📱 Provider app (mobile)** — *light UX (browse jobs, bid); no calendars/earnings dashboards*
| Screen | Feature / FRs |
|---|---|
| Sign-up + verification (CNIC + selfie) | FR-1, FR-2 |
| My profile + reputation | FR-3, FR-4 |
| Availability toggle | FR-19 |
| Job feed / job alerts | FR-7, FR-20 |
| Submit a bid | FR-8 |
| My awarded jobs | FR-10, FR-11 |
| Respond to a dispute | FR-23 |
| Subscription status / trial | FR-17, FR-18 |

**🖥️ Admin back-office (web — founder only)**
| Screen | Feature / FRs |
|---|---|
| Verification queue (view CNIC/selfie, approve) | FR-2 |
| Dispute adjudication (both sides → outcome) | FR-16, FR-24 |
| Resident-standing monitor | FR-25 |
| Subscription & trial-expiry dashboard | FR-17, FR-18 |
| Empty-marketplace concierge alerts (recruit/assign) | empty-state backstop |
| Reputation **recompute** button | integrity tool |
| Notification log | broadcast audit |

### Backend workflows (`BE –` — server-side, the integrity layer)
`BE – Broadcast Job` (FR-20) · `BE – Apply Rating to Reputation` · `BE – Apply Dispute Outcome` (terminal only) · `BE – Recompute Reputation` · `BE – Flag Expiring Trials` (daily) · `BE – Purge CNIC/Selfie` (post-verification) · `BE – Send SMS` (provider alert) · `BE – Check Phone/CNIC Uniqueness` (signup).

### Surface-boundary decisions (Bubble)
- **Admin stays in-app** (decisive): admin moderates reputation, resolves disputes, reads `Provider Private` — the surface most coupled to core data + backend workflows. Splitting it would turn every admin action into a cross-app API call. Tame editor clutter with page-name prefixes (`admin_`, `prov_`, `res_`), workflow folders, and a `Role` option set.
- **Provider + Resident = one role-switch mobile binary for v1** — confirmed by *light* provider UX and by the fact that, in one gated community, App-Store *discovery* is irrelevant (providers onboarded by direct link). **Guardrails so a later split stays cheap (a weekend, not a rewrite):** separate page trees (`res_*` / `prov_*`), no pages straddling both roles, role decided once at login and routed hard, and **`Role` as a first-class field on User with per-role privacy rules written now** (privacy is the painful retrofit). Re-evaluate only if provider UX later grows heavy.

### Other boundaries
- **Role boundary = Bubble privacy rules** (Resident / Provider / Admin) — the only access boundary; `Provider Private` is admin+owner only.
- **External integrations:** SMS gateway (provider alerts), push (OneSignal), payment gateway (subscription — later). Each used **only inside `BE –` workflows** (secrets never client-side).
- **Data boundary:** all reputation/money writes server-side; clients read.

### Build sequence (validation-first, not screen-first)
The riskiest assumption is **not** supply (already de-risked — the founder hand-seeds providers). It's demand + trust: *will residents post a job to an app and transact through it, and does software-enforced recourse actually matter?* So we test that **before** building screens.

- **Phase 0 — Wizard-of-Oz concierge loop (founder-as-backend, near-zero build).** A dead-simple Post-a-Job intake (one Bubble form, or even a Google Form / WhatsApp) for ~10–15 real residents; the founder manually texts the fitting seeded providers, relays 2–3 quotes, the resident picks, and after the job the founder captures the rating + Adab (and any dispute) by hand. **Confirmed feasible** — founder can reach 15–20 residents this month. **Gate:** do residents post and transact through the intro (not around it), and does recourse change behavior? *Caveat: validates demand and the value of trust, NOT on-platform retention / disintermediation — that needs the real software.*
- **Phase 1 — Foundation:** Bubble account + plan; data types (incl. `Provider`/`Provider Private` split, `Notification`); per-role privacy rules; reputation recompute button + incognito file-privacy test.
- **Phase 2 — The demand loop early (it's the product):** Resident **Post a Job** → broadcast → **Bids/Compare** (humanized provider card) → **Award**, paired with a **thin provider job-feed + bid**. Verify the ~20–30 seeded providers **by hand** at this stage.
- **Phase 3 — Trust loop:** Rate + Adab → reputation update → Dispute → admin adjudication.
- **Phase 4 — Defer the heavy machinery until volume justifies it:** the full **Admin verification queue**, automated **uniqueness/CNIC-purge**, and subscription tracking + daily expiry flags.

**→ The true first step is Phase 0 (no real screens).** The first *built* user-facing screen is the resident **Post a Job → Bids/Compare** — the screen that *is* the product.

## Architecture Validation Results

### Coherence Validation ✅
All decisions, patterns, and structure are mutually consistent; no contradictions. Integrity rules trace cleanly: server-side reputation → `BE –` workflows + non-client-writable fields → backend-workflow inventory. Build-order defers heavy machinery without leaving FRs unsupported (seeds hand-verified before the Admin queue exists).

### Requirements Coverage ✅
**All 25 FRs** mapped to a surface or backend workflow (see Surface→Screen→FR map and `BE –` inventory). **NFRs covered:** reputation integrity, CNIC/selfie privacy, degraded-real-time (poll+push+SMS), manual operations (admin surfaces).

### Implementation Readiness ✅
Data model, naming/enum conventions, privacy rules, workflow inventory, screen map, and a validation-first build order are all documented — sufficient to hand to a non-technical builder or an AI/freelancer.

### Gap Analysis
**Critical (blocking):** none.
**Important (resolve at build time, non-blocking):**
- Confirm the **Bubble plan** supports API Workflows + point-in-time restore (open dependency).
- **5 PRD open questions** remain as tuning (flat fee amount; subscription billing mechanism; bid response window; completion fallback; dispute pattern threshold).
- **Feed PRD-alignment refinements back into the PRD** (availability model, humanized provider-card display + provider reply, SMS-primary, empty-marketplace backstop, localization locks).
- **Data model is entity+key-field level, not fully field-typed** — expand during Phase 1 build.
**Nice-to-have:** UX wireframes (UX step skipped; acceptable for a no-code v1 where Bubble supplies UI).

### Architecture Completeness Checklist
**Requirements Analysis** — [x] context analyzed · [x] scale/complexity assessed · [x] constraints identified · [x] cross-cutting concerns mapped
**Architectural Decisions** — [x] critical decisions documented · [x] stack specified (Bubble + OneSignal + SMS gateway + payment-later) · [x] integration patterns defined · [x] performance addressed (poll+push, batched broadcast, cached aggregates)
**Implementation Patterns** — [x] naming conventions · [x] structure patterns · [x] communication patterns · [x] process patterns
**Project Structure** — [x] structure defined (surfaces/screens/workflows) · [x] component boundaries · [x] integration points mapped · [x] requirements→structure mapping

### Architecture Readiness Assessment
**Overall Status:** READY FOR IMPLEMENTATION *(all 16 checklist items met; no critical gaps; the listed important items are build-time tuning, not architectural holes)*
**Confidence Level:** High
**Key Strengths:** validation-first build order (Phase 0 concierge de-risks the company-killing assumption cheaply); reputation-integrity + CNIC-privacy hardened against Bubble's runtime limits; honest, humanized accountability UX; right-sized process for a solo founder.
**Areas for Future Enhancement:** the parked Phase-2 roadmap (Design Studio, two-mode, etc.), automated billing, automated verification, and the operational layer (backups/changelog) activate at scale.

### Implementation Handoff
**Builder guidelines:** follow the conventions sheet + privacy rules exactly; all reputation/money/secret writes in `BE –` workflows; consult this doc for any architectural question.
**First implementation priority:** **Phase 0 — run the Wizard-of-Oz concierge loop** (no real build) to validate demand + recourse; then Phase 1 Foundation in Bubble.
