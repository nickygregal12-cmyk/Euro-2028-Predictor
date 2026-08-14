# Newcomer goal-transfer and coverage-regime guard — PREDECLARATION

**13 August 2026. Declared BEFORE any candidate was implemented or run.**
This document exists so the mechanism and the expected direction cannot be
written after the numbers are seen. It promotes nothing, changes no default and
records no result. Results, when they exist, go in a separate dated section that
must cite this file.

Its predecessor is the 13 August research log, which produced the two findings
this study acts on and no others:

* the Over/Under benchmark measured fixtures involving a club new to its
  division at **2.6× worse** against a real book (+0.0146 against +0.0057 for
  established fixtures), with expected-total errors reaching about half a goal;
* SCH 1718's catastrophic fold was traced to a **coverage regime break** —
  `*_known` indicators near zero but non-zero in training, then active across
  92.6% of test — with SL1 and SL2 falsifying the simpler "Scottish football is
  odd" reading.

---

## Study 1 — how should expected-goal state transfer across a division change?

### The mechanism, stated before measurement

A club's goal-rate features are built from `TeamState.recent`, `recent_home`,
`recent_away` and the season counters. `roll_season` resets the season counters
but **deliberately does not clear the deques**, so form survives a summer. That
is correct within a division and is the defect across one: a club promoted from
League One into the Championship enters August carrying League One goal rates,
and a relegated club carries the division above's.

Contract 188 fixed the *rating* half of exactly this: `roll_season` now shrinks
Elo toward `division_prior(self.division)` rather than toward the Premier
League's 1500 anchor. **Nothing performs the equivalent operation on the goal
level.** The model is therefore handed a club whose rating says "Championship
newcomer" and whose goal features say "League One promotion winner", and those
two statements are about different populations.

`TeamState.division_move()` already returns +1 promoted, −1 relegated and 0
otherwise, and is currently read only by regime detection. It is the selector
for every candidate below, which is what keeps them no-ops on established clubs
**by construction** rather than by a filter that could be got wrong.

### The predeclared candidates

Deliberately four, not a grid. Each names the quantity it changes.

| | Candidate | Rule |
| --- | --- | --- |
| **A** | `current` | No change. Carried rates cross a division move untouched. The control. |
| **B** | `prior_shrink` | For a club with `division_move() != 0`, shrink each carried goal-rate feature toward the **target** division's prior rate by a fixed λ, for the whole first season in that division. |
| **C** | `decaying_blend` | The same shrink with weight `w(n) = k / (k + n)`, `n` = matches played in the new division. Shrinkage fades as evidence accrues rather than being switched off on a chosen matchday. |
| **D** | `elo_informed` | Derive the carried rate from the club's division-anchored Elo instead of its own history. |

Division prior rates are computed **from training rows only**, per fold. A prior
that saw the test season would be leakage, and it would leak in the direction
that flatters the candidate.

### Expected direction — declared now, so a wrong prediction is visible

1. **B and C improve newcomer fixtures and are no-ops on established ones.**
   They touch no club with `division_move() == 0`. If an established-fixture
   delta appears at all, the implementation is wrong, not the football.
2. **C beats B.** The defect is largest early; B keeps shrinking after the club
   has supplied evidence, which discards information.
3. **Promoted effect ≥ relegated effect.** A promoted club's rates are too high
   for the strength it now faces *and* its opponents are stronger, so two errors
   compound. A relegated club has one.
4. **D loses to C.** Elo is a strength scale, not a goal scale; mapping it to
   goals introduces a second, unmeasured model inside a feature.

Prediction 4 is the one most likely to be wrong, and it is stated because D is
the candidate that would be most tempting to adopt on a good headline number.

### Metrics

Primary, on identical expanding chronological folds, all nine leagues:
**1X2 log loss**, with RPS and Brier beside it.

Diagnostic only, through the existing Over/Under benchmark: goal-total MAE,
Over-2.5 probability error, model−market gap on newcomer fixtures. **The
bookmaker is an external check, never an optimisation target** — no candidate is
selected on a market number.

### Strata

* promoted (`+1`) and relegated (`−1`) reported **separately**, never pooled;
* first 5 matches in the new division / first 10 / the rest of the season.

### The adoption rule, fixed before the first run

A candidate is adopted only if, over all nine leagues, it

* improves newcomer fixtures **beyond noise**, and
* is **not worse beyond noise** on established fixtures.

A candidate that improves newcomers and degrades established fixtures is
rejected, however large the newcomer gain. There is no tie-break on the market
diagnostic.

---

## Study 2 — a general coverage-regime guard

### The mechanism

A `*_known` indicator that is **constant** across the training window admits no
coefficient at all. One that is on for a handful of matches — SCH's training
coverage runs `0.000, 0.008, 0.017, 0.007, 0.011` — admits a badly determined
one, fitted on almost no support. That coefficient then multiplies a feature
active across 92.6% of the next season's rows. Near-zero, not zero, is the
dangerous state, and it is the state no existing check looks for.

### The rule

Predeclared and **general**: for each feature family, compute the effective
training support of its `*_known` indicator. Where support is below a declared
threshold, the family is treated as **unavailable** for that fit rather than
fitted on almost nothing.

Written against the family's measured support, never against a league name. A
rule containing `if league == "SCH"` is rejected on sight regardless of what it
scores — it would fix one fold and leave the mechanism live everywhere else.

### The falsification test, which is the real gate

The guard is acceptable only if it

* removes SCH 1718's catastrophic behaviour, **and**
* is effectively a **no-op in the other eight leagues**, whose histories contain
  the same kind of coverage break without the same harm.

A guard that improves SCH and moves the other eight is not adopted globally. The
all-nine delta is reported whichever way it falls.

---

## What this study will not do

* It will not tune on individual errors. Candidates are fixed above.
* It will not build an Over/Under selection engine. The 13 August benchmark
  found our disagreement with the book is model inertia, and that finding stands.
* It promotes no model. Promotion stays a human decision with its own evidence.
