-- Contract 189: a quarantined forecast, and the bet advised from it, leave
-- every admin AI evidence read.
--
-- THE ORDER OF THIS FILE IS THE ASSERTION. Everything is created FIRST — two
-- forecasts, a graded result for each, a settled bet with its own result for
-- each, and an open bet for each — and both are then measured as counting.
-- Only after that is one forecast quarantined, and the SAME reads are called
-- again. That sequence is what distinguishes a live authority from a flag
-- copied forward at write time: a design that stamped `invalid` onto the
-- result or the bet when the quarantine was recorded would pass a suite that
-- quarantined first, and would silently keep counting everything already
-- graded. Which is precisely the case Production is in — 37 quarantined
-- forecasts, 0 results, the earliest kickoff 2026-08-14T19:00Z.
--
-- The before/after pairs also make the suite incapable of passing vacuously.
-- If the fixtures failed to insert, or the admin gate rejected the caller, the
-- "before" assertions would report 0 rather than 2 and fail there.

begin;

select plan(36);

-- Admin context is established HERE rather than after seeding, because the
-- baseline below calls the same competition-admin reads the assertions do.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('q189-admin')::uuid, 'role', 'authenticated',
    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);


-- ---------------------------------------------------------------------------
-- THE LAB-WIDE BASELINE, captured before this suite seeds anything.
--
-- Three of the reads below take NO league argument and are lab-wide on purpose:
-- `admin_ai_evidence_by_market`, `admin_ai_betting_gate_status` and
-- `admin_ai_dashboard(null)`. A publication gate that counted only one league's
-- settled bets would be the wrong number to decide publication on.
--
-- Asserting an absolute count against a lab-wide read therefore only holds on
-- an EMPTY database, and CI's is empty. Against a disposable copy of Production
-- carrying 37 quarantined forecasts and 80-odd settled bets, these assertions
-- read `have: 39 want: 2` -- and the READ was right each time.
--
-- That is the same vacuous pass that hid the contract-204 defect, with the
-- blame the other way round: there the read was wrong, here the expectation
-- was. The fix is not to relax the assertion to `>=`, which would stop it
-- noticing a read that counts nothing. It is to assert the DELTA this suite is
-- responsible for, which is exactly what each assertion already meant and is
-- true on an empty database and a populated one alike.
create temporary table lab_wide_baseline on commit drop as
select
  ((public.admin_ai_evidence_by_market() -> '1X2' ->> 'settled_bets'))::integer as market_1x2_settled,
  ((public.admin_ai_betting_gate_status() -> 'settled_bets' ->> 'value'))::integer as gate_settled,
  ((public.admin_ai_dashboard(null) ->> 'quarantined_predictions'))::integer as quarantined_all;

-- ---------------------------------------------------------------------------
-- A model, a fixture each, and two forecasts
-- ---------------------------------------------------------------------------
insert into ai.models (id, league, version, family, training_matches, status)
-- 'challenger' rather than 'current': a current model must have a verified
-- stored artefact, and this suite is about reads rather than about promotion.
values (md5('q189-model')::uuid, 'Q189', 'q189-v1', 'poisson', 500, 'challenger');

insert into ai.fixtures (id, division, season, league_key, match_date,
                         kickoff_at, home_canonical, away_canonical, status)
values
  (md5('q189-f-keep')::uuid, 'Q189', '2627', 'Q189', (now() + interval '3 days')::date,
   now() + interval '3 days', 'Q189 Keepers', 'Q189 Visitors', 'scheduled'),
  (md5('q189-f-drop')::uuid, 'Q189', '2627', 'Q189', (now() + interval '4 days')::date,
   now() + interval '4 days', 'Q189 Doubtful', 'Q189 Strangers', 'scheduled');

-- Both forecasts are upcoming, so both are visible to the upcoming read, and
-- both are graded, so both are visible to every performance read. A real
-- quarantined forecast is graded exactly this way once its match is played:
-- the prediction is immutable and the grading job has no reason to skip it.
insert into ai.predictions (
  id, model_id, league, fixture_id, kickoff_at, home_canonical, away_canonical,
  p_home, p_draw, p_away, predicted_result, predicted_score, features)
values
  (md5('q189-p-keep')::uuid, md5('q189-model')::uuid, 'Q189', md5('q189-f-keep')::uuid,
   now() + interval '3 days', 'Q189 Keepers', 'Q189 Visitors',
   0.50000, 0.25000, 0.25000, 'H', '2-1',
   '{"elo_diff": 40, "season_progress": 0.5, "home_is_newcomer": 0, "away_is_newcomer": 0}'::jsonb),
  (md5('q189-p-drop')::uuid, md5('q189-model')::uuid, 'Q189', md5('q189-f-drop')::uuid,
   now() + interval '4 days', 'Q189 Doubtful', 'Q189 Strangers',
   0.99000, 0.00500, 0.00500, 'H', '6-0',
   '{"elo_diff": 400, "season_progress": 0.5, "home_is_newcomer": 1, "away_is_newcomer": 0}'::jsonb);

insert into ai.prediction_results (
  prediction_id, actual_home_goals, actual_away_goals, actual_result,
  result_correct, exact_score_correct, log_loss, brier, rps)
values
  (md5('q189-p-keep')::uuid, 2, 1, 'H', true, true, 0.69315, 0.25000, 0.12500),
  (md5('q189-p-drop')::uuid, 1, 1, 'D', false, false, 5.29832, 0.99000, 0.49000);

-- A settled bet and an open bet on each forecast. The open pair is what makes
-- the exposure assertion mean something: exposure is money the lab says is at
-- risk right now, and a withdrawn forecast's stake is not.
--
-- THE OPEN PAIR IS ON THE OVER/UNDER MARKET, and the settled pair on 1X2.
-- All four were 1X2 on two fixtures, which contract 199 now reads as two
-- opinions about each match rather than four pieces of evidence: `ai.valid_bets`
-- admits only the canonical advice for a fixture and market, so each pair would
-- collapse and every count below would be measuring the canonical rule instead
-- of the quarantine rule this file is about. Two markets on one fixture are two
-- genuinely different pieces of evidence, so the suite now spans both — and a
-- quarantined forecast must still take BOTH of its bets with it.
insert into ai.bets (
  id, prediction_id, model_id, league, fixture_id, selection, advised_at,
  kickoff_at, bookmaker, odds_taken, model_prob, edge, stake_fraction,
  stake_units, market, line, selection_label, status)
values
  (md5('q189-b-keep-settled')::uuid, md5('q189-p-keep')::uuid, md5('q189-model')::uuid,
   'Q189', md5('q189-f-keep')::uuid, 'H', now(), now() + interval '3 days',
   'PS', 2.500, 0.50000, 0.25000, 0.02000, 2.0000, '1X2', null, null, 'settled'),
  (md5('q189-b-drop-settled')::uuid, md5('q189-p-drop')::uuid, md5('q189-model')::uuid,
   'Q189', md5('q189-f-drop')::uuid, 'H', now(), now() + interval '4 days',
   'PS', 3.000, 0.99000, 1.97000, 0.20000, 20.0000, '1X2', null, null, 'settled'),
  (md5('q189-b-keep-open')::uuid, md5('q189-p-keep')::uuid, md5('q189-model')::uuid,
   'Q189', md5('q189-f-keep')::uuid, 'Over', now(), now() + interval '3 days',
   'B365', 4.000, 0.25000, 0.00000, 0.01000, 1.0000, 'OU', 2.5, 'Over 2.5', 'advised'),
  (md5('q189-b-drop-open')::uuid, md5('q189-p-drop')::uuid, md5('q189-model')::uuid,
   'Q189', md5('q189-f-drop')::uuid, 'Over', now(), now() + interval '4 days',
   'B365', 4.000, 0.00500, -0.98000, 0.05000, 5.0000, 'OU', 2.5, 'Over 2.5', 'advised');

-- `settlement_outcome` is not null and is the canonical settlement across every
-- market; `won` is the 1X2 shorthand beside it and is nullable.
insert into ai.bet_results (
  bet_id, actual_result, won, settlement_outcome, pnl_units, return_per_unit,
  odds_closing, fair_prob_closing, clv, beat_closing_price)
values
  (md5('q189-b-keep-settled')::uuid, 'H', true,  'win',  3.0000,  1.50000, 2.200, 0.45000, 0.12500, true),
  (md5('q189-b-drop-settled')::uuid, 'D', false, 'loss', -20.0000, -1.00000, 8.000, 0.12000, -0.64000, false);

-- The competition-administrator door. Every read below goes through it.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('q189-admin')::uuid, 'role', 'authenticated',
    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);

-- ---------------------------------------------------------------------------
-- BEFORE: both forecasts count everywhere
-- ---------------------------------------------------------------------------
select is(
  ((public.admin_ai_dashboard('Q189') -> 'performance' ->> 'graded'))::integer,
  2,
  'before any quarantine the dashboard grades BOTH forecasts'
);

select is(
  (select sum((b ->> 'n')::integer)::integer
     from jsonb_array_elements(public.admin_ai_dashboard('Q189') -> 'calibration') b),
  2,
  'and both sit in a calibration bucket'
);

select is(
  ((public.admin_ai_performance_breakdown('Q189') -> 'overall' ->> 'n'))::integer,
  2,
  'and the performance breakdown measures both'
);

select is(
  jsonb_array_length(public.admin_ai_recent_results('Q189', 50)),
  2,
  'and both appear in recent results'
);

select is(
  jsonb_array_length(public.admin_ai_upcoming_predictions('Q189', 50)),
  2,
  'and both appear as upcoming forecasts'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') -> 'profit' ->> 'settled_bets'))::integer,
  2,
  'and the betting dashboard settles both bets'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') -> 'clv' ->> 'n'))::integer,
  2,
  'and averages both CLVs'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') -> 'open' ->> 'open_bets'))::integer,
  2,
  'and holds both open bets as exposure'
);

select is(
  ((public.admin_ai_evidence_by_market() -> '1X2' ->> 'settled_bets'))::integer
    - (select market_1x2_settled from lab_wide_baseline),
  2,
  'and the 1X2 market evidence counts both'
);

select is(
  ((public.admin_ai_betting_gate_status() -> 'settled_bets' ->> 'value'))::integer
    - (select gate_settled from lab_wide_baseline),
  2,
  'and the publication gate counts both — this one never joined ai.bets at all'
);

-- ---------------------------------------------------------------------------
-- THE QUARANTINE, recorded after everything above already exists
-- ---------------------------------------------------------------------------
insert into ai.prediction_invalidations (prediction_id, reason_code, note)
values (md5('q189-p-drop')::uuid, 'INVALID_TEAM_IDENTITY',
        'Contract 189 suite: quarantined AFTER its result and both its bets existed.');

select is(
  (select count(*)::integer from ai.valid_predictions
    where id = md5('q189-p-drop')::uuid),
  0,
  'the quarantined forecast leaves ai.valid_predictions'
);

select is(
  (select count(*)::integer from ai.predictions where id = md5('q189-p-drop')::uuid),
  1,
  'and is NOT deleted: the base row survives, because a pipeline that was wrong is a record'
);

select is(
  (select count(*)::integer from ai.prediction_results
    where prediction_id = md5('q189-p-drop')::uuid),
  1,
  'its grading survives too — nothing here rewrites history to make a dashboard tidy'
);

select is(
  (select count(*)::integer from ai.bets where prediction_id = md5('q189-p-drop')::uuid),
  2,
  'and both of its bets survive, with their status untouched'
);

select is(
  (select count(*)::integer from ai.valid_bets
    where prediction_id = md5('q189-p-drop')::uuid),
  0,
  'while ai.valid_bets drops them without anybody updating a row'
);

-- ---------------------------------------------------------------------------
-- AFTER: the same calls, the same data, one fewer forecast counted
-- ---------------------------------------------------------------------------
select is(
  ((public.admin_ai_dashboard('Q189') -> 'performance' ->> 'graded'))::integer,
  1,
  'the dashboard now grades ONE: a result that already existed stops counting immediately'
);

select is(
  ((public.admin_ai_dashboard('Q189') -> 'performance' ->> 'accuracy'))::numeric,
  1.00000::numeric,
  'and its accuracy is the valid forecast''s alone, not the average of a right one and a withdrawn wrong one'
);

select is(
  (select sum((b ->> 'n')::integer)::integer
     from jsonb_array_elements(public.admin_ai_dashboard('Q189') -> 'calibration') b),
  1,
  'calibration counts one observation — the 99% bucket the broken identity produced is gone'
);

select is(
  ((public.admin_ai_dashboard('Q189') ->> 'quarantined_predictions'))::integer,
  1,
  'and the dashboard says how many forecasts it is excluding, so a shrinking graded count is legible'
);

-- ---------------------------------------------------------------------------
-- A SECOND LEAGUE'S QUARANTINE, so the count above cannot pass by accident
--
-- The assertion directly above passed for the whole life of this suite and was
-- MEANINGLESS, because the database CI builds holds nothing but this fixture:
-- with one league seeded, the lab-wide count and the Q189 count are the same
-- number, and a read returning either would satisfy it.
--
-- It failed for the first time in the 198-to-203 Production rehearsal, against
-- a disposable copy of Production carrying 37 real quarantined forecasts: the
-- Q189 dashboard answered 38. The test had always been right; contract 204 is
-- what made the function right.
--
-- Seeding a second league here is what stops that regressing quietly. From now
-- on a lab-wide count fails on an empty database too, without needing a copy of
-- Production to notice.
-- ---------------------------------------------------------------------------
insert into ai.fixtures (id, division, season, league_key, match_date,
                         kickoff_at, home_canonical, away_canonical, status)
values
  (md5('q189-f-other')::uuid, 'Q190', '2627', 'Q190', (now() + interval '5 days')::date,
   now() + interval '5 days', 'Q190 Elsewhere', 'Q190 Visitors', 'scheduled');

insert into ai.predictions (
  id, model_id, league, fixture_id, kickoff_at, home_canonical, away_canonical,
  p_home, p_draw, p_away, predicted_result, predicted_score, features)
values
  (md5('q189-p-other')::uuid, md5('q189-model')::uuid, 'Q190', md5('q189-f-other')::uuid,
   now() + interval '5 days', 'Q190 Elsewhere', 'Q190 Visitors',
   0.60000, 0.20000, 0.20000, 'H', '2-0',
   '{"elo_diff": 60, "season_progress": 0.5, "home_is_newcomer": 0, "away_is_newcomer": 0}'::jsonb);

insert into ai.prediction_invalidations (prediction_id, reason_code, note)
values (md5('q189-p-other')::uuid, 'INVALID_TEAM_IDENTITY',
        'Contract 204 suite: a quarantine in ANOTHER league, which Q189 must not count.');

select is(
  ((public.admin_ai_dashboard('Q189') ->> 'quarantined_predictions'))::integer,
  1,
  'the Q189 dashboard still excludes ONE — another league''s quarantine is not Q189''s to report'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') ->> 'quarantined_predictions'))::integer,
  1,
  'and the betting dashboard scopes it the same way, because it explains the same league''s numbers'
);

select is(
  ((public.admin_ai_dashboard(null) ->> 'quarantined_predictions'))::integer
    - (select quarantined_all from lab_wide_baseline),
  2,
  'asked about no league in particular it still answers for the whole lab, which is the question that was asked'
);

select is(
  ((public.admin_ai_performance_breakdown('Q189') -> 'overall' ->> 'n'))::integer,
  1,
  'the performance breakdown measures one'
);

select ok(
  (public.admin_ai_performance_breakdown('Q189') -> 'promoted_clubs'
     -> 'involves newcomer') is null,
  'and the newcomer split — the one a placeholder rating distorts hardest — is empty rather than wrong'
);

select is(
  jsonb_array_length(public.admin_ai_recent_results('Q189', 50)),
  1,
  'recent results shows one'
);

select is(
  (select count(*)::integer
     from jsonb_array_elements(public.admin_ai_recent_results('Q189', 50)) e
    where (e ->> 'id')::uuid = md5('q189-p-drop')::uuid),
  0,
  'and the quarantined forecast is absent BY ID, not merely by count'
);

select is(
  (select count(*)::integer
     from jsonb_array_elements(public.admin_ai_upcoming_predictions('Q189', 50)) e
    where (e ->> 'id')::uuid = md5('q189-p-drop')::uuid),
  0,
  'it is no longer offered as a current forecast either — that read is a display, not just evidence'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') -> 'profit' ->> 'settled_bets'))::integer,
  1,
  'the betting dashboard settles one bet'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') -> 'clv' ->> 'mean_clv'))::numeric,
  0.12500::numeric,
  'and the mean CLV is the valid bet''s alone: the -0.64 from the withdrawn forecast is not averaged in'
);

select is(
  ((public.admin_ai_betting_dashboard('Q189') -> 'open' ->> 'exposure'))::numeric,
  1.000::numeric,
  'open exposure falls to the one unit actually at risk, from six'
);

select is(
  ((public.admin_ai_evidence_by_market() -> '1X2' ->> 'settled_bets'))::integer
    - (select market_1x2_settled from lab_wide_baseline),
  1,
  'the per-market evidence counts one'
);

select is(
  ((public.admin_ai_betting_gate_status() -> 'settled_bets' ->> 'value'))::integer
    - (select gate_settled from lab_wide_baseline),
  1,
  'and the publication gate counts one, which is the number that decides whether any of this is shown'
);

-- ---------------------------------------------------------------------------
-- The structural guard, over INSTALLED definitions rather than migration text
--
-- A future admin AI read that goes back to the base tables must fail here
-- without anybody remembering this contract. `pg_get_functiondef` is used
-- rather than a grep over `supabase/migrations/`, because what a repository
-- says and what a database installed are different claims and only one of them
-- is enforceable at runtime. Comments cannot satisfy it: this asks what the
-- function READS.
--
-- `admin_ai_recommendation_log` is the single stated exception and is required
-- to earn it — it keeps its join to `ai.predictions` so an append-only decision
-- log does not lose rows, and must therefore name the quarantine explicitly.
-- ---------------------------------------------------------------------------
select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.proname), '')
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'admin\_ai\_%'
      and p.proname <> 'admin_ai_recommendation_log'
      -- Line comments are stripped before the question is asked. The first
      -- version of this guard failed on a comment inside
      -- `admin_ai_betting_dashboard` that NAMED `ai.bets` while explaining why
      -- it does not read it. A guard prose can satisfy is worthless; one prose
      -- can break is merely annoying, and both are fixed the same way — ask
      -- what the function READS.
      and (regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') ~ '\mai\.predictions\M'
        or regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') ~ '\mai\.bets\M')),
  '',
  'no admin AI read reaches the base prediction or bet tables; every one goes through valid custody'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_ai_dashboard', 'admin_ai_performance_breakdown',
                        'admin_ai_recent_results', 'admin_ai_upcoming_predictions')
      and pg_get_functiondef(p.oid) like '%ai.valid_predictions%'),
  4,
  'and all four prediction reads name ai.valid_predictions in their installed definition'
);

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_ai_betting_dashboard', 'admin_ai_evidence_by_market',
                        'admin_ai_betting_gate_status')
      and pg_get_functiondef(p.oid) like '%ai.valid_bets%'),
  3,
  'and all three betting reads name ai.valid_bets'
);

select ok(
  pg_catalog.pg_get_functiondef(
    'public.admin_ai_recommendation_log(text,integer)'::regprocedure)
    like '%prediction_invalidations%',
  'the decision log keeps its rows and labels the withdrawn ones, rather than quietly losing them'
);

select finish();

rollback;
