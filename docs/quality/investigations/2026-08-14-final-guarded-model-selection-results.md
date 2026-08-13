# Final guarded model selection — RESULTS

**14 August 2026.** This is the result of the predeclared study in
`2026-08-14-final-model-selection-predeclaration.md`.

## Execution authority

- Development-only GitHub Actions run: **31754362290**
- Exact study head: **bb7fa74c8ca657fb2a5fa7cceff2da82d0acb3f8**
- `AI_READ_ONLY=1`
- `AI_COVERAGE_GUARD=1`
- Development project-ref proof passed before the study opened the credential.
- `check_write_scope.py` passed before the comparison.
- Evidence artifact: `final-guarded-model-selection-31754362290`
- Artifact id: **9202202399**
- Artifact digest: **sha256:ba97f2d720beabe7468ed127f67a15c0e01ab54088b36793516f01a8ab0cde55**
- No model row was inserted or promoted by this study.

The subsequent wrapper-compatibility fix changes only pickle reconstruction and
preserves estimators' existing prediction-column contracts. The final study is
being repeated on that exact head as a confirmation run; its result must agree
before this branch is considered complete.

## Predeclared selections

| league | selected challenger | mean log loss | mean RPS | mean Brier | selected-fold coverage drop? |
| --- | --- | ---: | ---: | ---: | --- |
| EPL | `blend-1800` | 0.971165 | 0.199875 | 0.576817 | no |
| ECH | `blend-1800` | 1.046627 | 0.217891 | 0.630270 | no |
| EL1 | `poisson-1800` | 1.032320 | 0.214985 | 0.620160 | no |
| EL2 | `poisson-900` | 1.059380 | 0.220876 | 0.639270 | no |
| ENL | `poisson-900` | 1.039707 | 0.217447 | 0.625314 | no |
| SPL | `poisson-1800` | 0.952596 | 0.192685 | 0.564655 | no |
| SCH | `poisson-900` | 1.068311 | 0.221572 | 0.644540 | yes — 1718 |
| SL1 | `poisson-1800` | 1.025901 | 0.216710 | 0.615972 | yes — 1718 |
| SL2 | `poisson-900` | 1.032354 | 0.219981 | 0.619482 | yes — 1718 |

The guard dropped `shots_volume` and `corners` in the selected 1718 fold for
SCH, SL1 and SL2. On the final all-history fit for each of those leagues all
requested groups have enough support, so the final challenger fit keeps the
full requested group set. That is the intended behaviour: sparse historical
folds do not borrow later coverage, while current data is not penalised for a
past provider gap.

## Window decisions

The longer window was admitted only when its paired improvement cleared the
fixed two-standard-error rule.

| league | Poisson 1800 vs 900 | verdict | Elo 1800 vs 900 | verdict |
| --- | ---: | --- | ---: | --- |
| EPL | -0.000758 ± 0.000312 SE | admit 1800 | -0.000306 ± 0.000205 | keep 900 |
| ECH | -0.000413 ± 0.000241 | keep 900 | -0.000126 ± 0.000141 | keep 900 |
| EL1 | -0.000270 ± 0.000106 | admit 1800 | -0.000204 ± 0.000230 | keep 900 |
| EL2 | -0.000222 ± 0.000346 | keep 900 | -0.000237 ± 0.000101 | admit 1800 |
| ENL | -0.000204 ± 0.000129 | keep 900 | -0.000117 ± 0.000146 | keep 900 |
| SPL | -0.000972 ± 0.000453 | admit 1800 | -0.000029 ± 0.000244 | keep 900 |
| SCH | -0.001768 ± 0.001051 | keep 900 | -0.000437 ± 0.000546 | keep 900 |
| SL1 | -0.001200 ± 0.000479 | admit 1800 | +0.000410 ± 0.000403 | keep 900 |
| SL2 | -0.001585 ± 0.000878 | keep 900 | -0.000274 ± 0.000474 | keep 900 |

A negative delta is better. “Admit 1800” means
`mean_delta + 2 * se_delta < 0`; a lower mean by itself was not enough.

## Family and blend decisions

The study deliberately did not choose the lowest raw mean when paired evidence
did not clear noise.

- **EPL:** Poisson-1800 and Elo-900 were statistically tied. Both equal blends
  cleared their component gate; `blend-1800` beat Poisson-1800 by
  **-0.002871 ± 0.001117 SE**, so it wins.
- **ECH:** neither single-family window earned 1800. Both blends cleared their
  component gate; `blend-1800` then beat the selected Poisson-900 reference by
  **-0.001742 ± 0.000725 SE**, so it wins.
- **EL1:** Poisson earned 1800. Elo did not beat it beyond noise and neither
  blend cleared its component gate. Select Poisson-1800.
- **EL2:** Elo earned 1800 on its own window comparison, but was then harmful
  relative to Poisson-900: **+0.003483 ± 0.001422 SE**. No blend cleared its
  component gate. Select Poisson-900.
- **ENL:** neither window nor family difference cleared noise and neither blend
  cleared its component gate. The predeclared conservative tie-break therefore
  leaves Poisson-900.
- **SPL:** Poisson earned 1800; the family difference remained noise and neither
  blend cleared its component gate. Select Poisson-1800.
- **SCH:** neither window, family difference nor blend cleared noise after the
  coverage-regime correction. The conservative outcome is Poisson-900.
- **SL1:** Poisson earned 1800; the apparent Elo/blend mean differences did not
  clear their paired-error gates. Select Poisson-1800.
- **SL2:** no window, family or blend alternative cleared noise. Select
  Poisson-900.

## Challenger manifest

| league | family | half-life | reproduction command |
| --- | --- | ---: | --- |
| EPL | ensemble: Poisson + Elo equal blend | 1800d | `python train.py --league EPL --family ensemble --base-families poisson elo --meta equal_blend --half-life-days 1800 --version <version> --walk-forward` |
| ECH | ensemble: Poisson + Elo equal blend | 1800d | `python train.py --league ECH --family ensemble --base-families poisson elo --meta equal_blend --half-life-days 1800 --version <version> --walk-forward` |
| EL1 | Poisson | 1800d | `python train.py --league EL1 --family poisson --half-life-days 1800 --version <version> --walk-forward` |
| EL2 | Poisson | 900d | `python train.py --league EL2 --family poisson --half-life-days 900 --version <version> --walk-forward` |
| ENL | Poisson | 900d | `python train.py --league ENL --family poisson --half-life-days 900 --version <version> --walk-forward` |
| SPL | Poisson | 1800d | `python train.py --league SPL --family poisson --half-life-days 1800 --version <version> --walk-forward` |
| SCH | Poisson | 900d | `python train.py --league SCH --family poisson --half-life-days 900 --version <version> --walk-forward` |
| SL1 | Poisson | 1800d | `python train.py --league SL1 --family poisson --half-life-days 1800 --version <version> --walk-forward` |
| SL2 | Poisson | 900d | `python train.py --league SL2 --family poisson --half-life-days 900 --version <version> --walk-forward` |

These are **challenger definitions, not promotion authority**. No hosted current
model changes as a consequence of this document.

## Remaining pre-promotion integrity gate

One independent price-identity check remains open. `ai.bookmakers` correctly
classifies `AVG` and `MAX` as synthetic aggregate references, and the accumulator
path already excludes them from actionable outputs. The single-selection value
gate currently applies its `PASS_UNBETTABLE_BOOK` refusal only outside paper
mode, which means a synthetic reference can still receive the action label in a
paper evaluation. The required invariant is stricter: an aggregate may be a
reference or diagnostic ceiling, never an actionable venue, regardless of run
mode.

That boundary must be closed and mutation-tested before challenger promotion or
forecast regeneration. It is intentionally recorded as a blocker rather than
hidden by changing a default book code.

## End-state reached by this study

- newcomer transfer remains `current`: measured null;
- coverage-regime guard is adopted in the real fitting path;
- requested/effective/dropped feature groups travel with artefact provenance;
- scheduled training reaches the guarded shared fit path;
- final all-nine Poisson/Elo and 900d/1800d selection is complete under a
  predeclared rule;
- per-league challenger definitions are fixed above;
- no promotion has occurred;
- forecast regeneration remains downstream of the human promotion gate and the
  aggregate-price integrity blocker.
