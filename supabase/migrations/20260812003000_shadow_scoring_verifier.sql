-- ---------------------------------------------------------------------------
-- Contract 178 — INNOV-018: an independent read-only check that the points a
-- season banked are the points ADR 0012 says it should have banked.
--
-- Promoted from the Innovation Lab register by the owner authorisation of
-- 12 August 2026 and recorded in ADR 0027.
--
-- ---------------------------------------------------------------------------
-- THE FAILURE THIS EXISTS FOR
-- ---------------------------------------------------------------------------
--
-- Every control in this repository detects a job that FAILED. Nothing detects a
-- job that succeeded and was wrong. `process_due_season_matchweek_scores`
-- returns `settled` and a count of rows written whether those rows are right or
-- not, and a league table built on a quietly wrong total looks exactly like a
-- league table built on a right one — to the players, to the operator and to
-- every existing test, until somebody adds up their own week by hand.
--
-- ---------------------------------------------------------------------------
-- INDEPENDENCE IS THE WHOLE FEATURE
-- ---------------------------------------------------------------------------
--
-- A verifier that calls `predictor_internal.season_matchweek_points` and
-- compares the answer with itself detects nothing at all and reports a green
-- tick for ever. So `shadow_matchweek_points` is written from ADR 0012's rules
-- directly and shares no code with the scoring path:
--
--   * the canonical function classifies an outcome with `sign(home - away)`;
--     this one classifies it into the tokens 'H', 'D' and 'A' with explicit
--     comparisons, because a defect in an arithmetic trick is exactly the kind
--     that reproduces itself when the trick is reused;
--   * the canonical function tests the exact score with two equalities before
--     the outcome branch; this one tests the whole scoreline as a composite,
--     so an implementation that let 5 and 3 stack would disagree here;
--   * the canonical function reads the Joker with `exists`; this one counts.
--
-- A `do` block at the bottom REFUSES to install a verifier whose text names
-- either canonical scoring function. That assertion, not this comment, is what
-- keeps the independence real: it is one careless `create or replace` away from
-- being lost, and the loss would be invisible because the verifier would keep
-- returning zero mismatches.
--
-- ---------------------------------------------------------------------------
-- IT CHANGES NOTHING
-- ---------------------------------------------------------------------------
--
-- It writes two tables of its own and no others. It never corrects a banked
-- total, never re-settles a matchweek and never touches a fixture, a
-- prediction, a Joker or a standing: a disagreement is a reason to investigate,
-- and an automatic correction driven by a second implementation would simply
-- move the question of which one is right somewhere nobody is looking. A second
-- source assertion refuses a verifier whose text writes any competitive table.
--
-- ---------------------------------------------------------------------------
-- WHAT IT CHECKS, AND WHAT IT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------
--
--   * `points` — recomputed independently. **critical**: this is the number the
--     league table is built from.
--   * `joker_applied` — recomputed independently. **critical**: it doubles.
--   * `fixtures_scored` — compared against the count of played fixtures in the
--     round. **advisory**, because the settlement job stores contract 91's
--     matches-played DENOMINATOR rather than a count, and the two are equal as
--     a consequence of that rule rather than by definition. A disagreement here
--     is a question, not a verdict.
--
-- It does NOT verify settlement lifecycle — whether a matchweek should have
-- settled at all, or whether the right entries have rows. That is contract 91's
-- disposition rule rather than ADR 0012's scoring rule, and a verifier that
-- reimplemented it would be a second settlement engine rather than a check on
-- the first. An entry with no banked row is invisible to this contract, and
-- that limit is stated rather than hidden.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. The evidence.
-- ---------------------------------------------------------------------------

create table predictor_internal.shadow_scoring_runs (
  id uuid primary key default gen_random_uuid(),

  -- A monotonic sequence, because "the latest run" cannot be answered from
  -- `started_at` alone: `now()` is transaction time, so two runs in one
  -- transaction carry the same instant and the report would return whichever
  -- the plan happened to produce. `clock_timestamp()` fixes the instant and
  -- this fixes the ORDER, which is the part a report depends on.
  run_seq bigint generated by default as identity,

  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  rounds_checked integer not null default 0,
  scores_checked integer not null default 0,
  critical_mismatches integer not null default 0,
  advisory_mismatches integer not null default 0
);

create index shadow_scoring_runs_season_idx
  on predictor_internal.shadow_scoring_runs (tournament_id, run_seq desc);

create table predictor_internal.shadow_scoring_mismatches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references predictor_internal.shadow_scoring_runs(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  competition_round_id uuid not null references public.competition_rounds(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,

  -- What disagreed, and how much it matters.
  finding text not null,
  severity text not null,

  banked_value integer,
  expected_value integer,

  detected_at timestamptz not null default clock_timestamp(),

  constraint shadow_scoring_mismatches_finding_allowed
    check (finding in ('points', 'joker_applied', 'fixtures_scored')),
  constraint shadow_scoring_mismatches_severity_allowed
    check (severity in ('critical', 'advisory'))
);

create index shadow_scoring_mismatches_run_idx
  on predictor_internal.shadow_scoring_mismatches (run_id, severity, detected_at desc);

-- Internal schema, so no Data API reaches them; row-level security and the
-- revoke are both stated anyway, because contract 134 is the record of what
-- happens when a table is created under a comment saying nobody can read it
-- and nothing is actually revoked.
alter table predictor_internal.shadow_scoring_runs enable row level security;
alter table predictor_internal.shadow_scoring_mismatches enable row level security;

revoke all on predictor_internal.shadow_scoring_runs from public, anon, authenticated;
revoke all on predictor_internal.shadow_scoring_mismatches from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The independent implementation.
--
-- ADR 0012, expressed from the decision rather than from the code:
--
--   * a matchweek's points are the sum of its played fixtures' points;
--   * a fixture whose predicted scoreline IS the result is worth 5;
--   * otherwise a fixture whose predicted OUTCOME is the result's outcome is
--     worth 3 — the 5 replaces the 3, it does not stack;
--   * a missing or malformed prediction is worth nothing;
--   * the Joker doubles the matchweek total, once.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.shadow_outcome(
  p_home smallint,
  p_away smallint
)
returns text
language sql
immutable
set search_path = ''
as $outcome$
  select case
    when p_home is null or p_away is null then null
    when p_home < 0 or p_away < 0 then null
    when p_home > p_away then 'H'
    when p_home = p_away then 'D'
    else 'A'
  end;
$outcome$;

revoke all on function predictor_internal.shadow_outcome(smallint, smallint)
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.shadow_matchweek_points(
  p_entry_id uuid,
  p_competition_round_id uuid
)
returns integer
language sql
stable
set search_path = ''
as $shadow$
  with played as (
    select
      fixture.home_score as result_home,
      fixture.away_score as result_away,
      prediction.home_score as predicted_home,
      prediction.away_score as predicted_away
    from public.season_fixtures fixture
    left join public.season_predictions prediction
      on prediction.season_fixture_id = fixture.id
     and prediction.entry_id = p_entry_id
    where fixture.competition_round_id = p_competition_round_id
      and fixture.status = 'played'
  ),
  awarded as (
    select case
      -- Unknown data awards nothing. Stated first so nothing below it has to
      -- cope with a null.
      when played.predicted_home is null or played.predicted_away is null then 0
      when played.result_home is null or played.result_away is null then 0
      when played.predicted_home < 0 or played.predicted_away < 0 then 0
      when played.result_home < 0 or played.result_away < 0 then 0
      -- The whole scoreline as one comparison, so a stacking implementation
      -- disagrees with this one rather than agreeing by construction.
      when (played.predicted_home, played.predicted_away)
         = (played.result_home, played.result_away) then 5
      when predictor_internal.shadow_outcome(played.predicted_home, played.predicted_away)
         = predictor_internal.shadow_outcome(played.result_home, played.result_away) then 3
      else 0
    end as points
    from played
  )
  select coalesce((select sum(awarded.points) from awarded), 0)::integer
       * (case
            when (select count(*) from public.season_matchweek_jokers joker
                   where joker.entry_id = p_entry_id
                     and joker.competition_round_id = p_competition_round_id) > 0
            then 2 else 1
          end);
$shadow$;

revoke all on function predictor_internal.shadow_matchweek_points(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. The run.
--
-- Read-only against every competitive relation; the only rows it writes are its
-- own. `service_role` alone, because it is a job rather than an action: an
-- administrator reads the result through the report below.
-- ---------------------------------------------------------------------------

create or replace function public.run_shadow_scoring_verification(
  p_tournament_id uuid,
  p_max_rounds integer default 40
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $verify$
declare
  v_run uuid;
  v_limit integer := least(greatest(coalesce(p_max_rounds, 40), 1), 60);
  v_rounds integer := 0;
  v_scores integer := 0;
  v_critical integer := 0;
  v_advisory integer := 0;
  v_round record;
  v_banked record;
  v_expected integer;
  v_expected_joker boolean;
  v_played integer;
begin
  if p_tournament_id is null then
    raise exception 'A competition season is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tournaments season
     where season.id = p_tournament_id and season.kind = 'league_season'
  ) then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  insert into predictor_internal.shadow_scoring_runs (tournament_id)
  values (p_tournament_id)
  returning id into v_run;

  -- Most recent settled matchweeks first: a defect introduced today matters
  -- more than one that has been sitting in matchweek 2 since August, and the
  -- cap has to fall somewhere.
  for v_round in
    select round.id, round.ordinal, round.round_key,
           (select count(*)::integer
              from public.season_fixtures fixture
             where fixture.competition_round_id = round.id
               and fixture.status = 'played') as played_fixtures
      from public.competition_rounds round
     where round.tournament_id = p_tournament_id
       and exists (
         select 1 from public.season_matchweek_scores score
          where score.competition_round_id = round.id)
     order by round.ordinal desc
     limit v_limit
  loop
    v_rounds := v_rounds + 1;
    v_played := v_round.played_fixtures;

    for v_banked in
      select score.entry_id, score.points, score.joker_applied, score.fixtures_scored
        from public.season_matchweek_scores score
       where score.competition_round_id = v_round.id
    loop
      v_scores := v_scores + 1;

      v_expected := predictor_internal.shadow_matchweek_points(
        v_banked.entry_id, v_round.id);

      v_expected_joker := (
        select count(*) > 0 from public.season_matchweek_jokers joker
         where joker.entry_id = v_banked.entry_id
           and joker.competition_round_id = v_round.id);

      if v_banked.points is distinct from v_expected then
        insert into predictor_internal.shadow_scoring_mismatches (
          run_id, tournament_id, competition_round_id, entry_id,
          finding, severity, banked_value, expected_value)
        values (v_run, p_tournament_id, v_round.id, v_banked.entry_id,
                'points', 'critical', v_banked.points, v_expected);
        v_critical := v_critical + 1;
      end if;

      if v_banked.joker_applied is distinct from v_expected_joker then
        insert into predictor_internal.shadow_scoring_mismatches (
          run_id, tournament_id, competition_round_id, entry_id,
          finding, severity, banked_value, expected_value)
        values (v_run, p_tournament_id, v_round.id, v_banked.entry_id,
                'joker_applied', 'critical',
                case when v_banked.joker_applied then 1 else 0 end,
                case when v_expected_joker then 1 else 0 end);
        v_critical := v_critical + 1;
      end if;

      if v_banked.fixtures_scored is distinct from v_played then
        insert into predictor_internal.shadow_scoring_mismatches (
          run_id, tournament_id, competition_round_id, entry_id,
          finding, severity, banked_value, expected_value)
        values (v_run, p_tournament_id, v_round.id, v_banked.entry_id,
                'fixtures_scored', 'advisory', v_banked.fixtures_scored, v_played);
        v_advisory := v_advisory + 1;
      end if;
    end loop;
  end loop;

  update predictor_internal.shadow_scoring_runs
     set completed_at = now(),
         rounds_checked = v_rounds,
         scores_checked = v_scores,
         critical_mismatches = v_critical,
         advisory_mismatches = v_advisory
   where id = v_run;

  return jsonb_build_object(
    'run_id', v_run,
    'tournament_id', p_tournament_id,
    'rounds_checked', v_rounds,
    'scores_checked', v_scores,
    'critical_mismatches', v_critical,
    'advisory_mismatches', v_advisory,
    -- Stated on every run, so an operator reading the output is never left to
    -- infer that a clean result means the settlement lifecycle was checked.
    'not_checked', 'settlement lifecycle: whether a matchweek should have '
                   'settled, and whether every eligible entry holds a row');
end;
$verify$;

revoke all on function public.run_shadow_scoring_verification(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.run_shadow_scoring_verification(uuid, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 4. The administrator's report.
--
-- Entries are named by entry id and never by display name or address: this
-- read exists to answer "is the scoring right", and who the player is adds
-- nothing to that question. An administrator who needs the person has
-- `admin_competition_entrants` for it.
-- ---------------------------------------------------------------------------

create or replace function public.admin_shadow_scoring_report(
  p_tournament_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $report$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_run record;
  v_findings jsonb;
begin
  perform predictor_internal.require_competition_admin();

  if p_tournament_id is null then
    raise exception 'A competition season is required' using errcode = '22023';
  end if;

  select * into v_run
    from predictor_internal.shadow_scoring_runs run
   where run.tournament_id = p_tournament_id
   order by run.run_seq desc
   limit 1;

  if v_run is null then
    return jsonb_build_object(
      'tournament_id', p_tournament_id,
      'server_now', now(),
      'run', null,
      'findings', '[]'::jsonb,
      'findings_returned', 0,
      'findings_truncated', false);
  end if;

  select coalesce(jsonb_agg(row order by severity, ordinal, entry_id), '[]'::jsonb)
    into v_findings
    from (
      select
        mismatch.severity,
        round.ordinal,
        mismatch.entry_id,
        jsonb_build_object(
          'finding', mismatch.finding,
          'severity', mismatch.severity,
          'matchweek_id', mismatch.competition_round_id,
          'matchweek', round.ordinal,
          'entry_id', mismatch.entry_id,
          'banked', mismatch.banked_value,
          'expected', mismatch.expected_value,
          'detected_at', mismatch.detected_at) as row
      from predictor_internal.shadow_scoring_mismatches mismatch
      join public.competition_rounds round on round.id = mismatch.competition_round_id
      where mismatch.run_id = v_run.id
      order by mismatch.severity, round.ordinal, mismatch.entry_id
      limit v_limit) page;

  return jsonb_build_object(
    'tournament_id', p_tournament_id,
    'server_now', now(),
    'run', jsonb_build_object(
      'run_id', v_run.id,
      'started_at', v_run.started_at,
      'completed_at', v_run.completed_at,
      'rounds_checked', v_run.rounds_checked,
      'scores_checked', v_run.scores_checked,
      'critical_mismatches', v_run.critical_mismatches,
      'advisory_mismatches', v_run.advisory_mismatches),
    'findings', v_findings,
    'findings_returned', jsonb_array_length(v_findings),
    -- Contract 171's rule: a truncated list must say so, because a short list
    -- and a clean season are otherwise the same thing on screen.
    'findings_truncated',
      jsonb_array_length(v_findings)
        < (v_run.critical_mismatches + v_run.advisory_mismatches));
end;
$report$;

revoke all on function public.admin_shadow_scoring_report(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_shadow_scoring_report(uuid, integer)
  to authenticated;

comment on function public.run_shadow_scoring_verification(uuid, integer) is
  'Contract 178 (INNOV-018). Independently recomputes settled season matchweek '
  'points and compares them with the banked totals, recording disagreements as '
  'evidence. Corrects nothing. service_role only.';

-- ---------------------------------------------------------------------------
-- 5. The two properties that make it a verifier rather than a mirror.
--
-- Asserted against the installed definitions, with `--` comments stripped
-- first: `pg_get_functiondef` returns the comments with the code, and a comment
-- must never be able to change what a parser thinks the data is — the rule
-- `rpcAllowlistParity.test.ts` states and the defect Database parity caught in
-- contracts 172 and 173.
-- ---------------------------------------------------------------------------

do $independence$
declare
  v_source text;
  v_target text;
begin
  foreach v_target in array array[
    'predictor_internal.shadow_matchweek_points(uuid, uuid)',
    'predictor_internal.shadow_outcome(smallint, smallint)',
    'public.run_shadow_scoring_verification(uuid, integer)'
  ] loop
    select string_agg(regexp_replace(line, '--.*$', ''), E'\n')
      into v_source
      from regexp_split_to_table(
        pg_get_functiondef(v_target::regprocedure), E'\n') line;

    -- INDEPENDENCE. A verifier that calls the implementation it verifies
    -- agrees with it by construction and reports a green tick for ever.
    if v_source ~ 'season_fixture_points' or v_source ~ 'season_matchweek_points' then
      raise exception
        'The shadow verifier (%) must not call the scoring path it verifies', v_target;
    end if;

    -- NO AUTHORITY. Its only writes are its own two tables.
    if v_source ~* '(insert\s+into|update|delete\s+from)\s+public\.'
       and v_source !~* 'shadow_scoring' then
      raise exception
        'The shadow verifier (%) must not write a competitive relation', v_target;
    end if;
  end loop;

  -- Named explicitly, because the generic test above would also pass on a
  -- verifier that wrote these through a helper.
  select string_agg(regexp_replace(line, '--.*$', ''), E'\n')
    into v_source
    from regexp_split_to_table(
      pg_get_functiondef(
        'public.run_shadow_scoring_verification(uuid, integer)'::regprocedure), E'\n') line;

  if v_source ~* 'season_matchweek_scores\s*(set|\()'
     or v_source ~* '(insert\s+into|update|delete\s+from)[^;]*season_matchweek_scores' then
    raise exception 'The shadow verifier must never write a banked total';
  end if;
end;
$independence$;

commit;
