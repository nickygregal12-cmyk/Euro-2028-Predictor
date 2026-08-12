-- Contract 185: private AI model, odds and paper-betting lifecycle.
--
-- This is an analytical subsystem only. It cannot write platform fixtures,
-- official results, scoring, locks, standings or memberships. Browser roles
-- have no direct schema access; bounded admin reads use the existing
-- competition-admin gate. Provider credentials remain in Supabase Edge
-- Function secrets and are never stored in this schema.

begin;

create schema if not exists extensions;

-- ---------------------------------------------------------------------------
-- Imported scaffold stage: 001_ai_lab_schema.sql
-- ---------------------------------------------------------------------------
-- =====================================================================
-- AI Lab — private prediction laboratory
-- Deliberately isolated in its own schema. Nothing in `public` is
-- altered, read or depended upon except by explicit, named reference.
-- No browser role is ever granted access: every read goes through a
-- SECURITY DEFINER RPC gated by predictor_internal.require_competition_admin().
-- =====================================================================

create schema if not exists ai;

revoke all on schema ai from anon, authenticated;
grant usage on schema ai to service_role;

-- ---------------------------------------------------------------------
-- 1. Team aliases.
--    Maps a provider's spelling of a club to this platform's team row.
--    Football-Data.co.uk writes "Nott'm Forest"; this database holds
--    "Nottingham Forest FC". Neither is wrong; the mapping is the fact.
-- ---------------------------------------------------------------------
create table if not exists ai.team_aliases (
  id            uuid primary key default gen_random_uuid(),
  source        text        not null,          -- 'football-data.co.uk'
  source_name   text        not null,          -- 'Nott'm Forest'
  team_id       uuid        null                references public.teams(id) on delete set null,
  canonical     text        not null,          -- 'Nottingham Forest'  (stable across seasons)
  country       text        not null,          -- 'ENG' | 'SCO'
  created_at    timestamptz not null default now(),
  unique (source, source_name)
);

comment on table ai.team_aliases is
  'Provider club spelling -> canonical club name (and, where the club is in a live
   season, the public.teams row). `canonical` is the join key for history: teams.id
   is per-tournament and so cannot span seasons.';

-- ---------------------------------------------------------------------
-- 2. Raw historical matches.
--    Append-only. One row per completed match from an external source.
--    Never edited after insert except by an explicit re-import that
--    replaces a whole (source, division, season).
-- ---------------------------------------------------------------------
create table if not exists ai.raw_matches (
  id              uuid primary key default gen_random_uuid(),
  source          text        not null default 'football-data.co.uk',
  division        text        not null,        -- 'E0','E1','SC0','SC1'
  season          text        not null,        -- '2425'
  match_date      date        not null,
  kickoff_at      timestamptz null,
  home_canonical  text        not null,
  away_canonical  text        not null,
  home_goals      smallint    not null,
  away_goals      smallint    not null,
  result          char(1)     not null check (result in ('H','D','A')),
  -- Match statistics, where the source provides them. Nullable on purpose:
  -- older seasons have fewer columns and a zero is not a missing value.
  home_shots      smallint    null,
  away_shots      smallint    null,
  home_shots_ot   smallint    null,
  away_shots_ot   smallint    null,
  home_corners    smallint    null,
  away_corners    smallint    null,
  -- Closing bookmaker probabilities, de-vigged. The benchmark, not a target.
  mkt_home_prob   numeric(6,5) null,
  mkt_draw_prob   numeric(6,5) null,
  mkt_away_prob   numeric(6,5) null,
  imported_at     timestamptz not null default now(),
  unique (source, division, season, match_date, home_canonical, away_canonical)
);

create index if not exists raw_matches_date_idx    on ai.raw_matches (match_date);
create index if not exists raw_matches_div_seas_idx on ai.raw_matches (division, season);
create index if not exists raw_matches_home_idx    on ai.raw_matches (home_canonical, match_date);
create index if not exists raw_matches_away_idx    on ai.raw_matches (away_canonical, match_date);

-- ---------------------------------------------------------------------
-- 3. Models. One row per trained artefact. Immutable once written.
-- ---------------------------------------------------------------------
create table if not exists ai.models (
  id                 uuid primary key default gen_random_uuid(),
  league             text        not null,     -- 'EPL' | 'SPL'
  version            text        not null,     -- 'v0.3'
  family             text        not null,     -- 'baseline' | 'logistic' | 'poisson'
  trained_at         timestamptz not null default now(),
  training_matches   integer     not null,
  train_period       daterange   null,
  validation_period  daterange   null,
  features_used      text[]      not null default '{}',
  -- Validation metrics. Accuracy is here for the dashboard; log_loss and rps
  -- are what actually decide whether a challenger is promoted.
  val_accuracy       numeric(6,5) null,
  val_log_loss       numeric(8,5) null,
  val_rps            numeric(8,5) null,
  val_brier          numeric(8,5) null,
  baseline_log_loss  numeric(8,5) null,        -- always-home / base-rate baseline
  market_log_loss    numeric(8,5) null,        -- bookmaker closing line, same matches
  status             text        not null default 'challenger'
                     check (status in ('challenger','current','retired','failed')),
  artifact_path      text        null,         -- e.g. 'models/epl-v0.3.joblib'
  artifact_sha256    text        null,
  notes              text        null,
  unique (league, version)
);

-- Exactly one 'current' model per league. This is the guard that stops two
-- models silently writing predictions for the same fixture.
create unique index if not exists models_one_current_per_league
  on ai.models (league) where status = 'current';

-- ---------------------------------------------------------------------
-- 4. Predictions. Written ONCE, before kickoff. Never updated.
--    Grading writes to ai.prediction_results, a separate row, so a
--    prediction's history can never be improved after the fact.
-- ---------------------------------------------------------------------
create table if not exists ai.predictions (
  id                 uuid primary key default gen_random_uuid(),
  model_id           uuid        not null references ai.models(id),
  league             text        not null,
  -- The fixture this is about. season_fixture_id for live fixtures;
  -- raw_match_id for backtests over history. Exactly one must be set.
  season_fixture_id  uuid        null references public.season_fixtures(id) on delete cascade,
  raw_match_id       uuid        null references ai.raw_matches(id)        on delete cascade,
  kickoff_at         timestamptz not null,
  home_canonical     text        not null,
  away_canonical     text        not null,
  p_home             numeric(6,5) not null,
  p_draw             numeric(6,5) not null,
  p_away             numeric(6,5) not null,
  exp_home_goals     numeric(5,3) null,
  exp_away_goals     numeric(5,3) null,
  predicted_result   char(1)      not null check (predicted_result in ('H','D','A')),
  predicted_score    text         null,        -- '2-1', from the scoreline grid
  scoreline_grid     jsonb        null,        -- {"2-1":0.11,...} top N, for the admin UI
  -- The exact inputs the model saw. Without this you can never answer
  -- "why did it say that?" six weeks later, and you cannot reproduce a run.
  features           jsonb        not null,
  created_at         timestamptz  not null default now(),
  check (num_nonnulls(season_fixture_id, raw_match_id) = 1),
  check (abs((p_home + p_draw + p_away) - 1) < 0.001)
);

-- One live prediction per model per fixture. A rerun of predict.py is a
-- no-op, not a second opinion.
create unique index if not exists predictions_one_per_model_fixture
  on ai.predictions (model_id, season_fixture_id) where season_fixture_id is not null;
create unique index if not exists predictions_one_per_model_rawmatch
  on ai.predictions (model_id, raw_match_id) where raw_match_id is not null;
create index if not exists predictions_kickoff_idx on ai.predictions (league, kickoff_at desc);

-- A prediction may only be written before the match starts. This is the
-- single most important line in this file: it is what makes the recorded
-- track record trustworthy to you, later, when you are tempted.
create or replace function ai.reject_late_prediction()
returns trigger language plpgsql as $$
begin
  if new.created_at >= new.kickoff_at then
    raise exception 'Prediction for a match kicking off at % cannot be created at %',
      new.kickoff_at, new.created_at
      using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists predictions_before_kickoff on ai.predictions;
create trigger predictions_before_kickoff
  before insert on ai.predictions
  for each row execute function ai.reject_late_prediction();

-- Predictions are append-only.
create or replace function ai.reject_prediction_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ai.predictions is append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists predictions_no_mutation on ai.predictions;
create trigger predictions_no_mutation
  before update on ai.predictions
  for each row execute function ai.reject_prediction_mutation();

-- ---------------------------------------------------------------------
-- 5. Grading. Derived, re-derivable, separate from the prediction.
-- ---------------------------------------------------------------------
create table if not exists ai.prediction_results (
  prediction_id      uuid primary key references ai.predictions(id) on delete cascade,
  actual_home_goals  smallint not null,
  actual_away_goals  smallint not null,
  actual_result      char(1)  not null check (actual_result in ('H','D','A')),
  result_correct     boolean  not null,
  exact_score_correct boolean not null,
  -- Per-prediction proper scores. Summing these is how the dashboard works.
  log_loss           numeric(8,5) not null,   -- -ln(p assigned to the true outcome)
  brier              numeric(8,5) not null,
  rps                numeric(8,5) not null,   -- ranked probability score, ordered H/D/A
  graded_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Job runs. So the admin page can answer "did it run, and did it work?"
-- ---------------------------------------------------------------------
create table if not exists ai.job_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text        not null,          -- 'import_history'|'predict'|'evaluate'|'train'
  league       text        null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz null,
  status       text        not null default 'running'
               check (status in ('running','succeeded','failed')),
  rows_written integer     not null default 0,
  message      text        null,
  detail       jsonb       null
);
create index if not exists job_runs_recent_idx on ai.job_runs (job, started_at desc);

-- ---------------------------------------------------------------------
-- 7. Publication gate. One row. Public exposure stays off until every
--    condition is met AND a human flips it.
-- ---------------------------------------------------------------------
create table if not exists ai.publication_gate (
  id                     boolean primary key default true check (id),
  public_enabled         boolean not null default false,
  min_graded_predictions integer not null default 500,
  require_beats_baseline boolean not null default true,
  require_calibrated     boolean not null default true,
  enabled_at             timestamptz null,
  enabled_by             uuid null,
  notes                  text null
);
insert into ai.publication_gate (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------
-- 8. Access. Browser roles get nothing. Admin reads go through RPCs.
-- ---------------------------------------------------------------------
alter table ai.team_aliases       enable row level security;
alter table ai.raw_matches        enable row level security;
alter table ai.models             enable row level security;
alter table ai.predictions        enable row level security;
alter table ai.prediction_results enable row level security;
alter table ai.job_runs           enable row level security;
alter table ai.publication_gate   enable row level security;
-- No policies are created. RLS with no policy = deny all for anon/authenticated.
-- service_role bypasses RLS, which is how the Python jobs write.

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

-- ---------------------------------------------------------------------
-- 9. Admin-facing RPCs. Same gate as every other admin_* function here.
-- ---------------------------------------------------------------------

create or replace function public.admin_ai_dashboard(p_league text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_models jsonb;
  v_perf   jsonb;
  v_calib  jsonb;
  v_jobs   jsonb;
  v_gate   jsonb;
begin
  perform predictor_internal.require_competition_admin();

  select coalesce(jsonb_agg(to_jsonb(m) order by m.league, m.trained_at desc), '[]'::jsonb)
    into v_models
    from (select id, league, version, family, family as model_family, trained_at,
                 training_matches, val_accuracy, val_log_loss, val_rps,
                 baseline_log_loss, market_log_loss, status
            from ai.models
           where p_league is null or league = p_league) m;

  select jsonb_build_object(
      'graded',          count(*),
      'result_correct',  count(*) filter (where r.result_correct),
      'accuracy',        round(avg(case when r.result_correct then 1 else 0 end)::numeric, 5),
      'exact_scores',    count(*) filter (where r.exact_score_correct),
      'mean_log_loss',   round(avg(r.log_loss)::numeric, 5),
      'mean_rps',        round(avg(r.rps)::numeric, 5),
      'mean_brier',      round(avg(r.brier)::numeric, 5))
    into v_perf
    from ai.prediction_results r
    join ai.predictions p on p.id = r.prediction_id
   where p_league is null or p.league = p_league;

  -- Calibration: for each confidence decile of the probability the model
  -- assigned to its OWN pick, how often was that pick right? These two
  -- numbers converging is the whole point of the exercise.
  select coalesce(jsonb_agg(to_jsonb(c) order by c.bucket), '[]'::jsonb)
    into v_calib
    from (
      select width_bucket(greatest(p.p_home, p.p_draw, p.p_away), 0.2, 1.0, 8) as bucket,
             round(min(greatest(p.p_home, p.p_draw, p.p_away))::numeric, 3) as min_conf,
             round(max(greatest(p.p_home, p.p_draw, p.p_away))::numeric, 3) as max_conf,
             count(*) as n,
             round(avg(greatest(p.p_home, p.p_draw, p.p_away))::numeric, 4) as mean_predicted,
             round(avg(case when r.result_correct then 1 else 0 end)::numeric, 4) as actual_rate
        from ai.predictions p
        join ai.prediction_results r on r.prediction_id = p.id
       where p_league is null or p.league = p_league
       group by 1) c;

  select coalesce(jsonb_object_agg(j.job, to_jsonb(j) - 'job'), '{}'::jsonb)
    into v_jobs
    from (select distinct on (job) job, started_at, finished_at, status,
                 rows_written, message
            from ai.job_runs
           order by job, started_at desc) j;

  select to_jsonb(g) into v_gate from ai.publication_gate g;

  return jsonb_build_object(
    'as_of',       now(),
    'models',      v_models,
    'performance', coalesce(v_perf, '{}'::jsonb),
    'calibration', v_calib,
    'jobs',        v_jobs,
    'gate',        v_gate);
end;
$$;

revoke all on function public.admin_ai_dashboard(text) from public, anon;
grant execute on function public.admin_ai_dashboard(text) to authenticated;


create or replace function public.admin_ai_upcoming_predictions(
  p_league text default null,
  p_limit  integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform predictor_internal.require_competition_admin();

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.kickoff_at)
      from (
        select p.id, p.league, p.kickoff_at,
               p.home_canonical as home, p.away_canonical as away,
               p.p_home, p.p_draw, p.p_away,
               p.predicted_result, p.predicted_score,
               p.exp_home_goals, p.exp_away_goals,
               p.scoreline_grid,
               m.version as model_version,
               sf.status as fixture_status
          from ai.predictions p
          join ai.models m on m.id = p.model_id
          left join public.season_fixtures sf on sf.id = p.season_fixture_id
         where p.season_fixture_id is not null
           and p.kickoff_at >= now() - interval '2 hours'
           and (p_league is null or p.league = p_league)
         order by p.kickoff_at
         limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_ai_upcoming_predictions(text, integer) from public, anon;
grant execute on function public.admin_ai_upcoming_predictions(text, integer) to authenticated;


create or replace function public.admin_ai_recent_results(
  p_league text default null,
  p_limit  integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  perform predictor_internal.require_competition_admin();

  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.kickoff_at desc)
      from (
        select p.id, p.league, p.kickoff_at,
               p.home_canonical as home, p.away_canonical as away,
               p.p_home, p.p_draw, p.p_away,
               p.predicted_result, p.predicted_score,
               r.actual_home_goals, r.actual_away_goals, r.actual_result,
               r.result_correct, r.exact_score_correct,
               r.log_loss, r.rps,
               m.version as model_version
          from ai.predictions p
          join ai.prediction_results r on r.prediction_id = p.id
          join ai.models m on m.id = p.model_id
         where p.season_fixture_id is not null
           and (p_league is null or p.league = p_league)
         order by p.kickoff_at desc
         limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_ai_recent_results(text, integer) from public, anon;
grant execute on function public.admin_ai_recent_results(text, integer) to authenticated;


-- Promotion is a deliberate, audited human act. The model does not promote itself.
create or replace function public.admin_ai_promote_model(
  p_model_id uuid,
  p_reason   text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_league text;
  v_status text;
begin
  perform predictor_internal.require_competition_admin();

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to promote a model' using errcode = '22000';
  end if;

  select league, status into v_league, v_status
    from ai.models where id = p_model_id for update;

  if v_league is null then
    raise exception 'Unknown model %', p_model_id using errcode = '22000';
  end if;
  if v_status <> 'challenger' then
    raise exception 'Only a challenger may be promoted (model is %)', v_status
      using errcode = '22000';
  end if;

  update ai.models set status = 'retired'
   where league = v_league and status = 'current';

  update ai.models
     set status = 'current',
         notes  = coalesce(notes || E'\n', '') ||
                  'Promoted ' || now()::text || ': ' || p_reason
   where id = p_model_id;

  return jsonb_build_object('promoted', p_model_id, 'league', v_league);
end;
$$;

revoke all on function public.admin_ai_promote_model(uuid, text) from public, anon;
grant execute on function public.admin_ai_promote_model(uuid, text) to authenticated;
-- ---------------------------------------------------------------------------
-- Imported scaffold stage: 002_ai_lab_temporal.sql
-- ---------------------------------------------------------------------------
-- =====================================================================
-- AI Lab, migration 002
--
-- Everything here exists to support facts that CHANGE. Migration 001
-- handles results, which are settled and never move. Injuries, odds,
-- line-ups, managers and weather are different: what was true on Tuesday
-- is not what is true on Saturday, and a backtest that reads Saturday's
-- injury list while pretending to be Tuesday is worthless.
--
-- The rule this file enforces: every mutable fact is stored with the
-- moment it became KNOWN, and every query for training data asks for the
-- world as it looked at a stated instant.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bitemporal observation store.
--
--    One row per (thing, fact, moment it was learned). Rows are never
--    updated: a changed injury status is a NEW row with a later
--    known_at, and the old row stays because it is what you knew then.
--
--    Deliberately generic. A table per fact type would mean a migration
--    every time a provider adds a field, and this data is sparse,
--    irregular and provider-shaped in a way that resists columns.
-- ---------------------------------------------------------------------
create table if not exists ai.observations (
  id            uuid primary key default gen_random_uuid(),
  subject_type  text        not null check (subject_type in ('match','team','player','league','venue')),
  subject_key   text        not null,   -- canonical team name, player id, fixture uuid as text
  fact_type     text        not null,   -- 'injury','lineup','odds','manager','weather','attendance'
  -- What the fact is about in football time...
  applies_from  timestamptz not null,
  applies_to    timestamptz null,       -- null = still applies
  -- ...and when YOU learned it. This column is the whole point of the table.
  known_at      timestamptz not null,
  value         jsonb       not null,
  source        text        not null,
  confidence    numeric(4,3) null check (confidence is null or (confidence between 0 and 1)),
  is_estimate   boolean     not null default false,
  recorded_at   timestamptz not null default now()
);

create index if not exists observations_lookup_idx
  on ai.observations (subject_type, subject_key, fact_type, known_at desc);
create index if not exists observations_known_idx
  on ai.observations (fact_type, known_at desc);

comment on table ai.observations is
  'Append-only bitemporal facts. `known_at` is when this system learned the value,
   which is not when the value became true. Training data must be read with
   ai.observations_as_of() so that a backtest cannot see a team sheet that was
   published after the prediction it is pretending to have made.';

-- A row may never be edited: an edit is indistinguishable from having
-- known something earlier than you did, which is the exact failure this
-- table exists to prevent.
create or replace function ai.reject_observation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ai.observations is append-only; record a new row with a later known_at'
    using errcode = '42501';
end;
$$;

drop trigger if exists observations_no_mutation on ai.observations;
create trigger observations_no_mutation
  before update or delete on ai.observations
  for each row execute function ai.reject_observation_mutation();

-- The world as it looked at a stated instant. Every feature builder that
-- touches mutable data goes through this and nothing else.
create or replace function ai.observations_as_of(
  p_as_of        timestamptz,
  p_fact_type    text,
  p_subject_type text default null)
returns table (
  subject_type text,
  subject_key  text,
  fact_type    text,
  applies_from timestamptz,
  known_at     timestamptz,
  value        jsonb,
  source       text,
  is_estimate  boolean)
language sql stable
set search_path to ''
as $$
  select distinct on (o.subject_type, o.subject_key, o.applies_from)
         o.subject_type, o.subject_key, o.fact_type,
         o.applies_from, o.known_at, o.value, o.source, o.is_estimate
    from ai.observations o
   where o.fact_type = p_fact_type
     and (p_subject_type is null or o.subject_type = p_subject_type)
     and o.known_at <= p_as_of                      -- <- the guarantee
     and (o.applies_to is null or o.applies_to > p_as_of)
   order by o.subject_type, o.subject_key, o.applies_from, o.known_at desc;
$$;

-- ---------------------------------------------------------------------
-- 2. Prediction timing.
--
--    A 48-hour forecast and a post-team-sheet forecast are different
--    predictions of the same match and must be stored as different rows,
--    or the track record silently mixes them.
-- ---------------------------------------------------------------------
alter table ai.predictions
  add column if not exists horizon text not null default 'scheduled'
    check (horizon in ('scheduled','t48','t24','t6','lineup','backtest')),
  add column if not exists hours_to_kickoff numeric(7,2) null,
  add column if not exists data_snapshot_at timestamptz null,
  add column if not exists features_version text not null default 'f1',
  add column if not exists uses_market boolean not null default false,
  -- The market's view at the moment the prediction was made, and at close.
  -- The gap between them is the only fast feedback available: a model whose
  -- disagreements with the opening line are later confirmed by the closing
  -- line is showing signal after ~50 matches, not 500.
  add column if not exists mkt_home_at_prediction numeric(6,5) null,
  add column if not exists mkt_draw_at_prediction numeric(6,5) null,
  add column if not exists mkt_away_at_prediction numeric(6,5) null;

comment on column ai.predictions.horizon is
  'When this forecast was made relative to kickoff. A model that sees the team
   sheets is not the same model as one forecasting on Thursday, and comparing
   their records without this column is comparing two different questions.';

comment on column ai.predictions.uses_market is
  'True for the market-informed variant. The pure model must stay pure: if
   betting prices are a feature, "does my football model add information?"
   becomes unanswerable.';

-- One prediction per (model, fixture, horizon) rather than per (model, fixture).
drop index if exists ai.predictions_one_per_model_fixture;
create unique index if not exists predictions_one_per_model_fixture_horizon
  on ai.predictions (model_id, season_fixture_id, horizon)
  where season_fixture_id is not null;

-- ---------------------------------------------------------------------
-- 3. Closing-line comparison. Written after the match, alongside grading.
-- ---------------------------------------------------------------------
alter table ai.prediction_results
  add column if not exists mkt_home_closing numeric(6,5) null,
  add column if not exists mkt_draw_closing numeric(6,5) null,
  add column if not exists mkt_away_closing numeric(6,5) null,
  add column if not exists market_log_loss numeric(8,5) null,
  -- Positive means the model beat the closing line on this match.
  add column if not exists log_loss_vs_market numeric(8,5) null,
  -- Did the market later move toward the model's disagreement?
  add column if not exists market_moved_toward_model boolean null;

-- ---------------------------------------------------------------------
-- 4. Extra result detail available free in the Football-Data CSVs.
--
--    Red cards especially. A 4-0 defeat after an eighth-minute dismissal
--    is not evidence that a team is bad at eleven-a-side football, and
--    feeding it to a form calculation as though it were is a real and
--    entirely avoidable source of noise.
-- ---------------------------------------------------------------------
alter table ai.raw_matches
  add column if not exists ht_home_goals smallint null,
  add column if not exists ht_away_goals smallint null,
  add column if not exists home_reds smallint null,
  add column if not exists away_reds smallint null,
  add column if not exists home_yellows smallint null,
  add column if not exists away_yellows smallint null,
  add column if not exists home_fouls smallint null,
  add column if not exists away_fouls smallint null,
  add column if not exists referee text null;

-- A match either side finished with ten men. Cheap to compute, and the
-- flag is what lets a form window discount it rather than silently
-- treating it as a normal result.
alter table ai.raw_matches
  add column if not exists red_card_distorted boolean
    generated always as (coalesce(home_reds,0) > 0 or coalesce(away_reds,0) > 0) stored;

-- ---------------------------------------------------------------------
-- 5. Market snapshots over time, for the market-movement research model.
-- ---------------------------------------------------------------------
create table if not exists ai.market_snapshots (
  id                uuid primary key default gen_random_uuid(),
  season_fixture_id uuid null references public.season_fixtures(id) on delete cascade,
  raw_match_id      uuid null references ai.raw_matches(id) on delete cascade,
  bookmaker         text not null,
  captured_at       timestamptz not null,
  odds_home         numeric(8,3) not null,
  odds_draw         numeric(8,3) not null,
  odds_away         numeric(8,3) not null,
  overround         numeric(6,4) null,
  p_home            numeric(6,5) null,
  p_draw            numeric(6,5) null,
  p_away            numeric(6,5) null,
  is_closing        boolean not null default false,
  check (num_nonnulls(season_fixture_id, raw_match_id) = 1)
);
create index if not exists market_snapshots_fixture_idx
  on ai.market_snapshots (season_fixture_id, captured_at);

-- ---------------------------------------------------------------------
-- 6. Feature experiment log. One row per "did adding X help?"
--
--    With ~4,000 top-flight matches and a two-season holdout, the standard
--    error on validation log loss is around 0.02. Most single-feature
--    improvements are smaller than that. Writing every experiment down,
--    including the ones that failed, is what stops you from running
--    twenty tests and keeping the luckiest.
-- ---------------------------------------------------------------------
create table if not exists ai.feature_experiments (
  id              uuid primary key default gen_random_uuid(),
  league          text not null,
  hypothesis      text not null,          -- 'adding red-card distortion flag helps'
  baseline_model  uuid null references ai.models(id),
  candidate_model uuid null references ai.models(id),
  folds           integer not null default 1,
  delta_log_loss  numeric(8,5) null,      -- negative = candidate better
  delta_rps       numeric(8,5) null,
  std_error       numeric(8,5) null,
  verdict         text not null default 'undecided'
                  check (verdict in ('undecided','kept','rejected','inconclusive')),
  notes           text null,
  ran_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Access, matching migration 001.
-- ---------------------------------------------------------------------
alter table ai.observations        enable row level security;
alter table ai.market_snapshots    enable row level security;
alter table ai.feature_experiments enable row level security;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

revoke all on function ai.observations_as_of(timestamptz, text, text) from public, anon, authenticated;
grant execute on function ai.observations_as_of(timestamptz, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 8. Performance by circumstance.
--
--    "59% accuracy" is one number hiding a dozen. This is the report that
--    tells you the model is fine except on promoted clubs, or fine except
--    in August, which is actionable in a way that a single figure is not.
-- ---------------------------------------------------------------------
create or replace function public.admin_ai_performance_breakdown(
  p_league text default null)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_out jsonb := '{}'::jsonb;
begin
  perform predictor_internal.require_competition_admin();

  with graded as (
    select p.league,
           p.horizon,
           p.predicted_result,
           r.actual_result,
           r.result_correct,
           r.log_loss,
           r.rps,
           greatest(p.p_home, p.p_draw, p.p_away) as confidence,
           (p.features ->> 'elo_diff')::numeric   as elo_diff,
           (p.features ->> 'season_progress')::numeric as season_progress,
           ((p.features ->> 'home_is_newcomer')::numeric
            + (p.features ->> 'away_is_newcomer')::numeric) > 0 as involves_newcomer
      from ai.predictions p
      join ai.prediction_results r on r.prediction_id = p.id
     where p_league is null or p.league = p_league
  )
  select jsonb_build_object(
    'overall', (select jsonb_build_object(
        'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
        'log_loss', round(avg(log_loss), 4), 'rps', round(avg(rps), 4)) from graded),

    'by_league', (select coalesce(jsonb_object_agg(league, j), '{}'::jsonb) from (
        select league, jsonb_build_object(
          'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
          'log_loss', round(avg(log_loss), 4)) as j
        from graded group by league) s),

    'by_horizon', (select coalesce(jsonb_object_agg(horizon, j), '{}'::jsonb) from (
        select horizon, jsonb_build_object(
          'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
          'log_loss', round(avg(log_loss), 4)) as j
        from graded group by horizon) s),

    'by_pick', (select coalesce(jsonb_object_agg(predicted_result, j), '{}'::jsonb) from (
        select predicted_result, jsonb_build_object(
          'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4)) as j
        from graded group by predicted_result) s),

    -- Favourite vs underdog by Elo, not by who the model picked.
    'by_elo_gap', (select coalesce(jsonb_object_agg(band, j), '{}'::jsonb) from (
        select case when abs(elo_diff) < 50 then 'even (<50)'
                    when abs(elo_diff) < 150 then 'slight (50-150)'
                    when abs(elo_diff) < 300 then 'clear (150-300)'
                    else 'mismatch (300+)' end as band,
               jsonb_build_object(
                 'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
                 'log_loss', round(avg(log_loss), 4)) as j
        from graded where elo_diff is not null group by 1) s),

    'by_season_stage', (select coalesce(jsonb_object_agg(band, j), '{}'::jsonb) from (
        select case when season_progress < 0.2 then 'early'
                    when season_progress < 0.75 then 'mid'
                    else 'late' end as band,
               jsonb_build_object(
                 'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
                 'log_loss', round(avg(log_loss), 4)) as j
        from graded where season_progress is not null group by 1) s),

    'promoted_clubs', (select coalesce(jsonb_object_agg(band, j), '{}'::jsonb) from (
        select case when involves_newcomer then 'involves newcomer' else 'established only' end as band,
               jsonb_build_object(
                 'n', count(*), 'accuracy', round(avg(result_correct::int)::numeric, 4),
                 'log_loss', round(avg(log_loss), 4)) as j
        from graded where involves_newcomer is not null group by 1) s)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.admin_ai_performance_breakdown(text) from public, anon;
grant execute on function public.admin_ai_performance_breakdown(text) to authenticated;
-- ---------------------------------------------------------------------------
-- Imported scaffold stage: 003_ai_lab_betting.sql
-- ---------------------------------------------------------------------------
-- =====================================================================
-- AI Lab, migration 003 — the betting layer
--
-- Migrations 001 and 002 answer "does the model predict results?".
-- This one answers a different and much harder question: "does the model
-- find prices the market has wrong?" The tables are shaped around three
-- facts that are easy to state and expensive to forget.
--
--   1. Profit is not a measurable signal at this volume. A genuine +3%
--      ROI at odds of 3.0 needs roughly 14,000 bets to demonstrate at
--      80% power. Closing-line value needs about 100. Every table here
--      is built so CLV is the primary record and profit is secondary.
--
--   2. The price you took must be stored, not reconstructed. A backtest
--      run against closing odds will look excellent and is meaningless,
--      because the closing price already contains the information you
--      believe you have found and was not available when you bet.
--
--   3. Advertising an unlicensed operator is a criminal offence under
--      s.330 Gambling Act 2005 — six months' imprisonment in Scotland.
--      The liability sits on the publisher, not the bookmaker. So the
--      bookmaker register below is not administrative tidiness; it is
--      the control that keeps a tempting affiliate deal from becoming a
--      prosecution.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bookmakers, and whether it is lawful to name them publicly.
-- ---------------------------------------------------------------------
create table if not exists ai.bookmakers (
  code                text primary key,        -- 'B365', 'AVG', 'MAX', 'BFE', 'PS'
  name                text not null,
  kind                text not null check (kind in ('bookmaker','exchange','aggregate')),
  -- 'aggregate' means Max/Avg: a derived number, not a place you can bet.
  -- Treating an aggregate as a real price is how a backtest ends up assuming
  -- you got the best price at every book simultaneously.
  is_real_price       boolean not null default true,
  gb_licence_verified boolean not null default false,
  gb_licence_number   text null,
  licence_checked_at  timestamptz null,
  exchange_commission numeric(5,4) null,       -- 0.0200 for Betfair's base rate
  notes               text null
);

insert into ai.bookmakers (code, name, kind, is_real_price, notes) values
  ('AVG', 'Market average',  'aggregate', false, 'Derived. Not bettable. Benchmark only.'),
  ('MAX', 'Market maximum',  'aggregate', false,
   'Best price across the sampled books. Assumes an account at whichever book '
   'happened to be top, which is optimistic; treat as a ceiling, not a plan.'),
  ('BFE', 'Betfair Exchange','exchange',  true,  'Commission applies to winnings.'),
  ('PS',  'Pinnacle',        'bookmaker', true,  'Sharp. Effectively the closing line.')
on conflict (code) do nothing;

comment on column ai.bookmakers.gb_licence_verified is
  'Set only after checking the Gambling Commission public register by hand.
   Publishing a selection naming an unverified operator is blocked by trigger,
   because s.330 Gambling Act 2005 puts that offence on the publisher.';

-- ---------------------------------------------------------------------
-- 2. Advised bets. Append-only, pre-kickoff, with the price as taken.
-- ---------------------------------------------------------------------
create table if not exists ai.bets (
  id                  uuid primary key default gen_random_uuid(),
  prediction_id       uuid not null references ai.predictions(id) on delete cascade,
  model_id            uuid not null references ai.models(id),
  league              text not null,
  season_fixture_id   uuid null references public.season_fixtures(id) on delete cascade,
  raw_match_id        uuid null references ai.raw_matches(id) on delete cascade,
  selection           char(1) not null check (selection in ('H','D','A')),

  advised_at          timestamptz not null default now(),
  kickoff_at          timestamptz not null,
  hours_to_kickoff    numeric(7,2) null,

  -- The price, and where it came from. Both matter.
  bookmaker           text not null references ai.bookmakers(code),
  odds_taken          numeric(8,3) not null check (odds_taken > 1.0),
  odds_average_at_advice numeric(8,3) null,
  odds_best_at_advice    numeric(8,3) null,

  model_prob          numeric(6,5) not null check (model_prob between 0 and 1),
  market_fair_prob    numeric(6,5) null,
  devig_method        text not null default 'shin',
  edge                numeric(8,5) not null,   -- model_prob * odds_taken - 1

  -- Decomposition, stored rather than derived later, because the two
  -- components have completely different meanings and the combined number
  -- flatters the model.
  edge_vs_average     numeric(8,5) null,       -- the model's actual disagreement
  edge_line_shopping  numeric(8,5) null,       -- best price vs average price

  staking_rule        text not null default 'quarter_kelly_cap2',
  stake_fraction      numeric(7,5) not null,
  stake_units         numeric(12,4) not null,
  is_paper            boolean not null default true,   -- money actually risked?

  status              text not null default 'advised'
                      check (status in ('advised','settled','void')),
  created_at          timestamptz not null default now(),
  check (num_nonnulls(season_fixture_id, raw_match_id) = 1)
);

create index if not exists bets_kickoff_idx on ai.bets (league, kickoff_at desc);
create index if not exists bets_status_idx  on ai.bets (status, kickoff_at);
create unique index if not exists bets_one_per_prediction_book
  on ai.bets (prediction_id, bookmaker, selection);

-- A bet may only be advised before kickoff. Same reasoning as ai.predictions:
-- the discipline fails at 11pm, the trigger does not.
create or replace function ai.reject_late_bet()
returns trigger language plpgsql as $$
begin
  if new.advised_at >= new.kickoff_at then
    raise exception 'Bet advised at % for a match kicking off at %',
      new.advised_at, new.kickoff_at using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists bets_before_kickoff on ai.bets;
create trigger bets_before_kickoff
  before insert on ai.bets
  for each row execute function ai.reject_late_bet();

-- Aggregates are not bettable prices. Recording a bet "at MAX" and later
-- reporting the profit is the single most common way a paper record becomes
-- fiction, so the database refuses it for anything that is not paper.
create or replace function ai.reject_unbettable_price()
returns trigger language plpgsql as $$
declare v_real boolean;
begin
  select is_real_price into v_real from ai.bookmakers where code = new.bookmaker;
  if v_real is null then
    raise exception 'Unknown bookmaker %', new.bookmaker using errcode = '22000';
  end if;
  if not v_real and not new.is_paper then
    raise exception
      'Bookmaker % is an aggregate, not a bettable price; a non-paper bet cannot use it',
      new.bookmaker using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists bets_real_price on ai.bets;
create trigger bets_real_price
  before insert on ai.bets
  for each row execute function ai.reject_unbettable_price();

create or replace function ai.reject_bet_mutation()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and old.status = 'advised' then
    return new;                       -- settling is allowed
  end if;
  raise exception 'ai.bets is append-only except for settlement status'
    using errcode = '42501';
end;
$$;

drop trigger if exists bets_no_mutation on ai.bets;
create trigger bets_no_mutation
  before update on ai.bets
  for each row execute function ai.reject_bet_mutation();

-- ---------------------------------------------------------------------
-- 3. Settlement, including the closing line. Separate row, as always.
-- ---------------------------------------------------------------------
create table if not exists ai.bet_results (
  bet_id             uuid primary key references ai.bets(id) on delete cascade,
  actual_result      char(1) not null check (actual_result in ('H','D','A')),
  won                boolean not null,
  commission_rate    numeric(5,4) not null default 0,
  pnl_units          numeric(12,4) not null,
  return_per_unit    numeric(10,5) not null,   -- +odds-1 on a win, -1 on a loss

  -- Closing line. This block is the actual scoreboard.
  odds_closing       numeric(8,3) null,
  fair_prob_closing  numeric(6,5) null,
  clv                numeric(8,5) null,        -- odds_taken * fair_prob_closing - 1
  beat_closing_price boolean null,
  settled_at         timestamptz not null default now()
);

comment on column ai.bet_results.clv is
  'Closing-line value: the expected return of the price taken, evaluated at the
   market''s final opinion. Positive and consistent means the model is finding
   information before the market does. This converges in roughly 100 bets;
   profit needs thousands, so this column, not pnl_units, is the evidence.';

-- ---------------------------------------------------------------------
-- 4. Publication gate for betting output, deliberately stricter.
-- ---------------------------------------------------------------------
alter table ai.publication_gate
  add column if not exists betting_public_enabled boolean not null default false,
  add column if not exists min_settled_bets integer not null default 200,
  add column if not exists min_mean_clv numeric(8,5) not null default 0.005,
  add column if not exists require_clv_ci_above_zero boolean not null default true,
  -- Every public-facing compliance control, in the same row as the switch that
  -- exposes them, so turning the site on without them is a visible omission
  -- rather than something you meant to come back to.
  add column if not exists all_bookmakers_licence_checked boolean not null default false,
  add column if not exists age_gate_live boolean not null default false,
  add column if not exists safer_gambling_signpost text null,
  add column if not exists results_page_shows_full_record boolean not null default false;

comment on column ai.publication_gate.min_mean_clv is
  'Mean closing-line value required before any selection may be shown publicly.
   0.005 is a deliberately modest bar: a real +0.5% CLV is worth having and is
   detectable, whereas an ROI target would be unfalsifiable at this volume.';

-- ---------------------------------------------------------------------
-- 5. Historical prices, per book rather than one de-vigged triple.
--
--    Football-Data publishes Max and Avg from 2019/20 and Pinnacle closing
--    (PSCH/PSCD/PSCA) from 2012/13. Keeping them apart is what lets you ask
--    whether an apparent edge is skill or is simply the gap between the best
--    price and the average one.
-- ---------------------------------------------------------------------
alter table ai.raw_matches
  add column if not exists odds_avg_h numeric(8,3), add column if not exists odds_avg_d numeric(8,3),
  add column if not exists odds_avg_a numeric(8,3),
  add column if not exists odds_max_h numeric(8,3), add column if not exists odds_max_d numeric(8,3),
  add column if not exists odds_max_a numeric(8,3),
  add column if not exists odds_ps_h  numeric(8,3), add column if not exists odds_ps_d  numeric(8,3),
  add column if not exists odds_ps_a  numeric(8,3),
  add column if not exists odds_bfe_h numeric(8,3), add column if not exists odds_bfe_d numeric(8,3),
  add column if not exists odds_bfe_a numeric(8,3),
  -- closing
  add column if not exists close_avg_h numeric(8,3), add column if not exists close_avg_d numeric(8,3),
  add column if not exists close_avg_a numeric(8,3),
  add column if not exists close_max_h numeric(8,3), add column if not exists close_max_d numeric(8,3),
  add column if not exists close_max_a numeric(8,3),
  add column if not exists close_ps_h  numeric(8,3), add column if not exists close_ps_d  numeric(8,3),
  add column if not exists close_ps_a  numeric(8,3),
  add column if not exists overround_avg numeric(6,4),
  add column if not exists overround_max numeric(6,4);

-- ---------------------------------------------------------------------
-- 6. Upcoming-fixture prices, from the twice-weekly Football-Data feed.
-- ---------------------------------------------------------------------
create table if not exists ai.fixture_odds (
  id                uuid primary key default gen_random_uuid(),
  season_fixture_id uuid null references public.season_fixtures(id) on delete cascade,
  division          text not null,
  match_date        date not null,
  home_canonical    text not null,
  away_canonical    text not null,
  bookmaker         text not null references ai.bookmakers(code),
  odds_h            numeric(8,3) null,
  odds_d            numeric(8,3) null,
  odds_a            numeric(8,3) null,
  captured_at       timestamptz not null,
  source            text not null default 'football-data.co.uk/fixtures.csv',
  unique (division, match_date, home_canonical, away_canonical, bookmaker, captured_at)
);
create index if not exists fixture_odds_lookup_idx
  on ai.fixture_odds (division, match_date, home_canonical, away_canonical);

-- ---------------------------------------------------------------------
-- 7. Access, matching 001 and 002.
-- ---------------------------------------------------------------------
alter table ai.bookmakers   enable row level security;
alter table ai.bets         enable row level security;
alter table ai.bet_results  enable row level security;
alter table ai.fixture_odds enable row level security;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

-- ---------------------------------------------------------------------
-- 8. The betting dashboard.
-- ---------------------------------------------------------------------
create or replace function public.admin_ai_betting_dashboard(p_league text default null)
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare
  v_clv jsonb; v_pnl jsonb; v_open jsonb; v_gate jsonb; v_books jsonb;
  v_n integer; v_mean numeric; v_sd numeric;
begin
  perform predictor_internal.require_competition_admin();

  select count(*), avg(r.clv), stddev_samp(r.clv)
    into v_n, v_mean, v_sd
    from ai.bets b join ai.bet_results r on r.bet_id = b.id
   where r.clv is not null and (p_league is null or b.league = p_league);

  -- Normal-approximation interval on CLV. Reported with n because a mean
  -- without a sample size is a rumour.
  v_clv := jsonb_build_object(
    'n', coalesce(v_n, 0),
    'mean_clv', round(coalesce(v_mean, 0), 5),
    'ci_low',  case when v_n > 1 then round(v_mean - 1.96 * v_sd / sqrt(v_n::numeric), 5) end,
    'ci_high', case when v_n > 1 then round(v_mean + 1.96 * v_sd / sqrt(v_n::numeric), 5) end,
    'beat_close_rate', (
      select round(avg(case when r2.beat_closing_price then 1 else 0 end)::numeric, 4)
        from ai.bets b2 join ai.bet_results r2 on r2.bet_id = b2.id
       where r2.beat_closing_price is not null
         and (p_league is null or b2.league = p_league)),
    'significant', case when v_n > 1 then (v_mean - 1.96 * v_sd / sqrt(v_n::numeric)) > 0 else false end);

  select jsonb_build_object(
      'settled_bets', count(*),
      'staked', round(coalesce(sum(b.stake_units), 0), 3),
      'pnl', round(coalesce(sum(r.pnl_units), 0), 3),
      'roi', round(coalesce(avg(r.return_per_unit), 0), 5),
      'hit_rate', round(coalesce(avg(case when r.won then 1 else 0 end)::numeric, 0), 4),
      'mean_odds', round(coalesce(avg(b.odds_taken), 0), 3),
      'mean_claimed_edge', round(coalesce(avg(b.edge), 0), 5),
      'mean_model_edge_vs_average', round(coalesce(avg(b.edge_vs_average), 0), 5),
      'mean_line_shopping_edge', round(coalesce(avg(b.edge_line_shopping), 0), 5),
      -- Stated next to the ROI so the ROI is never read on its own.
      'bets_needed_for_80pct_power', case
        when coalesce(avg(r.return_per_unit), 0) > 0 and stddev_samp(r.return_per_unit) > 0
        then ceil(power((1.6449 + 0.8416) * stddev_samp(r.return_per_unit)
                        / avg(r.return_per_unit), 2))
        end)
    into v_pnl
    from ai.bets b join ai.bet_results r on r.bet_id = b.id
   where p_league is null or b.league = p_league;

  select jsonb_build_object(
      'open_bets', count(*),
      'exposure', round(coalesce(sum(b.stake_units), 0), 3))
    into v_open
    from ai.bets b
   where b.status = 'advised' and (p_league is null or b.league = p_league);

  select jsonb_build_object(
      'total', count(*),
      'licence_verified', count(*) filter (where gb_licence_verified),
      'unverified_real_books', coalesce(jsonb_agg(code) filter (
        where is_real_price and not gb_licence_verified), '[]'::jsonb))
    into v_books from ai.bookmakers;

  select to_jsonb(g) into v_gate from ai.publication_gate g;

  return jsonb_build_object(
    'as_of', now(), 'clv', v_clv, 'profit', coalesce(v_pnl, '{}'::jsonb),
    'open', v_open, 'bookmakers', v_books, 'gate', v_gate);
end;
$$;

revoke all on function public.admin_ai_betting_dashboard(text) from public, anon;
grant execute on function public.admin_ai_betting_dashboard(text) to authenticated;

-- Publishing is gated on evidence AND on compliance, in one place.
create or replace function public.admin_ai_betting_gate_status()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare g record; v_n integer; v_mean numeric; v_sd numeric; v_lo numeric;
        v_unverified integer;
begin
  perform predictor_internal.require_competition_admin();
  select * into g from ai.publication_gate;

  select count(*), avg(clv), stddev_samp(clv) into v_n, v_mean, v_sd
    from ai.bet_results where clv is not null;
  v_lo := case when v_n > 1 then v_mean - 1.96 * v_sd / sqrt(v_n::numeric) end;

  select count(*) into v_unverified
    from ai.bookmakers where is_real_price and not gb_licence_verified;

  return jsonb_build_object(
    'settled_bets',        jsonb_build_object('value', coalesce(v_n,0),
                             'required', g.min_settled_bets,
                             'met', coalesce(v_n,0) >= g.min_settled_bets),
    'mean_clv',            jsonb_build_object('value', round(coalesce(v_mean,0),5),
                             'required', g.min_mean_clv,
                             'met', coalesce(v_mean,0) >= g.min_mean_clv),
    'clv_ci_above_zero',   jsonb_build_object('value', round(coalesce(v_lo,0),5),
                             'met', coalesce(v_lo, -1) > 0 or not g.require_clv_ci_above_zero),
    'bookmaker_licences',  jsonb_build_object('unverified', v_unverified,
                             'met', v_unverified = 0),
    'age_gate',            jsonb_build_object('met', g.age_gate_live),
    'safer_gambling_signpost', jsonb_build_object('value', g.safer_gambling_signpost,
                             'met', coalesce(btrim(g.safer_gambling_signpost),'') <> ''),
    'full_record_published', jsonb_build_object('met', g.results_page_shows_full_record),
    'currently_public',    g.betting_public_enabled);
end;
$$;

revoke all on function public.admin_ai_betting_gate_status() from public, anon;
grant execute on function public.admin_ai_betting_gate_status() to authenticated;
-- ---------------------------------------------------------------------------
-- Imported scaffold stage: 004_ai_lab_fixtures_and_markets.sql
-- ---------------------------------------------------------------------------
-- =====================================================================
-- AI Lab, migration 004
--
-- This migration exists because a code review found that the nine-division
-- architecture described in the guide was not the architecture the code
-- implemented. Seven of the nine leagues could be trained but could never
-- produce a live prediction, because prediction and settlement both went
-- through public.season_fixtures, which only exists for the two leagues
-- this platform actually runs. The reviewer was right; this is the fix.
--
-- The change in one sentence: the AI Lab gets its own canonical fixture
-- layer and stops borrowing the website's.
--
-- Also here: durable model storage (artefacts were being written to a
-- GitHub Actions runner and then lost), a closed loophole in the bet
-- immutability trigger, a corrected CLV benchmark, separated evidence and
-- compliance gates, and the market dimension needed for anything beyond
-- home/draw/away.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ai.fixtures — the AI Lab's own fixture lifecycle.
--
--    scheduled -> played, with an optional link out to the website's
--    season_fixtures where a league happens to also be a competition
--    here, and a link to ai.raw_matches once the result lands.
--
--    Football-Data is the source of truth for all nine divisions. Where
--    a fixture also exists in public.season_fixtures, that is a
--    convenience join, never a dependency.
-- ---------------------------------------------------------------------
create table if not exists ai.fixtures (
  id                uuid primary key default gen_random_uuid(),
  division          text not null,
  season            text not null,
  league_key        text not null,               -- 'EPL','EL2','SL1', ...
  match_date        date not null,
  kickoff_at        timestamptz null,            -- null when only the date is known
  home_canonical    text not null,
  away_canonical    text not null,

  -- Optional links. Both may be null; neither is required for the lab to work.
  season_fixture_id uuid null references public.season_fixtures(id) on delete set null,
  raw_match_id      uuid null references ai.raw_matches(id) on delete set null,

  status            text not null default 'scheduled'
                    check (status in ('scheduled','played','postponed','void')),
  home_goals        smallint null,
  away_goals        smallint null,
  result            char(1) null check (result is null or result in ('H','D','A')),

  first_seen_at     timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (division, match_date, home_canonical, away_canonical)
);

create index if not exists fixtures_upcoming_idx
  on ai.fixtures (league_key, status, match_date);
create index if not exists fixtures_kickoff_idx on ai.fixtures (kickoff_at);

comment on table ai.fixtures is
  'The AI Lab''s canonical fixture. Exists for all nine divisions, sourced from
   Football-Data. public.season_fixtures is linked where the platform also runs
   that competition, but nothing in the lab depends on that link: the review
   that prompted this table found seven of nine leagues could never produce a
   live prediction precisely because they did depend on it.';

-- A fixture kicking off in the future cannot already have a score, and a
-- played fixture must have one. Cheap, and it catches a whole class of
-- import bug at the moment it happens rather than three weeks later.
create or replace function ai.fixtures_consistency()
returns trigger language plpgsql as $$
begin
  if new.status = 'played' then
    if new.home_goals is null or new.away_goals is null then
      raise exception 'A played fixture needs a score' using errcode = '22000';
    end if;
    new.result := case when new.home_goals > new.away_goals then 'H'
                       when new.home_goals = new.away_goals then 'D'
                       else 'A' end;
  elsif new.status = 'scheduled' then
    if new.home_goals is not null or new.away_goals is not null then
      raise exception 'A scheduled fixture cannot have a score' using errcode = '22000';
    end if;
    new.result := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fixtures_consistent on ai.fixtures;
create trigger fixtures_consistent
  before insert or update on ai.fixtures
  for each row execute function ai.fixtures_consistency();

-- ---------------------------------------------------------------------
-- 2. Rewire predictions, bets and odds onto the fixture.
-- ---------------------------------------------------------------------
alter table ai.predictions add column if not exists fixture_id uuid
  references ai.fixtures(id) on delete cascade;
alter table ai.bets        add column if not exists fixture_id uuid
  references ai.fixtures(id) on delete cascade;
alter table ai.fixture_odds add column if not exists fixture_id uuid
  references ai.fixtures(id) on delete cascade;

-- The old "exactly one of season_fixture_id / raw_match_id" checks are what
-- forced everything through the website's tables. Replace with: a prediction
-- is about a fixture, or about a historical match during a backtest.
-- The originals were unnamed, so Postgres called them predictions_check /
-- bets_check or similar depending on creation order. Find them by definition
-- rather than guessing at the generated name.
do $$
declare c record;
begin
  for c in
    select rel.relname as tbl, con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'ai'
       and rel.relname in ('predictions', 'bets')
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%num_nonnulls%'
  loop
    execute format('alter table ai.%I drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table ai.predictions add constraint predictions_target_present
  check (num_nonnulls(fixture_id, raw_match_id) >= 1);

alter table ai.bets add constraint bets_target_present
  check (num_nonnulls(fixture_id, season_fixture_id, raw_match_id) >= 1);

drop index if exists ai.predictions_one_per_model_fixture_horizon;
create unique index if not exists predictions_one_per_model_fixture_horizon
  on ai.predictions (model_id, fixture_id, horizon) where fixture_id is not null;

create index if not exists fixture_odds_fixture_idx on ai.fixture_odds (fixture_id, captured_at desc);

-- ---------------------------------------------------------------------
-- 3. Durable model artefacts.
--
--    Training wrote .joblib to disk, .gitignore excluded it, and the
--    workflow uploaded it as a run artefact. A later prediction run gets a
--    fresh runner with no artefact, so Postgres would say model X is
--    current while predict.py could not load it. Artefacts are small
--    (kilobytes for a regularised regression on 34 features) so the
--    simplest durable store is the database that already holds the model
--    row: one write, atomic with the metadata, and the SHA is verifiable.
-- ---------------------------------------------------------------------
create table if not exists ai.model_artifacts (
  model_id   uuid primary key references ai.models(id) on delete cascade,
  payload    bytea not null,
  sha256     text  not null,
  bytes      integer generated always as (octet_length(payload)) stored,
  created_at timestamptz not null default now()
);

comment on table ai.model_artifacts is
  'The serialised model, stored beside its row. Deliberately in Postgres rather
   than object storage: no extra credentials, no second failure mode, and the
   artefact cannot outlive or predate the metadata that describes it.';

-- A model cannot be promoted to 'current' unless its artefact is actually
-- present. Otherwise the database happily advertises a model that no
-- prediction run can load, which is exactly the failure this migration fixes.
create or replace function ai.require_artifact_before_current()
returns trigger language plpgsql as $$
begin
  if new.status = 'current'
     and not exists (select 1 from ai.model_artifacts a where a.model_id = new.id) then
    raise exception 'Model % has no stored artefact and cannot be made current', new.id
      using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists models_need_artifact on ai.models;
create trigger models_need_artifact
  before insert or update on ai.models
  for each row execute function ai.require_artifact_before_current();

-- ---------------------------------------------------------------------
-- 4. Close the bet immutability loophole.
--
--    The previous trigger allowed any UPDATE whose status moved off
--    'advised'. One statement could therefore settle a bet AND rewrite the
--    odds, stake, edge and model probability. Since the whole point of the
--    table is that the recorded price cannot be improved after the fact,
--    that loophole voided the guarantee.
-- ---------------------------------------------------------------------
create or replace function ai.reject_bet_mutation()
returns trigger language plpgsql as $$
begin
  if new.status is not distinct from old.status then
    raise exception 'ai.bets is append-only; only the settlement status may change'
      using errcode = '42501';
  end if;
  if old.status <> 'advised' then
    raise exception 'Bet is already %; its status is final', old.status
      using errcode = '42501';
  end if;
  if new.status not in ('settled', 'void') then
    raise exception 'Invalid status transition advised -> %', new.status
      using errcode = '22000';
  end if;

  -- Every other column must be byte-identical. Listing them explicitly is
  -- deliberate: a `to_jsonb(new) - 'status' = to_jsonb(old) - 'status'`
  -- comparison would silently start allowing a new column the day one is added.
  if (new.id, new.prediction_id, new.model_id, new.league, new.fixture_id,
      new.season_fixture_id, new.raw_match_id, new.selection, new.advised_at,
      new.kickoff_at, new.hours_to_kickoff, new.bookmaker, new.odds_taken,
      new.odds_average_at_advice, new.odds_best_at_advice, new.model_prob,
      new.market_fair_prob, new.devig_method, new.edge, new.edge_vs_average,
      new.edge_line_shopping, new.staking_rule, new.stake_fraction,
      new.stake_units, new.is_paper, new.created_at)
     is distinct from
     (old.id, old.prediction_id, old.model_id, old.league, old.fixture_id,
      old.season_fixture_id, old.raw_match_id, old.selection, old.advised_at,
      old.kickoff_at, old.hours_to_kickoff, old.bookmaker, old.odds_taken,
      old.odds_average_at_advice, old.odds_best_at_advice, old.model_prob,
      old.market_fair_prob, old.devig_method, old.edge, old.edge_vs_average,
      old.edge_line_shopping, old.staking_rule, old.stake_fraction,
      old.stake_units, old.is_paper, old.created_at)
  then
    raise exception 'Only status may change when settling a bet'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Name the CLV benchmark, and stop using Max as one.
--
--    Max H, Max D and Max A can each come from a different bookmaker. The
--    triple is a synthetic best-of-market book whose overround is often
--    below 100% — an arbitrage, not a price anyone offered. De-vigging it
--    and calling the result "the market's fair probability" is not a
--    conceptually valid operation, and it flatters CLV.
--
--    A benchmark must be one consistent book. Max stays useful as the best
--    price available; it is never the fair line.
-- ---------------------------------------------------------------------
alter table ai.bet_results
  add column if not exists clv_benchmark text null
    check (clv_benchmark is null or clv_benchmark in ('PS','BFE','AVG')),
  add column if not exists benchmark_overround numeric(6,4) null;

comment on column ai.bet_results.clv_benchmark is
  'Which single consistent book the closing fair probability came from.
   Never MAX: that triple is assembled from different bookmakers and its
   overround is frequently below 1, so de-vigging it is meaningless.';

-- ---------------------------------------------------------------------
-- 6. Separate the evidence gate from the compliance gate.
--
--    Coupling them meant you could not honestly say "the model has proven
--    itself" without also having built an age gate, which has nothing to do
--    with whether the model works. Evidence is per market, because a model
--    that finds value in over/under says nothing about whether it finds
--    value in corners.
-- ---------------------------------------------------------------------
create table if not exists ai.evidence_gate (
  market                text primary key,
  min_settled_bets      integer not null default 200,
  min_mean_clv          numeric(8,5) not null default 0.005,
  require_ci_above_zero boolean not null default true,
  trusted               boolean not null default false,
  trusted_at            timestamptz null,
  notes                 text null
);

-- The dead flag: `all_bookmakers_licence_checked` was written but never read,
-- because the gate function counts unverified books live. A cached boolean can
-- go stale the moment a bookmaker is added, so the live count is the truth and
-- the column goes.
alter table ai.publication_gate drop column if exists all_bookmakers_licence_checked;

-- ---------------------------------------------------------------------
-- 7. The market dimension.
--
--    Everything so far assumed home/draw/away. A market registry plus a
--    market column on bets is what makes BTTS, over/under, correct score,
--    cards and corners expressible at all.
--
--    `derived_from_scoreline` matters more than it looks: every goal-based
--    market comes out of the SAME joint scoreline distribution, so they are
--    not independent evidence. If the grid is miscalibrated, six markets are
--    wrong together and it looks like six confirmations.
-- ---------------------------------------------------------------------
create table if not exists ai.markets (
  code                   text primary key,
  name                   text not null,
  family                 text not null
                         check (family in ('result','goals','cards','corners','other')),
  n_outcomes             smallint not null,
  derived_from_scoreline boolean not null default false,
  needs_line             boolean not null default false,
  free_historical_odds   boolean not null default false,
  typical_overround      numeric(6,4) null,
  notes                  text null
);

insert into ai.markets (code, name, family, n_outcomes, derived_from_scoreline,
                        needs_line, free_historical_odds, typical_overround, notes) values
  ('1X2',   'Match result',        'result', 3, true,  false, true,  1.0771,
   'Measured mean across 10 European leagues 2005-2017 (Buhagiar et al.). Pinnacle ~1.027.'),
  ('OU',    'Over/under goals',    'goals',  2, true,  true,  true,  1.0699,
   'Free odds exist for the 2.5 line ONLY. Other lines are modellable but unpriceable.'),
  ('AH',    'Asian handicap',      'goals',  2, true,  true,  true,  null,
   'Lowest margins of any football market; dominated by sharp books.'),
  ('BTTS',  'Both teams to score', 'goals',  2, true,  false, false, null,
   'No free historical odds anywhere across the nine divisions. Model it, but you '
   'cannot backtest it until you have collected prices yourself.'),
  ('CS',    'Correct score',       'goals',  20, true, false, false, 1.12,
   'Measured ~12% vs ~4% on 1X2 in the same EPL sample (Reade et al. 2020). The '
   'market people most want to bet is the one with the worst margin.'),
  ('DC',    'Double chance',       'result', 3, true,  false, false, null, null),
  ('DNB',   'Draw no bet',         'result', 2, true,  false, false, null, null),
  ('TT',    'Team totals',         'goals',  2, true,  true,  false, null, null),
  ('WTN',   'Win to nil',          'goals',  2, true,  false, false, null, null),
  ('HTFT',  'Half-time/full-time', 'other',  9, false, false, false, null,
   'Nine outcomes, so expect the worst margin of the set. Needs its own model: '
   'the full-time scoreline grid does not imply the half-time one.'),
  ('CARDS', 'Total booking points','cards',  2, false, true,  false, null,
   'Football-Data provides HBP/ABP booking points (10 per yellow, 25 per red) as '
   'RESULTS, so the model is buildable free. No odds source, free or cheap, and '
   'not on the exchange.'),
  ('CORN',  'Total corners',       'corners',2, false, true,  false, null,
   'Same position as cards: results free via HC/AC, odds unobtainable.')
on conflict (code) do nothing;

insert into ai.evidence_gate (market) select code from ai.markets
on conflict (market) do nothing;

alter table ai.bets
  add column if not exists market text not null default '1X2' references ai.markets(code),
  add column if not exists line numeric(6,2) null,      -- 2.5, -0.5, 45.5 booking points
  add column if not exists selection_label text null;   -- 'Over', 'Yes', '2-1', 'Home -1'

-- Reinstall the explicit guard now the row has its final market columns.
-- Defining it earlier left market/line/selection_label outside the comparison.
create or replace function ai.reject_bet_mutation()
returns trigger language plpgsql as $$
begin
  if new.status is not distinct from old.status then
    raise exception 'ai.bets is append-only; only the settlement status may change'
      using errcode = '42501';
  end if;
  if old.status <> 'advised' then
    raise exception 'Bet is already %; its status is final', old.status
      using errcode = '42501';
  end if;
  if new.status not in ('settled', 'void') then
    raise exception 'Invalid status transition advised -> %', new.status
      using errcode = '22000';
  end if;
  if (new.id, new.prediction_id, new.model_id, new.league, new.fixture_id,
      new.season_fixture_id, new.raw_match_id, new.selection, new.advised_at,
      new.kickoff_at, new.hours_to_kickoff, new.bookmaker, new.odds_taken,
      new.odds_average_at_advice, new.odds_best_at_advice, new.model_prob,
      new.market_fair_prob, new.devig_method, new.edge, new.edge_vs_average,
      new.edge_line_shopping, new.staking_rule, new.stake_fraction,
      new.stake_units, new.is_paper, new.created_at,
      new.market, new.line, new.selection_label)
     is distinct from
     (old.id, old.prediction_id, old.model_id, old.league, old.fixture_id,
      old.season_fixture_id, old.raw_match_id, old.selection, old.advised_at,
      old.kickoff_at, old.hours_to_kickoff, old.bookmaker, old.odds_taken,
      old.odds_average_at_advice, old.odds_best_at_advice, old.model_prob,
      old.market_fair_prob, old.devig_method, old.edge, old.edge_vs_average,
      old.edge_line_shopping, old.staking_rule, old.stake_fraction,
      old.stake_units, old.is_paper, old.created_at,
      old.market, old.line, old.selection_label)
  then
    raise exception 'Only status may change when settling a bet'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- One bet per (prediction, market, line, book, selection).
drop index if exists ai.bets_one_per_prediction_book;
create unique index if not exists bets_one_per_prediction_market
  on ai.bets (prediction_id, market, coalesce(line, -999), bookmaker, selection);

alter table ai.predictions
  add column if not exists market_probabilities jsonb null;

comment on column ai.predictions.market_probabilities is
  'Every market derived from this prediction''s scoreline grid, in one document.
   Stored together because they share a single source of error: a miscalibrated
   grid produces six wrong markets that look like six independent confirmations.';

-- Prices for markets other than 1X2.
create table if not exists ai.market_prices (
  id           uuid primary key default gen_random_uuid(),
  fixture_id   uuid not null references ai.fixtures(id) on delete cascade,
  market       text not null references ai.markets(code),
  line         numeric(6,2) null,
  selection    text not null,
  bookmaker    text not null references ai.bookmakers(code),
  odds         numeric(8,3) not null check (odds > 1.0),
  captured_at  timestamptz not null,
  source       text not null
);
-- Expression index rather than a table constraint: `line` is null for BTTS and
-- 2.5 for over/under, and a null would otherwise make every row distinct.
create unique index if not exists market_prices_unique
  on ai.market_prices (fixture_id, market, coalesce(line, -999), selection,
                       bookmaker, captured_at);
create index if not exists market_prices_lookup_idx
  on ai.market_prices (fixture_id, market, captured_at desc);

-- ---------------------------------------------------------------------
-- 8. Access.
-- ---------------------------------------------------------------------
alter table ai.fixtures        enable row level security;
alter table ai.model_artifacts enable row level security;
alter table ai.markets         enable row level security;
alter table ai.market_prices   enable row level security;
alter table ai.evidence_gate   enable row level security;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

-- ---------------------------------------------------------------------
-- 9. Evidence status, per market.
-- ---------------------------------------------------------------------
create or replace function public.admin_ai_evidence_by_market()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
begin
  perform predictor_internal.require_competition_admin();

  return coalesce((
    select jsonb_object_agg(m.code, jsonb_build_object(
      'name', m.name,
      'free_historical_odds', m.free_historical_odds,
      'derived_from_scoreline', m.derived_from_scoreline,
      'typical_overround', m.typical_overround,
      'settled_bets', coalesce(s.n, 0),
      'mean_clv', round(coalesce(s.mean_clv, 0), 5),
      'clv_ci_low', case when s.n > 1
                    then round(s.mean_clv - 1.96 * s.sd_clv / sqrt(s.n::numeric), 5) end,
      -- Flat-stake return. Named so, because the stake-weighted return of a
      -- Kelly-staked book is a different number and conflating them overstates
      -- or understates depending on where the winners fell.
      'flat_unit_roi', round(coalesce(s.flat_roi, 0), 5),
      'stake_weighted_roi', case when coalesce(s.staked, 0) > 0
                            then round(s.pnl / s.staked, 5) end,
      'required_bets', g.min_settled_bets,
      'required_clv', g.min_mean_clv,
      'trusted', g.trusted,
      'meets_evidence_bar', (
        coalesce(s.n, 0) >= g.min_settled_bets
        and coalesce(s.mean_clv, -1) >= g.min_mean_clv
        and (not g.require_ci_above_zero
             or (s.n > 1 and (s.mean_clv - 1.96 * s.sd_clv / sqrt(s.n::numeric)) > 0)))))
      from ai.markets m
      join ai.evidence_gate g on g.market = m.code
      left join (
        select b.market as code, count(*) as n,
               avg(r.clv) as mean_clv, stddev_samp(r.clv) as sd_clv,
               avg(r.return_per_unit) as flat_roi,
               sum(r.pnl_units) as pnl, sum(b.stake_units) as staked
          from ai.bets b join ai.bet_results r on r.bet_id = b.id
         group by b.market) s on s.code = m.code), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_ai_evidence_by_market() from public, anon;
grant execute on function public.admin_ai_evidence_by_market() to authenticated;
-- ---------------------------------------------------------------------------
-- Imported scaffold stage: 005_odds_api.sql
-- ---------------------------------------------------------------------------
-- =====================================================================
-- AI Lab, migration 005 — The Odds API integration
--
-- Built free-first for the 500 credit/month plan. Live collection fits;
-- historical odds do not exist on that tier and are refused by the client.
-- accounting is not optional. Three facts from the API's own docs drive
-- the design:
--
--   1. /v4/sports/{sport}/events costs NOTHING. Event discovery and
--      fixture-ID mapping are free, so there is no excuse for guessing.
--   2. /events/{id}/markets costs 1 credit and tells you exactly which
--      markets a bookmaker actually offers for that event. The API
--      publishes no coverage matrix for the lower English divisions or
--      the SPL, so 5 credits of probing replaces an assumption that
--      could otherwise waste a month's quota.
--   3. Historical costs 10x, and event-level calls are billed per event.
--      A careless loop over three seasons of League Two is a five-figure
--      credit spend. Hence the ledger, the pre-flight estimate and the
--      hard cap.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Credit ledger.
--
--    Every call, its cost, and the remaining balance the API reported.
--    Reconciling our own arithmetic against x-requests-remaining is what
--    catches a cost model that has drifted from the provider's.
-- ---------------------------------------------------------------------
create table if not exists ai.api_usage (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'the-odds-api',
  endpoint          text not null,
  sport_key         text null,
  event_id          text null,
  markets           text[] null,
  regions           text[] null,
  bookmakers        text[] null,
  snapshot_date     timestamptz null,          -- the historical `date` param
  is_historical     boolean not null default false,
  estimated_cost    integer not null,
  -- What the provider actually charged, from x-requests-last.
  reported_cost     integer null,
  reported_remaining integer null,
  reported_used     integer null,
  http_status       integer null,
  rows_returned     integer not null default 0,
  called_at         timestamptz not null default now()
);
create index if not exists api_usage_recent_idx on ai.api_usage (called_at desc);
-- date_trunc(text, timestamptz) is STABLE, not IMMUTABLE, so it cannot be
-- indexed. A plain index on the timestamp serves the monthly rollup fine.
create index if not exists api_usage_provider_time_idx
  on ai.api_usage (provider, called_at desc);

comment on column ai.api_usage.reported_cost is
  'From the x-requests-last header. Compared against estimated_cost on every
   call: a persistent gap means our cost model is wrong, and at 20k credits a
   month a wrong cost model is discovered as an exhausted quota otherwise.';

create or replace function ai.credits_used_this_month(p_provider text default 'the-odds-api')
returns integer language sql stable set search_path to '' as $$
  select coalesce(sum(coalesce(reported_cost, estimated_cost)), 0)::integer
    from ai.api_usage
   where provider = p_provider
     and called_at >= date_trunc('month', now());
$$;

-- ---------------------------------------------------------------------
-- 2. Monthly budget, enforced rather than remembered.
-- ---------------------------------------------------------------------
create table if not exists ai.api_budget (
  provider          text primary key default 'the-odds-api',
  monthly_credits   integer not null default 500,
  -- Below the plan limit on purpose. The reserve is what leaves room for
  -- live collection after a backfill has run away with itself.
  soft_cap          integer not null default 450,
  reserve_note      text null,
  updated_at        timestamptz not null default now()
);
insert into ai.api_budget (provider, monthly_credits, soft_cap, reserve_note)
values ('the-odds-api', 500, 450,
        '50 free-tier credits reserved. Twice-weekly h2h/totals collection '
        'across five leagues costs roughly 80 credits per month.')
on conflict (provider) do nothing;

-- ---------------------------------------------------------------------
-- 3. Event identity. The Odds API has its own event ids and its own
--    spelling of every club, making it a THIRD vocabulary alongside
--    Football-Data and this platform.
-- ---------------------------------------------------------------------
create table if not exists ai.odds_api_events (
  event_id       text primary key,
  sport_key      text not null,
  commence_time  timestamptz not null,
  home_team      text not null,           -- the API's spelling, verbatim
  away_team      text not null,
  home_canonical text null,
  away_canonical text null,
  fixture_id     uuid null references ai.fixtures(id) on delete set null,
  matched_by     text null check (matched_by is null or
                   matched_by in ('alias','fuzzy','manual','unmatched')),
  first_seen_at  timestamptz not null default now()
);
create index if not exists odds_api_events_fixture_idx on ai.odds_api_events (fixture_id);
create index if not exists odds_api_events_unmatched_idx
  on ai.odds_api_events (sport_key, commence_time) where fixture_id is null;

alter table ai.team_aliases
  add column if not exists odds_api_name text null;
create index if not exists team_aliases_odds_api_idx on ai.team_aliases (odds_api_name);

-- ---------------------------------------------------------------------
-- 4. Snapshot ledger, so a killed backfill resumes instead of re-buying.
-- ---------------------------------------------------------------------
create table if not exists ai.odds_api_snapshots (
  id             uuid primary key default gen_random_uuid(),
  sport_key      text not null,
  event_id       text null,               -- null for whole-sport featured snapshots
  snapshot_date  timestamptz not null,    -- the `date` we asked for
  actual_timestamp timestamptz null,      -- the `timestamp` it returned
  markets        text[] not null,
  -- Sorted, comma-joined copies of the two arrays. Stored rather than computed
  -- in the index because array_to_string is only STABLE, not IMMUTABLE, and
  -- Postgres will not index a STABLE expression.
  markets_key    text not null,
  bookmakers_key text not null,
  prices_written integer not null default 0,
  credits_spent  integer not null default 0,
  status         text not null default 'ok' check (status in ('ok','empty','failed')),
  fetched_at     timestamptz not null default now()
);
create unique index if not exists odds_api_snapshots_unique
  on ai.odds_api_snapshots
     (sport_key, coalesce(event_id, ''), snapshot_date, markets_key, bookmakers_key);

comment on table ai.odds_api_snapshots is
  'One row per historical snapshot already purchased. The backfill consults this
   before every call, so a run killed halfway does not pay twice for the same
   data. At 10 credits per event per snapshot that is the difference between a
   resumable job and a wasted month.';

-- ---------------------------------------------------------------------
-- 5. Market coverage probe results.
--
--    The API publishes no matrix of which markets exist for League Two or
--    the Scottish Premiership, and its own note says additional markets
--    are "currently limited to US sports and selected bookmakers". So we
--    measure it, once, for 1 credit per league, and record the answer.
-- ---------------------------------------------------------------------
create table if not exists ai.odds_api_coverage (
  sport_key    text not null,
  bookmaker    text not null,
  market_key   text not null,
  last_seen_at timestamptz not null default now(),
  probe_event  text null,
  primary key (sport_key, bookmaker, market_key)
);

create or replace function public.admin_ai_odds_api_status()
returns jsonb
language plpgsql stable security definer
set search_path to ''
as $$
declare v_budget record; v_used integer; v_recent jsonb; v_cov jsonb; v_match jsonb;
begin
  perform predictor_internal.require_competition_admin();

  select * into v_budget from ai.api_budget where provider = 'the-odds-api';
  v_used := ai.credits_used_this_month();

  select coalesce(jsonb_agg(to_jsonb(x) order by x.called_at desc), '[]'::jsonb)
    into v_recent
    from (select endpoint, sport_key, is_historical, estimated_cost, reported_cost,
                 reported_remaining, rows_returned, called_at
            from ai.api_usage order by called_at desc limit 20) x;

  -- Which markets were actually seen, per league. The answer the docs do not give.
  select coalesce(jsonb_object_agg(sport_key, markets), '{}'::jsonb)
    into v_cov
    from (select sport_key, jsonb_agg(distinct market_key order by market_key) as markets
            from ai.odds_api_coverage group by sport_key) c;

  select jsonb_build_object(
      'events_seen', count(*),
      'matched_to_fixture', count(*) filter (where fixture_id is not null),
      'unmatched', coalesce(jsonb_agg(distinct home_team) filter (
        where fixture_id is null), '[]'::jsonb))
    into v_match from ai.odds_api_events;

  return jsonb_build_object(
    'month_to_date_credits', v_used,
    'monthly_credits', v_budget.monthly_credits,
    'soft_cap', v_budget.soft_cap,
    'remaining_to_soft_cap', greatest(v_budget.soft_cap - v_used, 0),
    -- Estimate vs reported. A drift here is the early warning.
    'cost_model_drift', (
      select round(coalesce(sum(reported_cost) - sum(estimated_cost), 0)::numeric, 0)
        from ai.api_usage where reported_cost is not null
          and called_at >= date_trunc('month', now())),
    'coverage', v_cov,
    'event_matching', v_match,
    'recent_calls', v_recent);
end;
$$;

revoke all on function public.admin_ai_odds_api_status() from public, anon;
grant execute on function public.admin_ai_odds_api_status() to authenticated;

alter table ai.api_usage          enable row level security;
alter table ai.api_budget         enable row level security;
alter table ai.odds_api_events    enable row level security;
alter table ai.odds_api_snapshots enable row level security;
alter table ai.odds_api_coverage  enable row level security;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;
-- ---------------------------------------------------------------------------
-- Imported scaffold stage: 006_operational_integrity.sql
-- ---------------------------------------------------------------------------
-- =====================================================================
-- AI Lab, migration 006 — operational lifecycle integrity
--
-- Closes the remaining fixture -> odds -> prediction -> bet -> close -> CLV
-- integration gaps. Safe after 001..005 and on a fresh database.
-- =====================================================================

-- Every code emitted by the built-in collectors must satisfy the FKs.
insert into ai.bookmakers (code, name, kind, is_real_price, notes) values
  ('B365', 'Bet365', 'bookmaker', true, 'Early Football-Data fixture price.'),
  ('SMK',  'Smarkets', 'exchange', true, 'The Odds API sharp-book set.'),
  ('MTB',  'Matchbook', 'exchange', true, 'The Odds API sharp-book set.')
on conflict (code) do nothing;

-- Migrate only the untouched scaffold default from the former paid-plan
-- assumption. Any deliberately customised budget is preserved.
update ai.api_budget
   set monthly_credits=500, soft_cap=450,
       reserve_note='50 free-tier credits reserved; historical calls are disabled on free.',
       updated_at=now()
 where provider='the-odds-api'
   and monthly_credits=20000 and soft_cap=17000
   and reserve_note like '3,000 credits held back%';

-- Repair exact legacy matches where possible. New rows are never allowed to
-- become invisible orphans: fetch_fixtures_odds resolves the id in its INSERT
-- and this trigger is the final database guard.
update ai.fixture_odds fo
   set fixture_id = f.id
  from ai.fixtures f
 where fo.fixture_id is null
   and f.division = fo.division
   and f.match_date = fo.match_date
   and f.home_canonical = fo.home_canonical
   and f.away_canonical = fo.away_canonical;

create or replace function ai.require_fixture_odds_target()
returns trigger language plpgsql as $$
begin
  if new.fixture_id is null then
    raise exception 'fixture_odds requires fixture_id; sync fixtures and aliases first'
      using errcode = '23502';
  end if;
  return new;
end;
$$;
drop trigger if exists fixture_odds_need_fixture on ai.fixture_odds;
create trigger fixture_odds_need_fixture
  before insert or update of fixture_id on ai.fixture_odds
  for each row execute function ai.require_fixture_odds_target();

-- Generic market selections. The former char(1) H/D/A field prevented Over,
-- Under, Yes, No, correct scores and handicap selections from existing.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid=con.conrelid
      join pg_namespace ns on ns.oid=rel.relnamespace
     where ns.nspname='ai' and rel.relname='bets' and con.contype='c'
       and pg_get_constraintdef(con.oid) ilike '%selection%'
  loop
    execute format('alter table ai.bets drop constraint %I', c.conname);
  end loop;
end $$;

alter table ai.bets alter column selection type text using btrim(selection::text);
alter table ai.bets drop constraint if exists bets_selection_nonempty;
alter table ai.bets add constraint bets_selection_nonempty
  check (length(btrim(selection)) > 0);
alter table ai.bets drop constraint if exists bets_1x2_selection_shape;
alter table ai.bets add constraint bets_1x2_selection_shape
  check (market <> '1X2' or selection in ('H','D','A'));

alter table ai.bet_results
  add column if not exists settlement_outcome text null;
update ai.bet_results
   set settlement_outcome = case when won then 'win' else 'loss' end
 where settlement_outcome is null;
alter table ai.bet_results alter column settlement_outcome set not null;
alter table ai.bet_results alter column won drop not null;
alter table ai.bet_results add column if not exists actual_value text null;
alter table ai.bet_results drop constraint if exists bet_results_settlement_outcome_check;
alter table ai.bet_results add constraint bet_results_settlement_outcome_check
  check (settlement_outcome in
         ('win','loss','push','half_win','half_loss','void'));
comment on column ai.bet_results.return_per_unit is
  'Canonical financial settlement for every market: positive win return, -1 loss, '
  '0 push, and the actual blended return for half-wins/half-losses.';

-- Free historical O/U 2.5 and Asian-handicap prices from Football-Data.
-- Keeping these in a generic child table makes both markets backtestable
-- without widening raw_matches for every bookmaker/line combination.
create table if not exists ai.historical_market_prices (
  id           uuid primary key default gen_random_uuid(),
  raw_match_id uuid not null references ai.raw_matches(id) on delete cascade,
  market       text not null references ai.markets(code)
               check (market in ('OU','AH')),
  line         numeric(6,2) not null,
  selection    text not null,
  bookmaker    text not null references ai.bookmakers(code),
  odds         numeric(8,3) not null check (odds > 1.0),
  phase        text not null default 'pre' check (phase in ('pre','close')),
  source       text not null default 'football-data.co.uk'
);
create unique index if not exists historical_market_prices_unique
  on ai.historical_market_prices
     (raw_match_id,market,line,selection,bookmaker,phase);
create index if not exists historical_market_prices_lookup_idx
  on ai.historical_market_prices (market,line,bookmaker,raw_match_id);
alter table ai.historical_market_prices enable row level security;

-- Re-install the explicit immutability guard over the complete row shape.
create or replace function ai.reject_bet_mutation()
returns trigger language plpgsql as $$
begin
  if new.status is not distinct from old.status then
    raise exception 'ai.bets is append-only; only the settlement status may change'
      using errcode = '42501';
  end if;
  if old.status <> 'advised' then
    raise exception 'Bet is already %; its status is final', old.status
      using errcode = '42501';
  end if;
  if new.status not in ('settled', 'void') then
    raise exception 'Invalid status transition advised -> %', new.status
      using errcode = '22000';
  end if;
  if (new.id, new.prediction_id, new.model_id, new.league, new.fixture_id,
      new.season_fixture_id, new.raw_match_id, new.selection, new.advised_at,
      new.kickoff_at, new.hours_to_kickoff, new.bookmaker, new.odds_taken,
      new.odds_average_at_advice, new.odds_best_at_advice, new.model_prob,
      new.market_fair_prob, new.devig_method, new.edge, new.edge_vs_average,
      new.edge_line_shopping, new.staking_rule, new.stake_fraction,
      new.stake_units, new.is_paper, new.created_at,
      new.market, new.line, new.selection_label)
     is distinct from
     (old.id, old.prediction_id, old.model_id, old.league, old.fixture_id,
      old.season_fixture_id, old.raw_match_id, old.selection, old.advised_at,
      old.kickoff_at, old.hours_to_kickoff, old.bookmaker, old.odds_taken,
      old.odds_average_at_advice, old.odds_best_at_advice, old.model_prob,
      old.market_fair_prob, old.devig_method, old.edge, old.edge_vs_average,
      old.edge_line_shopping, old.staking_rule, old.stake_fraction,
      old.stake_units, old.is_paper, old.created_at,
      old.market, old.line, old.selection_label)
  then
    raise exception 'Only status may change when settling a bet'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Artefact bytes are content-addressed and insert-only. Metadata and payload
-- must agree, and promotion checks the same relationship again.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function ai.verify_model_artifact()
returns trigger language plpgsql
set search_path to 'pg_catalog', 'extensions', 'public'
as $$
declare expected text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Model artefacts are immutable; create a new model version'
      using errcode = '42501';
  end if;
  select artifact_sha256 into expected from ai.models where id = new.model_id;
  if expected is null or expected <> new.sha256 then
    raise exception 'Artefact SHA does not match model metadata for %', new.model_id
      using errcode = '22000';
  end if;
  if encode(digest(new.payload, 'sha256'), 'hex') <> new.sha256 then
    raise exception 'Artefact payload checksum is invalid for %', new.model_id
      using errcode = '22000';
  end if;
  return new;
end;
$$;
drop trigger if exists model_artifacts_verified on ai.model_artifacts;
create trigger model_artifacts_verified
  before insert or update on ai.model_artifacts
  for each row execute function ai.verify_model_artifact();

create or replace function ai.protect_model_artifact_sha()
returns trigger language plpgsql as $$
begin
  if new.artifact_sha256 is distinct from old.artifact_sha256
     and exists (select 1 from ai.model_artifacts where model_id=old.id) then
    raise exception 'artifact_sha256 is immutable once bytes are stored'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists models_artifact_sha_immutable on ai.models;
create trigger models_artifact_sha_immutable
  before update of artifact_sha256 on ai.models
  for each row execute function ai.protect_model_artifact_sha();

create or replace function ai.require_artifact_before_current()
returns trigger language plpgsql as $$
begin
  if new.status = 'current'
     and not exists (
       select 1 from ai.model_artifacts a
        where a.model_id=new.id and a.sha256=new.artifact_sha256) then
    raise exception 'Model % has no verified stored artefact and cannot be current', new.id
      using errcode = '22000';
  end if;
  return new;
end;
$$;

-- Lower-league predictions and grades are first-class admin data.
create or replace function public.admin_ai_upcoming_predictions(
  p_league text default null, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform predictor_internal.require_competition_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.kickoff_at)
      from (
        select p.id, p.league, p.kickoff_at,
               p.home_canonical as home, p.away_canonical as away,
               p.p_home, p.p_draw, p.p_away, p.predicted_result,
               p.predicted_score, p.exp_home_goals, p.exp_away_goals,
               p.scoreline_grid, m.version as model_version,
               f.status as fixture_status
          from ai.predictions p
          join ai.models m on m.id=p.model_id
          join ai.fixtures f on f.id=p.fixture_id
         where p.kickoff_at >= now() - interval '2 hours'
           and (p_league is null or p.league=p_league)
         order by p.kickoff_at
         limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_ai_recent_results(
  p_league text default null, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform predictor_internal.require_competition_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.kickoff_at desc)
      from (
        select p.id, p.league, p.kickoff_at,
               p.home_canonical as home, p.away_canonical as away,
               p.p_home, p.p_draw, p.p_away, p.predicted_result,
               p.predicted_score, r.actual_home_goals, r.actual_away_goals,
               r.actual_result, r.result_correct, r.exact_score_correct,
               r.log_loss, r.rps, m.version as model_version
          from ai.predictions p
          join ai.prediction_results r on r.prediction_id=p.id
          join ai.models m on m.id=p.model_id
         where p_league is null or p.league=p_league
         order by p.kickoff_at desc
         limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

-- Confidence intervals use the number of observed CLVs, not every settled
-- bet. Both counts are exposed so missing closing lines are visible.
create or replace function public.admin_ai_evidence_by_market()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
  perform predictor_internal.require_competition_admin();
  return coalesce((
    select jsonb_object_agg(m.code, jsonb_build_object(
      'name', m.name,
      'free_historical_odds', m.free_historical_odds,
      'derived_from_scoreline', m.derived_from_scoreline,
      'typical_overround', m.typical_overround,
      'settled_bets', coalesce(s.settled_bets, 0),
      'clv_observations', coalesce(s.clv_n, 0),
      'mean_clv', round(coalesce(s.mean_clv, 0), 5),
      'clv_ci_low', case when s.clv_n > 1
                    then round(s.mean_clv - 1.96*s.sd_clv/sqrt(s.clv_n::numeric), 5) end,
      'flat_unit_roi', round(coalesce(s.flat_roi, 0), 5),
      'stake_weighted_roi', case when coalesce(s.staked, 0) > 0
                            then round(s.pnl/s.staked, 5) end,
      'required_bets', g.min_settled_bets,
      'required_clv', g.min_mean_clv,
      'trusted', g.trusted,
      'meets_evidence_bar', (
        coalesce(s.clv_n, 0) >= g.min_settled_bets
        and coalesce(s.mean_clv, -1) >= g.min_mean_clv
        and (not g.require_ci_above_zero or
             (s.clv_n > 1 and
              s.mean_clv - 1.96*s.sd_clv/sqrt(s.clv_n::numeric) > 0)))))
      from ai.markets m
      join ai.evidence_gate g on g.market=m.code
      left join (
        select b.market as code, count(*) as settled_bets,
               count(r.clv) as clv_n, avg(r.clv) as mean_clv,
               stddev_samp(r.clv) as sd_clv,
               avg(r.return_per_unit) as flat_roi,
               sum(r.pnl_units) as pnl, sum(b.stake_units) as staked
          from ai.bets b join ai.bet_results r on r.bet_id=b.id
         group by b.market) s on s.code=m.code), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_ai_upcoming_predictions(text, integer) from public, anon;
revoke all on function public.admin_ai_recent_results(text, integer) from public, anon;
revoke all on function public.admin_ai_evidence_by_market() from public, anon;
grant execute on function public.admin_ai_upcoming_predictions(text, integer) to authenticated;
grant execute on function public.admin_ai_recent_results(text, integer) to authenticated;
grant execute on function public.admin_ai_evidence_by_market() to authenticated;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

-- ---------------------------------------------------------------------------
-- Secret-safe hosted Odds API collection.
--
-- The existing provider-poll Edge Function owns the outbound request and reads
-- ODDS_API (with legacy ODDS_API_KEY/THE_ODDS_API_KEY aliases) from Supabase
-- secrets. The database sees
-- only the credential-free URL, raw response evidence and normalized prices.
-- Collection is installed disabled: Development may enable it deliberately;
-- a later Production migration promotion remains inert unless separately
-- authorised there.
-- ---------------------------------------------------------------------------

alter table ai.api_budget
  add column if not exists collection_enabled boolean not null default false;

create table if not exists ai.odds_api_raw_responses (
  id uuid primary key default gen_random_uuid(),
  request_url text not null,
  response_status integer not null check (response_status between 100 and 599),
  response_headers jsonb not null default '{}'::jsonb,
  raw_body text not null,
  raw_body_sha256 text generated always as (
    pg_catalog.encode(extensions.digest(raw_body, 'sha256'), 'hex')
  ) stored,
  decoder_version text not null,
  error_detail text null,
  fetched_at timestamptz not null default clock_timestamp(),
  constraint odds_api_raw_response_origin check (
    request_url like 'https://api.the-odds-api.com/v4/%'
    and request_url !~* '([?&])(api[_-]?key|apikey|token|authorization)='
  ),
  constraint odds_api_raw_response_body_bound
    check (octet_length(raw_body) <= 12582912)
);

create table if not exists ai.odds_api_dispatches (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  net_request_id bigint not null,
  dispatched_at timestamptz not null default now()
);

alter table ai.odds_api_raw_responses enable row level security;
alter table ai.odds_api_dispatches enable row level security;
revoke all on ai.odds_api_raw_responses from public, anon, authenticated, service_role;
revoke all on ai.odds_api_dispatches from public, anon, authenticated, service_role;

create or replace function ai.reject_odds_custody_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;
revoke all on function ai.reject_odds_custody_mutation()
  from public, anon, authenticated, service_role;

create trigger odds_api_raw_responses_append_only
before update or delete on ai.odds_api_raw_responses
for each row execute function ai.reject_odds_custody_mutation();

create trigger odds_api_dispatches_append_only
before update or delete on ai.odds_api_dispatches
for each row execute function ai.reject_odds_custody_mutation();

create or replace function public.ai_odds_budget_check(p_estimated_cost integer)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_budget ai.api_budget%rowtype;
  v_used integer;
begin
  if p_estimated_cost is null or p_estimated_cost < 0 then
    raise exception 'estimated cost must be a non-negative integer';
  end if;
  select * into v_budget from ai.api_budget where provider = 'the-odds-api';
  v_used := ai.credits_used_this_month('the-odds-api');
  return jsonb_build_object(
    'allowed', coalesce(v_budget.collection_enabled, false)
      and v_used + p_estimated_cost <= coalesce(v_budget.soft_cap, 0),
    'collection_enabled', coalesce(v_budget.collection_enabled, false),
    'used', v_used,
    'estimated_cost', p_estimated_cost,
    'soft_cap', coalesce(v_budget.soft_cap, 0),
    'remaining', greatest(coalesce(v_budget.soft_cap, 0) - v_used, 0));
end;
$$;
revoke all on function public.ai_odds_budget_check(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.ai_odds_budget_check(integer) to service_role;

create or replace function public.record_ai_odds_snapshot(
  p_request_url text,
  p_response_status integer,
  p_response_headers jsonb,
  p_raw_body text,
  p_normalized_payload jsonb,
  p_estimated_cost integer,
  p_reported_cost integer,
  p_reported_remaining integer,
  p_reported_used integer,
  p_decoder_version text,
  p_error_detail text default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_raw_id uuid;
  v_prices integer := 0;
  v_events integer := 0;
  v_unmatched integer := 0;
begin
  if jsonb_typeof(coalesce(p_normalized_payload, '[]'::jsonb)) <> 'array' then
    raise exception 'normalized Odds API payload must be an array';
  end if;

  insert into ai.odds_api_raw_responses (
    request_url, response_status, response_headers, raw_body,
    decoder_version, error_detail
  ) values (
    p_request_url, p_response_status, coalesce(p_response_headers, '{}'::jsonb),
    p_raw_body, p_decoder_version, left(p_error_detail, 4000)
  ) returning id into v_raw_id;

  insert into ai.api_usage (
    provider, endpoint, sport_key, markets, estimated_cost, reported_cost,
    reported_remaining, reported_used, http_status, rows_returned
  )
  select 'the-odds-api', 'odds', min(x.sport_key),
         coalesce(array_agg(distinct x.market) filter (where x.market is not null), '{}'),
         p_estimated_cost, p_reported_cost, p_reported_remaining,
         p_reported_used, p_response_status,
         jsonb_array_length(coalesce(p_normalized_payload, '[]'::jsonb))
    from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb)) as x(
      sport_key text, market text
    );

  insert into ai.odds_api_events (
    event_id, sport_key, commence_time, home_team, away_team,
    home_canonical, away_canonical, fixture_id, matched_by
  )
  select distinct on (x.event_id)
         x.event_id, x.sport_key, x.commence_time, x.home_team, x.away_team,
         x.home_canonical, x.away_canonical, matched.id,
         case when matched.id is null then 'unmatched' else 'alias' end
    from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb)) as x(
      event_id text, sport_key text, commence_time timestamptz,
      home_team text, away_team text, home_canonical text, away_canonical text
    )
    left join lateral (
      select fixture.id
        from ai.fixtures fixture
       where fixture.home_canonical = x.home_canonical
         and fixture.away_canonical = x.away_canonical
         and coalesce(fixture.kickoff_at, fixture.match_date::timestamptz)
             between x.commence_time - interval '2 days'
                 and x.commence_time + interval '2 days'
       order by abs(extract(epoch from
         (coalesce(fixture.kickoff_at, fixture.match_date::timestamptz)
          - x.commence_time)))
       limit 1
    ) matched on true
  on conflict (event_id) do update set
    fixture_id = coalesce(ai.odds_api_events.fixture_id, excluded.fixture_id),
    matched_by = case when coalesce(ai.odds_api_events.fixture_id, excluded.fixture_id)
                      is null then 'unmatched' else excluded.matched_by end;
  get diagnostics v_events = row_count;

  insert into ai.market_prices (
    fixture_id, market, line, selection, bookmaker, odds, captured_at, source
  )
  select event.fixture_id, x.market, x.line, x.selection, x.bookmaker,
         x.odds, x.captured_at, 'the-odds-api'
    from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb)) as x(
      event_id text, market text, line numeric, selection text,
      bookmaker text, odds numeric, captured_at timestamptz
    )
    join ai.odds_api_events event on event.event_id = x.event_id
   where event.fixture_id is not null
  on conflict do nothing;
  get diagnostics v_prices = row_count;

  select count(*) into v_unmatched
    from ai.odds_api_events event
   where event.event_id in (
     select x.event_id
       from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb))
            as x(event_id text)
   ) and event.fixture_id is null;

  return jsonb_build_object(
    'raw_response_id', v_raw_id,
    'events_seen', v_events,
    'prices_written', v_prices,
    'unmatched_events', v_unmatched);
end;
$$;
revoke all on function public.record_ai_odds_snapshot(
  text,integer,jsonb,text,jsonb,integer,integer,integer,integer,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.record_ai_odds_snapshot(
  text,integer,jsonb,text,jsonb,integer,integer,integer,integer,text,text
) to service_role;

create or replace function public.dispatch_ai_odds_polls(p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_endpoint text;
  v_key text;
  v_path text;
  v_request_id bigint;
  v_count integer := 0;
  v_now timestamptz := now();
  v_local timestamp;
  v_budget jsonb;
begin
  v_local := v_now at time zone 'Europe/London';
  if not coalesce(p_force, false) and not (
    (extract(isodow from v_local) = 2 and extract(hour from v_local) = 13)
    or (extract(isodow from v_local) = 5 and extract(hour from v_local) = 17)
  ) then
    return jsonb_build_object('dispatched', 0, 'reason', 'outside_collection_window');
  end if;

  v_budget := public.ai_odds_budget_check(10);
  if coalesce((v_budget ->> 'allowed')::boolean, false) is false then
    return jsonb_build_object('dispatched', 0, 'reason', 'budget_or_collection_disabled',
                              'budget', v_budget);
  end if;

  select endpoint_url, caller_key into v_endpoint, v_key
    from predictor_internal.provider_poll_endpoint();
  if v_endpoint is null or v_key is null then
    return jsonb_build_object('dispatched', 0, 'reason', 'provider_poll_not_configured');
  end if;

  foreach v_path in array array[
    '/sports/soccer_epl/odds?markets=h2h,totals&bookmakers=pinnacle,betfair_ex_uk,smarkets,matchbook&oddsFormat=decimal',
    '/sports/soccer_efl_champ/odds?markets=h2h,totals&bookmakers=pinnacle,betfair_ex_uk,smarkets,matchbook&oddsFormat=decimal',
    '/sports/soccer_england_league1/odds?markets=h2h,totals&bookmakers=pinnacle,betfair_ex_uk,smarkets,matchbook&oddsFormat=decimal',
    '/sports/soccer_england_league2/odds?markets=h2h,totals&bookmakers=pinnacle,betfair_ex_uk,smarkets,matchbook&oddsFormat=decimal',
    '/sports/soccer_spl/odds?markets=h2h,totals&bookmakers=pinnacle,betfair_ex_uk,smarkets,matchbook&oddsFormat=decimal'
  ] loop
    v_request_id := net.http_post(
      url := v_endpoint,
      headers := jsonb_build_object('content-type','application/json','apikey',v_key),
      body := jsonb_build_object('provider','the-odds-api','path',v_path),
      timeout_milliseconds := 30000
    );
    insert into ai.odds_api_dispatches(path, net_request_id)
    values (v_path, v_request_id);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('dispatched', v_count, 'estimated_credits', 10);
end;
$$;
revoke all on function public.dispatch_ai_odds_polls(boolean)
  from public, anon, authenticated, service_role;
-- Deliberately owner/pg_cron-only. Any PostgREST-reachable grant here would
-- create a browser or service-session path into net.http_post.

select cron.schedule('ai-odds-tuesday-bst', '30 12 * * 2',
  'select public.dispatch_ai_odds_polls();');
select cron.schedule('ai-odds-tuesday-gmt', '30 13 * * 2',
  'select public.dispatch_ai_odds_polls();');
select cron.schedule('ai-odds-friday-bst', '30 16 * * 5',
  'select public.dispatch_ai_odds_polls();');
select cron.schedule('ai-odds-friday-gmt', '30 17 * * 5',
  'select public.dispatch_ai_odds_polls();');

commit;
