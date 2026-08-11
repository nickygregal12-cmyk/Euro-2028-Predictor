# Product Innovation Lab

**Status:** exploratory product opportunity register  
**Authority:** none — this document records candidates, not decisions  
**Owner:** product owner  
**Last reviewed:** 11 August 2026  
**Implementation effect:** none  

> **Core roadmap makes the product complete. Innovation Lab makes it distinctive.**
>
> Nothing in this document is approved implementation scope merely because it is written here. Innovation work must not delay the active weekly-product programme unless the owner explicitly promotes an idea because its expected value justifies changing the sequence.

## Purpose

The active roadmap, accepted-requirements register and ADRs already cover the work needed to finish the weekly football prediction platform. This document serves a different purpose: preserve high-potential ideas that could make the finished product unusually engaging, social, trustworthy or convenient without allowing speculative ideas to leak into the active backlog.

The candidates below were deliberately generated outside the existing roadmap. They are not substitutes for current Alpha work, provider correctness, privacy work, production readiness or the accepted Euro 2028 return plan.

## Status model

Every `INNOV-*` idea has one of four states:

- **Explore** — interesting but still too vague, risky or dependent on unknowns to be a serious candidate.
- **Candidate** — worth a future product workshop or bounded prototype; still not approved scope.
- **Accepted** — owner has explicitly accepted the product direction and it has been promoted into the appropriate decision/requirements/roadmap authorities.
- **Parked / Rejected** — intentionally not being pursued unless a later owner decision reopens it.

An idea may move from **Candidate** to implementation only when all of the following are true:

1. the owner explicitly accepts it;
2. any required product, privacy, security, legal or provider decision is recorded in the appropriate authority;
3. dependencies and data requirements are identified rather than guessed;
4. the idea has been checked against existing accepted requirements so it does not duplicate or contradict them;
5. it is promoted into the appropriate ADR / accepted requirement / roadmap entry before implementation begins;
6. its experiment or acceptance evidence is defined in advance.

`INNOV-*` identifiers are permanent and never reused. Promoting an idea does not delete it from this register; the row records where it moved.

## Evaluation principles

Innovation candidates should earn their complexity. Prefer ideas that create one or more of these effects:

- materially increase weekly return behaviour;
- make private competition more social or more fun;
- create a distinctive reason to choose this product over a generic score predictor;
- improve trust in locked predictions, scoring or provider data;
- remove recurring friction from a high-frequency phone journey;
- create an organic acquisition/distribution loop;
- reuse authoritative data the platform already owns rather than creating a second truth;
- degrade safely when an optional browser/platform capability is unavailable.

Innovation must never weaken the product's existing boundaries. In particular:

- projections are never official scoring;
- AI may explain or summarise verified facts but never become the authority for competitive facts;
- no social feature may reveal predictions earlier than the server-owned reveal rule;
- no offline feature may pretend a local draft reached the server;
- no public/share feature may expose private profile or league data without an explicit visibility model;
- no experimental feature may create a parallel scoring, lock, membership, settlement or result authority.

---

# A. Signature product experiences

## INNOV-001 — What-If Live Simulator

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Live engagement; private-league drama; differentiation |
| Best timing | After the weekly Match Centre has reliable live-result invalidation and league consequence reads |
| Core question | **What does the next goal / current score mean to me?** |

For a live fixture, show the player's projected competitive consequence if the current score became final and optionally the bounded effect of the plausible next scoring branch.

Example: `Liverpool 1–1 Arsenal · 72'` → current projected points/rank; `Liverpool score` → the player's 2–1 becomes exact and they project to first; `Arsenal score` → a rival's 1–2 becomes exact and the gap grows.

**Guardrails**

- Always labelled projection / what-if, never official points.
- Uses the canonical scoring authority and server-readable post-lock predictions; no reimplementation of scoring rules inside a component.
- Never exposes another player's still-hidden prediction.
- A provider-live score remains provisional until the existing official-result path confirms it.

**First experiment:** one seeded private Match Predictor league with a live fixture and three players whose ranking branches visibly differ.

---

## INNOV-002 — Prediction DNA

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Personalisation; retention; shareability |
| Best timing | Once durable season prediction history is available |

Build a deterministic profile of how a player predicts: favourite-backing tendency, draw frequency, upset success, average predicted goals, home/away bias, most-used scoreline, exact-score tendency and team-specific patterns.

The output should feel like a recognisable forecasting style rather than an invented personality assessment.

**Guardrails**

- Derived only from the player's recorded predictions/results.
- No psychological claims.
- Presentation-only; never changes points, rank or matchmaking.
- Metrics with too little sample size say so rather than pretending confidence.

**First experiment:** calculate five transparent metrics for one complete seeded season and compare two players side-by-side.

---

## INNOV-003 — Personal AI Matchweek Analyst

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Personal insight; makes accumulated data understandable |
| Best timing | After player history, league comparison and football-insight reads are stable |

Provide a constrained natural-language analyst over verified structured data. It should answer questions such as:

- Why did I drop six places this week?
- Which teams am I worst at predicting?
- How am I doing compared with Craig?
- Where did I differ most from the field?
- What has improved over my last six matchweeks?

**Guardrails**

- Retrieval/tool output supplies the facts; the model explains them.
- Competitive facts displayed alongside or linked back to deterministic values.
- Never invent unavailable causality or statistics.
- No direct database authority, scoring writes, result confirmation or admin action.
- Privacy review before any third-party model receives personal competitive context.

**First experiment:** a fixed set of five questions over seeded data with expected factual assertions checked independently of generated prose.

---

## INNOV-004 — Public Spectator League Pages

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Sharing; acquisition; league identity |
| Best timing | After private league UX and visibility/privacy rules are mature |

Allow a league owner to opt a league into a polished public, read-only spectator page containing safe standings, weekly winner/movement and post-reveal prediction summaries.

Every public league page becomes a potential acquisition surface with a clear `Create your own predictor` path.

**Guardrails**

- Explicit opt-in visibility model; private remains the default.
- No email, auth identifiers or otherwise private profile data.
- Prediction reveal follows the same server rule as signed-in surfaces.
- Public read is bounded and cannot be used to enumerate private leagues.

---

## INNOV-005 — Single-Match Friend Challenges

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Low-friction viral acquisition |
| Best timing | After invitation/auth continuation is reliable |

Create a challenge link around one fixture rather than requiring a full private league. A recipient can make a bounded guest prediction, then optionally create an account to retain the challenge/history and continue playing.

**Guardrails**

- Challenge is separate from official season-game membership unless the user explicitly joins.
- Hidden challenger prediction remains hidden until the correct reveal point.
- Abuse/rate-limit design required before public launch.
- Guest state must have an explicit expiry/retention model.

**First experiment:** one fixture, one challenger, one guest response, one post-lock reveal and one optional account-conversion path.

---

## INNOV-006 — Matchday TV / Party Mode

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Social viewing; private-league differentiation |
| Best timing | After live league consequence data is stable |

A large-screen, read-only route designed for a television/monitor while a group watches football: live fixture, current league, revealed predictions, biggest movers and what-if consequence cards rotate automatically.

**Guardrails**

- No write controls or personal-account administration on the shared screen.
- Uses only data visible to the signed-in host / public spectator scope chosen for the mode.
- Stops/softens animation under reduced motion.
- Rotation never hides the fact that provider-live information is provisional.

---

# B. Social, acquisition and distribution

## INNOV-007 — Dynamic Share Cards and Smart Link Previews

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Organic acquisition; premium sharing |

Generate safe, branded Open Graph/share images for league wins, matchweek recaps, exact-score streaks, post-lock predictions, H2H comparisons and season achievements.

**Guardrails**

- Share payload is generated from a versioned allow-list of fields.
- No pre-reveal competitive information.
- No private league/person data unless the user is authorised to share that exact surface.
- Every card links back to a meaningful destination, not a generic home page.

---

## INNOV-008 — Embeddable League Widgets

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Distribution through offices, supporters' clubs and community sites |

Offer a compact read-only widget for leagues that are explicitly public: standings, current matchweek winner and next lock, with a link back to the full product.

**Guardrails:** same public-visibility contract as `INNOV-004`; strict origin/CSP/rate-limit review; no browser write authority.

---

## INNOV-009 — Messaging-Platform League Companion

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Put league information where groups already talk |

Provide bounded integrations such as Discord commands/webhooks for table, next deadline and completed-matchweek summaries; assess other messaging platforms only under their current platform and business-message rules.

**Guardrails**

- Read/notification companion first; no prediction writes through chat in the initial design.
- Explicit league-owner setup and revocation.
- Secrets remain server-side.
- Platform-specific privacy and delivery terms reviewed before production.

---

## INNOV-010 — Predictor Wallet Pass

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5 potential; experimental** |
| Value | Premium delight; quick-glance rank/deadline information |

Offer an optional wallet pass showing a bounded summary such as competition, player display name, rank context and next deadline, refreshed as the season moves.

**Guardrails:** optional convenience surface only; stale/update-failure state must be obvious; no sensitive data on the lock screen by default; platform review before commitment.

---

# C. Competitive depth and retention

## INNOV-011 — Community Divergence / Contrarian Insight

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Makes anonymous consensus personally meaningful |

After reveal, show how unusual the player's choice was: `Only 11% backed Chelsea`; `your scoreline was in the boldest 8% of picks`; `contrarian win` when a low-consensus result lands.

**Guardrails:** aggregate minimum cohort sizes; no inference about named individuals; no reveal before the existing aggregate/reveal rule permits it.

---

## INNOV-012 — League Side Honours

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Keeps more league members engaged when they are out of the title race |

Add deterministic secondary honours such as Exact Score King, Form Player, Biggest Mover, Draw Specialist, Goals Guru, successful Contrarian and Comeback of the Season.

**Guardrails**

- Never alter official points/table order.
- Every honour has a published deterministic definition and tie behaviour.
- Avoid humiliating/negative labels by default; any playful wooden-spoon treatment requires league-level product review.

---

## INNOV-013 — Prediction Archaeology

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Turns historical data into an explorable product rather than a dead archive |

For an old fixture, show the player's prediction, final score, revealed community distribution, safe league context and what the settled match changed at the time where historical movement data supports it.

**Guardrails:** historical truth only; never reconstruct rank movement by guessing if immutable evidence is absent.

---

## INNOV-014 — Alternate-Season / Closest-Miss Analysis

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | End-of-season exploration and shareable statistical stories |

Analyse nearest misses and counterfactuals without presenting them as official standings: one-goal-away exacts, late goals that changed a scoreline, theoretical points under explicitly stated hypothetical rules and similar retrospective views.

**Guardrails:** hypothetical output visually separated from real season records; never rewrites history or official ranking.

---

## INNOV-015 — Prediction Confidence and Calibration

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Adds real forecasting depth without touching game scoring |

Let a player optionally record confidence in a prediction. Over time show whether `80% confident` selections really succeed more often than `40% confident` selections and how calibration differs by team/market/context.

**Guardrails:** no impact on points; optional; clear definition of what outcome is being calibrated; enough sample size before drawing conclusions.

---

## INNOV-016 — Personal Matchday Briefing

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | A single glance that joins actions, football and competitive context |

A concise in-product briefing such as: today's fixtures, incomplete predictions, first lock, current private-league gap and one or two genuinely relevant football/context facts.

This is not another Home redesign. It is a reusable daily summary that could later feed safe notification/email surfaces from the same deterministic model.

---

# D. Trust, integrity and data quality

## INNOV-017 — Cryptographic Prediction Receipts

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Strong trust that locked predictions were not edited after the deadline |

Create a receipt/commitment for a submitted prediction set so the platform can later prove that the revealed picks correspond to the pre-lock submission without exposing them early.

**Guardrails**

- Cryptographic design requires proper review; do not invent a home-grown scheme casually.
- Receipt supplements the authoritative database audit trail; it does not replace it.
- No public commitment should leak low-entropy hidden predictions through a guessable hash construction.

**Best timing:** before meaningful prizes or broader public trust makes tamper allegations materially important.

---

## INNOV-018 — Independent Shadow Scoring Verifier

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Detect silent correctness bugs where every job succeeds but the points are wrong |

After settlement, an independent read-only verifier recalculates expected scoring and compares it with the official banked output. Any disagreement produces an integrity alert and changes nothing automatically.

**Guardrails**

- No write authority.
- Independence matters: it must not simply call the exact same function and declare agreement.
- The canonical scoring implementation remains the only authority; disagreement triggers investigation rather than automatic correction.
- Differential fixtures/mutants must prove the verifier can actually disagree when one implementation is wrong.

---

## INNOV-019 — Football Data Anomaly Sentinel

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Detect suspicious provider changes before they become player-facing truth |

Add cross-provider and domain-plausibility checks around ingestion: unexpected kickoff jumps, result changes after final, overlapping fixtures for one team, disappearing fixtures, standings that do not reconcile with results, three providers agreeing against one, implausible identity churn and similar anomalies.

**Guardrails**

- Anomaly score is evidence, not official football truth.
- Never auto-confirm a result/change merely because a majority of providers agree.
- Reuse the staged/reviewed provider-change model rather than creating a second publication path.

---

# E. Convenience and premium product polish

## INNOV-020 — Offline Prediction Drafting

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Mobile resilience on trains, stadiums and poor connections |

Allow pre-lock prediction edits to be stored as an explicitly local draft when offline, then offer submission when connectivity returns.

**Guardrails**

- UI must always distinguish `saved on this device` from `submitted`.
- Server lock/version rules remain absolute.
- Reconnection after a lock may refuse some/all drafts; the client never backdates them.
- Conflict handling is explicit when another device has submitted a newer server version.

---

## INNOV-021 — Passkeys / Biometric-Friendly Sign-In

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Remove repeated password friction from a high-frequency phone product |

Assess passkeys/WebAuthn as an additional authentication method so returning users can use device biometrics/PIN rather than repeatedly handling passwords.

**Guardrails:** Auth architecture/support must be measured against the current Supabase capability and recovery model before any decision; existing account/recovery routes remain available until migration evidence proves otherwise.

---

## INNOV-022 — Personal Calendar Subscription

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5** |
| Value | Prediction deadlines and relevant fixtures appear in the user's normal calendar |

Offer a private subscribed calendar feed containing selected competition fixtures and game deadlines. Fixture changes update through the subscription rather than requiring the user to import a static file repeatedly.

**Guardrails:** revocable unguessable feed token; no prediction values/private league data in calendar events; timezone follows calendar standards and the user's calendar client.

---

## INNOV-023 — Outstanding-Action App Badge

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5 when supported; progressive enhancement** |
| Value | At-a-glance signal that predictions/actions still need attention |

For an installed web app on supporting platforms, badge the icon with the bounded number of server-derived outstanding actions.

**Guardrails:** optional progressive enhancement; browser support must never be required for action discovery; count comes from the same action authority as `/play` rather than a client-side duplicate.

---

## INNOV-024 — Native-Feeling View Transitions

| Field | Value |
| --- | --- |
| Status | **Candidate** |
| Impact | **5/5 for polish when used selectively** |
| Value | Preserve context and make the premium desktop/phone product feel cohesive |

Use the platform View Transition capability selectively for high-value transitions such as a fixture card expanding into Match Centre or a competition context change.

**Guardrails:** progressive enhancement; no navigation depends on animation; reduced-motion respected; performance evidence required on representative phones; no return to whole-page scroll/animation gimmicks.

---

# Candidate portfolio view

## Potential signature differentiators

1. `INNOV-001` What-If Live Simulator
2. `INNOV-002` Prediction DNA
3. `INNOV-003` Personal AI Matchweek Analyst
4. `INNOV-004` Public Spectator League Pages
5. `INNOV-005` Single-Match Friend Challenges
6. `INNOV-006` Matchday TV / Party Mode
7. `INNOV-011` Community Divergence / Contrarian Insight

These deserve the first future product workshops because they could create a reason to prefer this predictor rather than merely making an already-complete predictor nicer.

## Invisible competitive advantage

1. `INNOV-017` Cryptographic Prediction Receipts
2. `INNOV-018` Independent Shadow Scoring Verifier
3. `INNOV-019` Football Data Anomaly Sentinel
4. `INNOV-020` Offline Prediction Drafting
5. `INNOV-021` Passkeys / biometric-friendly sign-in

These are less visible in screenshots but could make the product unusually trustworthy and dependable.

## Organic distribution candidates

1. `INNOV-004` Public Spectator League Pages
2. `INNOV-005` Single-Match Friend Challenges
3. `INNOV-007` Dynamic Share Cards
4. `INNOV-008` Embeddable League Widgets
5. `INNOV-009` Messaging-Platform League Companion

Treat these as one acquisition family during future evaluation so they do not each invent a different visibility/share model.

# Suggested future evaluation order

When the core weekly product is sufficiently settled to spend time on differentiation, evaluate candidates in small workshops rather than accepting the whole register at once:

1. **What-If Live Simulator** — strongest candidate for a signature live feature.
2. **Prediction DNA** — high personal/share value from data the product naturally accumulates.
3. **Public spectator page + single-match challenge** — test whether private competition can become an acquisition loop.
4. **Matchday TV Mode** — test with a seeded private league on a large screen.
5. **Shadow scoring + anomaly sentinel** — evaluate as integrity controls before larger cohorts/prizes.
6. **AI Analyst** — only after deterministic player/league/history reads are sufficiently complete that the model can explain rather than guess.

This sequence is advisory only. It does **not** alter `docs/roadmap.md`.

# Deliberately not carried forward

A personalised generated **audio matchweek recap** was considered during the same ideation session and deliberately not retained as a candidate. The owner considered it too much for this type of site relative to the value/complexity. A later decision may revisit audio if the product context changes, but future sessions should not rediscover it and assume it was simply forgotten.
