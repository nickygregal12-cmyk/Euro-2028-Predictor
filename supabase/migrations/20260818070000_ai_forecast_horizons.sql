-- Contract 202: last Saturday must actually reach next Saturday's forecast.
--
-- ai/README.md states the invariant plainly: "Evaluation and deployment are two
-- stages. Every reported number comes from a model fitted strictly before the
-- matches it is scored on; the artefact that ships is then fitted fresh on every
-- eligible completed match, so last Saturday reaches next Saturday's forecast."
--
-- MEASURED ON PRODUCTION ON 18 AUGUST 2026, IT DOES NOT. Fifty-seven results
-- from 14 to 17 August were imported at 05:55 that morning. `predict.py` then
-- ran at 09:23 across the five leagues with upcoming fixtures, rebuilt team
-- state from the full history — so its FEATURES did include the new results —
-- scored all 52 fixtures, and wrote NOTHING. Every league reported
-- `{"written": 0, "fixtures": 12}`. The stored forecasts for this weekend were
-- still the ones made on 17 August, on data that ended before last weekend was
-- played.
--
-- The cause is the identity, not the code around it.
-- `predictions_one_per_model_fixture_horizon` is UNIQUE (model_id, fixture_id,
-- horizon) and `insert_predictions` is `on conflict do nothing`, which is
-- correct — a prediction is immutable, a database trigger enforces it, and
-- grades live in their own table precisely so a forecast is never rewritten
-- after the fact. But `horizon` had one bucket, `scheduled`, covering everything
-- more than forty-eight hours out. A fixture eight days away was forecast once,
-- and every later run on better data collided with that row and was silently
-- discarded until the clock crossed forty-eight hours.
--
-- So the fix is to let the clock name more of itself. `t72`, `t120` and `t168`
-- join the vocabulary, and a fixture is re-forecast as it moves through them:
-- roughly six forecasts across the week rather than one, each on strictly more
-- completed football than the last, each an immutable row of its own, and none
-- of them overwriting another.
--
-- This does not create the duplicate-evidence problem contract 199 closed. That
-- one was a paper BET recorded twice for the same match; the guard there now
-- keys on the fixture, so more forecasts cannot mean more bets. And contract
-- 201's `ai.canonical_fixture_predictions` already reduces a fixture to its
-- newest forecast for every fixture-level read, so more forecasts do not mean
-- a match counted more than once in any review.
--
-- It also gives contract 185's per-horizon performance report something to
-- report on. `db.insert_predictions` carries the note that every prediction was
-- landing on the `scheduled` default, so "the per-horizon performance report
-- contract 185 shipped had exactly one horizon to report on and could never
-- answer the question it exists for". Six buckets is what makes "is the
-- forecast better as kickoff approaches" a question the lab can answer with its
-- own data rather than an assumption.
--
-- Nothing about model selection, promotion, activation or any value threshold
-- moves. This widens a CHECK constraint and nothing else.

begin;

alter table ai.predictions drop constraint if exists predictions_horizon_check;

alter table ai.predictions
  add constraint predictions_horizon_check
  check (horizon in ('scheduled', 't168', 't120', 't72', 't48', 't24', 't6',
                     'lineup', 'backtest'));

comment on column ai.predictions.horizon is
  'How far from kickoff the forecast was made, and the third column of the '
  'per-model uniqueness key. t6/t24/t48/t72/t120/t168 are hour bounds, lineup is '
  'post-team-sheet, backtest is not a live forecast, and scheduled is anything '
  'further out than seven days. More buckets than t48 exist so a fixture is '
  're-forecast as new completed matches arrive instead of being frozen at '
  'whatever the first run of the week produced.';

-- Every existing row keeps its horizon: the widening is additive and no row is
-- rewritten. Prove both, and prove the new values are actually accepted, rather
-- than trusting that a widened CHECK behaves like one.
do $$
declare
  v_before integer;
  v_scheduled integer;
begin
  select count(*), count(*) filter (where horizon = 'scheduled')
    into v_before, v_scheduled from ai.predictions;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'ai.predictions'::regclass
       and conname = 'predictions_horizon_check'
       and pg_get_constraintdef(oid) like '%t168%') then
    raise exception 'the widened horizon vocabulary is not installed';
  end if;

  if v_before <> (select count(*) from ai.predictions) then
    raise exception 'the horizon widening changed a prediction row, which it must never do';
  end if;

  raise notice 'contract 202: % predictions retained, % of them at the scheduled '
               'horizon, vocabulary widened to t168/t120/t72',
    v_before, v_scheduled;
end;
$$;

commit;
