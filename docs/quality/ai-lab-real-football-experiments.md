# AI Lab real-football experiments — 13 August 2026

**Dated evidence at its recorded commit. Not a task list, and not a promotion.**
Every figure below was measured against Production's retained historical
dataset — 46,215 matches across nine divisions, 2012/13 to 2026/27 — through
`ai-lab.yml` `task=experiments`, which makes **no provider request of any kind**
and trains no deployable model. Nothing here has been promoted. Promotion
remains a human decision.

## What had to be true before any of this was worth running

The branch's new modelling machinery had only ever been exercised against
synthetic data, and the follow-up investigation was explicit that Production's
first fifty-one live predictions could not be used to judge it. They were
measured again here and the finding is confirmed and worse than "some rows look
odd":

| Measure | Count |
| --- | --- |
| Live predictions | 51 |
| With at least one club carrying zero matched history | 37 |
| With **both** clubs carrying zero matched history | 16 |
| Above 90% headline probability | 11 |
| Above 99% | 6 |
| Hitting an expected-goals clamp (0.05 or 6.00) | 16 |
| Paper selections advised | 49 |
| Paper selections resting on an identity-broken prediction | 22 |

**Every one of the eleven >90% predictions carries a zero-history club.** They
also arrive in two exact clusters — five at `0.99659` with a 6-0 scoreline, and
five at `0.90715` with a 0-0 — which is the signature of a degenerate model
state rather than eleven separate bold opinions. None is defensible, and none
should be counted as evidence for or against the model.

The cause was custody rather than knowledge, and is recorded in contract 188.
Twenty-nine club spellings were affected, each with a full history sitting
under its canonical name:

| Provider spelling | Canonical name | Historical matches ignored |
| --- | --- | --- |
| Leicester City | Leicester | 564 |
| West Bromwich Albion | West Brom | 588 |
| Stoke City / Swansea City | Stoke / Swansea | 596 each |
| Norwich City | Norwich | 604 |
| Leeds United | Leeds | 612 |
| Hull City | Hull | 620 |
| … 23 more | | 626–644 each |

## The studies

Three leagues, chosen for the same reason `ablate` uses them: a paired verdict
per league beats a sweep nobody reads. EPL is the deepest top flight, SPL a
smaller one, EL2 the sample-starved lower division where an effect has the most
room to be noise.

Every study is **paired and chronological**: expanding-season folds, the same
folds for baseline and candidate, and the verdict is the paired mean difference
against twice its own standard error. A candidate is only "kept" when the whole
interval clears zero.

### A. Elo season transition (run 31706013941)

Baseline is `global_mean`, which the register calls a defect rather than a
candidate: it drifts every lower-division club toward the Premier League's
anchor each summer. The incumbent default is `division_prior`.

| League | `division_prior` | `none` | Verdict |
| --- | --- | --- | --- |
| EPL | −0.00378 ± 0.00117 **clears noise** | **−0.00502 ± 0.00125 clears noise** | move off `global_mean` |
| SPL | −0.00041 ± 0.00075 within noise | **−0.00222 ± 0.00084 clears noise** | move off `global_mean` |
| EL2 | −0.00014 ± 0.00047 within noise | −0.00044 ± 0.00038 within noise | inconclusive |

Nine folds each. Mean log loss at the winner: EPL 0.9736, SPL 0.9518, EL2 1.0591.

**The measured winner is not the incumbent.** `none` — carry each club's rating
across the season boundary unchanged — beats `global_mean` in both EPL and SPL
by more than twice the paired standard error, and beats `division_prior` in
both. This is a real result and it is **not acted on here**: the effect is
smaller in EL2 than its own error bar, only three of nine leagues have been
measured, and changing the transition changes every rating in the lab. The
remaining six leagues must be run before any default moves.

### B. Half-life sweep (run 31706390379)

Baseline is the incumbent 900 days, global and until now unmeasured. Grid:
0, 180, 365, 540, 730, 900, 1200 days.

| League | Chosen | Paired delta vs 900d | Verdict |
| --- | --- | --- | --- |
| EPL | **1200 days** | −0.00041 ± 0.00015 | clears noise |
| SPL | **1200 days** | −0.00063 ± 0.00023 | clears noise |
| EL2 | retain 900 days | −0.00017 ± 0.00017 | within noise |

Nine folds each. Where several candidates clear the noise the **longest** wins,
because more history is the more stable setting and the lower divisions are
sample-starved.

**Two leagues prefer a longer memory and one does not**, which is exactly the
case for keeping the setting per league rather than forcing a single global
winner. Again: measured, recorded, not applied.

### C. Independent model families and the ensemble (run 31707544045)

Six out-of-time folds per league. Base models are already out-of-fold by
construction; the meta-model is refitted on earlier folds and scored on a later
one, so every number below is comparable.

Mean out-of-time log loss:

| League | Poisson | Elo | GBM | Equal blend | Learned stacker | Best single |
| --- | --- | --- | --- | --- | --- | --- |
| EPL | 0.98725 | **0.98722** | 1.13503 | 0.99415 | 0.99010 | Elo |
| SPL | 0.95319 | **0.95225** | 1.22041 | 0.97054 | 0.95838 | Elo |
| EL2 | **1.05991** | 1.06277 | 1.18890 | 1.07381 | 1.06190 | Poisson |

Paired against the best single base model, positive meaning worse:

| League | Equal blend | Learned stacker |
| --- | --- | --- |
| EPL | +0.00694 ± 0.00135 | +0.00288 ± 0.00260 |
| SPL | +0.01829 ± 0.00625 | +0.00613 ± 0.00489 |
| EL2 | +0.01390 ± 0.00269 | +0.00199 ± 0.00223 |

**No combination beats the best single model in any of the three leagues, and
the equal blend is decisively worse in all three.** This is a clear negative
result and it is the useful kind: the cause is visible in the same table.
**The gradient-boosted family is between 0.13 and 0.27 log loss worse than
either of the other two, everywhere.** Averaging a badly wrong forecast into
two good ones costs exactly what the blend loses, and the learned stacker
spends most of its regularised capacity learning to ignore it — which is why it
recovers most of the gap and still does not close it.

Poisson and Elo are, for practical purposes, tied: 0.00003 apart in EPL and
0.0009 in SPL, both far inside their own fold standard errors.

**The ensemble family must not be promoted on this evidence.** The next step is
not a better stacker; it is either fixing or dropping the GBM base family, and
then re-running. Note also that this comparison is of the ensemble's
DISCRIMINATION only — contract 188's second-level cross-fitting changes what
its calibration figure is allowed to claim, and the calibration study has not
been run.

## Studies not yet run

`elo-margin` (red cards), `regime-weighting`, `calibration` and the
feature-family ablations after the corrected transition are implemented,
dispatchable and **not run here**. They are the remaining work. The calibration
study in particular should only be read after contract 188's second-level
cross-fitting, since the previous figure was measured on meta predictions the
stacker had been fitted on — it would have been reported as better than it is.

`market` versus pure football is not runnable at all against this dataset for
the leagues the paid provider covers: the retained pre-match price columns come
from Football-Data, and a fair benchmark needs the market block over the same
folds. It is not claimed either way.

## What this evidence does not support

- No configuration is promoted, and no default is changed.
- Nothing here says the model is good. It says two specific settings are
  measurably better than two specific incumbents in two of three leagues.
- Before any of it becomes a default for all nine modelled leagues, the final
  comparison must run across **all nine**. If leagues disagree — and half-life
  already does — the setting stays per league.
- The 51 live predictions remain invalid evidence and are excluded from every
  number above.
