# Milestone 0 — Concierge Test Runbook (Phase 0)

**You are the backend.** No app, no code, no Bubble. You manually run the whole job loop for ~15–20 real jobs to answer one question: **should this product be built at all?**

---

## What you're testing (and the only 3 things that matter)

1. **Demand** — will residents actually *post a job* to you instead of doing what they do today (call a guy a neighbor recommended)?
2. **Through-the-platform** — will they transact *through your introduction*, or go around you / already have someone? (This is the disintermediation risk — watch it closely.)
3. **Trust/recourse matters** — when work is bad, does your involvement matter to them? Do good ratings change who they'd pick next time?

Everything in your PRD/architecture is downstream of these. If these fail, no amount of Bubble building saves it.

---

## What you need before you start

- **A WhatsApp number** to be the "concierge line."
- **~15–20 residents** you can reach (you said you can — Bahria Town WhatsApp groups + personal contacts).
- **A handful of seeded providers** across the common trades (plumber, electrician, A/C, carpenter — 2–3 each is plenty to start; you said you can recruit 20–30).
- **The intake** — either a Google Form (link below) or just WhatsApp Q&A.
- **The tracking sheet** (`tracking-sheet.csv` in this folder — open in Excel/Google Sheets).
- **The message templates** (`message-templates.md` in this folder).

> 💡 You do NOT need all 6 trades or all 20 providers to start. Begin with the 2–3 trades that have the most everyday demand (plumber, electrician, A/C) and a few trusted providers each.

---

## The loop (repeat per job)

1. **Recruit residents** — post the recruitment message in 1–2 Bahria Town WhatsApp groups + DM a few people directly. *"Need a plumber/electrician/AC tech? Message me — I'll find you a trusted one and get you quotes. Free."*
2. **Take the job** — resident sends trade + problem + precinct + preferred time (via form or WhatsApp). Log it in the sheet, assign a Job ID.
3. **Relay to providers** — text the matching seeded providers the job details; ask for **price + earliest availability**.
4. **Relay quotes back** — send the resident **2–3 quotes** with each provider's name + a short trust note ("Bilal, did 3 jobs for neighbours, very tidy").
5. **They pick** — resident chooses. For the **first ~5 jobs, stay in the middle** (you pass messages) so you can *observe* whether they'd rather deal direct. After that you can connect them directly.
6. **Job happens** — offline, cash, between resident and provider.
7. **Follow up (critical!)** — a day after, message/call the resident: rate the work **1–5**, the **3 Adab dimensions** (respect, cleanup, punctuality), and *"any problems?"*. Log everything.
8. **If bad → run the manual dispute** — contact the provider, ask them to make it right; note whether they did. *This is you testing whether recourse matters.*

---

## What to record (it's all in the tracking sheet)

Per job: who posted, trade, what they needed, which providers you contacted, quotes, who they picked, price, whether it completed, the rating + Adab scores, any issue + how it resolved, whether they **came back** (repeat), and whether anyone **referred a neighbour** (advocacy).

---

## The Go / No-Go decision (after ~15–20 jobs)

| Signal | GO (build it) | RETHINK |
|---|---|---|
| **Demand** | Residents posted readily once they knew you'd help | You had to beg; few posted |
| **Through-you** | They transacted through your intro | They kept going around you / "I'll just call him" |
| **Recourse** | When work was bad, your help mattered; ratings shaped next choice | Nobody cared about recourse or ratings |
| **Repeat** | At least a few came back for a 2nd job | One-and-done, no return |
| **Advocacy** | A neighbour got referred unprompted | Silence |

- **GO** → start building Epic 1 in Bubble with real confidence (and real early customers).
- **RETHINK** → you just saved yourself months of building. Figure out *which* signal failed and whether the concept or the wedge needs to change. (Cheaper to learn this now than after launch.)

---

## Honest limits of this test

- It **cannot** test on-platform *retention* / disintermediation long-term — that needs the real software-enforced recourse. So even a great result doesn't prove people will *stay* on the app once you step out. Go in clear-eyed.
- Keep it small and real. 15–20 *genuine* jobs beats 100 hypothetical "yes I'd use it" answers. Talk is cheap; a posted job is signal.

---

## Suggested 2–3 week cadence

- **Week 1:** line up providers; post recruitment messages; run your first 3–5 jobs (staying in the middle).
- **Week 2:** run another ~10 jobs; start capturing ratings + watching for repeats/referrals.
- **Week 3:** finish to ~15–20; review the tracking sheet against the Go/No-Go table; decide.
