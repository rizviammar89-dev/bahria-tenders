# PRD Quality Review — Bahria Town Karachi Home-Services Marketplace

## Overall verdict

This is a strong, unusually disciplined passion-project PRD. It has a real thesis (persistent provider reputation as the trust moat a national app structurally can't build), and nearly every feature, metric, and journey traces back to it. FRs are testable, the Glossary is doing real load-bearing work, and assumptions are honestly tagged and indexed. The verdict is **PASS-WITH-FIXES**: the only items that meaningfully need attention before downstream UX/architecture/epics work are a few cross-reference and consistency nits — none of them block the work, but two could quietly mislead an implementer if left as-is. The FR numbering is complete and unique (all of FR-1..FR-25 present, no gaps, no duplicates), just deliberately out of document order where features were inserted late.

## Decision-readiness — strong

A builder or future collaborator could act on this today. Choices are stated as decisions, not hedged: cash-only/offline payment, single broadcast flow (no Rescue/Court split), flat subscription as the sole revenue line, manual founder-mediated verification and disputes. Trade-offs are named honestly with what was given up — e.g. the 2-month free trial is explicitly chosen *over* charge-from-day-one and indefinitely-free (addendum §Cold-Start Pricing), and the no-code platform cap in §10 names what it rules out (real-time mapping, 3D, face-match). Open Questions (§8) are genuinely open and each is tied to FRs; none are rhetorical. The `[NOTE FOR PM]` callouts land at real tensions (the deferred Design Studio in §6.2; the CNIC-retention stance in §10), not at safe checkpoints.

### Findings
- **low** Targets largely TBD (§7) — Most Success Metrics say "Target TBD once baseline exists." Appropriate for a pre-launch solo project, but SM-1/SM-3 will need a number before they can gate anything. *Fix:* note these will be set after the first cohort; no change needed pre-build.

## Substance over theater — strong

Very little furniture. There are exactly two personas (Ayesha, Bilal) and both drive concrete FRs and edge cases rather than padding the doc. The differentiation claim (persistent reputation + hyper-local density) is the actual product thesis, not a template section. NFRs are product-specific and bounded where it matters (CNIC/selfie admin-only, restricted access, used solely for verification — §4.1, §10) rather than boilerplate "must be secure." The Vision (§1) could not be swapped into another category PRD — it is specifically about a gated-community trust moat.

### Findings
*(none — dimension is strong.)*

## Strategic coherence — strong

The PRD has a clear thesis and the feature arc serves it: onboarding/verification (light gate, strong net) → the reputation engine (called out as "the heart of the product") → broadcast/matching → compare-on-reputation → rating/Adab → dispute/recourse → subscription. Prioritization follows the thesis, not ease — the dispute fairness model and Adab Score are harder to build than they are central, and they're in v1 because they *are* the trust loop. Counter-metrics are present and pointed: SM-C1 explicitly guards against cheapest-bid-wins resurrecting the race to the bottom, and SM-C2 guards against loosening verification for growth. This is the rare passion-project PRD that reads as a bet, not a backlog.

### Findings
*(none — dimension is strong.)*

## Done-ness clarity — strong (with two soft spots)

Every FR carries at least one testable consequence, and most are genuinely verifiable (e.g. FR-1 "sign-up cannot complete without phone OTP, CNIC number, selfie, and at least one Trade"; FR-5 defines N precisely as "distinct Residents in that Precinct with a completed Job by this Provider"; FR-17 trial mechanics are concrete). There is almost no "handles gracefully / reasonable / user-friendly" hand-waving. Two consequences lean on adjectives an engineer can't test as written.

### Findings
- **medium** "Typical response-time indication" is undefined (FR-21) — The consequence "the Resident sees a count of who's online and a typical response-time indication" has no source for the time figure; UJ-1 shows it as "~X minutes." With no completed-job history at launch there is nothing to compute it from. *Fix:* state how the indicator is derived (e.g. static placeholder copy in v1, or "hidden until enough data"), or move it to Open Questions.
- **low** "Near-real-time" is unbounded (FR-8 consequences, §4.3, UJ-1) — Acceptable given the addendum already flags real-time as the hardest no-code piece and offers a short-interval-refresh fallback, but the FR itself states no bound. *Fix:* one line referencing the addendum's degradation path (short-interval refresh + push/SMS) as the acceptable v1 standard.
- **low** "Adab dimensions are lightweight (a few taps), not a long form" (FR-14) — mild adjective, but "three named dimensions, a few taps" is concrete enough to test. No action required.

## Scope honesty — strong

Omissions are explicit and repeated where a reader might otherwise infer them. §5 Non-Goals and §6.2 Out-of-Scope both list cash-only, no Design Studio, no two-mode flows, no automated CNIC, no multi-community, no crew — with rationale appended to each. Assumptions are tagged inline and the §9 index round-trips cleanly (see Mechanical notes). Open-items density is low and proportionate to the stakes (5 Open Questions, 10 indexed assumptions, 2 PM notes for a solo green-light-to-prototype doc) — well within tolerance.

### Findings
*(none — dimension is strong.)*

## Downstream usability — adequate (a few cross-ref fixes needed)

This PRD is chain-top (it feeds UX → architecture → epics), so traceability matters. The Glossary is present and the domain nouns are used consistently (see Mechanical notes). FR IDs are unique and complete. The main friction for a downstream extractor is FR document-order: FR-19..22 are physically inside §4.3 and FR-23..25 inside §4.6, so a reader scanning top-to-bottom hits 1-8, then 19-22, then 9-18 interleaved with 23-25. This is internally consistent and every cross-reference resolves, but it is non-obvious. The bigger concrete issues are below.

### Findings
- **medium** SM-1 cross-references a non-existent FR range (§7) — SM-1 cites "the core trust loop (FR-6…FR-14)." Read literally as FR-6 through FR-14 that span is fine, but the trust loop it describes (post → bid → compare → award → rate) actually runs FR-6, 7, 8, 20, 21, 22, 9, 10, 11, 12, 13, 14 — the broadcast/matching FRs (19-22) sit numerically outside the "6…14" range yet are part of the loop. An epics author taking "FR-6…FR-14" at face value would silently drop FR-19..22. *Fix:* either list the loop FRs explicitly or write "FR-6..14 plus FR-19..22."
- **low** UJ→FR coverage is implicit, not mapped — Features name which UJ they realize ("Realizes UJ-1, UJ-2"), but no reverse map says which FRs satisfy each UJ. Fine for now, but a UJ→FR table would help the UX/epics step. *Fix:* optional; add a short traceability table if convenient.
- **low** Distance shown in FR-9 vs no geolocation in v1 — FR-9 and FR-7 show "distance/Precinct," but §10 rules out "real-time mapping." Precinct-level proximity is plausibly computable without mapping, but the source of "distance" is unstated. *Fix:* clarify distance is Precinct-derived, not GPS, to avoid an architecture assumption.

## Shape fit — strong

The shape matches the product. This is a consumer / two-sided marketplace with meaningful UX, so named-protagonist UJs are load-bearing — and all four UJs (Ayesha ×2, Bilal ×2) carry persona + context inline and drive real edge cases (no-providers-online, bad-faith disputing, lost-bid). Rigor is calibrated light for a solo no-code build (manual verification/disputes accepted as a known throughput constraint, §10) without dropping the substance bar. Not over-formalized, not under-formalized.

### Findings
*(none — dimension is strong.)*

## Mechanical notes

**FR ID continuity.** All of FR-1..FR-25 are present exactly once; no gaps, no duplicates. Document order is non-sequential by design: FR-19..22 are nested in §4.3 (Job Posting & Matching) and FR-23..25 in §4.6 (Dispute & Recourse), inserted after the original 1-18 numbering was set. Every FR reference in §7, §8, and the addendum resolves to a real FR. *Recommend* a one-line note near §4 explaining the out-of-order numbering so downstream readers don't suspect a gap.

**Glossary drift.** Clean. Domain nouns (Provider, Resident, Job, Bid, Trade, Precinct, Reputation, Rating, Adab Score, Dispute, Resident Standing, Availability, Verification, Subscription) are capitalized and used identically across FRs, UJs, and SM definitions. Minor: Dispute outcome labels appear as "Legitimate–Remedied / Legitimate–Unresolved / Not Upheld" in the Glossary and "Legitimate – Remedied" (spaced en-dash) in FR-16; SM-4 refers to "Unresolved Disputes." Same concepts, slightly inconsistent punctuation/phrasing — harmless but worth normalizing.

**Assumptions Index roundtrip.** Solid. All 10 §9 index entries trace to an inline `[ASSUMPTION]` (FR-2, FR-4, FR-7, FR-19, FR-9, FR-12, FR-24, FR-25, FR-17, FR-18). One inline assumption — UJ-4's "verification is a quick manual/automated check… only Verified providers can win jobs" — overlaps the FR-2 index entry rather than being separately indexed; acceptable since FR-2 covers the same ground. No orphan index entries.

**UJ protagonist naming.** Every UJ has a named protagonist with inline context (Ayesha, Precinct 10, leaking tap; Bilal, 24, newcomer carpenter). No floating UJs.

**Required sections.** All expected sections present for a chain-top consumer PRD: Vision, Target User + JTBD + Non-Users + UJs, Glossary, Features/FRs, Non-Goals, MVP Scope, Success Metrics + counter-metrics, Open Questions, Assumptions Index, Constraints. Tech-how correctly offloaded to the addendum.
