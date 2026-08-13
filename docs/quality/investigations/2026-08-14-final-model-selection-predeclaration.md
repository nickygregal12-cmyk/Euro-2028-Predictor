# Final guarded model selection — PREDECLARATION

**14 August 2026. Declared before the corrected final comparison is run.**

This is the closing model-selection study after #770 and the newcomer/coverage
hardening work. It changes no hosted model, promotes nothing and authorises no
provider call. Its purpose is to turn the research findings into one reproducible
per-league challenger decision without choosing a rule after the results are
visible.

## Fixed implementation state

Every candidate in this study uses the same football state:

- `DEFAULT_GROUPS` as the requested feature families;
- the adopted coverage-regime guard at `COVERAGE_SUPPORT_FLOOR = 0.05`, resolved
  independently on the training window of every fold;
- `NEWCOMER_TRANSFER_DEFAULT = current`; the transfer study was a measured null
  and no candidate earned adoption;
- the current division-aware Elo transition and the current feature semantics;
- no market probabilities or prices as model inputs.

The dedicated coverage-guard experiment retains an unguarded control arm. This
final study does not: it explicitly opts into the guard because the guard has
already passed its predeclared adoption test.

## Candidate set

The set is deliberately small and fixed:

| configuration | family | half-life |
| --- | --- | ---: |
| `poisson-900` | Poisson | 900d |
| `poisson-1800` | Poisson | 1800d |
| `elo-900` | Elo | 900d |
| `elo-1800` | Elo | 1800d |
| `blend-900` | equal Poisson/Elo probability blend | 900d for both bases |
| `blend-1800` | equal Poisson/Elo probability blend | 1800d for both bases |

No GBM or logistic candidate is reintroduced. #770's mutation-verified admission
register already answered that question: both remain implemented and callable,
but neither is admitted to the default ensemble.

There is no parameter grid and no intermediate half-life. The only window
question is the one left open by #770: shipped 900d versus the longer 1800d
window that won directionally across all nine leagues in the earlier unguarded
study.

## Measurement

All nine leagues use identical expanding chronological season folds. For every
configuration and fold:

1. fit only on seasons before the test season;
2. resolve coverage support from those training rows only;
3. score the untouched next season;
4. record 1X2 log loss, RPS and Brier;
5. retain the guard's requested/effective/dropped groups for provenance.

Primary decision metric: **paired fold log-loss delta**. Negative is better.
A change clears noise only when the whole two-standard-error interval is below
zero, the same rule used by `ablate.compare`:

`mean_delta + 2 * se_delta < 0`.

RPS and Brier are reported as diagnostics and cannot overrule the primary
metric after the fact.

## Selection rule — fixed now

The incumbent reference is `poisson-900` because that is the scheduled
challenger configuration before this hardening work.

Selection is deliberately conservative and staged:

1. **Window admission per single family.** `*-1800` replaces the same family's
   `*-900` only if 1800d beats 900d beyond noise. Otherwise that family keeps
   900d, even if the 1800d mean is slightly lower.
2. **Single-family choice.** Compare the admitted Poisson and Elo variants.
   One replaces the other only if it beats it beyond noise. If neither clears
   noise, prefer Poisson as the simpler incumbent rather than selecting the
   luckier mean.
3. **Blend admission.** At each half-life, the equal blend must beat the better
   of its two component families beyond noise. A blend that merely lies between
   its components is rejected. The best admitted blend is then compared with
   the selected single family and must again beat it beyond noise to win the
   league.
4. **No global winner is forced.** Different leagues may select different
   configurations. A null result is a valid result and leaves that league on
   its simpler admitted configuration.

The report must state every rejected candidate and the paired evidence that
rejected it. It must not silently choose the lowest mean.

## End condition

The study ends with a per-league challenger manifest containing:

- selected family and half-life;
- requested and effective feature groups;
- fold metrics and paired comparisons that justify the selection;
- whether any coverage group was dropped in any fold;
- a command capable of reproducing the challenger fit.

**It does not promote those challengers.** Promotion remains a separate human
gate after the evidence and exact-head CI are reviewed. Forecast regeneration
also happens only after that gate, because generating a new live forecast set
before deciding which model is live would mix model authority with evaluation.
