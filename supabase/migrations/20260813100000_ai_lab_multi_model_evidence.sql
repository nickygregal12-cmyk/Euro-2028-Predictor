-- Contract 188: multi-model forecasting evidence, provider identity custody
-- and prediction quarantine for the private AI Lab.
--
-- Additive only. It adds nullable columns to three existing `ai` tables and
-- one new append-only table, and it moves no scoring, lock, settlement,
-- progression or reveal rule. Schema `ai` keeps the authority ADR 0029 gave
-- it, which is none over platform fixtures, official results, scoring, locks,
-- standings, progression, memberships or player predictions. No browser role
-- gains direct access to anything here; the one new read is a bounded
-- competition-admin RPC, on the same gate as every other `admin_ai_*` read.
--
-- CONTRACT NUMBERING IS POSITIONAL. `documentationContractFreshness.test.ts`
-- asserts contractVersion == requiredMigrationCount == the number of committed
-- migration files, so the number is decided by how many migrations are in the
-- tree rather than by what a header says. An earlier draft of this file was
-- numbered 186 and would have collided with the open season-Championship pull
-- request, which holds 186 and 187 through
-- `20260812080000_cup_group_stage_span.sql` and
-- `20260812090000_season_cup_qualification_driver.sql`. This branch is
-- therefore STACKED on that one: both of its migrations are present here, this
-- file's timestamp sorts after both, and no object below is shared with
-- either, so when that branch merges this rebases as a no-op rather than as a
-- renumbering.
--
-- WHAT THE FIRST DRAFT OF THIS CONTRACT DID NOT KNOW, and which sections 6 to
-- 9 below exist to fix. Production's first fifty-one live forecasts were
-- generated on 13 August 2026 and thirty-seven of them carried at least one
-- club with NO matched history — Leicester City, Norwich City, West Bromwich
-- Albion, Swansea City, Blackburn Rovers and the rest — because the
-- `provider-poll` Edge Function canonicalises team names through its OWN
-- twelve-entry alias table, a fourth club-name vocabulary that happens to
-- cover the Premier League and nothing below it. `ai/aliases.py` has always
-- mapped `Leicester City -> Leicester` correctly; nothing on the hosted path
-- ever called it. A club with a complete Championship season was scored as a
-- newcomer on the 1180 placeholder rating, and the model duly said Notts
-- County 99.659%, expected goals 6.00 - 0.05. That is not a model opinion, and
-- no amount of model work is worth doing while an input can do that.
--
-- WHY EACH PIECE EXISTS, since a column with no caller is this repository's
-- most-repeated defect and none of these may become one:
--
--  1. ai.models learned to distinguish the fit it was JUDGED on from the fit
--     that was STORED. Training used to evaluate on a chronological holdout
--     and then serialise the very model that had been kept away from the
--     newest two seasons, so the deployed artefact could not see last month
--     and `training_matches` counted rows that were thrown away. Those are two
--     different numbers and they now have two different columns.
--
--  2. ai.predictions learned to carry the evidence behind the number: the raw
--     probability beside the calibrated one, what each independent model
--     said, how much they agreed, how confident the DATA was as distinct from
--     how likely the OUTCOME was, and a structured explanation. Stored with
--     the immutable prediction rather than recomputed later, because the model
--     that produced it may be retired by the time anyone asks, and an
--     explanation regenerated from a successor is an explanation of a
--     different forecast.
--
--  3. ai.recommendations records the decision, INCLUDING the decision not to
--     bet. `ai.bets` records bets, so a gate that answers "no selection
--     qualifies" wrote nothing at all and left no evidence that it had run,
--     which is indistinguishable from the job failing. A PASS with its reason
--     codes is the output this lab most needs to be able to defend.
--
--  4. ai.prediction_results learned to record a post-match DIAGNOSIS.
--     A 74% favourite losing is not evidence that a model is wrong; a 74%
--     favourite losing while being out-shot 4-21 is a different observation
--     from one losing while winning every underlying count, and storing them
--     identically is how a lab confuses variance with a defect.

begin;

-- ---------------------------------------------------------------------------
-- 1. Model provenance: the artefact that shipped, and the fit that was judged.
-- ---------------------------------------------------------------------------
alter table ai.models
  add column if not exists eval_training_matches integer null,
  add column if not exists final_trained_through date null,
  add column if not exists features_version text null,
  add column if not exists feature_groups text[] null,
  add column if not exists half_life_days numeric(8,2) null,
  add column if not exists elo_transition text null,
  add column if not exists calibration_method text null,
  add column if not exists component_families text[] null,
  add column if not exists meta_model text null,
  add column if not exists uses_market boolean not null default false;

comment on column ai.models.training_matches is
  'Rows the STORED artefact was fitted on. Before contract 186 this described
   the evaluation fit, which was discarded; `eval_training_matches` now holds
   that number and this one describes the bytes.';

comment on column ai.models.component_families is
  'For an ensemble, the base families packaged inside this artefact. They are
   components of one model rather than sibling rows, so the one-current-model
   -per-league unique index keeps its meaning.';

comment on column ai.models.uses_market is
  'True when this model was trained on betting prices. The pure football model
   must stay identifiable, or "does my football model add information?" stops
   being answerable.';

-- ---------------------------------------------------------------------------
-- 2. Prediction evidence.
-- ---------------------------------------------------------------------------
alter table ai.predictions
  -- What the model said, before calibration was applied. Kept beside the
  -- calibrated number rather than instead of it: a diagnosis months later
  -- needs to know whether an error came from the model or from its correction.
  add column if not exists p_home_raw numeric(6,5) null,
  add column if not exists p_draw_raw numeric(6,5) null,
  add column if not exists p_away_raw numeric(6,5) null,
  add column if not exists model_views jsonb null,
  add column if not exists agreement jsonb null,
  add column if not exists data_confidence jsonb null,
  add column if not exists uncertainty jsonb null,
  add column if not exists explanation jsonb null;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'predictions_raw_probabilities_sum')
  then
    alter table ai.predictions
      add constraint predictions_raw_probabilities_sum
      check (p_home_raw is null
             or abs((p_home_raw + coalesce(p_draw_raw,0) + coalesce(p_away_raw,0)) - 1) < 0.001);
  end if;
end $$;

comment on column ai.predictions.model_views is
  'Each independent base model''s H/D/A vector. 67/66/68 and 82/51/73 can
   average to the same headline and are not the same evidence.';

comment on column ai.predictions.data_confidence is
  'How well evidenced this forecast is — NOT how likely the outcome is. A 70%
   favourite may carry limited data confidence; the two must never be shown as
   one number.';

-- ---------------------------------------------------------------------------
-- 3. The decision log, including the decision not to bet.
-- ---------------------------------------------------------------------------
create table if not exists ai.recommendations (
  id                uuid primary key default gen_random_uuid(),
  -- Fixture identity is deliberately NOT repeated here. `ai.bets` carries its
  -- own copy because it predates the prediction being the only route to one;
  -- a second copy on this table could disagree with the prediction it is
  -- about, and seven of the nine modelled leagues have no season fixture at
  -- all, so the exactly-one-of check those columns would need is wrong here.
  prediction_id     uuid not null references ai.predictions(id) on delete cascade,
  model_id          uuid not null references ai.models(id),
  league            text not null,
  market            text not null default '1X2',
  selection         text not null,

  decided_at        timestamptz not null default now(),
  kickoff_at        timestamptz not null,
  hours_to_kickoff  numeric(7,2) null,

  -- BET or one of the PASS reasons. A gate that can only say yes is not a
  -- gate, and "no selections currently pass the threshold" has to be a
  -- recordable answer rather than an empty run.
  decision          text not null
                    check (decision in ('BET','PASS')),
  reason_codes      text[] not null default '{}',

  bookmaker         text null references ai.bookmakers(code),
  odds_offered      numeric(8,3) null,
  odds_captured_at  timestamptz null,
  odds_age_seconds  integer null,

  calibrated_prob   numeric(6,5) null,
  fair_odds         numeric(8,3) null,
  expected_value    numeric(8,5) null,
  data_confidence   numeric(6,5) null,
  data_confidence_state text null,
  agreement_score   numeric(6,5) null,
  uncertainty_width numeric(6,5) null,
  evidence          jsonb not null default '{}'::jsonb,

  -- A PASS must say why. An unexplained refusal is as useless as an
  -- unexplained selection, and harder to argue with.
  check (decision = 'BET' or cardinality(reason_codes) > 0)
);

create index if not exists recommendations_league_idx
  on ai.recommendations (league, decided_at desc);
create index if not exists recommendations_prediction_idx
  on ai.recommendations (prediction_id, decided_at desc);

-- Append-only, for the same reason predictions and bets are: a decision log
-- that can be edited after the result is known is not a decision log.
create or replace function ai.reject_recommendation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ai.recommendations is append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists recommendations_no_mutation on ai.recommendations;
create trigger recommendations_no_mutation
  before update or delete on ai.recommendations
  for each row execute function ai.reject_recommendation_mutation();

-- A recommendation may only be made before kickoff, matching ai.predictions
-- and ai.bets. Advice recorded after the match is not advice.
create or replace function ai.reject_late_recommendation()
returns trigger language plpgsql as $$
begin
  if new.decided_at >= new.kickoff_at then
    raise exception 'Recommendation for a match kicking off at % cannot be recorded at %',
      new.kickoff_at, new.decided_at
      using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists recommendations_before_kickoff on ai.recommendations;
create trigger recommendations_before_kickoff
  before insert on ai.recommendations
  for each row execute function ai.reject_late_recommendation();

-- ---------------------------------------------------------------------------
-- 4. Post-match diagnosis, beside the grade rather than inside it.
-- ---------------------------------------------------------------------------
alter table ai.prediction_results
  add column if not exists diagnosis text null,
  add column if not exists diagnosis_evidence jsonb null,
  add column if not exists diagnosed_at timestamptz null;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'prediction_results_diagnosis_vocabulary')
  then
    alter table ai.prediction_results
      add constraint prediction_results_diagnosis_vocabulary
      check (diagnosis is null or diagnosis in (
        'NORMAL_VARIANCE',
        'DATA_GAP',
        'UNDERLYING_PERFORMANCE_SUPPORTED_MODEL',
        'UNDERLYING_PERFORMANCE_CONTRADICTED_MODEL',
        'REGIME_CHANGE_CANDIDATE',
        'CALIBRATION_WARNING',
        'MARKET_WARNING',
        'FEATURE_FAILURE_CANDIDATE'));
  end if;
end $$;

comment on column ai.prediction_results.diagnosis is
  'Why this prediction scored as it did, from a closed vocabulary. The
   lower-probability outcome occurring is NORMAL_VARIANCE, not a model failure;
   the categories exist so that a real weakness is distinguishable from the
   ordinary noise a probabilistic forecast is supposed to produce.';

-- ---------------------------------------------------------------------------
-- 5. Access. Identical posture to contract 185: nothing for browser roles.
-- ---------------------------------------------------------------------------
alter table ai.recommendations enable row level security;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

-- ---------------------------------------------------------------------------
-- 6. The bounded admin read, shipped WITH the table it reads.
--
--    Contracts 116, 118, 120, 122, 124, 128 and 129 each record the same
--    defect from the other side: an authority that nothing could call. A
--    decision log an administrator cannot see would be the same mistake, and
--    the whole point of recording a PASS is that somebody reads it.
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_recommendation_log(
  p_league text default null,
  p_limit  integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_rows    jsonb;
  v_reasons jsonb;
  v_limit   integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform predictor_internal.require_competition_admin();

  select coalesce(jsonb_agg(to_jsonb(r) order by r.decided_at desc), '[]'::jsonb)
    into v_rows
    from (select rec.id, rec.league, rec.market, rec.selection, rec.decision,
                 rec.reason_codes, rec.decided_at, rec.kickoff_at,
                 rec.hours_to_kickoff, rec.bookmaker, rec.odds_offered,
                 rec.odds_captured_at, rec.odds_age_seconds,
                 rec.calibrated_prob, rec.fair_odds, rec.expected_value,
                 rec.data_confidence, rec.data_confidence_state,
                 rec.agreement_score, rec.uncertainty_width,
                 p.home_canonical, p.away_canonical, p.horizon
            from ai.recommendations rec
            join ai.predictions p on p.id = rec.prediction_id
           where p_league is null or rec.league = p_league
           order by rec.decided_at desc
           limit v_limit) r;

  -- Which gate fires most is the single most useful thing this log knows: it
  -- says whether the lab is passing on price, on data or on disagreement, and
  -- those three have completely different fixes.
  select coalesce(jsonb_object_agg(code, n), '{}'::jsonb)
    into v_reasons
    from (select unnest(rec.reason_codes) as code, count(*) as n
            from ai.recommendations rec
           where (p_league is null or rec.league = p_league)
             and rec.decided_at > now() - interval '90 days'
           group by 1) c;

  return jsonb_build_object(
    'recommendations', v_rows,
    'reason_code_counts_90d', v_reasons,
    'generated_at', now());
end;
$$;

revoke all on function public.admin_ai_recommendation_log(text, integer)
  from public, anon;
grant execute on function public.admin_ai_recommendation_log(text, integer) to authenticated;

-- All four of this contract's competition-admin reads are declared in
-- `config/deployment-contract.json` and in `080_function_privileges.sql`.
-- Declaring them means the hosted deployment gate refuses an application build
-- against a database below 188 — which is what that gate is for, and is the
-- opposite of the "authority with no caller" defect this repository keeps
-- recording.

commit;

begin;

-- ===========================================================================
-- 7. ONE provider identity authority.
--
--    There are now four club-name vocabularies in this system — the platform's
--    `public.teams.name`, Football-Data's spellings, The Odds API's spellings
--    and the canonical name that joins them — and until this contract there
--    were two independent, disagreeing implementations of the fourth:
--    `ai/aliases.py`, which is complete, and a twelve-entry literal inside
--    `supabase/functions/provider-poll/index.ts`, which is not and which is
--    the one the hosted path actually used.
--
--    The authority moves into the database because that is the only place both
--    callers can reach. The Edge Function keeps sending its own opinion — it
--    has to send something — but `record_ai_odds_snapshot` now ignores it and
--    re-derives, so a decoder that has never heard of Leicester City cannot
--    poison a row. `ai/aliases.py` stays the Python-side authority and
--    `test_models.py` asserts the two agree name for name.
-- ===========================================================================

-- Shape-only comparison key. A deliberate mirror of `aliases.normalise`:
-- fold accents, lower-case, '&' -> 'and', drop apostrophes and full stops,
-- reduce everything else to single spaces, then remove a trailing club-type
-- suffix. Suffixes go LAST and as whole words, which is contract 137's lesson
-- — stripping '(afc|fc)' from a spaceless string turned 'Chelsea FC' into
-- 'chelse'.
create or replace function ai.normalise_club_name(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select case
           when s = '' then ''
           when s like '% fc'            then btrim(left(s, length(s) - 3))
           when s like '% afc'           then btrim(left(s, length(s) - 4))
           when s like '% f c'           then btrim(left(s, length(s) - 4))
           when s like '% football club' then btrim(left(s, length(s) - 14))
           else s
         end
    from (
      select btrim(regexp_replace(
               regexp_replace(
                 replace(replace(replace(lower(translate(coalesce(p_name, ''),
                   'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÑñÇçÝýŠšŽž',
                   'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCcYySsZz')),
                   '&', 'and'), '.', ''), '''', ''),
                 '[^a-z0-9 ]+', ' ', 'g'),
               '\s+', ' ', 'g')) as s
    ) folded
$$;

comment on function ai.normalise_club_name(text) is
  'Shape-only comparison key for club names. NOT a mapping: it is the fallback
   used when no explicit alias exists, and it never guesses between two names
   that merely look similar.';

-- The alias data itself, in the table that has existed since contract 185 and
-- has never held a row. `source` distinguishes the vocabulary; `(source,
-- source_name)` is already unique, so re-running this is a no-op.
insert into ai.team_aliases (source, source_name, canonical, country) values
  ('the-odds-api', 'Nottingham Forest',            'Nott''m Forest',      'ENG'),
  ('the-odds-api', 'Manchester United',            'Man United',          'ENG'),
  ('the-odds-api', 'Manchester City',              'Man City',            'ENG'),
  ('the-odds-api', 'Wolverhampton Wanderers',      'Wolves',              'ENG'),
  ('the-odds-api', 'Sheffield Wednesday',          'Sheffield Weds',      'ENG'),
  ('the-odds-api', 'West Bromwich Albion',         'West Brom',           'ENG'),
  ('the-odds-api', 'West Ham United',              'West Ham',            'ENG'),
  ('the-odds-api', 'Queens Park Rangers',          'QPR',                 'ENG'),
  ('the-odds-api', 'Brighton and Hove Albion',     'Brighton',            'ENG'),
  ('the-odds-api', 'Brighton & Hove Albion',       'Brighton',            'ENG'),
  ('the-odds-api', 'AFC Bournemouth',              'Bournemouth',         'ENG'),
  ('the-odds-api', 'Newcastle United',             'Newcastle',           'ENG'),
  ('the-odds-api', 'Tottenham Hotspur',            'Tottenham',           'ENG'),
  ('the-odds-api', 'Leeds United',                 'Leeds',               'ENG'),
  ('the-odds-api', 'Leicester City',               'Leicester',           'ENG'),
  ('the-odds-api', 'Norwich City',                 'Norwich',             'ENG'),
  ('the-odds-api', 'Ipswich Town',                 'Ipswich',             'ENG'),
  ('the-odds-api', 'Hull City',                    'Hull',                'ENG'),
  ('the-odds-api', 'Coventry City',                'Coventry',            'ENG'),
  ('the-odds-api', 'Luton Town',                   'Luton',               'ENG'),
  ('the-odds-api', 'Stoke City',                   'Stoke',               'ENG'),
  ('the-odds-api', 'Swansea City',                 'Swansea',             'ENG'),
  ('the-odds-api', 'Cardiff City',                 'Cardiff',             'ENG'),
  ('the-odds-api', 'Birmingham City',              'Birmingham',          'ENG'),
  ('the-odds-api', 'Derby County',                 'Derby',               'ENG'),
  ('the-odds-api', 'Preston North End',            'Preston',             'ENG'),
  ('the-odds-api', 'Blackburn Rovers',             'Blackburn',           'ENG'),
  ('the-odds-api', 'Bristol City',                 'Bristol City',        'ENG'),
  ('the-odds-api', 'Milton Keynes Dons',           'Milton Keynes Dons',  'ENG'),
  ('the-odds-api', 'Peterborough United',          'Peterboro',           'ENG'),
  ('the-odds-api', 'Bolton Wanderers',             'Bolton',              'ENG'),
  ('the-odds-api', 'Charlton Athletic',            'Charlton',            'ENG'),
  ('the-odds-api', 'Crewe Alexandra',              'Crewe',               'ENG'),
  ('the-odds-api', 'Oxford United',                'Oxford',              'ENG'),
  ('the-odds-api', 'Wycombe Wanderers',            'Wycombe',             'ENG'),
  ('the-odds-api', 'Shrewsbury Town',              'Shrewsbury',          'ENG'),
  ('the-odds-api', 'Cheltenham Town',              'Cheltenham',          'ENG'),
  ('the-odds-api', 'Colchester United',            'Colchester',          'ENG'),
  ('the-odds-api', 'Newport County',               'Newport County',      'ENG'),
  ('the-odds-api', 'Notts County',                 'Notts County',        'ENG'),
  ('the-odds-api', 'Tranmere Rovers',              'Tranmere',            'ENG'),
  ('the-odds-api', 'Doncaster Rovers',             'Doncaster',           'ENG'),
  ('the-odds-api', 'Bradford City',                'Bradford',            'ENG'),
  ('the-odds-api', 'Grimsby Town',                 'Grimsby',             'ENG'),
  ('the-odds-api', 'Harrogate Town',               'Harrogate',           'ENG'),
  ('the-odds-api', 'Heart of Midlothian',          'Hearts',              'SCO'),
  ('the-odds-api', 'Hibernian',                    'Hibernian',           'SCO'),
  ('the-odds-api', 'St Mirren',                    'St Mirren',           'SCO'),
  ('the-odds-api', 'St. Mirren',                   'St Mirren',           'SCO'),
  ('the-odds-api', 'St Johnstone',                 'St Johnstone',        'SCO'),
  ('the-odds-api', 'St. Johnstone',                'St Johnstone',        'SCO'),
  ('the-odds-api', 'Dundee United',                'Dundee United',       'SCO'),
  ('the-odds-api', 'Ross County',                  'Ross County',         'SCO'),
  ('the-odds-api', 'Greenock Morton',              'Morton',              'SCO'),
  ('the-odds-api', 'Inverness Caledonian Thistle', 'Inverness C',         'SCO'),
  ('the-odds-api', 'Partick Thistle',              'Partick',             'SCO'),
  ('the-odds-api', 'Queen''s Park',                'Queens Park',         'SCO'),
  ('the-odds-api', 'Raith Rovers',                 'Raith Rvs',           'SCO'),
  ('the-odds-api', 'Airdrieonians',                'Airdrie Utd',         'SCO'),
  ('the-odds-api', 'Hamilton Academical',          'Hamilton',            'SCO'),
  ('the-odds-api', 'Alloa Athletic',               'Alloa',               'SCO'),
  ('the-odds-api', 'Cove Rangers',                 'Cove Rangers',        'SCO'),
  ('the-odds-api', 'Peterhead',                    'Peterhead',           'SCO'),
  ('the-odds-api', 'Elgin City',                   'Elgin',               'SCO'),
  ('the-odds-api', 'Forfar Athletic',              'Forfar',              'SCO'),
  ('the-odds-api', 'Stirling Albion',              'Stirling',            'SCO'),
  ('the-odds-api', 'Annan Athletic',               'Annan Athletic',      'SCO'),
  -- A second sweep, added after the 13 August 2026 Production audit measured
  -- what the first one missed: twenty-one lower-league spellings had no alias
  -- entry AND no shape match, because `normalise('Huddersfield Town')` is
  -- 'huddersfield town' while the history's key is 'huddersfield'. Each was
  -- scored as a club with no matches at all, exactly as Leicester was. Every
  -- canonical name here was read out of ai.raw_matches with its match count
  -- checked, not guessed.
  ('the-odds-api', 'Accrington Stanley', 'Accrington', 'ENG'),
  ('the-odds-api', 'Bristol Rovers', 'Bristol Rvs', 'ENG'),
  ('the-odds-api', 'Bromley FC', 'Bromley', 'ENG'),
  ('the-odds-api', 'Bromley', 'Bromley', 'ENG'),
  ('the-odds-api', 'Burton Albion', 'Burton', 'ENG'),
  ('the-odds-api', 'Cambridge United', 'Cambridge', 'ENG'),
  ('the-odds-api', 'Chesterfield FC', 'Chesterfield', 'ENG'),
  ('the-odds-api', 'Chesterfield', 'Chesterfield', 'ENG'),
  ('the-odds-api', 'Exeter City', 'Exeter', 'ENG'),
  ('the-odds-api', 'Huddersfield Town', 'Huddersfield', 'ENG'),
  ('the-odds-api', 'Lincoln City', 'Lincoln', 'ENG'),
  ('the-odds-api', 'Mansfield Town', 'Mansfield', 'ENG'),
  ('the-odds-api', 'Northampton Town', 'Northampton', 'ENG'),
  ('the-odds-api', 'Oldham Athletic', 'Oldham', 'ENG'),
  ('the-odds-api', 'Plymouth Argyle', 'Plymouth', 'ENG'),
  ('the-odds-api', 'Rotherham United', 'Rotherham', 'ENG'),
  ('the-odds-api', 'Salford City', 'Salford', 'ENG'),
  ('the-odds-api', 'Stockport County FC', 'Stockport', 'ENG'),
  ('the-odds-api', 'Stockport County', 'Stockport', 'ENG'),
  ('the-odds-api', 'Swindon Town', 'Swindon', 'ENG'),
  ('the-odds-api', 'Wigan Athletic', 'Wigan', 'ENG'),
  ('the-odds-api', 'Wimbledon', 'AFC Wimbledon', 'ENG'),
  ('the-odds-api', 'AFC Wimbledon', 'AFC Wimbledon', 'ENG'),
  ('the-odds-api', 'Wrexham AFC', 'Wrexham', 'ENG'),
  ('the-odds-api', 'Wrexham', 'Wrexham', 'ENG'),
  ('the-odds-api', 'York City', 'York', 'ENG'),
  ('the-odds-api', 'Dundee FC', 'Dundee', 'SCO'),
  ('the-odds-api', 'Falkirk F.C.', 'Falkirk', 'SCO')
on conflict (source, source_name) do update
  set canonical = excluded.canonical,
      country   = excluded.country;

-- The other two vocabularies, seeded from `ai/aliases.py`'s own tables so the
-- SQL authority answers for a club the Odds API happens to spell the same way
-- this platform does. Without these the authority could only resolve names it
-- had an explicit Odds API alias for, and would fall through to scanning the
-- history for everything else — correct, but a table scan per club.
insert into ai.team_aliases (source, source_name, canonical, country) values
  ('platform', 'AFC Bournemouth', 'Bournemouth', 'ENG'),
  ('football-data.co.uk', 'Bournemouth', 'Bournemouth', 'ENG'),
  ('canonical', 'Bournemouth', 'Bournemouth', 'ENG'),
  ('platform', 'Arsenal FC', 'Arsenal', 'ENG'),
  ('football-data.co.uk', 'Arsenal', 'Arsenal', 'ENG'),
  ('canonical', 'Arsenal', 'Arsenal', 'ENG'),
  ('platform', 'Aston Villa FC', 'Aston Villa', 'ENG'),
  ('football-data.co.uk', 'Aston Villa', 'Aston Villa', 'ENG'),
  ('canonical', 'Aston Villa', 'Aston Villa', 'ENG'),
  ('platform', 'Brentford FC', 'Brentford', 'ENG'),
  ('football-data.co.uk', 'Brentford', 'Brentford', 'ENG'),
  ('canonical', 'Brentford', 'Brentford', 'ENG'),
  ('platform', 'Brighton & Hove Albion FC', 'Brighton', 'ENG'),
  ('football-data.co.uk', 'Brighton', 'Brighton', 'ENG'),
  ('canonical', 'Brighton', 'Brighton', 'ENG'),
  ('platform', 'Chelsea FC', 'Chelsea', 'ENG'),
  ('football-data.co.uk', 'Chelsea', 'Chelsea', 'ENG'),
  ('canonical', 'Chelsea', 'Chelsea', 'ENG'),
  ('platform', 'Coventry City FC', 'Coventry', 'ENG'),
  ('football-data.co.uk', 'Coventry', 'Coventry', 'ENG'),
  ('canonical', 'Coventry', 'Coventry', 'ENG'),
  ('platform', 'Crystal Palace FC', 'Crystal Palace', 'ENG'),
  ('football-data.co.uk', 'Crystal Palace', 'Crystal Palace', 'ENG'),
  ('canonical', 'Crystal Palace', 'Crystal Palace', 'ENG'),
  ('platform', 'Everton FC', 'Everton', 'ENG'),
  ('football-data.co.uk', 'Everton', 'Everton', 'ENG'),
  ('canonical', 'Everton', 'Everton', 'ENG'),
  ('platform', 'Fulham FC', 'Fulham', 'ENG'),
  ('football-data.co.uk', 'Fulham', 'Fulham', 'ENG'),
  ('canonical', 'Fulham', 'Fulham', 'ENG'),
  ('platform', 'Hull City AFC', 'Hull', 'ENG'),
  ('football-data.co.uk', 'Hull', 'Hull', 'ENG'),
  ('canonical', 'Hull', 'Hull', 'ENG'),
  ('platform', 'Ipswich Town FC', 'Ipswich', 'ENG'),
  ('football-data.co.uk', 'Ipswich', 'Ipswich', 'ENG'),
  ('canonical', 'Ipswich', 'Ipswich', 'ENG'),
  ('platform', 'Leeds United FC', 'Leeds', 'ENG'),
  ('football-data.co.uk', 'Leeds', 'Leeds', 'ENG'),
  ('canonical', 'Leeds', 'Leeds', 'ENG'),
  ('platform', 'Liverpool FC', 'Liverpool', 'ENG'),
  ('football-data.co.uk', 'Liverpool', 'Liverpool', 'ENG'),
  ('canonical', 'Liverpool', 'Liverpool', 'ENG'),
  ('platform', 'Manchester City FC', 'Man City', 'ENG'),
  ('football-data.co.uk', 'Man City', 'Man City', 'ENG'),
  ('canonical', 'Man City', 'Man City', 'ENG'),
  ('platform', 'Manchester United FC', 'Man United', 'ENG'),
  ('football-data.co.uk', 'Man United', 'Man United', 'ENG'),
  ('canonical', 'Man United', 'Man United', 'ENG'),
  ('platform', 'Newcastle United FC', 'Newcastle', 'ENG'),
  ('football-data.co.uk', 'Newcastle', 'Newcastle', 'ENG'),
  ('canonical', 'Newcastle', 'Newcastle', 'ENG'),
  ('platform', 'Nottingham Forest FC', 'Nott''m Forest', 'ENG'),
  ('football-data.co.uk', 'Nott''m Forest', 'Nott''m Forest', 'ENG'),
  ('canonical', 'Nott''m Forest', 'Nott''m Forest', 'ENG'),
  ('platform', 'Sunderland AFC', 'Sunderland', 'ENG'),
  ('football-data.co.uk', 'Sunderland', 'Sunderland', 'ENG'),
  ('canonical', 'Sunderland', 'Sunderland', 'ENG'),
  ('platform', 'Tottenham Hotspur FC', 'Tottenham', 'ENG'),
  ('football-data.co.uk', 'Tottenham', 'Tottenham', 'ENG'),
  ('canonical', 'Tottenham', 'Tottenham', 'ENG'),
  ('platform', 'Aberdeen', 'Aberdeen', 'SCO'),
  ('football-data.co.uk', 'Aberdeen', 'Aberdeen', 'SCO'),
  ('canonical', 'Aberdeen', 'Aberdeen', 'SCO'),
  ('platform', 'Celtic', 'Celtic', 'SCO'),
  ('football-data.co.uk', 'Celtic', 'Celtic', 'SCO'),
  ('canonical', 'Celtic', 'Celtic', 'SCO'),
  ('platform', 'Dundee', 'Dundee', 'SCO'),
  ('football-data.co.uk', 'Dundee', 'Dundee', 'SCO'),
  ('canonical', 'Dundee', 'Dundee', 'SCO'),
  ('platform', 'Dundee United', 'Dundee United', 'SCO'),
  ('football-data.co.uk', 'Dundee United', 'Dundee United', 'SCO'),
  ('canonical', 'Dundee United', 'Dundee United', 'SCO'),
  ('platform', 'Falkirk', 'Falkirk', 'SCO'),
  ('football-data.co.uk', 'Falkirk', 'Falkirk', 'SCO'),
  ('canonical', 'Falkirk', 'Falkirk', 'SCO'),
  ('platform', 'Hearts', 'Hearts', 'SCO'),
  ('football-data.co.uk', 'Hearts', 'Hearts', 'SCO'),
  ('canonical', 'Hearts', 'Hearts', 'SCO'),
  ('platform', 'Hibernian', 'Hibernian', 'SCO'),
  ('football-data.co.uk', 'Hibernian', 'Hibernian', 'SCO'),
  ('canonical', 'Hibernian', 'Hibernian', 'SCO'),
  ('platform', 'Kilmarnock', 'Kilmarnock', 'SCO'),
  ('football-data.co.uk', 'Kilmarnock', 'Kilmarnock', 'SCO'),
  ('canonical', 'Kilmarnock', 'Kilmarnock', 'SCO'),
  ('platform', 'Motherwell', 'Motherwell', 'SCO'),
  ('football-data.co.uk', 'Motherwell', 'Motherwell', 'SCO'),
  ('canonical', 'Motherwell', 'Motherwell', 'SCO'),
  ('platform', 'Rangers', 'Rangers', 'SCO'),
  ('football-data.co.uk', 'Rangers', 'Rangers', 'SCO'),
  ('canonical', 'Rangers', 'Rangers', 'SCO'),
  ('platform', 'St. Johnstone', 'St Johnstone', 'SCO'),
  ('football-data.co.uk', 'St Johnstone', 'St Johnstone', 'SCO'),
  ('canonical', 'St Johnstone', 'St Johnstone', 'SCO'),
  ('platform', 'St. Mirren', 'St Mirren', 'SCO'),
  ('football-data.co.uk', 'St Mirren', 'St Mirren', 'SCO'),
  ('canonical', 'St Mirren', 'St Mirren', 'SCO'),
  ('football-data.co.uk', 'Sheffield United', 'Sheffield United', 'ENG'),
  ('canonical', 'Sheffield United', 'Sheffield United', 'ENG'),
  ('football-data.co.uk', 'Sheffield Weds', 'Sheffield Weds', 'ENG'),
  ('canonical', 'Sheffield Weds', 'Sheffield Weds', 'ENG'),
  ('football-data.co.uk', 'West Brom', 'West Brom', 'ENG'),
  ('canonical', 'West Brom', 'West Brom', 'ENG'),
  ('football-data.co.uk', 'West Ham', 'West Ham', 'ENG'),
  ('canonical', 'West Ham', 'West Ham', 'ENG'),
  ('football-data.co.uk', 'Wolves', 'Wolves', 'ENG'),
  ('canonical', 'Wolves', 'Wolves', 'ENG'),
  ('football-data.co.uk', 'QPR', 'QPR', 'ENG'),
  ('canonical', 'QPR', 'QPR', 'ENG'),
  ('football-data.co.uk', 'Luton', 'Luton', 'ENG'),
  ('canonical', 'Luton', 'Luton', 'ENG'),
  ('football-data.co.uk', 'Burnley', 'Burnley', 'ENG'),
  ('canonical', 'Burnley', 'Burnley', 'ENG'),
  ('football-data.co.uk', 'Southampton', 'Southampton', 'ENG'),
  ('canonical', 'Southampton', 'Southampton', 'ENG'),
  ('football-data.co.uk', 'Leicester', 'Leicester', 'ENG'),
  ('canonical', 'Leicester', 'Leicester', 'ENG'),
  ('football-data.co.uk', 'Watford', 'Watford', 'ENG'),
  ('canonical', 'Watford', 'Watford', 'ENG'),
  ('football-data.co.uk', 'Norwich', 'Norwich', 'ENG'),
  ('canonical', 'Norwich', 'Norwich', 'ENG'),
  ('football-data.co.uk', 'Ross County', 'Ross County', 'SCO'),
  ('canonical', 'Ross County', 'Ross County', 'SCO'),
  ('football-data.co.uk', 'Livingston', 'Livingston', 'SCO'),
  ('canonical', 'Livingston', 'Livingston', 'SCO'),
  ('football-data.co.uk', 'Hamilton', 'Hamilton', 'SCO'),
  ('canonical', 'Hamilton', 'Hamilton', 'SCO'),
  ('football-data.co.uk', 'Partick Thistle', 'Partick Thistle', 'SCO'),
  ('canonical', 'Partick Thistle', 'Partick Thistle', 'SCO')
on conflict (source, source_name) do update
  set canonical = excluded.canonical,
      country   = excluded.country;

-- The history is the last-resort fallback: a club this lab has matches for but
-- no alias row about. Indexed on the normalised key so that fallback is a
-- lookup rather than a scan of 46,000 rows per club per event.
create index if not exists raw_matches_home_normalised_idx
  on ai.raw_matches (ai.normalise_club_name(home_canonical));
create index if not exists raw_matches_away_normalised_idx
  on ai.raw_matches (ai.normalise_club_name(away_canonical));

create index if not exists team_aliases_normalised_source_idx
  on ai.team_aliases (ai.normalise_club_name(source_name));
create index if not exists team_aliases_normalised_canonical_idx
  on ai.team_aliases (ai.normalise_club_name(canonical));

-- Three tiers, and the third is deliberately absent: there is no edit-distance
-- fallback. 'Bristol City' and 'Bristol Rovers' are two characters apart and
-- are different clubs in different divisions, and a near-miss matcher would
-- eventually attach a price to the wrong match — which is the defect this
-- whole section exists to remove, not a cheaper version of it.
create or replace function ai.canonical_from_odds_api(p_name text)
returns table (canonical text, matched_by text)
language plpgsql
stable
set search_path to ''
as $$
declare
  v_key text := ai.normalise_club_name(p_name);
  v_hit text;
begin
  if coalesce(btrim(p_name), '') = '' then
    return query select null::text, 'unmatched'::text;
    return;
  end if;

  select a.canonical into v_hit
    from ai.team_aliases a
   where a.source = 'the-odds-api'
     and a.source_name = p_name
   limit 1;
  if v_hit is not null then
    return query select v_hit, 'alias'::text;
    return;
  end if;

  select c into v_hit from (
    select a.canonical as c, 0 as rank
      from ai.team_aliases a
     where ai.normalise_club_name(a.source_name) = v_key
    union all
    select a.canonical, 1
      from ai.team_aliases a
     where ai.normalise_club_name(a.canonical) = v_key
    union all
    select r.home_canonical, 2
      from ai.raw_matches r
     where ai.normalise_club_name(r.home_canonical) = v_key
    union all
    select r.away_canonical, 2
      from ai.raw_matches r
     where ai.normalise_club_name(r.away_canonical) = v_key
    order by rank, c
    limit 1
  ) ranked;
  if v_hit is not null then
    return query select v_hit, 'alias'::text;
    return;
  end if;

  return query select null::text, 'unmatched'::text;
end;
$$;

comment on function ai.canonical_from_odds_api(text) is
  'The single authority for what an Odds API team name means. Explicit alias,
   then normalised shape against the alias table and the retained history,
   then a refusal. Never a guess.';

-- The sport-key map, in one place, because it was about to exist in three:
-- the Edge Function, `reconcile_paid_fixture_evidence.py` and the repair below.
create or replace function ai.odds_api_sport_map()
returns table (sport_key text, division text, league_key text)
language sql immutable set search_path to '' as $$
  values ('soccer_epl',             'E0',  'EPL'),
         ('soccer_efl_champ',       'E1',  'ECH'),
         ('soccer_england_league1', 'E2',  'EL1'),
         ('soccer_england_league2', 'E3',  'EL2'),
         ('soccer_spl',             'SC0', 'SPL')
$$;

-- ===========================================================================
-- 8. The repair, and its ledger.
--
--    An alias table that is only consulted on the way IN leaves every row
--    already retained under the wrong identity wrong for ever — which is
--    exactly the state Production was in: `ai/aliases.py` had mapped
--    `Leicester City -> Leicester` since contract 185 and fifty-two retained
--    events still said `Leicester City`, because the only writer's
--    `on conflict (event_id) do update` touched `fixture_id` and `matched_by`
--    and nothing else.
--
--    This repair makes NO provider request. Everything it needs is already in
--    `ai.odds_api_events.home_team` / `away_team`, which are the raw provider
--    strings and have always been correct.
-- ===========================================================================

create table if not exists ai.provider_identity_repairs (
  id               uuid primary key default gen_random_uuid(),
  repaired_at      timestamptz not null default now(),
  event_id         text not null,
  raw_home         text not null,
  raw_away         text not null,
  old_home_canonical text null,
  old_away_canonical text null,
  new_home_canonical text null,
  new_away_canonical text null,
  old_fixture_id   uuid null,
  new_fixture_id   uuid null,
  market_prices_repointed integer not null default 0,
  fixture_odds_rebuilt    integer not null default 0,
  detail           jsonb not null default '{}'::jsonb
);

create index if not exists provider_identity_repairs_at_idx
  on ai.provider_identity_repairs (repaired_at desc);

comment on table ai.provider_identity_repairs is
  'Append-only evidence of every identity correction. A repair that leaves no
   record is indistinguishable from the data never having been wrong, and the
   whole reason this contract exists is that a wrong identity was invisible.';

create or replace function ai.reject_identity_repair_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ai.provider_identity_repairs is append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists provider_identity_repairs_no_mutation
  on ai.provider_identity_repairs;
create trigger provider_identity_repairs_no_mutation
  before update or delete on ai.provider_identity_repairs
  for each row execute function ai.reject_identity_repair_mutation();

create or replace function ai.repair_provider_identity(
  p_horizon interval default interval '400 days')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_events      integer := 0;
  v_fixtures    integer := 0;
  v_relinked    integer := 0;
  v_prices      integer := 0;
  v_odds        integer := 0;
  v_voided      integer := 0;
  v_unmatched   integer := 0;
  r             record;
  v_new_fixture uuid;
  v_old_fixture uuid;
  v_h           text;
  v_a           text;
  v_hp          integer;
  v_op          integer;
begin
  for r in
    select e.event_id, e.sport_key, e.commence_time, e.home_team, e.away_team,
           e.home_canonical as old_home, e.away_canonical as old_away,
           e.fixture_id as old_fixture,
           m.division, m.league_key
      from ai.odds_api_events e
      left join ai.odds_api_sport_map() m on m.sport_key = e.sport_key
     where e.commence_time > now() - p_horizon
     order by e.commence_time
  loop
    select c.canonical into v_h from ai.canonical_from_odds_api(r.home_team) c;
    select c.canonical into v_a from ai.canonical_from_odds_api(r.away_team) c;

    if v_h is null or v_a is null then
      v_unmatched := v_unmatched + 1;
      continue;
    end if;
    if v_h is not distinct from r.old_home and v_a is not distinct from r.old_away then
      continue;                       -- already correct; the common case
    end if;

    v_events := v_events + 1;
    v_old_fixture := r.old_fixture;
    v_new_fixture := null;

    -- The corrected fixture. Created rather than looked up only when the
    -- division is known, because a fixture without a division cannot be joined
    -- to any history and would be a second kind of broken row.
    if r.division is not null then
      insert into ai.fixtures
        (division, season, league_key, match_date, kickoff_at,
         home_canonical, away_canonical, status)
      select r.division,
             lpad((case when extract(month from d)::int >= 7
                        then extract(year from d)::int
                        else extract(year from d)::int - 1 end % 100)::text, 2, '0') ||
             lpad(((case when extract(month from d)::int >= 7
                         then extract(year from d)::int
                         else extract(year from d)::int - 1 end + 1) % 100)::text, 2, '0'),
             r.league_key, d, r.commence_time, v_h, v_a, 'scheduled'
        from (select (r.commence_time at time zone 'Europe/London')::date as d) dd
      on conflict (division, match_date, home_canonical, away_canonical)
      do update set kickoff_at = excluded.kickoff_at,
                    league_key = excluded.league_key,
                    updated_at = now()
      returning id into v_new_fixture;
      if v_new_fixture is not null then
        v_fixtures := v_fixtures + 1;
      end if;
    end if;

    update ai.odds_api_events e
       set home_canonical = v_h,
           away_canonical = v_a,
           fixture_id = coalesce(v_new_fixture, e.fixture_id),
           -- A corrected identity RELINKS. `coalesce(old, new)` was the bug:
           -- it pinned the event to whatever wrong fixture it first resolved
           -- to and made the correction unobservable downstream.
           matched_by = case when v_new_fixture is null then 'unmatched' else 'alias' end
     where e.event_id = r.event_id;
    if v_new_fixture is not null and v_new_fixture is distinct from v_old_fixture then
      v_relinked := v_relinked + 1;
    end if;

    -- Evidence follows identity. `ai.market_prices` is the retained provider
    -- observation and is REPOINTED, never rewritten.
    if v_new_fixture is not null and v_old_fixture is not null
       and v_new_fixture is distinct from v_old_fixture then
      update ai.market_prices mp
         set fixture_id = v_new_fixture
       where mp.fixture_id = v_old_fixture
         and mp.source = 'the-odds-api'
         and exists (select 1 from ai.odds_api_events x
                      where x.event_id = r.event_id);
      get diagnostics v_hp = row_count;
      v_prices := v_prices + v_hp;

      -- `ai.fixture_odds` is a DERIVED projection of `ai.market_prices` — the
      -- bridge in `reconcile_paid_fixture_evidence.py` rebuilds it from
      -- scratch — so rows carrying the wrong club names are deleted rather
      -- than repointed. Deleting derived rows destroys no evidence; leaving
      -- them would keep a wrong club name in the table the value engine reads.
      delete from ai.fixture_odds fo
       where fo.fixture_id = v_old_fixture
         and (fo.home_canonical is distinct from v_h
              or fo.away_canonical is distinct from v_a);
      get diagnostics v_op = row_count;
      v_odds := v_odds + v_op;

      -- The stale fixture is voided rather than deleted: predictions,
      -- recommendations and bets reference it, and `status = 'scheduled'` is
      -- already the filter every value path applies, so voiding removes it
      -- from all of them without breaking a foreign key or losing the audit.
      update ai.fixtures f
         set status = 'void', updated_at = now()
       where f.id = v_old_fixture
         and f.status = 'scheduled'
         and not exists (select 1 from ai.odds_api_events x
                          where x.fixture_id = f.id);
      get diagnostics v_op = row_count;
      v_voided := v_voided + v_op;
    end if;

    insert into ai.provider_identity_repairs
      (event_id, raw_home, raw_away, old_home_canonical, old_away_canonical,
       new_home_canonical, new_away_canonical, old_fixture_id, new_fixture_id,
       market_prices_repointed, fixture_odds_rebuilt, detail)
    values (r.event_id, r.home_team, r.away_team, r.old_home, r.old_away,
            v_h, v_a, v_old_fixture, v_new_fixture, v_hp, v_op,
            jsonb_build_object('sport_key', r.sport_key,
                               'division', r.division,
                               'commence_time', r.commence_time));
  end loop;

  return jsonb_build_object(
    'events_corrected', v_events,
    'fixtures_upserted', v_fixtures,
    'events_relinked', v_relinked,
    'market_prices_repointed', v_prices,
    'fixture_odds_deleted', v_odds,
    'stale_fixtures_voided', v_voided,
    'events_still_unmatched', v_unmatched,
    'provider_requests_made', 0,
    'repaired_at', now());
end;
$$;

revoke all on function ai.repair_provider_identity(interval)
  from public, anon, authenticated;
grant execute on function ai.repair_provider_identity(interval) to service_role;

-- ===========================================================================
-- 9. Quarantine: preserve the bad evidence as INVALID, never as model evidence.
--
--    Deleting Production's first fifty-one forecasts would destroy the only
--    record of what a broken identity does to a forecast, and rewriting their
--    probabilities would make `ai.predictions` an editable table, which is
--    the one thing it must never be. So validity becomes a SEPARATE, additive
--    authority and every evidence path reads through it.
-- ===========================================================================

create table if not exists ai.prediction_invalidations (
  id             uuid primary key default gen_random_uuid(),
  prediction_id  uuid not null references ai.predictions(id) on delete cascade,
  invalidated_at timestamptz not null default now(),
  reason_code    text not null check (reason_code in (
                   'INVALID_TEAM_IDENTITY',
                   'HISTORY_ALIAS_MISMATCH',
                   'IDENTITY_REPAIR_SUPERSEDED',
                   'FEATURE_PIPELINE_DEFECT',
                   'MODEL_DEFECT',
                   'OPERATOR_QUARANTINE')),
  evidence       jsonb not null default '{}'::jsonb,
  note           text null,
  unique (prediction_id, reason_code)
);

create index if not exists prediction_invalidations_at_idx
  on ai.prediction_invalidations (invalidated_at desc);

create or replace function ai.reject_invalidation_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ai.prediction_invalidations is append-only'
    using errcode = '42501';
end;
$$;

drop trigger if exists prediction_invalidations_no_mutation
  on ai.prediction_invalidations;
create trigger prediction_invalidations_no_mutation
  before update or delete on ai.prediction_invalidations
  for each row execute function ai.reject_invalidation_mutation();

comment on table ai.prediction_invalidations is
  'Which forecasts must never be counted as evidence, and why. The prediction
   itself is never edited or deleted: a pipeline that was wrong is a scientific
   record, and losing it is how the same defect gets rediscovered.';

-- The one object every evidence path is supposed to read. A view rather than a
-- column, because a column on an append-only table would have to be written
-- after the fact, and that is the mutation the trigger above forbids.
create or replace view ai.valid_predictions as
  select p.*
    from ai.predictions p
   where not exists (select 1 from ai.prediction_invalidations i
                      where i.prediction_id = p.id);

comment on view ai.valid_predictions is
  'ai.predictions minus everything quarantined. Calibration, accuracy, CLV,
   promotion evidence, recommendations, accumulator legs and any publication
   threshold read THIS, never the base table.';

-- Quarantine by measurement rather than by hand. It takes the identity defect
-- as its input — a prediction whose club has zero matched history while that
-- club's canonical name IS present in the retained history under another
-- alias — so nobody has to enumerate Leicester.
create or replace function ai.quarantine_identity_defective_predictions(
  p_reason text default 'INVALID_TEAM_IDENTITY',
  p_dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_rows jsonb;
  v_n    integer := 0;
begin
  create temporary table if not exists _quarantine_candidates
    (id uuid, league text, home_canonical text, away_canonical text,
     home_known numeric, away_known numeric,
     home_resolves_to text, away_resolves_to text)
    on commit drop;
  delete from _quarantine_candidates;

  insert into _quarantine_candidates
  select p.id,
         p.league,
         p.home_canonical,
         p.away_canonical,
         (p.features ->> 'home_matches_known')::numeric,
         (p.features ->> 'away_matches_known')::numeric,
         (select c.canonical from ai.canonical_from_odds_api(p.home_canonical) c),
         (select c.canonical from ai.canonical_from_odds_api(p.away_canonical) c)
    from ai.predictions p
   where not exists (select 1 from ai.prediction_invalidations i
                      where i.prediction_id = p.id);

  delete from _quarantine_candidates c
   where not (
     -- A club with no history in the feature row, whose name nonetheless
     -- resolves to a DIFFERENT canonical name that the history does hold.
     (coalesce(c.home_known, 0) = 0
      and c.home_resolves_to is not null
      and c.home_resolves_to is distinct from c.home_canonical
      and exists (select 1 from ai.raw_matches r
                   where r.home_canonical = c.home_resolves_to
                      or r.away_canonical = c.home_resolves_to))
     or
     (coalesce(c.away_known, 0) = 0
      and c.away_resolves_to is not null
      and c.away_resolves_to is distinct from c.away_canonical
      and exists (select 1 from ai.raw_matches r
                   where r.home_canonical = c.away_resolves_to
                      or r.away_canonical = c.away_resolves_to)));

  select count(*) into v_n from _quarantine_candidates;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.league, c.home_canonical), '[]'::jsonb)
    into v_rows from _quarantine_candidates c;

  if not p_dry_run and v_n > 0 then
    insert into ai.prediction_invalidations (prediction_id, reason_code, evidence, note)
    select c.id, p_reason,
           jsonb_build_object(
             'home_canonical', c.home_canonical,
             'away_canonical', c.away_canonical,
             'home_matches_known', c.home_known,
             'away_matches_known', c.away_known,
             'home_resolves_to', c.home_resolves_to,
             'away_resolves_to', c.away_resolves_to),
           'Quarantined by ai.quarantine_identity_defective_predictions: the '
           'club was scored as a newcomer while its history exists under the '
           'canonical name the provider spelling resolves to.'
      from _quarantine_candidates c
    on conflict (prediction_id, reason_code) do nothing;
  end if;

  return jsonb_build_object(
    'reason_code', p_reason,
    'dry_run', p_dry_run,
    'matched', v_n,
    'predictions', v_rows,
    'evaluated_at', now());
end;
$$;

revoke all on function ai.quarantine_identity_defective_predictions(text, boolean)
  from public, anon, authenticated;
grant execute on function ai.quarantine_identity_defective_predictions(text, boolean)
  to service_role;

-- ===========================================================================
-- 10. The provider quota, read from the provider rather than from a guess.
--
--     `ai.api_budget` was installed at 500 monthly credits with a 450 soft cap
--     and a note about reserving fifty free-tier credits. Production's own
--     retained response headers say used 20, remaining 19,980 — a 20,000
--     credit period. A cap set an order of magnitude below the real allowance
--     is not conservative, it is wrong, and it silently refuses collection the
--     budget was supposed to permit.
--
--     The correction is deliberately NOT a new hard-coded number. The provider
--     reports `used` and `remaining` on every successful call; their sum is the
--     allowance, measured. This reads the retained headers and reconciles.
-- ===========================================================================

alter table ai.api_budget
  add column if not exists observed_period_credits integer null,
  add column if not exists observed_used integer null,
  add column if not exists observed_remaining integer null,
  add column if not exists observed_at timestamptz null,
  -- A reserve expressed as a FRACTION survives a plan change; 450/500 did not.
  add column if not exists soft_cap_fraction numeric(4,3) not null default 0.900;

comment on column ai.api_budget.soft_cap_fraction is
  'The share of the measured allowance collection may spend. Stated as a
   fraction so that a subscription change moves the cap automatically; a
   hard-coded 450 is what made the 500-credit assumption survive a 20,000
   credit plan.';

create or replace function ai.reconcile_api_budget(
  p_provider text default 'the-odds-api',
  p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_used      integer;
  v_remaining integer;
  v_at        timestamptz;
  v_observed  integer;
  v_budget    record;
  v_new_cap   integer;
begin
  select u.reported_used, u.reported_remaining, u.called_at
    into v_used, v_remaining, v_at
    from ai.api_usage u
   where u.provider = p_provider
     and u.reported_used is not null
     and u.reported_remaining is not null
   order by u.called_at desc
   limit 1;

  select * into v_budget from ai.api_budget b where b.provider = p_provider;
  if v_budget is null then
    return jsonb_build_object('provider', p_provider, 'status', 'no budget row');
  end if;
  if v_used is null then
    return jsonb_build_object(
      'provider', p_provider, 'status', 'no provider-reported usage retained',
      'configured_credits', v_budget.monthly_credits,
      'configured_soft_cap', v_budget.soft_cap,
      'provider_requests_made', 0);
  end if;

  v_observed := v_used + v_remaining;
  v_new_cap  := greatest(1, floor(v_observed * v_budget.soft_cap_fraction)::int);

  if p_apply then
    update ai.api_budget b
       set monthly_credits = v_observed,
           soft_cap = v_new_cap,
           observed_period_credits = v_observed,
           observed_used = v_used,
           observed_remaining = v_remaining,
           observed_at = v_at,
           reserve_note = format(
             'Allowance measured from provider headers on %s: used %s + '
             'remaining %s = %s. Soft cap is %s%% of it. No provider request '
             'was made to learn this.',
             to_char(v_at, 'YYYY-MM-DD'), v_used, v_remaining, v_observed,
             round(b.soft_cap_fraction * 100)),
           updated_at = now()
     where b.provider = p_provider;
  else
    update ai.api_budget b
       set observed_period_credits = v_observed,
           observed_used = v_used,
           observed_remaining = v_remaining,
           observed_at = v_at
     where b.provider = p_provider;
  end if;

  return jsonb_build_object(
    'provider', p_provider,
    'applied', p_apply,
    'observed_at', v_at,
    'provider_reported_used', v_used,
    'provider_reported_remaining', v_remaining,
    'observed_period_credits', v_observed,
    'configured_credits_before', v_budget.monthly_credits,
    'configured_soft_cap_before', v_budget.soft_cap,
    'soft_cap_fraction', v_budget.soft_cap_fraction,
    'proposed_soft_cap', v_new_cap,
    -- The single most useful field: it says whether anyone should look.
    'disagrees', v_observed is distinct from v_budget.monthly_credits,
    'provider_requests_made', 0);
end;
$$;

revoke all on function ai.reconcile_api_budget(text, boolean)
  from public, anon, authenticated;
grant execute on function ai.reconcile_api_budget(text, boolean) to service_role;

commit;

begin;

-- ===========================================================================
-- 11. The private Bet Builder's bounded reads.
--
--     The browser must not query schema `ai`, must not see a raw provider
--     payload, and must never be able to turn a server-side PASS into a BET.
--     So the read returns LEGS THAT ALREADY PASSED THE GATE — rows of
--     `ai.recommendations` with `decision = 'BET'` — and never a prediction the
--     gate has not judged. Combination search downstream is arithmetic over
--     those legs; it is not a second gate and it cannot admit anything the
--     gate refused.
--
--     One bookmaker, deliberately. `MAX` is the best price on each selection
--     across the sampled books and those prices may sit at different books;
--     multiplying them produces a return that is not available anywhere. The
--     gate is therefore run per REAL bookmaker and this read is keyed on one.
-- ===========================================================================

-- The freshness policy, in SQL, matching `value_engine.FreshnessPolicy` field
-- for field. It lives in both languages because both need it; `test_models.py`
-- asserts the two agree at every boundary, so a change to one that is not made
-- to the other fails a test rather than quietly disagreeing.
create or replace function ai.price_age_limit_seconds(
  p_hours_to_kickoff double precision,
  p_is_aggregate boolean default false)
returns integer
language sql immutable set search_path to '' as $$
  select (case
            when p_hours_to_kickoff <= 2.0 then 1200      -- 20 min
            when p_hours_to_kickoff <= 8.0 then 3600      -- 1 hour
            else 43200                                    -- 12 hours
          end * case when p_is_aggregate then 0.5 else 1.0 end)::int
$$;

create or replace function public.admin_ai_bet_builder_books()
returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_rows jsonb;
begin
  perform predictor_internal.require_competition_admin();
  select coalesce(jsonb_agg(to_jsonb(b) order by b.legs desc, b.code), '[]'::jsonb)
    into v_rows
    from (
      select bk.code, bk.name, bk.kind, bk.is_real_price, bk.exchange_commission,
             count(*) filter (where r.decision = 'BET') as legs,
             max(r.decided_at) as last_decided_at
        from ai.bookmakers bk
        left join ai.recommendations r
               on r.bookmaker = bk.code
              and r.kickoff_at > now()
              and not exists (select 1 from ai.prediction_invalidations i
                               where i.prediction_id = r.prediction_id)
       group by bk.code, bk.name, bk.kind, bk.is_real_price, bk.exchange_commission
    ) b;
  return jsonb_build_object(
    'bookmakers', v_rows,
    -- Stated rather than assumed by the caller: an aggregate cannot be the
    -- source of an actionable combined return, and an exchange charges
    -- commission on winnings, so a gross exchange price is not the net return.
    'actionable_rule', 'An accumulator may only be presented as actionable '
                       'when every leg is priced at one bookmaker whose '
                       'is_real_price is true. Aggregates (AVG, MAX) are a '
                       'research ceiling only. Exchange prices are gross of '
                       'commission.',
    'generated_at', now());
end;
$$;

revoke all on function public.admin_ai_bet_builder_books() from public, anon;
grant execute on function public.admin_ai_bet_builder_books() to authenticated;

create or replace function public.admin_ai_bet_builder_candidates(
  p_bookmaker text,
  p_leagues   text[] default null,
  p_from      timestamptz default null,
  p_to        timestamptz default null,
  p_limit     integer default 200)
returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare
  v_rows      jsonb;
  v_book      record;
  v_limit     integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_from      timestamptz := coalesce(p_from, now());
  v_to        timestamptz := coalesce(p_to, now() + interval '7 days');
begin
  perform predictor_internal.require_competition_admin();

  select * into v_book from ai.bookmakers b where b.code = p_bookmaker;
  if v_book is null then
    raise exception 'Unknown bookmaker %', p_bookmaker using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.kickoff_at, c.fixture_id), '[]'::jsonb)
    into v_rows
    from (
      select distinct on (r.prediction_id)
             r.id                        as recommendation_id,
             r.league,
             r.market,
             r.selection,
             r.bookmaker,
             r.odds_offered              as odds,
             r.calibrated_prob,
             r.fair_odds,
             r.expected_value            as model_edge,
             r.data_confidence,
             r.data_confidence_state,
             r.agreement_score,
             r.uncertainty_width,
             r.odds_captured_at,
             extract(epoch from (now() - r.odds_captured_at))::int as price_age_seconds,
             ai.price_age_limit_seconds(
               extract(epoch from (r.kickoff_at - now())) / 3600.0,
               not v_book.is_real_price)                           as price_age_limit_seconds,
             r.kickoff_at,
             p.fixture_id::text          as fixture_id,
             p.home_canonical,
             p.away_canonical,
             p.horizon,
             p.uses_market
        from ai.recommendations r
        join ai.valid_predictions p on p.id = r.prediction_id
        join ai.fixtures f on f.id = p.fixture_id
       where r.decision = 'BET'
         and r.bookmaker = p_bookmaker
         and f.status = 'scheduled'
         and r.kickoff_at between v_from and v_to
         and (p_leagues is null or r.league = any(p_leagues))
       order by r.prediction_id, r.decided_at desc
       limit v_limit) c;

  return jsonb_build_object(
    'bookmaker', jsonb_build_object(
      'code', v_book.code, 'name', v_book.name, 'kind', v_book.kind,
      'is_real_price', v_book.is_real_price,
      'exchange_commission', v_book.exchange_commission),
    'window', jsonb_build_object('from', v_from, 'to', v_to),
    'leagues', to_jsonb(p_leagues),
    'legs', v_rows,
    'leg_count', jsonb_array_length(v_rows),
    'truncated_at', v_limit,
    -- Every leg here has already passed the server-side value gate. This
    -- sentence is the contract with the presentation layer: it may filter and
    -- combine what it is given, and it may never add to it.
    'source', 'ai.recommendations where decision = BET, at this bookmaker, '
              'excluding quarantined predictions and voided fixtures',
    'generated_at', now());
end;
$$;

revoke all on function public.admin_ai_bet_builder_candidates(
  text, text[], timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.admin_ai_bet_builder_candidates(
  text, text[], timestamptz, timestamptz, integer) to authenticated;

-- ===========================================================================
-- 12. The sanity audit that has to run after every regeneration.
--
--     A cluster of 99.659% forecasts with a 6-0 scoreline is a pipeline smell,
--     not a set of bold opinions, and nothing in the lab could have said so.
--     These are review flags rather than automatic defects: a genuine 95%
--     forecast exists and must not be suppressed.
-- ===========================================================================
create or replace function public.admin_ai_prediction_audit(
  p_league text default null,
  p_hours  integer default 24)
returns jsonb
language plpgsql stable security definer set search_path to '' as $$
declare v_flags jsonb; v_counts jsonb; v_since timestamptz;
begin
  perform predictor_internal.require_competition_admin();
  v_since := now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 8760));

  with scored as (
    select p.id, p.league, p.home_canonical, p.away_canonical, p.kickoff_at,
           p.created_at,
           greatest(p.p_home, p.p_draw, p.p_away) as top_probability,
           p.exp_home_goals, p.exp_away_goals,
           (p.features ->> 'home_matches_known')::numeric as home_known,
           (p.features ->> 'away_matches_known')::numeric as away_known,
           (p.features ->> 'home_is_newcomer')::numeric   as home_new,
           (p.features ->> 'away_is_newcomer')::numeric   as away_new,
           (p.data_confidence ->> 'score')::numeric       as data_confidence,
           p.mkt_home_at_prediction, p.mkt_draw_at_prediction, p.mkt_away_at_prediction,
           greatest(
             abs(p.p_home - coalesce(p.mkt_home_at_prediction, p.p_home)),
             abs(p.p_draw - coalesce(p.mkt_draw_at_prediction, p.p_draw)),
             abs(p.p_away - coalesce(p.mkt_away_at_prediction, p.p_away))) as market_gap
      from ai.valid_predictions p
     where p.created_at >= v_since
       and (p_league is null or p.league = p_league)
  ), flagged as (
    select s.*,
           array_remove(array[
             case when s.top_probability > 0.95 then 'PROBABILITY_OVER_95' end,
             case when s.top_probability > 0.90 and s.top_probability <= 0.95
                  then 'PROBABILITY_OVER_90' end,
             case when s.exp_home_goals >= 6.0 or s.exp_away_goals >= 6.0
                  then 'EXPECTED_GOALS_UPPER_CLAMP' end,
             case when s.exp_home_goals <= 0.05 or s.exp_away_goals <= 0.05
                  then 'EXPECTED_GOALS_LOWER_CLAMP' end,
             case when coalesce(s.home_known, 0) = 0 or coalesce(s.away_known, 0) = 0
                  then 'ZERO_HISTORY_CLUB' end,
             case when coalesce(s.home_new, 0) = 1 and coalesce(s.away_new, 0) = 1
                  then 'TWO_NEWCOMERS' end,
             case when s.market_gap > 0.15 then 'MODEL_MINUS_MARKET_OVER_15PP' end,
             case when coalesce(s.data_confidence, 0) < 0.55 and s.top_probability > 0.80
                  then 'EXTREME_PROBABILITY_ON_LOW_DATA' end
           ], null) as flags
      from scored s
  )
  select coalesce(jsonb_agg(to_jsonb(f) order by f.top_probability desc), '[]'::jsonb),
         coalesce((select jsonb_object_agg(code, n)
                     from (select unnest(f2.flags) as code, count(*) as n
                             from flagged f2 group by 1) x), '{}'::jsonb)
    into v_flags, v_counts
    from flagged f
   where cardinality(f.flags) > 0;

  return jsonb_build_object(
    'since', v_since,
    'league', p_league,
    'flagged', v_flags,
    'flag_counts', v_counts,
    'note', 'These are mandatory review flags, not defects. A genuine 95% '
            'forecast may exist; a CLUSTER of them, or any of them beside a '
            'zero-history club, is a pipeline smell.',
    'generated_at', now());
end;
$$;

revoke all on function public.admin_ai_prediction_audit(text, integer) from public, anon;
grant execute on function public.admin_ai_prediction_audit(text, integer) to authenticated;

-- Access, restated after every object above, matching contract 185's posture.
alter table ai.prediction_invalidations   enable row level security;
alter table ai.provider_identity_repairs  enable row level security;

revoke all on all tables in schema ai from anon, authenticated;
grant all on all tables in schema ai to service_role;

commit;

begin;

-- ===========================================================================
-- 13. The consumer stops trusting the decoder's opinion about club identity.
--
--     `record_ai_odds_snapshot` took `home_canonical` / `away_canonical`
--     straight out of the normalised payload, so the authority was whichever
--     alias table the Edge Function happened to carry. It is redefined here
--     from its contract 185 text with exactly three changes, and nothing else
--     moves:
--
--       1. identity is re-derived through `ai.canonical_from_odds_api`, and
--          the caller's `home_canonical` / `away_canonical` are retained only
--          as evidence of what the decoder thought;
--       2. `on conflict (event_id)` now refreshes identity and RE-RESOLVES the
--          fixture rather than pinning it with `coalesce(old, new)`;
--       3. the returned report names the events whose identity changed, so an
--          alias correction is observable instead of silent.
-- ===========================================================================
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
  v_recanonicalised integer := 0;
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

  -- The incoming set is derived twice as a CTE rather than once into a
  -- temporary table. `114_predictor_cup_lint_safe_qualification.sql` refuses
  -- ANY `public` or `predictor_internal` function that retains a
  -- temporary-table dependency, and this is a `security definer` writer with
  -- `search_path = ''` — precisely the shape that rule exists to protect. The
  -- payload is one poll of five leagues, so deriving it twice costs nothing
  -- measurable, and it is a pure function of the parameter, so the two
  -- derivations cannot disagree.
  select count(*) into v_recanonicalised
    from (
      select distinct on (x.event_id)
             x.home_canonical as decoder_home,
             x.away_canonical as decoder_away,
             (select c.canonical from ai.canonical_from_odds_api(x.home_team) c) as home_canonical,
             (select c.canonical from ai.canonical_from_odds_api(x.away_team) c) as away_canonical
        from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb)) as x(
          event_id text, home_team text, away_team text,
          home_canonical text, away_canonical text
        )
    ) e
   where e.home_canonical is distinct from e.decoder_home
      or e.away_canonical is distinct from e.decoder_away;

  with incoming as (
    select distinct on (x.event_id)
           x.event_id, x.sport_key, x.commence_time, x.home_team, x.away_team,
           (select c.canonical from ai.canonical_from_odds_api(x.home_team) c) as home_canonical,
           (select c.canonical from ai.canonical_from_odds_api(x.away_team) c) as away_canonical
      from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb)) as x(
        event_id text, sport_key text, commence_time timestamptz,
        home_team text, away_team text
      )
  )
  insert into ai.odds_api_events (
    event_id, sport_key, commence_time, home_team, away_team,
    home_canonical, away_canonical, fixture_id, matched_by
  )
  select e.event_id, e.sport_key, e.commence_time, e.home_team, e.away_team,
         e.home_canonical, e.away_canonical, matched.id,
         case when matched.id is null then 'unmatched' else 'alias' end
    from incoming e
    left join lateral (
      select fixture.id
        from ai.fixtures fixture
       where fixture.home_canonical = e.home_canonical
         and fixture.away_canonical = e.away_canonical
         and coalesce(fixture.kickoff_at, fixture.match_date::timestamptz)
             between e.commence_time - interval '2 days'
                 and e.commence_time + interval '2 days'
       order by abs(extract(epoch from
         (coalesce(fixture.kickoff_at, fixture.match_date::timestamptz)
          - e.commence_time)))
       limit 1
    ) matched on true
  on conflict (event_id) do update set
    sport_key      = excluded.sport_key,
    commence_time  = excluded.commence_time,
    home_team      = excluded.home_team,
    away_team      = excluded.away_team,
    home_canonical = excluded.home_canonical,
    away_canonical = excluded.away_canonical,
    -- A corrected identity must be allowed to relink. Keeping the first
    -- fixture this event ever resolved to is what made an alias fix
    -- unobservable for every row already retained.
    fixture_id = case
                   when ai.odds_api_events.home_canonical
                          is distinct from excluded.home_canonical
                     or ai.odds_api_events.away_canonical
                          is distinct from excluded.away_canonical
                   then excluded.fixture_id
                   else coalesce(ai.odds_api_events.fixture_id, excluded.fixture_id)
                 end,
    matched_by = case when coalesce(
                        case when ai.odds_api_events.home_canonical
                                    is distinct from excluded.home_canonical
                               or ai.odds_api_events.away_canonical
                                    is distinct from excluded.away_canonical
                             then excluded.fixture_id
                             else coalesce(ai.odds_api_events.fixture_id,
                                           excluded.fixture_id) end)
                      is null then 'unmatched' else 'alias' end;
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

  -- Read AFTER the upsert, so it reports what was actually retained. Only the
  -- event ids are needed here, which is why this one does not re-canonicalise.
  select count(*) into v_unmatched
    from ai.odds_api_events event
   where event.event_id in (
           select x.event_id
             from jsonb_to_recordset(coalesce(p_normalized_payload, '[]'::jsonb)) as x(
               event_id text
             )
         )
     and event.fixture_id is null;

  return jsonb_build_object(
    'raw_response_id', v_raw_id,
    'events_seen', v_events,
    'prices_written', v_prices,
    'unmatched_events', v_unmatched,
    -- Names the disagreement rather than counting it away: a non-zero value
    -- here means the decoder's alias table is behind the database's.
    'decoder_identity_corrected', v_recanonicalised);
end;
$$;
revoke all on function public.record_ai_odds_snapshot(
  text,integer,jsonb,text,jsonb,integer,integer,integer,integer,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.record_ai_odds_snapshot(
  text,integer,jsonb,text,jsonb,integer,integer,integer,integer,text,text
) to service_role;

commit;
