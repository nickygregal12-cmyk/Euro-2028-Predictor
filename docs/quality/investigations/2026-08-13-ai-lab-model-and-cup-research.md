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

> **Resolved later the same day — see §11.** The conclusion above is correct about the container and wrong about the repository. The studies do not need *this* session to reach the database; they need *a* process with `DATABASE_URL`, and `.github/workflows/ai-lab.yml` is one, on a GitHub-hosted runner with the secret already resolved. What was missing was not access but a **task**: the workflow offered `experiments` with `--record`, which writes, and offered only six of the eight studies the module implements. §11 adds the read-only `research` task and reports what the studies actually returned. Section 8's list stands as the specification of what to run; it is no longer a list of things that cannot be run here.

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

=== SPL: GBM diagnostic, 5 folds, baseline gbm_shipped ===
candidate             train      test     delta       se   verdict
gbm_shipped          0.0531    1.4498   +0.0000   0.0000       tie
capacity_low         0.9440    0.9970   -0.4528   0.0408    BETTER
capacity_mid         0.8884    1.0108   -0.4389   0.0459    BETTER
capacity_high        0.6733    1.0566   -0.3932   0.0511    BETTER
early_stopping       0.7257    0.9969   -0.4529   0.0457    BETTER
iter_only            0.3998    1.0952   -0.3546   0.0274    BETTER
depth_only           0.7928    1.0415   -0.4083   0.0465    BETTER
native_missing       0.8880    1.0102   -0.4396   0.0459    BETTER
core_only            0.9113    0.9960   -0.4538   0.0390    BETTER
no_time_weight       0.8806    0.9928   -0.4569   0.0418    BETTER
calibrated           0.8884    1.0093   -0.4405   0.0397    BETTER
```

Three things in that table are worth carrying into the real runs, all of them
consequences of having declared the isolating candidates in advance:

- **All ten alternatives beat the incumbent**, by 0.35 to 0.46 against a
  standard error near 0.04. When every member of a bounded grid beats the
  baseline by ten standard errors, the baseline is broken rather than untuned.
- **`iter_only` is the WEAKEST improvement** (−0.3546) and still carries a
  training loss of 0.3998. Cutting 400 iterations to 100 while keeping 15-leaf
  trees and 40-sample leaves leaves the model still memorising, so the
  iteration count is not the whole story and tree shape carries real weight.
  A one-line "reduce max_iter" fix would have looked like a success and left
  most of the defect in place.
- **`early_stopping` is among the best** (0.9969). The shipped belief can
  largely be repaired *in place*: keep the capacity and let the estimator stop
  itself on its own validation split.

The top four — `no_time_weight`, `core_only`, `early_stopping`, `capacity_low`
— sit within noise of each other, so this harness does not choose between them
and is not asked to. The real leagues will.

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

> **Correction (§11 session, same day): this section's evidence is Development's, and it did not say so.** Re-measured by counting rows on each project separately:
>
> | | `predictor_internal.provider_raw_responses` | earliest | football-data `/v4/competitions` |
> |---|---|---|---|
> | **Development** `iouzoutneyjpugbbtdem` | 438 rows (434 SportMonks) | 5 Aug 2026 | present, 5 Aug, HTTP 200 |
> | **Production** `vkfnsqdyhvtwyqkisxhk` | **28 rows** | **10 Aug 2026** | **absent** |
>
> So the 434-response corpus and the 12-competition catalogue below are **Development** evidence. That matters more than a citation tidy-up: entitlement is a property of a **credential**, the two environments hold their own, and the owner's "the API is paid" claim is about the account behind whichever key Production uses. Evidence gathered on Development cannot settle it.
>
> Production nonetheless agrees, on its own separately retained rows: `GET /v4/competitions/SPL/matches?dateFrom=2026-08-01&dateTo=2026-08-10` returned **403** on 10 August 2026 with `"The resource you are looking for is restricted and apparently not within your permissions. Please check your subscription."`, while `/v4/competitions/PL/matches?season=2026` returned **200** — most recently at **18:05:06 UTC on 13 August 2026**, from Production's own scheduled poll rather than from this session. Two credentials, two environments, same shape of answer.
>
> The 12-competition count is confirmed rather than repeated: parsing the retained body returns exactly `BL1, BSA, CL, DED, EC, ELC, FL1, PD, PL, PPL, SA, WC`.

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

> **Upgraded from "unknown" to measured (§11 session, still zero new calls).** A retained `GET /v3/football/leagues` on **Production** (10 August 2026, HTTP 200, 1,596 bytes) carries SportMonks' own subscription block and its complete entitled-league list:
>
> ```
> "subscription":[{"plans":[{"plan":"Football Free Plan","sport":"Football","category":"Standard"}, ...],
>                  "add_ons":[],"widgets":[]}]
> "pagination":{"count":4, ... ,"has_more":false}
> ```
>
> Four leagues, and `has_more:false` makes that the whole list rather than a first page:
>
> | id | name | country |
> |---|---|---|
> | 271 | Superliga | Denmark |
> | **501** | **Premiership** | **Scotland** |
> | 513 | Premiership Play-Offs | Scotland |
> | 1659 | Superliga Play-offs | Denmark |
>
> Two conclusions, one useful and one closing a door.
>
> **The Scottish Premiership entitlement is richer than assumed.** A retained 200 for `fixtures/between/2026-07-31/2026-08-09?filters=fixtureLeagues:501&include=participants;scores;round;venue;lineups;events;statistics;referees;formations` returned 240,614 bytes. Lineups, events, statistics, referees and formations are **not** an add-on here; they are already being served on the free plan, and `add_ons:[]` says there is nothing extra to reconcile against. That is the single richest free source in this project for one of its nine leagues.
>
> **SportMonks cannot supply any cup.** No Scottish League Cup, no Scottish Cup, no FA Cup, no EFL Cup. Combined with football-data.org's 12-competition catalogue, which contains no cup either, **both configured providers are now measured as unable to supply the domestic cups** — the second half of the answer §5 needed, and it costs nothing to know.
>
> One further retained response is worth keeping: a **422** for a 303-day range, `"You requested a date range of 303 days. The maximum range is 100 days."` That is a parameter refusal, not an entitlement refusal, and a future collector must window at ≤100 days rather than read it as a block.

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

---

## 11. The hosted read-only research path — how the egress blocker was actually solved

§1 concluded the nine-league studies could not be run. That was true of this container and false of this repository, and the distinction is the whole of this section.

The studies need a process holding `DATABASE_URL`. `.github/workflows/ai-lab.yml` is such a process: a GitHub-hosted runner, the secret already resolved and checked against the expected project ref, the Python environment already specified. The 46,215 rows never cross the agent boundary at all — they are read inside the runner, and what comes back is a JSON report of a few kilobytes. **The blocker was never access. It was that the workflow had no task that would do this**, and two smaller faults underneath:

- it offered **six** studies while `ai/experiments.py` implements **eight** — `gbm-diagnostic` and `base-model`, the two this branch added, were undispatchable. `tests/scripts/aiLabWorkflowBoundary.test.ts` already required the workflow's choice list to equal the module's registry and was **failing on this branch for exactly that reason**. The guard was right; the workflow was the half that was wrong.
- its only study task ran `experiments.py … --record`, which **writes** `ai.feature_experiments`. Correct for a recorded experiment, and not what a session under a Production freeze may do.

### What was added

A `research` task, and a `league` selector offering the nine plus `all`.

It is **read-only by enforcement, not by convention**. `AI_READ_ONLY=1` makes `db.connect` open the session with `default_transaction_read_only=on`, so a write raises `read_only_sql_transaction` from PostgreSQL rather than depending on a caller having remembered to withhold a flag; and `experiments.py` refuses `--record` under it up front, so the contradictory request dies before a twenty-minute study runs rather than after it. `config.read_only` states the limit of the guarantee rather than overclaiming it: the GUC is settable by any role, so this stops the mistake that actually happens, not a caller who deliberately turns it off.

It is **provider-free by construction**: no `fetch_history.py`, `sync_fixtures.py`, `fetch_fixtures_odds.py` or `odds_api.py` appears in the arm, and the test asserts their absence *by name*, so an edit that grew one would fail rather than quietly begin spending. The run's own step list is the confirmation — every collection step resolved to `skipped`.

### Dispatching a branch definition without merging it

The brief's constraint was to run branch code without merging to a frozen `main`. `workflow_dispatch` accepts a `ref`, and validates the *inputs* against the workflow file at that ref — so `task=research` and `league=all`, which exist nowhere on `main`, being accepted at all is itself the first evidence. Verified from the resulting run rather than assumed:

| | |
|---|---|
| `head_branch` | `claude/euro-2028-predictor-research-4g6387` |
| `head_sha` | `f9ba04cff3372b0e4f1238063c351ab11a9b0360` |
| secrets | resolved normally (same-repository branch, not a fork) |

**`main` was not merged to, and nothing was merged to obtain `DATABASE_URL`.**

### Development holds the same archive, which is worth more than it sounds

Measured on both projects: `ai.raw_matches` **46,215**, `ai.historical_market_prices` **272,084**, nine divisions — *identical*. The bulk studies therefore never needed Production at all. Two consequences: the heaviest work can avoid the environment under promotion entirely, and because the workflow's concurrency group is keyed on the target, a Development stream and a Production stream **run in parallel** rather than queueing behind one another.

---

## 12. The unused Over/Under and Asian-handicap archive — audited

The brief asks for an exact audit before any use. `ai.historical_market_prices` is the table; nothing in the repository reads it.

### Exact counts

| market | bookmaker column | rows | matches | lines |
|---|---|---|---|---|
| OU | AVG | 45,406 | 22,703 | 2.5 only |
| OU | B365 | 45,372 | 22,686 | 2.5 only |
| OU | MAX | 45,406 | 22,703 | 2.5 only |
| AH | AVG | 45,366 | 22,683 | −3.50 … +3.75 |
| AH | B365 | 45,168 | 22,584 | −3.50 … +2.50 |
| AH | MAX | 45,366 | 22,683 | −3.50 … +3.75 |

**272,084 rows in total** — Over/Under 136,184 and Asian handicap 135,900. The brief's "approximately 136,000" is one of the two families; the archive is twice that.

### Three structural facts that constrain every proposed use

**1. `phase` is `'pre'` for all 272,084 rows. There is not one closing price.** The 1X2 columns on `ai.raw_matches` carry both (`odds_*` and `close_*`); these do not. So closing-line value on totals or handicaps is **not computable from this archive**, and any experiment framed as CLV on these markets is dead before it starts. The 1X2 CLV work is unaffected.

**2. Coverage is a clean chronological cut at 2019/20, not scattered missingness.** By division the coverage looked like uniform ~48–50% everywhere, which is the shape of a *date* boundary rather than a league gap. By season it is exact:

| seasons | matches | with OU |
|---|---|---|
| 2012/13 – 2018/19 | 23,492 | **0 (0.0%)** |
| 2019/20 – 2026/27 | 22,723 | 22,703 (**99.9%**) |

This matters more than the headline count. The usable sample is **seven complete seasons plus the start of 2026/27**, all recent and all contiguous — good for a benchmark, but it means a market-informed feature exists only from 2019/20. Under the existing `--min-train-seasons 5` walk-forward, that leaves very few evaluable folds, and a market-informed model must therefore be judged on a **deliberately short** window and said to be.

**3. `MAX` and `AVG` are not bookmakers.** `AVG` is the market mean and `MAX` the best available price — `MAX`'s Asian-handicap maximum of 199.00 against B365's 3.40 is an aggregation artefact, not a quote. A calibration benchmark wants `AVG` (or a de-overrounded `AVG`); `MAX` answers a different question and would bias any implied probability low.

### Proposed first experiment — benchmark only

**Does the Poisson goal grid's implied P(Over 2.5) calibrate against the market's?** It is first because it needs no schema change, no new feature and no model change: `ai/markets.py` already derives `over_under(grid, 2.5)`, the archive is exactly the 2.5 line, and the outcome is `home_goals + away_goals > 2.5`, which `ai.raw_matches` holds. Compare, over 2019/20 onward, the model's Brier/log loss and reliability curve against de-overrounded `AVG` — the market is the benchmark, and beating it is not expected; the diagnostic value is in the **sign and shape of the disagreement**, which says whether the goal model is systematically over- or under-predicting totals in a way the 1X2 view cannot show.

**Not run in this session** — it is a new study, and the session's execution budget went to the eight declared ones. It is specified here so it can be declared before it is seen, like the GBM candidates.

The Asian-handicap family is deliberately second: its line varies per match, so it needs the line-selection semantics settled before it can be read as a strength estimate.

---

## 13. Base models over all nine leagues, on real football

`--study base-model`, nine expanding-season chronological folds per league, paired against the best family in that league. Run **31729652899** (Development, read-only, `f9ba04c`), 18:13–18:20 UTC, 6m 47s for all nine.

Mean log loss. `baseline` is the class base rate; `vs best` is the paired delta against the winning family in that league.

| league | baseline | **poisson** | **elo** | logistic | **gbm** | best |
|---|---|---|---|---|---|---|
| EPL | 1.0671 | 0.9748 | **0.9747** | 0.9926 | 1.1387 | elo |
| ECH | 1.0773 | **1.0484** | 1.0486 | 1.0643 | 1.1659 | poisson |
| EL1 | 1.0744 | **1.0326** | 1.0357 | 1.0439 | 1.1651 | poisson |
| EL2 | 1.0800 | **1.0594** | 1.0631 | 1.0782 | 1.2075 | poisson |
| ENL | 1.0782 | 1.0397 | **1.0396** | 1.0475 | 1.1631 | elo |
| SPL | 1.0681 | **0.9536** | 0.9569 | 0.9835 | 1.2641 | poisson |
| SCH | 1.0881 | 1.0966 | **1.0562** | 1.5541 | 1.4423 | elo |
| SL1 | 1.0724 | 1.0271 | **1.0209** | 1.0974 | 1.4326 | elo |
| SL2 | 1.0716 | **1.0324** | 1.0388 | 1.0981 | 1.4459 | poisson |

Paired deltas against the league's best, with standard errors:

| league | logistic | gbm |
|---|---|---|
| EPL | +0.0179 ± 0.0046 **WORSE** | +0.1640 ± 0.0120 **WORSE** |
| ECH | +0.0159 ± 0.0034 **WORSE** | +0.1175 ± 0.0161 **WORSE** |
| EL1 | +0.0113 ± 0.0018 **WORSE** | +0.1325 ± 0.0093 **WORSE** |
| EL2 | +0.0188 ± 0.0034 **WORSE** | +0.1481 ± 0.0109 **WORSE** |
| ENL | +0.0079 ± 0.0021 **WORSE** | +0.1236 ± 0.0141 **WORSE** |
| SPL | +0.0299 ± 0.0057 **WORSE** | +0.3106 ± 0.0340 **WORSE** |
| SCH | +0.4979 ± 0.4317 tie | +0.3861 ± 0.0460 **WORSE** |
| SL1 | +0.0765 ± 0.0273 **WORSE** | +0.4116 ± 0.0336 **WORSE** |
| SL2 | +0.0658 ± 0.0170 **WORSE** | +0.4135 ± 0.0344 **WORSE** |

### What this settles

**GBM must come out of `ENSEMBLE_BASE_FAMILIES`.** It is worse than the league's best family in **all nine**, every one beyond noise, by +0.1175 to +0.4135. The stronger fact is the comparison the table makes available for free: in **eight of the nine** the GBM is also worse than the **base rate** — 1.1387 against 1.0671 in the EPL, 1.4459 against 1.0716 in SL2. A component that loses to "always predict the class frequencies" is not carrying information into a blend; it is carrying noise, with a weight. That is the mechanism behind the brief's observation that the equal blend lost to its own best component in all three leagues it had been measured on.

This is the §2 diagnosis reproduced on real football rather than on synthetic seasons, and it is *worse* in the lower divisions — SL1, SL2 and SCH are the three biggest gaps, which is what a memorising learner does when given fewer rows.

**Logistic does not earn ensemble membership either**, and the brief was right that it deserved a fair test rather than dismissal for being simple. It is much closer than the GBM — usually +0.008 to +0.03 — and it is genuinely competitive in the EPL (0.9926 against 0.9747). But it is beyond noise in eight of nine, and its one "tie" is not a good result: SCH returns 1.5541 with a standard error of **0.4317**, an order of magnitude larger than any other cell in the table. That is a fit that fell apart on at least one fold, not a fit that drew.

**Poisson and Elo are a genuine pair**, and neither dominates. Elo wins EPL, ENL, SCH, SL1; Poisson wins ECH, EL1, EL2, SPL, SL2. In seven of nine the two are inside 0.007 of each other and the verdict between them is `tie`. Only EL2 separates them beyond noise (+0.0037 ± 0.0014 to Elo's disadvantage).

**One league is a genuine outlier and should not be smoothed over.** In SCH the Poisson model is *worse than the base rate* (1.0966 against 1.0881) and the logistic model is catastrophic; only Elo beats the baseline. Whatever a global default does, a single global family would be actively wrong for the Scottish Championship.

### Corroboration against the brief's earlier figures

The brief's prior real-football numbers were EPL best-single 0.98722, SPL 0.95225, EL2 1.05991. This run returns 0.9747, 0.9536 and 1.0594 on the same leagues — the same ordering and within a few thousandths on two of the three, from an independent run at a different fold count. The earlier evidence reproduces.

### What is **not** claimed

No promotion. `ai.models.status` is untouched, no artefact was trained or serialised, and `ENSEMBLE_BASE_FAMILIES` is **not edited by this session** — §14 records the recommendation and the evidence for it, and changing a default model authority is a separate decision with its own approval. Nothing was written to `ai.feature_experiments`: the run was read-only, so these results live in this document and in the run's artefact, not in the ledger.

---

## 14. Half-life over all nine leagues

`--study half-life`, nine folds, baseline the shipped **900 days**, candidates 0/180/365/540/730/900/1200. Run **31730086103** (Development, read-only, `3177a57`), 18:20–18:23 UTC.

| league | 900d (shipped) | 1200d | paired delta | se | verdict | study's recommendation |
|---|---|---|---|---|---|---|
| EPL | 0.9748 | 0.9744 | −0.0004 | 0.0002 | **BETTER** | 1200d |
| ECH | 1.0484 | 1.0482 | −0.0002 | 0.0001 | tie | keep 900d |
| EL1 | 1.0326 | 1.0324 | −0.0002 | 0.0000 | **BETTER** | 1200d |
| EL2 | 1.0594 | 1.0592 | −0.0002 | 0.0002 | tie | keep 900d |
| ENL | 1.0397 | 1.0396 | −0.0001 | 0.0001 | tie | keep 900d |
| SPL | 0.9536 | 0.9529 | −0.0006 | 0.0002 | **BETTER** | 1200d |
| SCH | 1.0966 | 1.0960 | −0.0006 | 0.0005 | tie | keep 900d |
| SL1 | 1.0271 | 1.0264 | −0.0007 | 0.0003 | **BETTER** | 1200d |
| SL2 | 1.0324 | 1.0314 | −0.0009 | 0.0005 | **BETTER** | 1200d |

**The brief's three prior results reproduce exactly.** It recorded EPL 1200d vs 900d at −0.00041 ± 0.00015, SPL at −0.00063 ± 0.00023, and EL2 within noise with 900 retained. This run returns −0.0004 ± 0.0002, −0.0006 ± 0.0002, and a tie retaining 900. That is the strongest available evidence that the hosted read-only path reproduces the earlier real-football measurements rather than merely producing plausible new ones.

**No default change is recommended.** 1200d clears noise in five leagues and not in four, and every effect is between 0.0001 and 0.0009 log loss — real, consistently signed, and too small to justify moving a shipped default on its own. The four "keep 900d" verdicts are the study's own rule refusing to move on an effect it cannot separate.

### An unlooked-for result: the decay may be doing almost nothing

The **0d** row — uniform weights, no time decay at all — was not what the study was pointed at, and it is the most interesting column in the table. It is a `tie` in all nine leagues, but its paired delta against the 900d baseline is **negative in eight of nine** (EPL −0.0011, ECH −0.0007, EL2 −0.0001, ENL −0.0002, SPL −0.0014, SCH −0.0040, SL1 −0.0017, SL2 −0.0027; EL1 exactly 0.0000), and its raw mean is the **best in the whole table** for EPL, SPL, SCH, SL1 and SL2 — better than the 1200d the study recommends.

Each league taken alone says "tie", because 0d's standard error is the largest in every row: dropping the weighting makes the fit noisier fold to fold. But eight of nine leagues agreeing in sign is not what nine independent coin flips look like, and the leagues where 0d looks best are the same lower divisions where §13 found the GBM worst — i.e. the ones with the least data, where discarding old matches costs most.

This is stated as an **observation, not a finding**, and deliberately not acted on. The half-life grid was declared to answer "which decay", and reading "perhaps none" out of the same run is exactly the after-the-fact reinterpretation §3 exists to prevent. It deserves its own predeclared study — one that pairs 0d against the shipped 900d directly across all nine leagues, and reports the fold-level variance rather than only the mean — before anyone concludes the time weighting is not earning its place.

---

## 15. Elo margin / red-card-aware rating updates

`--study elo-margin`, nine folds, `plain` against `red_card_aware`. Run **31730431239** (Development, read-only), 18:24–18:26 UTC. All nine leagues ran and are in the run's artefact; **four were read back from the job log and are reported here** — the log was not paged further because the result was already unambiguous.

| league | plain | red_card_aware | delta | se | verdict |
|---|---|---|---|---|---|
| SPL | 0.9536 | 0.9536 | +0.0001 | 0.0001 | tie |
| SCH | 1.0966 | 1.0967 | +0.0001 | 0.0001 | tie |
| SL1 | 1.0271 | 1.0274 | +0.0003 | 0.0002 | tie |
| SL2 | 1.0324 | 1.0324 | +0.0001 | 0.0001 | tie |

**A null result, and worth having as one.** Every delta is positive — the red-card-aware rule is fractionally *worse* — and every one is inside its own standard error. The effect is at the fourth decimal place of log loss, which is the size of a rounding difference rather than of a football effect.

Keep `plain` as the default. The red-card-aware rule stays a declared candidate rather than being deleted: it is a reasonable hypothesis that measured as nothing on this archive, and that is a result rather than a reason to remove the code.

---

## 16. Aberdeen v Dundee — still not resolved, and now for a demonstrable reason

Re-checked at **18:13 UTC on 13 August 2026**. All eight Premier Sports Cup last-16 ties remain prospective; the earliest kickoff is Friday 14 August, 19:45. §5a's clock statement stands and nothing has been back-dated.

The orientation question was re-attempted and **failed again**, but this time the failure is diagnosable rather than merely inconclusive.

Direct retrieval is impossible here: `spfl.co.uk`, `www.afc.co.uk` and `en.wikipedia.org` are all refused by the egress proxy (`EGRESS_BLOCKED`), so the competition's own page cannot be read. Only a search tool is available, and it returns an **LLM-written summary of snippets** rather than the source text. Asked three ways, it produced:

1. unrestricted — "Aberdeen will play Dundee … at **Pittodrie Stadium**";
2. restricted to `spfl.co.uk` — "at **Dens Park** (not at Pittodrie as your query suggested)";
3. asked for the full eight-tie list — "**Aberdeen v Dundee at Dens Park**".

Answer 3 is the useful one, because it is **internally inconsistent**. Every other tie in the same list pairs the first-named club with its own ground — Kilmarnock/Rugby Park, Dundee United/Tannadice, Hearts/Tynecastle, Hibernian/Easter Road, Stenhousemuir/Ochilview, Rangers/Ibrox, Dunfermline/East End Park. Only the Aberdeen/Dundee row breaks the pattern, naming one club first and the other club's ground. One of the two halves of that row is wrong and nothing available here says which. Answer 2's parenthetical arguing with the query is the same tell: a summariser reasoning, not a source quoting.

So there is no authoritative resolution, and a majority vote across three summaries of unknown provenance is exactly what §5a declined to do. **The fixture is excluded from prospective home/away modelling**, per the brief's own instruction, rather than guessed at. `CupTie.orientation_confirmed=False` already drives data confidence to `low`; exclusion is the stronger and correct treatment while home advantage is worth roughly 60 Elo points.

The other seven ties are unaffected — their orientation is consistent across every source seen.

**No prospective forecast was produced for any tie, including the seven that are orientationally clean.** A forecast needs a fitted model, and the runs in §13–§15 are *studies*: they evaluate on folds and serialise nothing. Producing one would mean training and persisting an artefact, which is a model-authority action this session is not taking. The path is now unblocked — the `research` task proves a fitted model can be produced on the hosted runner from the full archive — so this is a next-session action rather than a standing obstacle.

---

## 17. Why a cup forecast still cannot be stored — measured against the live schema

§9 proposed a shape. This is the constraint it has to satisfy, read from Production rather than inferred:

```
league          text    NOT NULL
predictions_target_present  CHECK (num_nonnulls(fixture_id, raw_match_id) >= 1)
predictions_fixture_id_fkey     FOREIGN KEY (fixture_id)    REFERENCES ai.fixtures(id)
predictions_raw_match_id_fkey   FOREIGN KEY (raw_match_id)  REFERENCES ai.raw_matches(id)
```

Both permitted targets are league-shaped, and `league` cannot be omitted. A cup tie has neither a `raw_match_id` (it is not in the historical league archive) nor an `ai.fixtures` row (that table carries league/division semantics too). Writing `'scottish_league_cup'` into `league` would put a competition identifier into a column whose every other row holds a division key, and whose consumers — `ai.valid_predictions`, evaluation, settlement, the value engine — all read it as one.

**So the refusal to store a cup forecast is structural, not conservative.** §9's proposed shape stands unchanged, and **no migration is created and no contract number is claimed**: Production is at 185 and being promoted to 188 by a separate session, and the next free contract number cannot be established until that lands and every open pull request is re-read.

---

## 18. Recommendations after the real-league runs — still recommendations

1. **Remove `gbm` from `ENSEMBLE_BASE_FAMILIES`.** Evidence: §13, nine of nine leagues worse than the best family beyond noise, eight of nine worse than the class base rate. Keep `GradientBoostedModel` in the model zoo and keep the eleven predeclared candidates — a rejected model is evidence, and §3's diagnostic is the thing that would tell us whether a *corrected* GBM deserves reconsideration.
2. **Do not add `logistic` to the default ensemble.** Evidence: §13, beyond noise in eight of nine, and its one tie is an unstable 1.5541 ± 0.4317. It was given an equal test and did not earn inclusion.
3. **Change no half-life default.** Evidence: §14, five leagues clear noise and four do not, on effects of 0.0001–0.0009.
4. **Keep `plain` Elo updates.** Evidence: §15, a null.
5. **Declare and run a `0d` time-weighting study.** Evidence: §14's unlooked-for observation — negative in eight of nine, best raw mean in five. Not acted on here, on purpose.
6. **Run the market-benchmark experiment of §12** before any market-informed feature, and bound it to 2019/20 onward because that is where the data starts.
7. **Nothing is promoted.** `ai.models.status` untouched, no artefact trained or serialised, no default edited.

---

## 19. Safety — restated for the hosted runs

- **Zero** provider calls of any kind by this session, paid or free. Every collection step in every run resolved to `skipped`, and the `research` arm names no provider script. Production's own scheduled poll continued independently (a football-data.org PL fetch at 18:05:06 UTC on 13 August); that is the platform's job, not this session's.
- **Zero** Odds API calls; the collection flag remains `false` and was not read for writing.
- **Zero** Production mutations. The hosted Production run (§ run 31729251308) executed with `AI_READ_ONLY=1`, i.e. `default_transaction_read_only=on`; every ad-hoc Production query in this document is a `select`. `ai.feature_experiments` stood at **9** rows before these runs and no run was permitted to add to it.
- **Zero** Development mutations, on the same guarantee.
- **Nothing merged to `main`**, and nothing was merged in order to obtain `DATABASE_URL` — the runs were dispatched against the branch ref.
- **No migration, no contract number, no cron change, no budget change, no identity repair, no forecast regeneration, no model promotion.**
- The Production 185 → 188 promotion was left entirely to the session that owns it. Its workflows were not edited from this branch.
