# Addendum — Bahria Town Home-Services Marketplace Brief

Supporting depth that doesn't belong in the 1–2 page brief but matters for downstream work (PRD, architecture). Primary source: brainstorming session `_bmad-output/brainstorming/brainstorming-session-2026-06-07-1147.md` (24 ideas).

## Parked Phase-2+ Roadmap (post-v1)

Deliberately out of v1; sequence roughly by value and build difficulty:

1. **Two-mode architecture** — split the single flow into **Rescue mode** (emergencies: geolocation + live "provider arriving" screen + bid-with-time) and **Court mode** (planned projects: portfolio-led, multi-day competitive bidding).
2. **The 3D Design Studio** (headline differentiator) — resident designs a room within a **budget slider**; the design becomes the job spec; carpenters/interior designers bid to build it. Build path: crawl = 2D planner → walk = embed existing 3D SDK (Planner 5D / HomeByMe) → run = AR → cheat = "designer uploads 2–3 mockups" as a paid mini-bid. Pulls interior designers onto the platform.
3. **Tiered "package" bids** — Basic (fix only) / Standard (fix + warranty) / Premium (fix + parts + priority) for Court-mode jobs (borrowed from Fiverr).
4. **Rising Talent lane** — newcomers' first 3–5 jobs at a fair fixed rate, badged "New — verified skills," to solve cold-start without a race to the bottom.
5. **Gamified Trust Ladder** — progressive verification levels with streak/completion nudges (Duolingo/LinkedIn-style).
6. **Advanced safety** — Uber-style live-arrival face-match; declared/verified crew ("+1") so providers can bring vetted helpers without enabling bait-and-switch.
7. **Stickiness/retention** — proactive maintenance reminders (seasonal A/C servicing), a per-home maintenance history record.
8. **Monetize the design/renovation flow** — paid mockups, material/BOM lists, featured interior-designer placement, premium bid access.
9. **Manners economy** — expand the "Adab" score into a ranked axis with rewards ("Gentleman Pro" badge, premium-job access, lower subscription).

## Rejected / Scaled-Back Alternatives (with rationale)

- **Platform-funded money-back guarantee → REJECTED for v1.** A real financial liability a solo passion-project founder shouldn't carry. Replaced with reputational dispute resolution (provider must remedy; unresolved bad jobs hit reputation).
- **Bidding as the headline mechanic → DEMOTED.** Bidding solves price/choice, not the accountability problem; persistent reputation is the headline, bidding is a supporting selection step.
- **Parked cross-pollination patterns:** Airbnb "Superhost" badge, Foodpanda-style customer membership ("BahriaCare"), Bark/Thumbtack lead-credits — noted, not adopted yet.
- **Go-wide expansion (replicate to other communities) → DEFERRED.** Strategy is depth in Bahria Town first; the playbook can travel later.

## Key Constraints

- **Builder:** solo, non-technical founder; **v1 on a no-code platform.** This caps technical complexity — favors profiles/listings/ratings/payments/simple workflows; rules out (for now) real-time mapping, 3D rendering, and face-matching. Conveniently aligns with the tight v1 scope.
- **Market:** single gated community (Bahria Town Karachi). Supply (independent solo tradesmen) is the bottleneck — seed providers before residents.

## Personas (extended)

- **Resident household (decision unit):** housewife (deals with the problem, supervises, feels the post-job helplessness) + husband (controls payment, signs off bigger spends).
- **Provider:** independent solo tradesman ("Bilal") — skilled but invisible, no travelling reputation, no path to a first job vs. established names.
- **Partner:** building/society management — incumbent trust holder, potential channel for both residents and vetted providers.
