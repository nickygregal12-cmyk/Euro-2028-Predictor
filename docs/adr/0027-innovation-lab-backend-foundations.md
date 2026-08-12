# ADR 0027 — Innovation Lab backend foundations

| Field | Value |
| --- | --- |
| Status | Accepted direction — partially implemented (contracts 175–178) |
| Date | 12 August 2026 |
| Decided by | Product owner |
| Supersedes | None |
| Superseded by | None |
| Related | [`../product/innovation-lab.md`](../product/innovation-lab.md) (candidate register), [0012](0012-season-predictor-rules.md) (season scoring), [0011](0011-multi-competition-platform.md) (separation), [0020](0020-football-prediction-hub-product-model.md) (ingestion), [0024](0024-development-environment-operating-model.md) (rollout) |

## Why this record exists

[`../product/innovation-lab.md`](../product/innovation-lab.md) says of itself:
**Authority: none — this document records candidates, not decisions.** Its own
promotion rule requires an idea to be moved into an ADR, the accepted
requirements register and the roadmap **before implementation begins**, and
requires the product, privacy and security decisions it depends on to be
recorded rather than taken by whoever writes the migration.

The owner authorised backend foundations for those candidates on 12 August 2026.
This record is the promotion that authorisation requires. Without it a reader
six months from now would find four contracts implementing a document that
declares itself non-authoritative, and no way to tell an owner decision from an
implementer's enthusiasm.

## Scope of the authorisation

The owner authorised **backend foundations that are safe, well-defined and
consistent with the existing architecture**, and explicitly separated repository
implementation from hosted rollout. It is not a blanket approval of the
register: an `INNOV-*` row still needs the product, privacy or security decision
its own guardrails name before anything is built for it.

Accordingly this ADR **classifies every candidate** rather than accepting them
all, and the classification is part of the decision. The register in
[`../quality/accepted-requirements.md`](../quality/accepted-requirements.md)
carries the row-level detail; the table there is the authority for status, and
this record is the authority for the reasoning.

## Decisions

### 1. Projections reuse the scoring authority; they never restate it

A what-if projection supplies **inputs** to ADR 0012's scoring rules — a
hypothetical score in place of a settled one — and never a rule. Contract 175
computes every point value through `predictor_internal.season_fixture_points`,
and `224_what_if_projection.sql` requires the projection to equal
`predictor_internal.season_matchweek_points` exactly over a fully played
matchweek, with and without a Joker.

A projection is never banked, never written and never presented as official.
Provisional provider state (contract 135's `season_fixture_live_state`) may be a
projection's basis, and the read states which basis each fixture used.

### 2. Derived player metrics are a server contract, not a browser derivation

Every metric in Prediction DNA is derivable in a browser, which is precisely the
problem: derived in three places it becomes three numbers. The denominators are
the feature, so a single server contract owns them and returns each rate **with**
its denominator and an explicit minimum-sample flag.

**Counting is not scoring.** No point value appears in a metrics function; how
often a prediction matched a result is a fact about predictions, and
`season_matchweek_scores` remains the only authority for what a matchweek was
worth.

### 3. The disclosure boundary for one player's data is a shared private league

Contract 151 established it and this ADR adopts it unchanged for every
player-comparison surface the Innovation Lab adds: **self always; otherwise a
shared private league on that season, and nothing weaker.** Sharing a competition
is not consent to be profiled by fifty thousand strangers; joining someone's
private league is a mutual act.

**No player directory.** A comparison read answers about one named player and
may not enumerate, search or rank the population.

### 4. The reveal boundary for a season is the matchweek's own lock

Contract 149 established it and this ADR adopts it unchanged. A season has no
single tournament-wide lock instant, so the boundary is the round's own,
resolved **server-side** with no client-supplied instant anywhere. Before the
lock a surface **hides rather than refuses** — a refusal is indistinguishable
from "you may not see this" — and hides completely, including whether a rival
has predicted at all.

### 5. "Favourite" is not derivable, so the metric says what it measures

The register asks for a favourite-backing rate. This platform holds no odds, and
deriving a favourite from a league table as it stood at kickoff would require a
history nothing stores. What it does own is what everybody else predicted, so
the metric is **agreement with the field** and **success when going against it**,
protected by contract 61's minimum cohort of ten and excluding any fixture where
no single outcome was strictly the most predicted. Excluded fixtures are
reported rather than dropped.

### 6. An integrity verifier must be able to disagree

A verifier that calls the implementation it verifies reports a green tick for
ever and is worse than none, because it looks like a control. Contract 178's
shadow scoring implementation is written from ADR 0012's rules directly, shares
no code with the scoring path, and a source assertion refuses to install a
verifier that names either canonical scoring function.

It has **no authority**: a disagreement is recorded as evidence and investigated.
Nothing corrects a banked total automatically, because an automatic correction
driven by a second implementation only moves the question of which one is right
somewhere nobody is looking.

### 7. Offline drafting changes no server rule

The server-side half was measured before anything was built: the version
trigger, the lock trigger and the absence of any caller-supplied instant were
already in place. What was missing was the **shape of the answer**. Contract 177
adds per-item outcomes and adds no write path: it submits through
`save_season_prediction` unchanged, and a source assertion refuses a
redefinition that writes the prediction table directly or grows a timestamp
parameter.

### 8. Candidates whose product or privacy decision is open are not built

`INNOV-003` (AI analyst), `INNOV-004`/`INNOV-007`/`INNOV-008` (the public
visibility family), `INNOV-005` (guest challenges), `INNOV-009` (messaging),
`INNOV-010` (wallet), `INNOV-015` (confidence) and `INNOV-021` (passkeys) each
depend on a decision this ADR deliberately does not take. The reasons are
recorded per row in the accepted-requirements register so a later session finds
a named blocker rather than an unexplained gap.

Two are worth stating here because the temptation to build them is strongest:

- **The public visibility family is one decision, not four.** A public spectator
  page, a share card, an embed widget and any later public surface must share a
  single opt-in visibility model and a single field allow-list. Building any one
  of them first would create the second public-league security system the
  register warns against, and the field allow-list is a privacy decision rather
  than an engineering one.
- **Confidence needs its scale defined before its column exists.** The register's
  own guardrail requires a clear statement of *what outcome is being calibrated*
  — the exact score, or the outcome — and that is a product decision. A nullable
  smallint added ahead of it would fix the wrong meaning in stored data.

### 9. Nothing here is a hosted change

Repository implementation and hosted rollout remain separate actions under
ADR 0024. Contracts 175 to 178 are additive and repository-only until an
authorised Development rollout applies and verifies them; Production promotion
needs its own owner authorisation naming that exact boundary.

## Consequences

- Four contracts land: 175 (what-if projection), 176 (prediction DNA), 177
  (offline draft reconciliation), 178 (shadow scoring verifier).
- Five new browser-or-server functions enter the deployment contract; one is
  `service_role`-only, one is competition-admin gated, three are ordinary
  authenticated reads or writes with their boundaries resolved internally.
- Two new `predictor_internal` tables hold the verifier's evidence. No public
  table is created and no browser role gains a table grant.
- No scoring, lock, settlement, progression, membership or reveal rule moves.
- `INNOV-023` is recorded as **already satisfied**: `get_my_actions` has
  returned an `unseen` count since contract 162, and adding a second counting
  read would be the duplicate authority the candidate's own guardrail forbids.
- `INNOV-024` is recorded as having **no backend dependency**.

## What would show this decision was wrong

- A projection and a banked total disagreeing about the same settled matchweek.
- A metric appearing on two surfaces with two values.
- The shadow verifier reporting zero mismatches on a season with a known scoring
  defect — which is why `227_shadow_scoring_verifier.sql` banks a deliberately
  wrong total and requires the verifier to name it.
- Any public or share surface shipping before the visibility model in decision 8
  exists.
