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
  features.py                 leakage-safe feature construction
  metrics.py                  log loss, RPS, Brier, calibration
  model_zoo.py                baseline / logistic / Dixon-Coles Poisson
  train.py                    train a challenger, report against benchmarks
  predict.py                  score upcoming fixtures with the current model
  evaluate.py                 grade finished fixtures
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
  test_db_lifecycle.py        PostgreSQL proof of SC3 + EPL lifecycle variants
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
cd ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
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
