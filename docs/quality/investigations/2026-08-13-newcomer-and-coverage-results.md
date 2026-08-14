# Newcomer goal-transfer and coverage-regime guard — RESULTS

**13 August 2026. Dated evidence at its recorded commit. Promotes nothing.**

Design, candidates, strata, metrics and adoption rules were fixed in
[`2026-08-13-newcomer-goal-transfer-predeclaration.md`](2026-08-13-newcomer-goal-transfer-predeclaration.md),
committed at `e26961b0` **before** any candidate existed. Nothing in this file
re-scopes them.

Every run is read-only against hosted Development through `ai-lab.yml`
`task=research`, which exports `AI_READ_ONLY=1`, opens the session with
`default_transaction_read_only=on` and contains no provider script. **Zero
provider calls, zero rows written, zero models promoted.**

---

## 0. The measurement that mattered most was a defect in the measurement

The first real-data run (**31751093115**, ECH, at `917ec0d0`) returned
`"not measurable on these folds"` for all three candidates. That verdict was
correct and the reason was a bug in the study, not a property of football.

`division_move_into` compared the fixture's division against
`TeamState.division` — the division of the club's **most recent match**.
`observe` advances that field after the club's first match in the new tier, so
the flag was true for exactly **one fixture per club per season**:

| | ECH, whole archive |
| --- | --- |
| rows | 7,692 |
| flagged `newcomer` | **71** |
| flagged `newcomer_later` | **0** |
| newcomer fixtures the Championship actually holds | ~270 **per season** |

The 20-test offline suite passed throughout, because every assertion in it
asked only whether *something* changed, never *how many things*. The fix
compares against `previous_division`, which `roll_season` fixes for the whole
season. Two counting assertions now exist and are mutation-checked: restoring
the old comparison fails exactly those two and nothing else.

**This is the finding to keep from the pilot.** A synthetic fixture cannot
produce it: six clubs and one promotion look identical under both spellings for
the first match, and the suite never counted the rest.

---

## 1. Newcomer goal transfer — all nine leagues

Run **31751419023**, family `poisson`, expanding chronological folds,
`DEFAULT_GROUPS`, half-life 900d.

Newcomer-stratum change against the control, in log loss. **Negative is
better.** `*` clears noise, `!` is worse beyond noise.

| league | rows | newcomer | `prior_shrink` | `decaying_blend` | `elo_informed` |
| --- | ---: | ---: | ---: | ---: | ---: |
| EPL | 5,290 | 1,405 | +0.00004 | **−0.00035 \*** | −0.00056 |
| ECH | 7,692 | 3,198 | −0.00011 | +0.00000 | −0.00046 |
| EL1 | 7,539 | 3,546 | +0.00015 | +0.00009 | +0.00039 |
| EL2 | 7,603 | 3,137 | +0.00015 | +0.00017 | +0.00028 |
| ENL | 7,493 | 1,064 | −0.00024 | −0.00031 | −0.00027 |
| SPL | 3,136 | 627 | −0.00038 | −0.00048 | −0.00052 |
| SCH | 2,427 | 1,160 | **+0.00259** | **+0.00354** | **+0.00393** |
| SL1 | 2,404 | 1,259 | +0.00014 | +0.00008 | +0.00046 |
| SL2 | 2,402 | 728 | +0.00125 | +0.00056 | +0.00274 |

**One newcomer-stratum result in twenty-seven clears noise** — EPL under
`decaying_blend`, −0.00035 ± 0.00015 — and the same policy is *worse beyond
noise* on EPL's established fixtures (+0.000103 ± 0.000046). The predeclared
adoption rule rejects it on the second condition, which is exactly the case
that rule was written for.

Across all nine leagues, three policies and eight strata — 189 cells — **6
improve beyond noise and 2 are worse beyond noise.** At roughly a one-standard-
error threshold that is what a null result looks like.

### Promoted against relegated

The split is structurally determined and the study reports it that way: a club
arriving in a pyramid's **top** flight can only have been promoted (EPL, SPL
show `relegated = 0`), and one arriving in its **bottom** tier can only have
been relegated (ENL, SL2 show `promoted = 0`). Only the four middle divisions
carry both.

| league | promoted rows | relegated rows | best promoted Δ | best relegated Δ |
| --- | ---: | ---: | ---: | ---: |
| EPL | 1,405 | 0 | −0.00056 | — |
| ECH | 1,716 | 1,716 | **−0.00111 \*** (`elo_informed`) | −0.00006 |
| EL1 | 2,164 | 1,685 | +0.00006 | −0.00016 |
| EL2 | 1,176 | 2,161 | +0.00014 | +0.00008 |
| ENL | 0 | 1,064 | — | −0.00031 |
| SPL | 627 | 0 | −0.00052 | — |
| SCH | 677 | 580 | +0.00521 | +0.00130 |
| SL1 | 724 | 674 | +0.00003 | −0.00010 |
| SL2 | 0 | 728 | — | +0.00056 |

**Predeclared prediction 3 — "promoted effect ≥ relegated effect" — is not
supported.** The one direction result that clears noise is ECH promoted under
`elo_informed`, and ECH's newcomer stratum as a whole does not clear noise for
that policy, so it does not survive as evidence for the mechanism.

### First 5 / first 10 / later

| policy | first 5 | first 10 | later |
| --- | --- | --- | --- |
| `prior_shrink` | 1 of 9 leagues thick enough | 4 of 9 | 9 of 9 |
| `decaying_blend` | 1 of 9 | 4 of 9 | 9 of 9 |
| `elo_informed` | 1 of 9 | 4 of 9 | 9 of 9 |

**The first-5 window is mostly unanswerable, and that is a finding rather than
a gap in the run.** Only EL1 carries ≥30 first-5 rows per fold, and there the
effect is the *worst* in the table (`elo_informed` +0.00223, worse beyond
noise). The predeclared expectation that the defect is concentrated early
therefore cannot be confirmed — and the one place it can be measured points the
other way.

### Verdict against the predeclared adoption rule

**No candidate is adopted. `NEWCOMER_TRANSFER_DEFAULT` stays `current`.**

| candidate | verdict, by the rule fixed before the run |
| --- | --- |
| A `current` | control |
| B `prior_shrink` | **no change** — newcomer gain within noise in 9 of 9 |
| C `decaying_blend` | **rejected in EPL** (degrades established), no change elsewhere |
| D `elo_informed` | **no change** — newcomer gain within noise in 9 of 9 |

Predictions 2 (C beats B) and 4 (D loses to C) are both **unsupported**: the
three policies are indistinguishable from each other and from the control.

**SCH is the one league where all three policies are clearly harmful**
(+0.0026 to +0.0039 on the newcomer stratum, and worse still on promoted clubs
at +0.0052 to +0.0072). SCH is also the league with the coverage-regime defect.
That the goal-transfer policies make it *worse* is consistent with the 13
August diagnosis that SCH's problem is a feature-support break rather than a
promotion-transfer one — and is a reason not to reach for this mechanism there.

The measured 2.6× newcomer penalty against the bookmaker is therefore **real
but not addressable by transferring goal rates at the division boundary.**
Whatever produces it is not the carried rate.

### Where the predeclaration was wrong

Prediction 1 said an established-fixture delta "means the implementation is
wrong, not the football". **That was too strong and is corrected here rather
than quietly dropped.** A transfer policy alters newcomer rows in the
*training* window as well as the test window, so the fitted model differs, so
established test predictions differ too. The correct statement is that the
established delta must be *orders of magnitude smaller* than the newcomer one
and must not clear noise — which is what the adoption rule already tests.

And the corrected statement still does not hold as cleanly as hoped: measured
across all nine leagues the established deltas are of order **1e-4**, the *same
order* as the newcomer deltas they are supposed to be dwarfed by. The 1e-6
figure came from the buggy pilot, where only 71 rows were ever treated.

That is itself informative. A transfer policy changes the fitted model about as
much as it changes the predictions it was aimed at, so its effect is largely
redistribution rather than correction — which is the most likely reason the
newcomer gains do not clear noise.

---

## 2. Coverage-regime guard — all nine leagues

Run **31751424020**, floor `COVERAGE_SUPPORT_FLOOR = 0.05`, applied per
fold, `core` protected.

| league | folds | guard fired | mean Δ | verdict |
| --- | ---: | --- | ---: | --- |
| EPL | 9 | never | 0.0 | untouched |
| ECH | 9 | never | 0.0 | untouched |
| EL1 | 9 | never | 0.0 | untouched |
| EL2 | 9 | never | 0.0 | untouched |
| ENL | 9 | never | 0.0 | untouched |
| SPL | 9 | never | 0.0 | untouched |
| **SCH** | 9 | **1718** | **−0.02830** | **catastrophe removed** |
| SL1 | 9 | 1718 | **0.0** | fired, changed nothing |
| SL2 | 9 | 1718 | **0.0** | fired, changed nothing |

### SCH 1718, the fold that motivated it

The fold that motivated the whole study, and the guard removes it:

| | SCH 1718 |
| --- | --- |
| training support, `shots_volume` / `corners` | **0.0085** |
| test support, same families | **0.925** |
| control log loss | **1.30312** |
| guarded log loss | **1.04841** |
| change | **−0.25471** |

1718 was the largest single league-season calibration error anywhere in the
nine-league table. Guarded, it lands at 1.0484 — **inside the range of SCH's
own other eight folds** (1.017 to 1.097) rather than half a nat outside it.

The paired-fold statistic reports `beats_noise: false`, and that is correct
rather than a disappointment: one fold moving out of nine cannot clear a
paired test over nine, and the standard error equals the mean for exactly that
reason. **The evidence here is the fold, not the mean.**

### The falsification half

This is the half that decides whether the rule is general, and it passes in the
strongest available form.

* **Six leagues — EPL, ECH, EL1, EL2, ENL, SPL — the guard never fires at all.**
  Every fold's log loss is byte-identical to the control and `mean_delta` is
  exactly `0.0`.
* **SL1 and SL2 fire on the same 1718 break and change nothing.** Control and
  guarded log loss agree to all seventeen significant figures
  (SL1 `0.9934835963887985` both ways; SL2 `1.0283209671766476` both ways).

That second bullet is the mechanism confirming itself. SL1 and SL2 carry
training support of **exactly 0.000**, and a constant column admits no
coefficient at all — so dropping it is provably a no-op, and the measurement
shows precisely that. SCH carries **0.0085**: near zero but *not* zero, which
admits a coefficient fitted on about eight matches in nine hundred, and that
coefficient then multiplies a feature live across 92.5% of the next season.

**The predeclared distinction between "exactly zero" and "near zero" is
therefore not a rationalisation written after the result — it is visible in the
numbers, in three leagues, in the same season.** SL1 and SL2 are the
falsification example #770 identified, and they behave exactly as a correct
general rule requires.

### Verdict

**ADOPT.** Both predeclared conditions are met:

1. it removes SCH 1718's catastrophic behaviour — 1.30312 → 1.04841;
2. it is a no-op in the other eight — never firing in six, and bit-identical
   where it fires in two.

No league is named anywhere in the rule; the indicators are derived from
`FEATURE_GROUPS`, and `core` is protected so a model always exists.

**The one action this does not take.** `groups_with_support` is implemented,
tested and measured, but the training path does **not** call it: `build_dataset`
and `train.py` are unchanged, so nothing trained today is affected. Wiring it
into the fit is a change to what the scheduled Monday `task=train` job would
produce, and that is a model-behaviour decision with a scheduled consequence.
The evidence above supports it and the decision is left explicit rather than
taken silently.

### A limitation this study does not close

`conversion` carries **no** `*_known` indicator of its own, yet
`goals_per_sot` and `conceded_per_sot` are derived from the same shots data
`shots_volume` measures. The guard therefore drops `shots_volume` while leaving
conversion features built on the same sparse source in place. That is visible
in the design rather than hidden by it, and closing it means giving
`conversion` an indicator — which is a feature-pipeline change, not a guard
change, and is not made here.

---

## 3. What this evidence does not support

* No model is promoted. `DEFAULT_HALF_LIFE_DAYS`, `DEFAULT_GROUPS`,
  `ENSEMBLE_BASE_FAMILIES` and `NEWCOMER_TRANSFER_DEFAULT` are all untouched.
* No Over/Under selection engine. The 13 August benchmark found our
  disagreement with the book is model inertia, and that finding stands.
* Nothing here re-opens the GBM or logistic verdicts.
