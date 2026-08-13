# AI Lab model diagnosis and domestic-cup research — 13 August 2026

**Status:** repository research at commit `806e474` (contract 188). Applied to **no** hosted environment.
**Branch:** `claude/euro-2028-predictor-research-4g6387`
**Does not authorise:** a migration, a contract number, a default model change, a promotion, a provider call, or any hosted mutation.

This session ran in parallel with a separate Production 185 → 188 rollout and deliberately took **no** write action against `main`, Production or Development.

---

## 1. What could and could not be measured, and why

This is stated first because it governs how every number below should be read.

The nine-league studies named in the brief — Elo transition, half-life, elo-margin, regime, calibration and the feature-family ablations — **were not run**, and not for want of trying. They need `ai.raw_matches`, which is 46,215 rows across nine divisions. This session's container reaches the database through one channel only: a tool whose results enter the agent's context. The gateway denies direct egress:

```
"kind": "connect_rejected",
"detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
"host": "iouzoutneyjpugbbtdem.supabase.co:443"
```

and the same for `www.football-data.co.uk:443`, so neither a Postgres connection nor a CSV re-download is available. Pulling even the smallest league's history (SL2, 4,836 rows) through the tool boundary would consume more context than the whole session has.

**This is an environment limitation, not a finding about the models.** The correct reading of the brief's premise that these studies are "already ready to run" is: they are ready, and they need a session with `DATABASE_URL` set. Section 8 lists exactly what to run.

What this session **could** do, and did:

- read and drive the model code directly, including on the repository's own fold harness over synthetic seasons;
- run **aggregate** SQL against Production read-only, which returns a handful of rows rather than tens of thousands, and which is where every coverage number below comes from;
- read retained provider responses, which answered the provider-entitlement question with **zero** new provider calls.

---

## 2. The GBM is memorising, and the comment saying otherwise was wrong

The brief reported the GBM at 1.13503 (EPL), 1.22041 (SPL) and 1.18890 (EL2) against a poisson/elo pair near 0.987, 0.953 and 1.060. A GBM losing to a Poisson regression is ordinary. A GBM losing to a **base-rate baseline** — about 1.06 in these leagues — is a broken configuration rather than a tuning question.

Driven on the repository's own `expanding_season_folds` over synthetic seasons, reporting train and test together:

| family / config | train | test | gap |
|---|---|---|---|
| poisson | 1.0061 | 0.9960 | −0.0101 |
| elo | 1.0123 | 0.9927 | −0.0196 |
| logistic | 0.9846 | 1.0291 | +0.0445 |
| **gbm SHIPPED** lr.05/it400/lf15/msl40 | **0.0930** | **1.3462** | **+1.2532** |
| gbm lr.05/it150/lf7/msl150 | 0.7396 | 1.0724 | +0.3328 |
| gbm lr.03/it120/lf4/msl250/l2=5 | 0.9441 | 1.0185 | +0.0744 |
| gbm lr.02/it80/lf3/msl300/l2=10 | 0.9929 | 1.0070 | +0.0141 |

A training log loss of **0.0930** on a three-class outcome whose irreducible loss is about 0.99 is not learning a weak signal; it is memorisation. 400 iterations at a 0.05 learning rate with 15-leaf trees build roughly 1,200 trees over a few thousand rows. Poisson and Elo show a *negative* gap — they score the held-out season slightly better than the training seasons, which is what time weighting plus a genuinely recent test fold should do.

The mechanism was hiding in a comment:

```python
early_stopping=False,     # chronological folds do the stopping
```

A fold **scores** a model. It does not limit its boosting. Nothing bounded the iteration count at all.

**The shipped defaults are unchanged by this session.** Changing them is a model-authority decision with its own approval. `ai/model_candidates.py` carries the alternatives.

### 2a. `gbm` is in the default ensemble, contradicting its own docstring

`GradientBoostedModel` says it "enters an ensemble only by winning paired walk-forward folds". It never won any: `ENSEMBLE_BASE_FAMILIES = ("poisson", "elo", "gbm")` is the default for `--base-families` in **both** `experiments.py` and `train.py`, so the blend and the stacker carry it everywhere. The brief's own figures show the equal blend losing to its own best component in all three leagues, which is what an equal-weight average containing a memorising learner does.

Left in place deliberately, annotated in the source, and recommended for removal in §7.

### 2b. The native-missingness justification was false

`GradientBoostedModel` was chosen partly for native NaN handling, so "the neutral-prior columns become a fallback rather than the only representation". Measured: **the feature block contains no NaN, on any league.** `FeatureBuilder` substitutes a `NEUTRAL_*` constant before any model sees the data, so the tree's NaN branch is never taken — including in the National League, where `ai.raw_matches` carries a shot count for only 2,220 of 7,518 rows.

Two consequences, both now in code:

- `features.reconstruct_missing` turns a neutral prior back into NaN wherever its coverage flag is exactly zero, and `native_missing=True` makes the claim a **candidate to be measured** rather than a sentence to be repeated. It is off by default because it changes what the model sees.
- A column missing in *every* training row killed the estimator inside its own binner with `ValueError: window shape cannot be larger than input array shape`, which names no column and no league. Such columns are now dropped by name and the names retained.

A nuance worth knowing before reading any ablation of it: a coverage flag is also zero for a club's **first match**, so `native_missing` marks both "this competition records no shots" and "this club has no history yet". Only the first was the stated motivation.

---

## 3. The predeclared diagnostic

`ai/model_candidates.py` declares eleven GBM configurations **before** they are run, each with a stated mechanism, with the incumbent as the paired baseline. The grid does not grow once results are in; a test enforces a hard ceiling of twelve, and another refuses a candidate with no stated hypothesis.

| candidate | tests |
|---|---|
| `gbm_shipped` | the incumbent, and the baseline every row is paired against |
| `capacity_low` / `capacity_mid` / `capacity_high` | capacity is the problem, at three strengths |
| `early_stopping` | the shipped belief repaired in place — shipped capacity, estimator stops itself |
| `iter_only` | isolates iteration count |
| `depth_only` | isolates tree shape |
| `native_missing` | the docstring's claim, finally exercised |
| `core_only` | feature count rather than tree size |
| `no_time_weight` | exponential weights shrink effective leaf occupancy |
| `calibrated` | overconfidence rather than mis-ranking |

Two new studies, both recording to `ai.feature_experiments` including null results:

- `experiments.py --study gbm-diagnostic`
- `experiments.py --study base-model` — every family on identical folds, **including `logistic`**, which was excluded from the ensemble on an argument ("the Poisson model already occupies the smooth-linear corner") that had never been measured.

`fold_log_loss` now forwards `model_kwargs` — `fit_family` always accepted them and nothing ever passed any, so a GBM setting could not previously be compared without writing a second fold loop.

Calibration inside a fold is fitted on a held-out **tail** of the training window, never on the training fit (an overfitted model's in-sample probabilities are already near-perfect, so the temperature would be ≈1 and do nothing) and never on the test fold (leakage).

Both studies refuse a run with fewer than three usable folds. This was found by running them: on a degenerate input they printed eleven rows of `nan`, a verdict of `tie` on every one, and the recommendation "no candidate beat the shipped configuration" — indistinguishable from a real null result.

Harness demonstration on synthetic seasons (**not** football evidence — it shows the studies run and the ledger populates):

```
=== SPL: base models, 5 folds, best = elo ===
family                  mean   vs best       se   verdict
baseline              1.0591   +0.0633   0.0223     WORSE
poisson               1.0020   +0.0062   0.0058       tie
elo                   0.9958   +0.0000   0.0000       tie
logistic              1.0368   +0.0410   0.0131     WORSE
gbm                   1.5013   +0.5055   0.0784     WORSE
```

---

## 4. Discipline features, and why there are no referee features

Measured on Production, 13 August 2026, over the whole archive:

| division | rows | referee present | fouls present | referees | median matches per referee | share of matches by a referee with 100+ |
|---|---|---|---|---|---|---|
| E0 | 5,332 | 100.0% | 100.0% | 66 | 50 | **79.2%** |
| E1 | 7,728 | 92.8% | 100.0% | 137 | 21 | 69.5% |
| E2 | 7,576 | 92.7% | 100.0% | 181 | 31 | 32.4% |
| E3 | 7,628 | 92.8% | 100.0% | 194 | 26 | 27.2% |
| EC | 7,518 | 92.6% | 29.5% | 199 | 28 | 16.6% |
| SC0 | 3,155 | 92.8% | 100.0% | 50 | 28 | 70.6% |
| SC1 | 2,442 | 63.1% | 63.1% | 51 | 28 | **0.0%** |
| SC2 | 2,419 | 62.8% | 62.7% | 66 | 22 | **0.0%** |
| SC3 | 2,417 | 62.8% | 62.7% | 70 | 20 | **0.0%** |

In the three Scottish lower divisions **not one referee has officiated 100 matches in fifteen seasons**, and the median is twenty. A per-referee card or foul rate estimated from twenty matches is mostly the noise of which fixtures that official happened to be given, and a model reading it as disposition will confidently attribute a bad-tempered derby to whoever was in the middle. Referee identity is also only ~63% present at all below SC0.

So the new `discipline` **candidate** family is what the data supports: the team's own foul, card and sending-off rates, with a coverage flag. Cards per match sit in a strikingly narrow 3.14–3.73 band across all nine divisions, and fouls in 20.3–23.3.

It is **not** in `DEFAULT_GROUPS`. It enters only by winning paired folds in `ablate.py`.

### Football-Data.co.uk fields still unused

- **Over/Under and Asian handicap are retained** — `ai.historical_market_prices` holds 136,184 OU rows over 22,703 matches and 135,900 AH rows over 22,683, across all nine divisions, seasons `1920`–`2627`, phase `pre` only. **Nothing reads them**: no feature, no model, no study. This is a genuine unused asset, roughly half the archive by match count.
- **Offsides is not stored at all** — there is no column in `ai.raw_matches`.

---

## 5. Domestic cups

### 5a. The clock, checked before kickoff

Checked at **17:08 UTC on Thursday 13 August 2026**. All eight Premier Sports Cup last-16 ties were **still prospective** — the earliest kickoff is Friday 14 August, 19:45.

| date | tie | tiers | cross-tier |
|---|---|---|---|
| Fri 14 Aug 19:45 | Kilmarnock v Ayr | SC0 v SC1 | yes (1) |
| Sat 15 Aug 17:45 | Dundee United v Celtic | SC0 v SC0 | no |
| Sat 15 Aug 15:00 | Aberdeen v Dundee | SC0 v SC0 | no — **orientation unconfirmed** |
| Sat 15 Aug 15:00 | Ross County v Dunfermline | SC1 v SC1 | no |
| Sun 16 Aug 16:00 | Rangers v St Mirren | SC0 v SC0 | no |
| Sun 16 Aug 14:00 | Hearts v Inverness C | SC0 v SC2 | yes (2) |
| Sun 16 Aug 14:00 | Hibernian v Partick | SC0 v SC1 | yes (1) |
| Sun 16 Aug 14:00 | Stenhousemuir v Motherwell | SC2 v SC0 | yes (2) |

All sixteen clubs resolve against the **real retained canonical vocabulary** — `Ayr`, `Inverness C`, `Partick`, `Ross County`, `Stenhousemuir` — each carrying 484–526 prior matches. Tiers are from `ai.raw_matches` season `2526`/`2627`, not assumed.

**One tie is not fully established.** Sources disagree on whether Aberdeen v Dundee is at Pittodrie or Dens Park, which is a disagreement about who is at *home*. `spfl.co.uk`, `afc.co.uk` and `en.wikipedia.org` are all egress-blocked to this session's fetcher, so it could not be settled against the competition's own source. Home advantage is worth roughly `ELO_HOME_ADV` = 60 rating points, so this is a material uncertainty in the result and `CupTie.orientation_confirmed=False` drives data confidence to `low` when it is set.

**No forecast was produced for any tie, and none was back-dated.** A forecast needs a fitted model, a fitted model needs the history, and §1 explains why the history is unreachable here. `assert_prospective` refuses a post-kickoff calculation outright rather than warning, and the boundary goes to the refusal — a tie kicking off this instant is not something anyone is still forecasting.

### 5b. The architecture

`ai/cups.py` is generic across Scottish League Cup, Scottish Cup, FA Cup and EFL Cup. No UEFA competition is declared; European club strength is a separate, larger project and a test enforces the exclusion.

- **90-minute H/D/A only.** `CupForecast` has no qualification field and `refuse_qualification()` raises. A level tie goes to extra time, penalties and — in the Scottish Cup and FA Cup — replays, and the league archive contains not one example of any of them. "Draw" and "eliminated" are different events.
- **Cross-tier honesty is per family**, because the families do not degrade equally:
  - `elo` — extrapolates *honestly*; a rating is one scale and `ELO_DIVISION_OFFSET` places every division on it. The declared cup default.
  - `poisson` — outside domain; goal-rate level wrong, ordering usually survives.
  - `logistic` — outside domain; a standardised linear fit is only meaningful near where it was standardised.
  - `gbm` — **cannot extrapolate at all**; a tree returns its most extreme training leaf, so the cross-tier gap is silently clipped.
- **Data confidence stays separate** from calibration, from model agreement and from the probability itself, and returns *reasons* rather than a bare band.

### 5c. Schedule context — no migration needed

The 2026/27 group stage ran on **five matchdays in fifteen days**: 11/12, 14/15, 18/19, 21/22 and 25/26 July, over 40 clubs including Linlithgow Rose, Brora Rangers and Brechin City. That is exactly the workload pattern the congestion family cannot currently see.

`ai.observations` already holds this honestly — `subject_type='team'`, `fact_type='schedule_match'`, competition in the jsonb value, and `known_at` so a backtest cannot learn on Monday about a Wednesday replay. `cups.observation_rows` builds those rows and **deliberately does not write them**.

**The congestion re-ablation was not run**, and would have been refused anyway: complete per-club July fixtures could not be assembled from the available sources, and `schedule_context.MIN_TEAM_COVERAGE = 0.90` correctly rejects partial coverage. Partial cup coverage is not a smaller version of full coverage — it is a bias, missing precisely for the clubs congestion is about.

---

## 6. Providers — measured from retained responses, zero new calls

### football-data.org: the entitlement question is already answered on disk

A retained `GET /v4/competitions` response (5 August 2026, HTTP 200) enumerates **exactly the 12 competitions the token may see**:

| entitled | | not entitled |
|---|---|---|
| PL — Premier League (2026-08-21 → 2027-05-30) | ELC — Championship (2026-08-14 → 2027-05-01) | **Scottish Premiership** |
| CL, EC, WC | BSA, FL1, BL1, SA, DED, PPL, PD | **FA Cup, EFL Cup, Scottish League Cup, Scottish Cup** |

Against the seven competitions the brief asks about: **Premier League and Championship yes; the Scottish Premiership and all four domestic cups no.** This is the catalogue the provider itself returns, so it is proof for all of them at once — and the brief's instruction to "stop retrying a competition once the provider has proven it unavailable" is satisfied without a single new request. It is consistent with the retained `403` on `/v4/competitions/SPL/matches`.

**The "paid entitlement" premise is not confirmed by retained evidence.** That 12-competition catalogue is the provider's standard free tier. Either the upgrade post-dates 5 August 2026, or the configured credential is not the paid one. The smallest possible check is one more `GET /v4/competitions` — deferred, because it belongs after the Production rollout.

**Four domestic cups being unavailable here is the decisive fact for §5**: football-data.org cannot be the cup source.

### SportMonks

431 of 434 retained responses are `fixtureLeagues:501` — the Scottish Premiership — the most recent on 13 August 2026. There is **no retained evidence about any Scottish cup**, so cup coverage is *unknown* rather than absent. The existing audit's finding stands: free plan, 3,000-call limit, Scottish Premiership included, payload already carrying team identity, venue and image references. No live call was made.

### API-Football

One retained response (7 August 2026): HTTP 200, result count 0, `errors.plan` refusing the 2026 season. Unchanged, not retested — the brief is explicit about not repeatedly testing a blocked entitlement.

### SportDB.dev and TheSportsDB

Neither was contacted. SportDB.dev is still absent from the `provider-poll` decoder contract, so it has no controlled custody path and its entitlement cannot be measured honestly. TheSportsDB — a *different* service — was not reachable: this session's fetcher is egress-blocked for every football domain it tried (`spfl.co.uk`, `afc.co.uk`, `en.wikipedia.org`). It remains the most promising cup-discovery candidate on the brief's own external evidence, and it must not be given sole settlement authority over a fixture or result.

---

## 7. Recommendations — recommendations only, nothing promoted

1. **Do not remove `gbm` from `ENSEMBLE_BASE_FAMILIES` yet; measure first.** Run `--study base-model` and `--study gbm-diagnostic` on all nine leagues. If a repaired GBM still loses, remove it — the evidence for the removal will then exist, which it does not today.
2. **Expect `capacity_mid` or `capacity_low` to win.** Do not adopt on that expectation. If the winner is `early_stopping`, the defect was iterations alone and the fix is one constructor argument.
3. **Treat `elo` as the cup default** until a cross-tier comparison says otherwise. It is the only family whose extrapolation is structurally sound.
4. **Read the OU/AH archive.** 136,000 retained rows over half the match archive, used by nothing, is the cheapest unexploited evidence in the lab.
5. **Re-check football-data.org entitlement with one catalogue call** after the rollout, and record the answer next to the 5 August one.

---

## 8. Exactly what to run next, in a session with `DATABASE_URL`

```bash
for L in EPL ECH EL1 EL2 ENL SPL SCH SL1 SL2; do
  python experiments.py --league $L --study base-model      --record
  python experiments.py --league $L --study gbm-diagnostic  --record
  python experiments.py --league $L --study elo-transition  --record
  python experiments.py --league $L --study half-life       --record
  python experiments.py --league $L --study elo-margin      --record
  python experiments.py --league $L --study regime-weighting --record
  python experiments.py --league $L --study calibration     --record
  python ablate.py      --league $L --groups discipline     --record
done
```

`--record` writes rejections too. Run `base-model` and `gbm-diagnostic` **before** `ensemble`: the ensemble question is only meaningful once the components are credible.

---

## 9. Proposed future migration — designed, deliberately not created

No migration was added and **no contract number was claimed**, because Production was still mid-rollout at 185 while the repository is at 188.

**What needs no migration.** Cup fixtures and cup schedule context, via `ai.observations` as above. This is the honest existing home and it was used rather than worked around.

**What does need one.** A cup **forecast** cannot be stored honestly today:

- `ai.predictions.league` is `text NOT NULL`, and a cup is not a league;
- `ai.predictions` carries `CHECK (num_nonnulls(fixture_id, raw_match_id) >= 1)`, so every prediction must point at an `ai.fixtures` or `ai.raw_matches` row;
- `ai.fixtures` is `division text NOT NULL` with `UNIQUE (division, match_date, home_canonical, away_canonical)` and `league_key text NOT NULL`.

Storing a cup tie would mean inventing a division and a league key for it — writing a cup name into a league field, which the brief forbids and which would corrupt every read that groups by division. So no cup forecast is persisted, and none was.

Proposed shape, for a session that owns the next contract number:

- `ai.cup_competitions` — key, name, country, tier set, replay rule;
- `ai.cup_fixtures` — competition, round, both clubs, kickoff, both divisions **as recorded at kickoff**, provenance;
- `ai.predictions` — a nullable `cup_fixture_id`, with `predictions_target_present` widened to include it and `league` made nullable *only* where that column is set;
- a `market` discriminator pinning `90_minute_hda`, so a qualification probability cannot later be written into a column that means something else.

Re-read `main`, re-read every open pull request, and establish the real next contract number before creating any of it.

---

## 10. Safety

- **Zero** paid Odds API calls.
- **Zero** paid provider calls of any kind, from any environment. Development paid usage remains at zero; the only provider evidence used was already retained.
- **Zero** Production mutations. Every Production query was a read-only `select`.
- **Zero** Development mutations.
- Nothing merged to `main`; nothing pushed to any branch but `claude/euro-2028-predictor-research-4g6387`.
- No migration added, no contract claimed, no cron altered, no budget touched, no forecast regenerated, no identity repair run.
- No default model authority changed.
