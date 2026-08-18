# AI Lab

A private football prediction laboratory for euro28predictor. Admin-only.
Nothing here writes to a public page; the publication gate in
`ai.publication_gate` is off and stays off until you turn it on deliberately.

## Layout

```
ai/
  ../supabase/migrations/20260812070000_ai_lab_operational_loop.sql
                              the single repository contract for the private
                              schema, guards and bounded admin RPCs
  config.py                   leagues, seasons, paths
  aliases.py                  club name reconciliation (Nott'm Forest <-> Nottingham Forest FC)
  db.py                       Postgres access + ai.job_runs bookkeeping
  fetch_history.py            Football-Data.co.uk -> ai.raw_matches
                              plus free historical O/U 2.5 and AH prices
  features.py                 leakage-safe feature construction, division-aware
                              Elo, and the candidate feature families
  fitting.py                  time decay and the one place a family is fitted
  metrics.py                  log loss, RPS, Brier, calibration
  model_zoo.py                baseline / logistic / Dixon-Coles Poisson /
                              standalone Elo / gradient boosting / market-aware
  market_features.py          the pre-match price block, and the guard that
                              refuses a closing price as a feature
  ensemble.py                 out-of-fold base predictions, blend and stacker
  calibration.py              applied calibration, fitted out-of-fold only
  confidence.py               model agreement, data confidence, uncertainty —
                              three different things, kept apart
  artifacts.py                what a stored model is, and the feature schema it
                              must be given
  train.py                    evaluate out-of-time, THEN fit the final artefact
  predict.py                  score upcoming fixtures with the current model
  explain.py                  structured evidence for why a prediction says it
  evaluate.py                 grade finished fixtures, then diagnose them
  diagnose.py                 post-match categories: variance or a real weakness
  value_engine.py             the strict BET / PASS gate and its reason codes
  accumulator.py              deterministic combination search with a
                              correlation rule
  data_quality.py             what is missing, and what would plausibly help
  regime.py                   has this club become a different club?
  schedule_context.py         the cup and European midweeks congestion needs
  market_timing.py            price movement research, refusing to fit without
                              a sample
  experiments.py              paired walk-forward studies: half-life, Elo
                              transition, ensemble, calibration
  tools.py                    the bounded operations a conversational layer may
                              call — it explains these results, it does not
                              compute them
  oddsapi.py                  offline Odds API cost model and response parser
  odds_api.py                 cost-free planner and local/manual diagnostics;
                              hosted calls are made by Supabase, not Actions
  markets.py                  every goal market from one scoreline grid
  card_corner_models.py       cards/corners: negative-binomial count models
  sync_fixtures.py            Football-Data fixtures -> ai.fixtures, all divisions
  betting.py                  de-vigging (Shin/power/multiplicative), EV, Kelly, CLV
  backtest.py                 staking simulation, bootstrap CIs, power analysis
  fetch_fixtures_odds.py      free twice-weekly price feed, all nine divisions
  find_value.py               model probabilities vs prices -> ai.bets
  settle_bets.py              settlement and closing-line value
  test_pipeline.py            offline checks: no leakage, beats baseline, calibrated
  test_betting.py             offline checks: de-vig, negative control, power
  test_parsers.py             parsers against the REAL Football-Data headers
  test_oddsapi.py             cost model, budget guard, response parsing
  test_models.py              guardrails: leakage, ratings, artefacts,
                              calibration, evidence, decisions, diagnosis
  test_training.py            stage separation, source assertions, and mutation
                              tests that break each guard on purpose
  test_db_lifecycle.py        PostgreSQL proof of SC3 + EPL lifecycle variants,
                              and of contract 186's evidence tables
  run_leagues.sh              one command across all nine leagues: every league
                              attempted, any failure named and the exit status
                              non-zero
  check_write_scope.py        refuses the package if any write names a relation
                              outside schema `ai`
  models/                     trained artefacts (gitignored)
  reports/                    validation reports (gitignored)
```

## First run

```bash
git clone YOUR_REPOSITORY && cd Euro-2028-Predictor
bash scripts/agent-tools/ai-sync.sh test
source ai/.venv/bin/activate
cd ai
cp .env.example .env      # then fill in DATABASE_URL

python test_pipeline.py                            # no database needed
python test_betting.py                             # no database needed
python test_parsers.py                             # no database, no network
python test_oddsapi.py                             # no database, no network
# The schema is applied only through the repository's guarded Supabase
# migration workflow. Do not run a second migration chain from this directory.

# Downloads each Football-Data division once. League-by-league importing
# repeats neighbouring tiers and needlessly increases 429/502 exposure.
python fetch_history.py --all-divisions
python sync_fixtures.py
python train.py --league EPL --family baseline --version v0.1
python train.py --league EPL --family logistic --version v0.2
python train.py --league EPL --family poisson  --version v0.3 --walk-forward
```

`pyproject.toml` declares the core and optional dependency groups; `uv.lock`
pins the complete Python 3.12 environment. Hosted jobs always use the `core`
profile, tests add the `test` and `analytics` groups, and the optional local
observability lane uses the `observability` profile. Update dependencies with
the centrally pinned uv version and commit the resulting lock; never replace a
locked hosted install with an ad-hoc `pip install`.

A hosted project does the same thing in one action: run the **AI Lab jobs**
workflow with task `bootstrap`, choosing `development` or `production` as the
target. It imports every division's full history, syncs fixtures, collects the
free prices and trains one challenger per league. It promotes nothing, so the
lab still produces no prediction until a human promotes a model — which is the
next step and is deliberately not automated.

## Which environment the lab runs against

The target is a choice. `development` needs `SUPABASE_DEV_DB_URL`;
`production` needs `SUPABASE_PROD_DB_URL`. Each is checked to name that
project's ref, so a secret pointing at the wrong project fails rather than
crosses. Scheduled runs read the `AI_LAB_SCHEDULED_TARGET` repository
variable and fall back to `development`.

What makes a hosted target safe is not care but `check_write_scope.py`, which
runs **before** the credential is resolved: every write in this package must
name a relation in schema `ai`, which ADR 0029 gives no authority over
fixtures, results, scoring, locks, standings, progression, memberships or
player predictions. A package that could write a platform table never learns
the database URL.

Production is where the live competitions are and where the paid odds budget
is enabled, so it is a legitimate target. It is still the environment carrying
real players, so prefer proving a change on Development first.

Then promote one. **A model becomes `current` only through a signed-in admin**,
and that is deliberate — `predictor_internal.require_competition_admin()` reads
`auth.jwt() -> 'app_metadata'` and passes only for `admin_role = 'super_admin'`
or an `admin_capabilities` array containing `competitions`.

So promotion needs a browser session, not a database connection:

```
npm run dev      # pointed at the target project, sign in as an admin
                 # then /admin/ai, choose the challenger, give a reason
```

`admin_ai_promote_model` is granted to `authenticated`, so any signed-in admin
session can call it — the dashboard is the convenient route, not the only one.

**What does not work**, though this file used to recommend it:

```sql
-- From psql or the Supabase SQL editor. Raises 42501:
--   'Competition administration is not authorised'
-- There is no JWT on a database connection, so auth.jwt() is null and the
-- guard refuses. Measured on hosted Development, 13 August 2026.
select public.admin_ai_promote_model('<model-uuid>', 'first live model');
```

Do not reach around it by writing `ai.models.status` directly. The RPC is what
verifies the artefact's SHA before a model may go live, and a row edited past
it is a model nobody can prove the weights of.

## The multi-model lab

Six model families, of which three are structurally different views of the
same evidence and one is deliberately impure:

| family | what it is | sees prices |
|---|---|---|
| `baseline` | training-set base rates. The floor, kept for ever | no |
| `logistic` | regularised multinomial logistic regression | no |
| `poisson` | Dixon-Coles goal model. Owns the scoreline grid | no |
| `elo` | ordered logit on the rating difference alone | no |
| `gbm` | histogram gradient boosting, native missingness | no |
| `market` | football features plus the de-vigged pre-match price | **yes** |
| `ensemble` | the above, combined by a stacker fitted out-of-fold | inherited |

`elo` exists because a second opinion has to be able to disagree. Elo was
already a feature; feeding it through the same regression produces the first
model again with different rounding, and a "model agreement" measured between
two such models measures nothing.

The ensemble is one artefact. Its components live inside it rather than beside
it, so `ai.models`' guarantee of one `current` model per league — the thing
that stops two models writing predictions for the same fixture — is untouched.

### What is measured, and what is decided

```bash
python ablate.py      --league EPL                    # does a feature family earn its place
python experiments.py --league EPL --study half-life  # per-league recency
python experiments.py --league EPL --study elo-transition
python experiments.py --league EPL --study ensemble
python experiments.py --league EPL --study calibration
python experiments.py --league EPL --study regime-weighting --record
```

Every study is paired over the same expanding-window folds and reports the
standard error on the DIFFERENCE. A configuration wins when the whole
two-standard-error interval sits on the right side of zero; everything else is
a tie, and a tie leaves the simpler setting alone. `--record` writes the result
to `ai.feature_experiments` **including a null result**, because running twenty
studies and keeping the best is how a lab convinces itself of things that are
not true.

### Four numbers that are not the same number

```
outcome probability     Arsenal win 67%
model agreement         the four base models said 67 / 66 / 68 / 65
data confidence         high — ten matches of form each, full shot coverage
probability uncertainty 62% – 71%
```

67/66/68/65 and 82/51/73/62 average to the same headline and are not the same
evidence. A 70% favourite may carry limited data confidence. "70% confidence"
is a sentence this package does not produce.

### BET, or a reason

`find_value.py` records a decision for every candidate, not only the ones it
likes. `BET`, or one of `PASS_LOW_EDGE`, `PASS_STALE_PRICE`, `PASS_LOW_DATA`,
`PASS_HIGH_MODEL_DISAGREEMENT`, `PASS_WIDE_UNCERTAINTY`,
`PASS_MARKET_DISCREPANCY`, `PASS_INPUT_PENDING`, `PASS_LONGSHOT`,
`PASS_ODDS_OUT_OF_RANGE`, `PASS_UNBETTABLE_BOOK`, `PASS_NO_MARKET_REFERENCE`.

`public.admin_ai_recommendation_log` counts which gate is firing, which is the
most useful thing this lab produces on a quiet week: passing on price, on data
and on disagreement have completely different fixes.

## What is deliberately switched off, and why

Nothing here is disabled because it sounded wrong. Each is disabled because it
was measured, or because the instrument that would measure it does not yet see
the phenomenon.

| thing | state | why |
|---|---|---|
| `halftime` features | off | measured as noise in EPL, SPL and EL2 |
| `congestion` features | off | the counts see league Saturdays only; `schedule_context` is the missing input and carries no data yet |
| `performance` features | off | new; needs a paired ablation before DEFAULT_GROUPS |
| red-card-aware Elo | off | `experiments.py --study elo-margin` decides it |
| regime weighting | off | `experiments.py --study regime-weighting` decides it |
| market-timing model | off | `ai.market_snapshots` has no sample; the analysis reports INSUFFICIENT_DATA and fits nothing |
| `gbm` and `market` in the live ensemble | off | registered and testable; they enter only by winning walk-forward folds |

A null result from an instrument that cannot see the phenomenon is not
evidence about the phenomenon. That is why `congestion` is documented rather
than deleted.

## Where this stops, and what the next slice is

Written down because the alternative is rediscovering it. Everything below is
implemented and tested; what is missing in each case is *evidence from real
football*, which needs a database this branch was developed without.

**Nothing in this branch has been measured against real data.** Every number in
the test suite comes from synthetic leagues, which prove that the code does what
it says and prove nothing whatsoever about football. The measured ablation
evidence in `features.py` — shots, corners, conversion, half-time, congestion —
predates this work and remains the authority for `DEFAULT_GROUPS`.

In priority order:

1. **Re-measure the feature families under the corrected Elo transition.** The
   recorded deltas were measured while every club drifted toward 1500 each
   summer. The families are very unlikely to change verdict, but the numbers
   are no longer exactly like-for-like and should be re-run rather than
   assumed. `ablate.py --league EPL|SPL|EL2`.
2. **Run the studies.** `experiments.py --study elo-transition` sizes the
   rating fix; `--study half-life` is the per-league recency tuning that has
   never been done; `--study ensemble` decides whether the stacker beats the
   best single model; `--study calibration` decides whether calibration is
   adopted at all. Each with `--record`. The AI Lab jobs workflow has an
   `experiments` task for exactly this.
3. **Ablate the `performance` family and the red-card margin rule**, which are
   this branch's two research candidates and are switched off until they win.
4. **Train an ensemble challenger and read its report** before promoting
   anything: `train.py --league EPL --family ensemble --version vX
   --walk-forward`. Promotion stays a human action through the admin UI.
5. **Collect market snapshots.** `market_timing.py` reports INSUFFICIENT_DATA
   and fits nothing, correctly, because `ai.market_snapshots` is empty. The
   analysis path is written; only the collection is missing.
6. **Find a schedule feed** for the cup and European midweeks, record it
   through `ai.observations` with `known_at`, and only then re-run the
   congestion ablation. `schedule_context.coverage()` refuses below 90% of a
   league's clubs, because partial coverage is a bias correlated with exactly
   the clubs the feature is about.
7. **Roll contract 186 to Development** through the guarded fast lane, then
   re-run the lab end to end there. It is additive and hosted nowhere today.

Not started, and deliberately: injury and lineup observations (no proven
endpoint in the provider audit), market-specific calibration for over/under and
both-teams-to-score (needs its own evidence, and the 1X2 calibrator must not be
borrowed for it), and any conversational layer above `tools.py`.

## The rules this codebase enforces for you

- A prediction cannot be written after kickoff. Database trigger, not a convention.
- A prediction cannot be updated. Grades live in a separate table.
- Only one model per league is `current`. Unique partial index.
- No browser role can read anything in `ai`. RLS on, zero policies.
- Promotion requires a human and a written reason.
- Mutable facts (injuries, odds, line-ups) are append-only and stamped with
  `known_at`. Read them only via `ai.observations_as_of()`, never directly.
- A change in validation log loss smaller than ~0.02 is noise. Use
  `--walk-forward` and record the verdict in `ai.feature_experiments`.
- Evaluation and deployment are two stages. Every reported number comes from a
  model fitted strictly before the matches it is scored on; the artefact that
  ships is then fitted fresh on every eligible completed match, so last
  Saturday reaches next Saturday's forecast.
- A stored model is given the feature schema it was trained on, from its own
  artefact, and a missing feature is a loud failure. It is never replaced with
  a neutral value: a neutral value is a claim about a team.
- A calibrator is fitted only on out-of-fold predictions. Fitted in-sample it
  learns that the model is under-confident — on rows it memorised — and then
  sharpens every live probability, which is the opposite correction.
- Closing prices are never a feature. They are the benchmark, they sit in the
  same frame as the features, and `market_features.assert_no_closing_features`
  is what keeps them out.
- A price with no capture time, or one too old for how close kickoff is, is a
  PASS. An edge against a price nobody is offering is arithmetic, not value.
- Two markets on one fixture are never combined into an accumulator: their
  joint probability is only available from the scoreline distribution.
- One match may never modify or promote a model. A repeated diagnostic pattern
  becomes a candidate experiment for a human to run, and nothing else.
- A bet cannot be advised after kickoff, and a non-paper bet cannot be recorded
  against an aggregate "price" like Max or Avg, which is not bettable.
- Closing-line value is the scoreboard, not profit. A true +3% ROI needs
  ~14,000 bets to demonstrate; a true +1% CLV needs ~100.
- No selection may be published naming a bookmaker whose GB licence has not
  been verified by hand. Advertising an unlicensed operator is a criminal
  offence under s.330 Gambling Act 2005, and it is the publisher who commits it.
- A model cannot be made `current` unless its artefact is stored in the
  database and its payload SHA matches the model row. Artefact bytes are
  insert-only; a changed model is a new model version.
- MAX is never a CLV benchmark. Its three legs come from different bookmakers
  and its overround is often below 1, so de-vigging it is meaningless.
- Nothing in the lab depends on `public.season_fixtures`. All nine divisions
  run off `ai.fixtures`; the link to the website is a convenience.
- The season to import is derived from the date, never listed. `SEASONS` ends
  at `current_season()` and the daily job asks for `--seasons current`. A
  hard-coded code is the worst kind of wrong here: after 1 July the finished
  season's file still answers 200 with a healthy row count and the job still
  records success, while no new result is ever graded and no bet ever settled.
- A per-league loop attempts all nine and fails loudly. `predict.py` and
  `find_value.py` return 0 when there is no current model, so a `|| true`
  guard around them can only ever hide a real error.
- Fixture odds cannot be inserted without an `ai.fixtures.id`. A parsed row
  that fails canonical matching aborts the transaction instead of becoming an
  invisible orphan.
- Football-Data's free O/U 2.5 and Asian-handicap prices are retained for both
  historical matches and upcoming fixtures; they are no longer parsed and
  discarded while only 1X2 survives.
- A played bet is not finalised until a valid Pinnacle or average closing line
  exists. Result-before-close timing therefore defers settlement rather than
  permanently recording `clv = null`.
- `ai.bets.selection` supports generic market labels, and settlement records
  distinguish win/loss/push/half-win/half-loss. Automated selection and
  settlement remain intentionally limited to 1X2 until each additional market
  has a trustworthy closing-price feed.
- No Odds API call happens without a pre-flight cost estimate and a check
  against `ai.api_budget.soft_cap`. The default is the free 500-credit plan
  with a 450-credit cap; twice-weekly live h2h/totals collection uses roughly
  80 credits/month. Historical calls are unavailable on free and are refused.
- `odds_api.py plan` costs nothing and must be run before any backfill.
  `backfill` refuses without `--confirm` and refuses if the preset exceeds the
  remaining monthly allowance.
- Hosted API keys never enter Python or GitHub Actions. Supabase Edge Functions
  read the paid key from the `ODDS_API` project secret and record only a
  credential-free request URL. The `AI_ODDS_POLL` caller secret protects the
  function; scheduled database calls use the matching Vault secret named
  `provider_poll_caller_key`.
- An Odds API event that cannot be resolved to a fixture is recorded as
  unmatched and its prices are discarded. A price on the wrong match is worse
  than a missing price.
