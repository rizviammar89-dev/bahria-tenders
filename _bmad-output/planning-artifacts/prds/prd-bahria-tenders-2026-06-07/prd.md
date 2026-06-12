---
title: Bahria Town Karachi Home-Services Marketplace
status: final
created: 2026-06-07
updated: 2026-06-12
---

# PRD: Bahria Town Karachi Home-Services Marketplace

## 0. Document Purpose

This PRD is for the founder (Ammar) and any future collaborator or builder who implements v1. **Build-target note (2026-06-12):** v1 is now preceded by a code-built POC that doubles as Phase-0 demand validation; the POC's scope cuts, gate metrics, and kill criterion live in `_bmad-output/planning-artifacts/poc-spec-2026-06-12.md` and are summarized in §6.3. This PRD remains the v1 product definition. It translates the finalized product brief (`_bmad-output/planning-artifacts/briefs/brief-bahria-tenders-2026-06-07/brief.md` + `addendum.md`) into capabilities and functional requirements. It is Glossary-anchored: features are grouped, FRs are nested, assumptions are tagged inline as `[ASSUMPTION]` and indexed in §9. (FR numbering is explained in §4.) Tech-how (no-code platform choice, data storage mechanics) lives in the addendum, not here. The product is a passion project built solo on no-code tooling, so scope is deliberately tight — the parked Phase-2 roadmap lives in the brief's addendum and is out of scope here.

## 1. Vision

A trusted home-services marketplace built specifically for **Bahria Town Karachi**, where the core asset is **persistent provider reputation**. Every tradesman carries a permanent, public track record that follows them across every job, so for the first time a bad job has lasting consequences and a good one compounds into more work. This is the thing word-of-mouth and building-management referrals structurally cannot do.

For residents, it replaces the recurring gamble of hiring small-job tradesmen — and the helplessness when the work is bad — with the ability to compare providers on reputation, distance, and what their own neighbors have said, then have those providers compete for the job. For providers, it gives skilled-but-invisible solo tradesmen a reputation that travels and a way to win work on merit instead of only on lowest price.

The advantage is focus and local trust density, not technology: by going deep in one gated community, the platform builds a hyper-local trust moat a national app cannot replicate. v1 proves the core trust loop with a single simple job flow across six trades; everything ambitious (the 3D Design Studio, renovations, two-mode flows) is deferred.

## 2. Target User

### 2.1 Jobs To Be Done

**Residents (demand)** — the household acts as a unit: the housewife typically deals with the problem and supervises the work, while the husband often controls payment and signs off on bigger spends.
- When a small home job comes up (every few months), find a tradesman I can trust *without* gambling on a single blind referral.
- Know *before* I let someone into my home whether he is competent, respectful, and accountable.
- Have real recourse when the work is bad — so I am not left helpless after paying.

**Providers (supply — the bottleneck):**
- Prove I am good and reliable when I have no travelling reputation, so I can win work.
- As a newcomer, get a fair shot at a first job against established names.
- Win work on merit (skill, manners, reliability) rather than being forced into a race to the bottom on price.
- Build a reputation that compounds into a steady livelihood.

### 2.2 Non-Users (v1)

- **Interior designers and renovation contractors** — deferred until the Design Studio / Court-mode phase.
- **Residents outside Bahria Town Karachi** — the trust model depends on single-community density.
- **Multi-worker companies / service shops** — v1 targets independent solo tradesmen; crew/roster management is parked.

### 2.3 Key User Journeys

- **UJ-1. Ayesha hires a trusted plumber without the usual gamble.**
  - **Persona + context:** Ayesha, a homeowner in Precinct 10, has a leaking tap. Today she'd WhatsApp a neighbor and hope. She wants confidence, not a coin-flip.
  - **Entry state:** Authenticated resident on the mobile app.
  - **Path:** Opens app → picks Trade (plumber) and types the problem → **before/as she posts, the app sets expectations honestly based on real supply**: "3 plumbers near you are online now" (with a typical response time once enough data exists) → she posts → the Job **broadcasts at once to all available matching Providers**, who each send a single price → she watches prices arrive in near-real-time, each showing price, rating, Adab Score, distance, and "used by N homes in your precinct" → compares and shortlists two → picks one on reputation, not just lowest price.
  - **Climax:** She confirms the provider; both get each other's contact details to coordinate the visit. She feels she chose with real information.
  - **Resolution:** Job happens offline, paid in cash. Afterward she rates the work and the provider's manners. Her choice is now part of his permanent record.
  - **Edge case (the make-or-break moment):** If **no Providers are online**, the app does not leave her in silence — it says so honestly and lets her **leave the request and be notified the moment a Provider responds**, rather than implying a real-time promise it can't keep.

- **UJ-2. Bilal, a newcomer carpenter, wins his first job on merit.**
  - **Persona + context:** Bilal, 24, skilled but new to Bahria Town with no local reputation.
  - **Entry state:** Verified provider (CNIC + selfie) with a profile and selected trades.
  - **Path:** Sees a nearby job matching his trade → submits a price and a short note → resident compares him against established names; his "New — verified" status and fair price get him shortlisted → he is chosen.
  - **Climax:** He gets the job and the resident's contact; he does clean work.
  - **Resolution:** He earns his first rating and Adab score — the seed of a reputation that compounds.
  - **Edge case:** If he loses the bid, the job simply closes for him; his standing is unaffected.

- **UJ-3. Ayesha flags a bad job and is not left helpless.**
  - **Persona + context:** Ayesha hired a provider; the work was sloppy.
  - **Entry state:** Completed job in her history.
  - **Path:** Opens the job → flags it as a problem with a short reason → the Dispute enters Pending Review (not yet public) → the Provider is notified and gives his side → the founder reviews both sides and judges legitimacy.
  - **Climax:** If legitimate, the Provider is expected to make it right (re-do/remedy); if he doesn't, it's recorded against his reputation. If not upheld, nothing stains him.
  - **Resolution:** Ayesha has real recourse; the Provider had a fair hearing; future residents see only legitimate outcomes. A *pattern* against a Provider is what truly damages standing.
  - **Edge case (anti-abuse):** If Ayesha repeatedly raises flags judged Not Upheld, her *own* standing drops — bad-faith disputing has a cost.

- **UJ-4. Bilal signs up and gets verified in minutes.**
  - **Persona + context:** Bilal hears about the app from a friend; rent is due.
  - **Path:** Downloads app → enters phone (OTP), name, CNIC number + selfie, selects trades and his area → submits.
  - **Climax/Resolution:** Once verified, he can browse and respond to jobs immediately. `[ASSUMPTION: verification is a quick manual/automated check in v1; providers can be marked "Verified" or "Pending" and only Verified providers can win jobs.]`

## 3. Glossary

- **Resident** — A Bahria Town Karachi household member (the housewife and/or husband) who posts jobs and hires Providers. The demand side.
- **Provider** — An independent solo tradesman in one or more Trades who responds to Jobs. The supply side.
- **Trade** — A service category. v1 Trades: A/C technician, plumber, carpenter, electrician, mason, painter.
- **Job** — A request posted by a Resident for a specific Trade, with a description and a Precinct location. Has a lifecycle: Open → Awarded → Completed (or Cancelled).
- **Bid** — A Provider's response to a Job: a price and optional short note. (Single price in v1; no tiers.)
- **Precinct** — A named sub-area of Bahria Town Karachi, used for location and neighbor social proof.
- **Reputation** — A Provider's persistent, public track record across all Jobs: ratings, reviews, Adab Score, job count, and dispute history. Permanent and cumulative.
- **Rating** — A Resident's post-Job score of the overall result (e.g., 1–5 stars) plus a written review.
- **Adab Score** — A Resident's post-Job rating of soft dimensions: Respect/politeness, Cleanup, Punctuality. Part of Reputation, shown distinctly from the overall Rating.
- **Neighbor Social Proof** — A precinct-level usage signal on a Provider's profile, e.g., "used by N homes in your precinct."
- **Dispute** — A Resident-raised flag that a completed Job's work was unsatisfactory. Lifecycle: Pending Review → outcome (Legitimate–Remedied, Legitimate–Unresolved, or Not Upheld). Only Legitimate outcomes affect public Reputation; raw Pending disputes are never public.
- **Resident Standing** — An internal trust signal for a Resident, lowered by a pattern of Disputes judged Not Upheld (anti-abuse counterpart to provider Reputation).
- **Availability (Online)** — Whether a Provider is currently available to receive real-time Job broadcasts. A Provider is Available or Unavailable; only Available Providers feed the "online now" expectation signal.
- **Verification** — The provider check based on CNIC number + selfie. A Provider is Verified or Pending; only Verified Providers can win Jobs.
- **Subscription** — The flat recurring fee a Provider pays for active access. The platform's only v1 revenue; Providers keep 100% of Job payments.

## 4. Features

*FRs are globally numbered (FR-1…FR-25) with stable IDs. Numbering is non-sequential by section because later FRs were added to existing features during coaching: FR-19–22 belong to §4.3 and FR-23–25 to §4.6. Every ID appears exactly once. "Distance" throughout is **Precinct-derived** (which precinct a Resident/Provider is in), not GPS/real-time mapping (see §10).*

### 4.1 Provider Onboarding & Verification
**Description:** Independent tradesmen sign up fast and prove identity, because supply is the bottleneck and trust starts at the door. Onboarding is deliberately light (the brief's "light gate, strong net"): minimal fields, quick verification, immediate ability to browse. Realizes UJ-4.

**Functional Requirements:**

#### FR-1: Provider sign-up
A prospective Provider can register with phone number (OTP-verified), name, CNIC number, a selfie, one or more Trades, and their primary area/Precinct.
**Consequences (testable):**
- Sign-up cannot complete without phone OTP, CNIC number, selfie, and at least one Trade selected.
- A Provider profile is created in **Pending** state on submission.

#### FR-2: Identity verification gate
The system marks a Provider as **Verified** or **Pending**, and only Verified Providers can be awarded Jobs. Verification is a **light gate plus one cheap second signal**: the selfie must visibly match the CNIC, and (for the launch cohort) the founder's personal vetting serves as the second signal.
**Consequences (testable):**
- A Pending Provider may browse Jobs but cannot have a Bid accepted.
- Verification requires the selfie to visibly match the CNIC before a Provider is marked Verified.
- `[ASSUMPTION: v1 verification is a manual founder review (selfie–CNIC match + personal vetting for early providers); there is no automated government CNIC API integration.]`

**Feature-specific NFRs:**
- CNIC number and selfie are sensitive personal data; access is restricted to the founder/admin and not shown publicly (see §10 Constraints).

### 4.2 Provider Profile & Persistent Reputation
**Description:** The heart of the product. Every Provider has a public profile carrying a permanent, cumulative reputation that follows them across all Jobs — the accountability engine. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-3: Public provider profile (humanized accountability)
A Resident can view a Provider's profile/card showing Trades, reputation, written reviews, total completed Job count, and Neighbor Social Proof. Accountability — including disputes — is surfaced **humanely, in two layers**, so it informs rather than frightens a non-technical reader in her second language.
**Consequences (testable):**
- **Glance layer:** overall Rating shown **with job count** ("4.6 from 83 jobs"), plus a **plain-language, positively-framed trust line** ("83 jobs done · 81 went smoothly") — never a raw "Legitimate–Unresolved count."
- **Detail layer (one tap):** honest dispute breakdown; an unresolved Dispute is framed as *"we're looking into this"* (platform's open work), **not a verdict of guilt**, and the **Provider's response is always shown** (realizes FR-23 at the point of decision).
- **Adab sub-scores** appear in the detail layer or as labeled icons (not five competing numbers at a glance); labeled "Adab" in the Urdu UI.
- A **new Provider with no history** has a deliberately designed zero-state — "New · verified ID" framed neutrally-to-positively — so blank history reads "fresh start," not "unknown risk."

#### FR-4: Persistent reputation record
Reputation is permanent and cumulative; a Provider cannot reset or delete ratings, reviews, or dispute history by any in-app action.
**Consequences (testable):**
- Deleting/recreating a profile is prevented or detectable via CNIC uniqueness. `[ASSUMPTION: CNIC is unique per Provider and blocks duplicate accounts.]`
- Past reviews and dispute outcomes remain visible after they occur.

#### FR-5: Neighbor social proof
The system shows a precinct-level usage count on a Provider's profile relative to the viewing Resident's Precinct.
**Consequences (testable):**
- Profile shows "used by N homes in [Resident's Precinct]" where N is the count of distinct Residents in that Precinct with a completed Job by this Provider.
- The signal is **anonymous/aggregate only** — it shows a count, never Resident names, in v1. (Named, opt-in vouching is parked to Phase 2.)
- When N is 0, the signal is hidden or shows a neutral state (no fabricated numbers).

### 4.3 Job Posting & Matching
**Description:** A Resident posts a small job; it **broadcasts at once to all available matching Providers**, who each respond with a price in near-real-time. One simple flow (no rescue/court split in v1). The platform makes the "respond now" promise **only when supply actually exists** — it sets expectations honestly up front (who's online, typical response time) and, when no one is available, captures the request and notifies the Resident rather than leaving them in silence. Realizes UJ-1.

**Functional Requirements:**

#### FR-6: Post a job
A Resident can post a Job specifying Trade, a free-text description, and their Precinct.
**Consequences (testable):**
- A Job cannot be posted without a Trade and a Precinct.
- A posted Job enters **Open** state and becomes visible to Verified Providers in that Trade.

#### FR-7: Provider job discovery
A Verified Provider can see Open Jobs that match their Trade(s) and area.
**Consequences (testable):**
- A Provider sees only Jobs in Trades they offer.
- Jobs display the Resident's Precinct/distance but not exact address until awarded. `[ASSUMPTION: exact address/contact is shared only after a Provider is awarded the Job, for privacy.]`

#### FR-8: Submit a bid
A Verified Provider can respond to an Open Job with a single price and an optional short note.
**Consequences (testable):**
- A Provider can submit at most one active Bid per Job (editable until the Job is awarded).
- Bids are single-price; no Basic/Standard/Premium tiers in v1.

#### FR-19: Provider availability signal
The system tracks whether a Provider is currently **available/online** so broadcasts and expectation-setting reflect real supply. To prevent stale "Available" providers from misleading Residents, availability **auto-expires after inactivity**, and matching is backed by **per-job accept/decline**.
**Consequences (testable):**
- A Provider can be in an Available or Unavailable state via a manual toggle, which **auto-flips to Unavailable after N days of inactivity** (so a forgotten toggle doesn't overstate supply).
- Only Available Providers are counted in the "online now" expectation signal and notified for real-time broadcast.
- A broadcast Job offers matched Providers an explicit **accept/decline**, so a Resident sees responses from Providers who actually engage — a stale toggle degrades gracefully rather than producing silence. `[ASSUMPTION: inactivity window N and the toggle-vs-auto mechanism are build-time tunable.]`

#### FR-20: Broadcast & provider notification
On posting, a Job is pushed at once to all Verified, Available Providers matching its Trade and area, who are notified to respond. The provider job alert is delivered by **push *and* SMS**, because push is unreliable on the budget Android devices common to the provider base — and provider-receives-job is the most fragile link in the loop.
**Consequences (testable):**
- All matching Available Providers receive a notification (push + SMS) for a newly posted Job, with enough detail (trade, area) to decide without opening the app.
- A Provider who was Unavailable at post time can still see and bid on the Job while it is Open (just not pushed in real-time).
- `[ASSUMPTION: SMS is sent for provider job alerts only (not resident-side) to control cost; per-SMS budget TBD.]`

#### FR-21: Supply-aware expectation setting
Before/at posting, the Resident is shown an honest expectation based on current supply.
**Consequences (testable):**
- When ≥1 matching Provider is Available, the Resident sees a count of who's online.
- A typical response-time indication is shown **only once enough historical Bid-response data exists**; at launch (no data) the app shows the online count and a generic "providers usually respond shortly" rather than a fabricated number. `[ASSUMPTION: response-time ETA is derived from observed Bid response times, not shown until a baseline exists.]`
- When 0 matching Providers are Available, the Resident is told so plainly — no real-time promise is implied.

#### FR-22: Empty-state capture, resident notification & concierge backstop
When no Providers are Available (or none have responded), the Resident can leave the request and be notified when a Bid arrives — and a founder-operated **concierge backstop** ensures a thin early marketplace never reads as "dead."
**Consequences (testable):**
- A Resident is notified when the first/each Bid arrives on their Open Job, so they need not watch the screen.
- An empty broadcast does not dead-end: the Job stays Open and the Resident is offered the leave-and-notify path.
- When a Job receives no Bids within a window, the **founder/admin is alerted to manually recruit or assign** a suitable Provider (founder-as-concierge), so early-stage thin supply still results in a real outcome. `[ASSUMPTION: concierge is a manual admin workflow in v1; the no-bid window is build-time tunable.]`

### 4.4 Compare, Choose & Connect
**Description:** The Resident reviews responses and chooses on reputation, not just price — then the two are connected to coordinate offline. Realizes UJ-1.

**Functional Requirements:**

#### FR-9: Compare bids
A Resident can view all Bids on their Job, each showing price, the Provider's overall Rating, Adab Score, distance/Precinct, and Neighbor Social Proof.
**Consequences (testable):**
- Bids are viewable together for comparison; sorting does not default to lowest-price-only. `[ASSUMPTION: default presentation surfaces reputation alongside price rather than sorting purely by cheapest.]`

#### FR-10: Award the job
A Resident can award the Job to one Provider, moving it to **Awarded**.
**Consequences (testable):**
- On award, the Job closes to further Bids.
- On award, Resident and Provider receive each other's contact details to coordinate the visit.

#### FR-11: Offline completion (no in-app payment)
Job execution and payment happen offline; the app does not process Job payments in v1.
**Consequences (testable):**
- There is no payment gateway or in-app charge for a Job.
- The system provides a way to mark a Job **Completed** (see FR-12) to enable rating.

### 4.5 Rating, Adab Score & Reputation Update
**Description:** After the job, the Resident rates the result and the provider's conduct, feeding the permanent reputation. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-12: Mark job completed
A Resident can mark an Awarded Job as **Completed**.
**Consequences (testable):**
- Only a Completed Job can be rated. `[ASSUMPTION: the Resident marks completion; if they don't, a Job may auto-prompt for completion after a set period.]`

#### FR-13: Rate the result
A Resident can give a Completed Job an overall Rating (e.g., 1–5) and an optional written review.
**Consequences (testable):**
- The overall Rating updates the Provider's cumulative Reputation immediately.

#### FR-14: Adab Score
A Resident can rate three soft dimensions — Respect, Cleanup, Punctuality — for a Completed Job.
**Consequences (testable):**
- The Adab Score is stored and displayed distinctly from the overall Rating on the Provider profile.
- Adab dimensions are lightweight (a few taps), not a long form.

### 4.6 Dispute & Recourse
**Description:** The Resident's protection against helplessness, deliberately balanced to also protect Providers (the bottleneck) from bad-faith flags. Resolution is remedy-or-reputation — no platform funds change hands. The mechanics (right to respond, review-before-record, pattern weighting, resident-standing anti-abuse) are specified in the FRs below. Realizes UJ-3.

**Functional Requirements:**

#### FR-15: Raise a dispute
A Resident can flag a Completed Job as unsatisfactory with a short reason; the flag is tied to that real Job.
**Consequences (testable):**
- A Dispute can only be raised on a Completed Job the Resident actually hired.
- Raising a Dispute notifies the founder/admin and the Provider, and enters a **Pending Review** state.
- A raw, Pending-Review Dispute is **not shown publicly** on the Provider's profile.

#### FR-23: Provider right to respond
The Provider can submit their side of a Dispute before any Reputation impact is recorded.
**Consequences (testable):**
- The Provider is notified of a Dispute and can respond within a set window.
- No Reputation change is applied while a Dispute is in Pending Review.

#### FR-16: Founder review & legitimacy judgment
The founder/admin reviews both sides and records an outcome; only a Dispute judged **legitimate** affects the Provider's public Reputation.
**Consequences (testable):**
- Possible outcomes include: **Legitimate–Remedied**, **Legitimate–Unresolved**, or **Not Upheld** (no provider impact).
- Only Legitimate outcomes appear in the Provider's public dispute history; **Not Upheld** disputes never stain the Provider.
- No platform funds are paid out; resolution is remedy-or-reputation only.

#### FR-24: Pattern weighting
Repeated legitimate Disputes against the same Provider weigh more heavily on standing than any single one.
**Consequences (testable):**
- A single Legitimate Dispute is recorded but treated as low-weight (he-said/she-said).
- A pattern of Legitimate Disputes is what materially damages a Provider's standing. `[ASSUMPTION: exact pattern threshold/weighting is a tunable rule, set during build.]`

#### FR-25: Resident standing (anti-abuse)
A Resident's own standing is affected when their Disputes are repeatedly judged **Not Upheld** (bad-faith flagging).
**Consequences (testable):**
- A pattern of Not Upheld Disputes lowers the Resident's internal trust standing.
- `[ASSUMPTION: low Resident standing's effect (e.g., warnings, reduced dispute weight, or visibility to providers) is a tunable rule set during build; v1 may start by simply tracking it.]`

### 4.7 Provider Subscription
**Description:** The platform's only v1 revenue. Providers pay a flat recurring fee for active access and keep 100% of every Job's payment. Realizes the business model.

**Functional Requirements:**

#### FR-17: Subscription gating with free trial
A Provider gets their **first 2 months free**; after the trial, an active Subscription is required to submit new Bids.
**Consequences (testable):**
- A new Provider can bid freely during their first 2 months without any payment.
- After the trial expires, a Provider without an active Subscription cannot submit new Bids (can still maintain a profile and Reputation).
- The free trial is per-Provider, starting from their verification/first activation. `[ASSUMPTION: the flat fee amount is TBD; the trial length is fixed at 2 months.]`

#### FR-18: Subscription payment & status
The system records a Provider's Subscription status and renewal.
**Consequences (testable):**
- `[ASSUMPTION: v1 subscription is collected via a simple/manual method (e.g., bank transfer or a basic payment link) given the no-code build; full automated billing is not required for v1.]`
- A Provider can see their current Subscription status and expiry.

## 5. Non-Goals (Explicit)

- **No in-app job payments / escrow / commission** — payment is cash, direct, offline; the platform is not a payment processor in v1.
- **No 3D Design Studio, renovations, or interior-design jobs** — parked to Phase 2 (see brief addendum).
- **No two-mode (Rescue vs. Court) flows, tiered bids, live arrival/face-match, declared crew, gamified trust ladder, or in-app surge** — all deferred.
- **Not a multi-community / national platform** — single-community depth only.
- **Not a company/crew marketplace** — solo independent tradesmen only.
- **No automated government CNIC verification integration** — lightweight check in v1.

## 6. MVP Scope

### 6.1 In Scope
- Provider onboarding + light verification (CNIC + selfie), six Trades.
- Public provider profiles with persistent, cumulative Reputation (Rating, Adab Score, reviews, job count).
- Neighbor Social Proof (precinct-level usage count).
- Single job flow: post → providers bid (single price) → compare → award → connect offline.
- Post-job overall Rating + Adab Score; permanent reputation update.
- Resident-raised Disputes with founder-mediated, reputation-based resolution.
- Flat provider Subscription (with an initial free period to seed supply).
- Mobile app + web.

### 6.2 Out of Scope for MVP
The broad "not building / not becoming" list is §5 Non-Goals. The MVP-specific deferrals to call out:
- **3D Design Studio, renovations, interior designers** → Phase 2. `[NOTE FOR PM: the emotionally load-bearing future feature; revisit first once the trust loop is proven.]`
- All other parked mechanics (two-mode flows, tiered bids, advanced safety, gamified ladder, maintenance reminders, monetized design flow) → Phase 2+ (see brief addendum).

### 6.3 POC Scope — Phase 0 on the MVP (locked 2026-06-12)

The MVP is preceded by a deliberately thinner **POC** that runs the core loop with real residents and providers and *is* the Phase-0 demand validation (replacing the earlier Wizard-of-Oz concierge plan). Full definition: `_bmad-output/planning-artifacts/poc-spec-2026-06-12.md`.

**Proof statement:** Residents in 2–3 precincts will post real jobs through an app, and providers will bid on them, often enough to repeat.

**POC in scope:** core loop only — post job (FR-6) → broadcast via push (FR-20, push-only) → single-price bids (FR-8) → compare on stars + completed-job count (FR-9, simplified) → award & connect (FR-10) → offline cash completion (FR-11, FR-12) → write-once rating (FR-13). Founder-provisioned phone+PIN auth; founder-manual provider vetting; Supabase Studio as the admin surface.

**Deferred to post-POC** (the FRs remain v1 requirements; they are out of the POC build): CNIC + selfie verification (FR-1/FR-2 — replaced by founder-manual `verified_by_admin`; **first item back post-POC**, since duplicate-account/reputation-reset protection rests on the founder personally knowing all ~20 providers), SMS alerts (FR-20 push-only for POC), Adab Score (FR-14), Neighbor Social Proof (FR-5), subscription gating/billing (FR-17/FR-18 — providers free during POC), in-app dispute tooling (FR-15/FR-16/FR-23–25 — founder's WhatsApp number + manual logging), availability auto-expiry mechanics (FR-19 — simple feed + pull-to-refresh), and the admin back-office framework.

**Gate metrics (30 days live):** 25+ residents post a job; 60%+ of jobs get ≥2 bids within 24h; 50%+ of awarded jobs completed + rated; ~20% repeat-post rate.

**Kill criterion (accepted by founder):** after 6 weeks live, <15 jobs posted OR median bids-per-job <2 → stop and rethink, not iterate harder.

## 7. Success Metrics

**Primary**
- **SM-1: Repeat usage (heartbeat).** Share of Residents who post a 2nd+ Job within ~3–4 months of their first. Validates the core trust loop (FR-6…FR-14 plus FR-19…FR-22). Target TBD once baseline exists.
- **SM-2: Organic advocacy.** Unprompted mentions/recommendations in Bahria Town WhatsApp groups and in-app referrals/vouch activity. Validates the trust thesis (FR-3, FR-5). Target: detectable, growing, unprompted.

**Secondary**
- **SM-3: Active earning supply.** Count of Verified Providers completing repeat Jobs and retaining Subscriptions. Validates supply health (FR-1, FR-17). 
- **SM-4: Trust quality.** High average overall Rating *and* a low rate of Legitimate–Unresolved Disputes. Validates the accountability engine (FR-13, FR-15, FR-16).
- **SM-5: Sustainability.** Subscription revenue covers running costs ("pays for itself").

**Counter-metrics (do not optimize)**
- **SM-C1: Bid volume / lowest-price wins.** Do *not* optimize for cheapest-bid-wins; it would resurrect the race to the bottom that reputation exists to prevent. Counterbalances SM-1/SM-3.
- **SM-C2: Onboarding speed at the cost of trust.** Do *not* loosen verification just to grow supply faster; safety at job-time is the promise. Counterbalances SM-3.

## 8. Open Questions

1. **Flat fee amount.** What is the monthly Subscription price after the 2-month free trial? (Trial length resolved: 2 months. Relates FR-17, FR-18.)
2. **Subscription billing mechanism.** Manual bank transfer / JazzCash / Easypaisa vs a payment-gateway link (Safepay/PayPro)? Deferred — providers are free during the POC. (FR-18.)
3. **Bid response window.** How long is a Job Open before it expires or notifies the Resident that no one responded? (FR-7, FR-22, UJ-1 edge case.)
4. **Completion confirmation.** If a Resident never marks a Job Completed, what's the fallback (auto-prompt, provider-initiated, timeout)? (FR-12.)
5. **Dispute tuning.** The fairness model is set (right-to-respond, review-before-record, pattern weighting, resident-standing anti-abuse). Still to tune during build: the exact pattern threshold (FR-24), response-window length (FR-23), and what low Resident Standing actually does (FR-25).

## 9. Assumptions Index

- §2.3 / FR-2 — v1 verification is a manual/lightweight founder check; no automated CNIC API.
- §4.2 / FR-4 — CNIC is unique per Provider and blocks duplicate accounts (prevents reputation reset).
- §4.3 / FR-7 — Exact address/contact shared only after a Provider is awarded the Job.
- §4.3 / FR-19 — Provider Availability is a toggle with auto-expiry after inactivity (window N) + per-job accept/decline; exact mechanism build-time tunable.
- §4.3 / FR-20 — SMS sent for provider job alerts only (cost control); per-SMS budget TBD.
- §4.3 / FR-22 — Concierge backstop is a manual admin workflow in v1; no-bid window build-time tunable.
- §4.3 / FR-21 — Response-time ETA is derived from observed Bid response times and not shown until a baseline exists.
- §4.4 / FR-9 — Default bid presentation surfaces reputation alongside price, not pure lowest-price sort.
- §4.5 / FR-12 — Resident marks completion; possible auto-prompt fallback after a set period.
- §4.6 / FR-24 — Pattern threshold/weighting for damaging disputes is a tunable rule set during build.
- §4.6 / FR-25 — The effect of low Resident Standing is a tunable rule; v1 may start by simply tracking it.
- §4.7 / FR-17 — Free trial is 2 months per Provider; flat fee amount is TBD.
- §4.7 / FR-18 — Subscription collected via a simple/manual method given the no-code build.

## 10. Constraints and Guardrails

**Platform.** Mobile app + web, built locally with code by the solo founder working with AI-agent tooling — **superseding the original Bubble no-code choice (decision 2026-06-12)**. Stack: **Supabase** (Postgres + row-level security + storage + Edge Functions; local dev via Docker) and an **Expo/React Native** mobile app (single role-switch binary), with Supabase Studio as the founder's admin surface until volume justifies more. A 2026-06 GitHub research pass (18 repos verified) confirmed no forkable open-source codebase implements the post-job → bids → award → reputation loop — the product is built on infrastructure blocks, not forked. Integrity rules move from Bubble workflows to database constraints (unique indexes, write-once RLS policies, server-side functions) — a strict upgrade. Real-time remains intentionally degraded to **pull-based refresh + push notifications** (SMS added post-POC). Scope discipline is now self-imposed rather than platform-imposed. (See the architecture document for the data model and integrity rules; the POC spec for the current build order.)

**Privacy & data (Safety).** The platform stores sensitive identity data (CNIC number, selfie). Guardrails: this data is admin-only, never shown publicly on profiles, used solely for Verification, and stored with access restricted to the founder/admin. `[NOTE FOR PM: confirm a basic retention/handling stance before launch — even a passion project handling national ID data should be deliberate.]`

**Cost.** Single-founder economics: running costs must be coverable by Subscription revenue (SM-5). Avoid features that introduce per-job platform cost (e.g., payment processing) in v1.

**Operational.** Verification, Dispute resolution, and the empty-marketplace **concierge backstop** (FR-22) are **founder-operated manual processes** in v1. Acceptable at small single-community scale; a known throughput constraint as volume grows.

**Localization & Accessibility (Urdu/English, low-tech users).** Lock now (cheap to set, costly to retrofit): **Western Arabic numerals (1, 2, 3) app-wide** for all PKR amounts and times (never mixed with Eastern Arabic-Indic digits); currency always reads **`Rs 1,500`** (never a bare number or `$`); **status labels paired with a fixed Urdu translation** in one table (no drift across the three apps); **icon + text, never icon alone** for statuses and Adab scores; generous tap targets for budget Android one-thumb use. Empty states must reassure (not blame the user), and "panic-moment" notifications (cancellation, dispute, no-response) use a calm, human tone with a clear next step.
