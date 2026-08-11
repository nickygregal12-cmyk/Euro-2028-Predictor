-- ---------------------------------------------------------------------------
-- Contract 160 — MIG-UI-13: the competition's own league table.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED FIRST
-- ---------------------------------------------------------------------------
--
-- The register says this is "not approximable in the browser" and names why:
-- contract 141's `get_season_club_form` is "explicitly not a league table" and
-- is capped at twenty matches, so it could not produce a season table even if
-- the rules were absent. Measured against the migrations rather than assumed:
--
--   * nothing anywhere aggregates `season_fixtures` into a club table — the
--     only club-level derivation is contract 141's capped form/head-to-head;
--   * no relation holds a competition's POINTS values, its TIE-BREAK ORDER or
--     its promotion/playoff/relegation boundaries. Three points for a win is
--     not a law of football: it is a rule each competition publishes;
--   * no relation holds a points DEDUCTION. A deduction is a fact about the
--     table and about nothing else — it changes no result, no prediction and
--     no player's score — so there was nowhere for one to live;
--   * `season_fixtures.status` is `scheduled | played | postponed | abandoned |
--     void`, and `season_fixtures_scores_match_status` makes a score exist
--     exactly when the status is `played`. So the four non-played states are
--     already deterministic in storage: none of them can carry a scoreline.
--
-- ---------------------------------------------------------------------------
-- AN AWARDED RESULT IS A TABLE FACT, NOT A FIXTURE RESULT
-- ---------------------------------------------------------------------------
--
-- The requirement asks for deterministic treatment of awarded fixtures, and the
-- obvious implementation — a sixth `season_fixtures.status` — is the wrong one,
-- for a reason that is a rule rather than a preference.
--
-- `season_fixtures.home_score` is what PREDICTIONS are settled against. Contract
-- 125 made writing it a protected, audited, administrator-or-provider act, and
-- contract 135 made a provider final status the authority for it. If a club is
-- awarded a 3-0 in November over a fixture played 1-1 in September, then writing
-- that 3-0 into the fixture would silently restate what every player predicted
-- and rescore a settled matchweek months later. Real competitions do not do
-- that: the match result stands for the players, and the TABLE is adjusted.
--
-- So an award is stored beside the fixture, never in it. `season_fixtures` is
-- untouched by this contract, the protected result authority is untouched, no
-- settlement re-runs, and no player's banked points can move. The separation is
-- asserted below rather than left as an intention.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CONTRACT IS NOT
-- ---------------------------------------------------------------------------
--
-- It is not a scoring authority and shares nothing with one. A league table
-- ranks CLUBS on football results; `season_standings` ranks PLAYERS on
-- prediction points. The two never meet: nothing here reads `entries`,
-- `match_predictions`, `season_matchweek_scores` or any score event, and
-- nothing that ranks players reads anything created here. Asserted below.
--
-- It is not an ingestion path. It creates and revises no fixture.
--
-- Additive: three new tables, one new internal derivation, one new read, and
-- grants. Nothing existing is dropped, altered or redefined.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. The competition's own rules
-- ===========================================================================
--
-- One row per SEASON rather than per competition, because a competition may
-- change its rules between seasons — points for a win changed in living memory,
-- and the number of relegation places changes far more often than that. Keying
-- on the season means a historic table keeps the rules it was actually played
-- under, which is the whole reason a stored Wrapped exists two contracts ago.
--
-- Defaults are the modern near-universal ones (3/1/0, goal difference then
-- goals scored then head-to-head) so that a season with no row still produces a
-- correct table for the competitions this platform runs today. The row exists
-- so a competition that differs can SAY so, not so that every competition must.

create table if not exists public.season_table_rules (
  -- `not null` is stated as well as implied by the primary key. The Stage C
  -- tournament_id inventory reads the DECLARATION, and a column that is
  -- not-null only by implication reads there as nullable — which is how a real
  -- nullable season scope would eventually hide.
  tournament_id uuid not null primary key
    references public.tournaments(id) on delete cascade,

  points_win smallint not null default 3,
  points_draw smallint not null default 1,
  points_loss smallint not null default 0,

  -- Ordered, and applied in order after points. Every member must be a key the
  -- deriver knows; an unknown key would silently order by nothing, which is the
  -- failure mode where a table looks right and is wrong.
  tie_breakers text[] not null
    default array['goal_difference', 'goals_for', 'head_to_head_points'],

  -- Boundaries, expressed as counts from each end rather than as positions, so
  -- they stay correct when a division changes size. Zero means the competition
  -- publishes no such boundary — not unknown, which is why they are `not null`.
  promotion_places smallint not null default 0,
  playoff_places smallint not null default 0,
  relegation_places smallint not null default 0,

  updated_at timestamptz not null default now(),

  constraint season_table_rules_points_sane
    check (points_win >= points_draw and points_draw >= points_loss
           and points_loss >= 0 and points_win <= 10),

  -- Between one and five keys. An empty array would leave clubs level on points
  -- ordered only by the deterministic name fallback, which is a table nobody
  -- publishes; six would exceed the ordering slots the deriver declares, and a
  -- silently ignored sixth key is exactly the failure this constraint prevents.
  constraint season_table_rules_tie_breakers_bounded
    check (array_length(tie_breakers, 1) between 1 and 5),

  -- Every member checked, with no null admitted anywhere in the array. The
  -- `array_position(tie_breakers, null) is null` conjunct is the three-valued
  -- logic hole this repository's checklist names: without it an array
  -- containing a null passes `<@` and then compares as unknown for ever.
  constraint season_table_rules_tie_breakers_known
    check (
      array_position(tie_breakers, null) is null
      and tie_breakers <@ array[
        'goal_difference', 'goals_for', 'goals_against', 'wins',
        'head_to_head_points', 'head_to_head_goal_difference', 'alphabetical']
    ),

  constraint season_table_rules_boundaries_non_negative
    check (promotion_places >= 0 and playoff_places >= 0 and relegation_places >= 0)
);

alter table public.season_table_rules enable row level security;

-- Read through the bounded read below. The rules are not secret, but a direct
-- grant is a new entry in the Data API exposure surface `dataApiExposure.test.ts`
-- pins, and this contract adds none.
revoke all on table public.season_table_rules from public, anon, authenticated;

comment on table public.season_table_rules is
  'Contract 160. Per-season league-table configuration: points values, ordered '
  'tie-break keys and promotion/playoff/relegation boundaries. Read through '
  'get_competition_table. Never a player-scoring authority.';

-- ===========================================================================
-- 2. Points deductions and awards
-- ===========================================================================
--
-- A single signed delta rather than a `kind` column and a magnitude, because a
-- deduction and an award differ only in sign and a two-column encoding admits
-- the pair (kind='deduction', points=+9) that means nothing.
--
-- `effective_from` is required, and the table read applies only deltas already
-- effective. A deduction announced today and effective at the start of next
-- season must not silently move this season's table, and a competition that
-- announces a sanction before it takes effect is the ordinary case rather than
-- the exotic one.

create table if not exists public.season_table_adjustments (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null,
  team_id uuid not null,

  -- Negative deducts, positive awards. Never zero: a zero-point adjustment is
  -- a record with no effect, and one in the table would be indistinguishable
  -- from a mistake.
  points_delta integer not null,

  -- Required, and required to say something. A deduction with no published
  -- reason is not a fact a table can defend.
  reason text not null,

  effective_from timestamptz not null default now(),

  decided_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),

  -- The same season-scoped key pattern contract 125's fixtures use: a plain
  -- `references teams(id)` would let a Premier League deduction name a Scottish
  -- Premiership club, and the row would be valid.
  constraint season_table_adjustments_team_fkey
    foreign key (tournament_id, team_id)
    references public.teams(tournament_id, id)
    on delete restrict,

  constraint season_table_adjustments_delta_non_zero
    check (points_delta <> 0 and points_delta between -100 and 100),

  constraint season_table_adjustments_reason_present
    check (char_length(btrim(reason)) between 3 and 500)
);

create index if not exists season_table_adjustments_season_idx
  on public.season_table_adjustments (tournament_id, team_id);

alter table public.season_table_adjustments enable row level security;
revoke all on table public.season_table_adjustments from public, anon, authenticated;

comment on table public.season_table_adjustments is
  'Contract 160. Signed points adjustments applied to a club''s league-table '
  'total from effective_from onward. Changes no result, no prediction and no '
  'player score.';

-- ===========================================================================
-- 3. Awarded fixture outcomes — for the table only
-- ===========================================================================
--
-- Keyed on the fixture and holding a scoreline that the TABLE uses in place of
-- whatever the fixture holds. The fixture itself is never written.
--
-- It covers both shapes a real award takes:
--   * a void or abandoned fixture awarded to one club, which has no scoreline
--     at all in `season_fixtures` and by that table's own CHECK never can;
--   * a played fixture whose result is later overturned, where the scoreline
--     the players predicted against stands and the table's does not.

create table if not exists public.season_fixture_awards (
  season_fixture_id uuid primary key
    references public.season_fixtures(id) on delete cascade,

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  home_goals smallint not null,
  away_goals smallint not null,

  reason text not null,

  decided_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),

  constraint season_fixture_awards_goals_sane
    check (home_goals >= 0 and away_goals >= 0
           and home_goals <= 99 and away_goals <= 99),

  constraint season_fixture_awards_reason_present
    check (char_length(btrim(reason)) between 3 and 500)
);

create index if not exists season_fixture_awards_season_idx
  on public.season_fixture_awards (tournament_id);

alter table public.season_fixture_awards enable row level security;
revoke all on table public.season_fixture_awards from public, anon, authenticated;

comment on table public.season_fixture_awards is
  'Contract 160. A table-only scoreline for an awarded fixture. season_fixtures '
  'is never written: predictions stay settled against the result that was '
  'played, which is what stops an award rescoring a settled matchweek.';

-- The award must name a fixture in the season it claims. A composite foreign
-- key cannot express it, because `season_fixtures` has no `(tournament_id, id)`
-- unique key and adding one to a hot table is a change this contract has no
-- reason to make.
create or replace function predictor_internal.assert_fixture_award_season()
returns trigger
language plpgsql
security definer
set search_path = ''
as $award$
begin
  if not exists (
    select 1 from public.season_fixtures fixture
     where fixture.id = new.season_fixture_id
       and fixture.tournament_id = new.tournament_id
  ) then
    raise exception 'An awarded outcome must name a fixture in its own season'
      using errcode = '23514';
  end if;
  return new;
end;
$award$;

drop trigger if exists season_fixture_awards_season_scope on public.season_fixture_awards;
create trigger season_fixture_awards_season_scope
  before insert or update on public.season_fixture_awards
  for each row execute function predictor_internal.assert_fixture_award_season();

-- ===========================================================================
-- 4. The derivation
-- ===========================================================================
--
-- Internal, granted to nobody, so the table has exactly one authority and the
-- browser-facing read below is a thin authorisation wrapper over it. The same
-- shape contract 128 used when a league needed its own table.
--
-- ORDERING IS TOTAL BY CONSTRUCTION. Points, then up to five configured keys,
-- then club name, then club id. A total order is not decoration: it is what
-- makes position deterministic across two calls, which is what a paginated or
-- repeatedly-rendered table needs, and it is why `alphabetical` is a key a
-- competition may name but never has to.
--
-- HEAD-TO-HEAD is computed against the clubs a club is actually TIED WITH — the
-- set sharing its points and every configured key that precedes the first
-- head-to-head key. Computing it against the whole division would be a
-- different statistic wearing the same name, and computing it pairwise would be
-- wrong for a three-way tie.

-- One key, normalised so that HIGHER IS ALWAYS BETTER. `goals_against` is the
-- only key where a smaller number is a better one, so it is negated here rather
-- than by a second ordering direction in five places — five `desc`/`asc` pairs
-- chosen by a CASE is exactly where an ordering bug hides.
--
-- An absent slot and an unrecognised key both return zero, which contributes no
-- ordering. `season_table_rules_tie_breakers_known` is what stops an
-- unrecognised key ever being stored, so the zero here is the belt to that
-- constraint's braces rather than the only control.
--
-- Defined BEFORE the deriver that calls it: `check_function_bodies` does not
-- resolve function names inside a plpgsql body, so the reverse order would
-- create cleanly and fail at the first call.
create or replace function predictor_internal.table_key_value(
  p_key text,
  p_gd integer,
  p_gf integer,
  p_ga integer,
  p_won integer,
  p_h2h_points integer,
  p_h2h_gd integer
)
returns integer
language sql
immutable
set search_path = ''
as $key$
  select case p_key
    when 'goal_difference' then p_gd
    when 'goals_for' then p_gf
    when 'goals_against' then -p_ga
    when 'wins' then p_won
    when 'head_to_head_points' then coalesce(p_h2h_points, 0)
    when 'head_to_head_goal_difference' then coalesce(p_h2h_gd, 0)
    else 0
  end;
$key$;

revoke all on function predictor_internal.table_key_value(
  text, integer, integer, integer, integer, integer, integer)
  from public, anon, authenticated, service_role;

create or replace function predictor_internal.season_league_table(p_tournament_id uuid)
returns table (
  -- `table_position` and not `position`: `position` is a reserved word in a
  -- parameter list — `returns table (position integer, ...)` is a syntax error,
  -- which the disposable database caught and no amount of reading would have.
  -- The browser-facing key stays `position`, built explicitly in the read below.
  table_position integer,
  team_id uuid,
  team_name text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_difference integer,
  points integer,
  adjustment integer,
  boundary text
)
language plpgsql
stable
security definer
set search_path = ''
as $table$
-- Every OUT parameter of this function — `played`, `won`, `points`, `position`
-- and the rest — is also a natural column name in the query below, and plpgsql
-- resolves an ambiguous unqualified name in favour of the VARIABLE by default.
-- That would silently substitute a null OUT parameter for a real column. Column
-- wins, and every reference below is qualified anyway.
#variable_conflict use_column
declare
  v_rules record;
  v_keys text[];
  v_h2h_at integer;
  v_field integer;
begin
  select coalesce(rules.points_win, 3) as points_win,
         coalesce(rules.points_draw, 1) as points_draw,
         coalesce(rules.points_loss, 0) as points_loss,
         coalesce(rules.tie_breakers,
                  array['goal_difference', 'goals_for', 'head_to_head_points']) as tie_breakers,
         coalesce(rules.promotion_places, 0) as promotion_places,
         coalesce(rules.playoff_places, 0) as playoff_places,
         coalesce(rules.relegation_places, 0) as relegation_places
    into v_rules
    from (select p_tournament_id as id) season
    left join public.season_table_rules rules on rules.tournament_id = season.id;

  v_keys := v_rules.tie_breakers;

  -- Where the first head-to-head key sits, because everything BEFORE it defines
  -- the tie group head-to-head is computed within. Null when the competition
  -- names no head-to-head key at all, in which case no mini-league is built.
  v_h2h_at := least(
    coalesce(array_position(v_keys, 'head_to_head_points'), 99),
    coalesce(array_position(v_keys, 'head_to_head_goal_difference'), 99));
  if v_h2h_at = 99 then
    v_h2h_at := null;
  end if;

  select count(*) into v_field
    from public.teams club where club.tournament_id = p_tournament_id;

  return query
  with counted as (
    -- WHAT COUNTS, and it is the whole deterministic-status rule in one place.
    --
    -- A fixture contributes exactly when it has a table scoreline: an award, or
    -- a played result. `scheduled`, `postponed`, `abandoned` and `void` carry no
    -- score by the fixtures table's own CHECK, so they contribute nothing unless
    -- an award says otherwise — and an award on a played fixture REPLACES the
    -- played scoreline in the table while leaving the fixture alone.
    select fixture.id,
           fixture.home_team_id,
           fixture.away_team_id,
           coalesce(award.home_goals, fixture.home_score)::integer as home_goals,
           coalesce(award.away_goals, fixture.away_score)::integer as away_goals
      from public.season_fixtures fixture
      left join public.season_fixture_awards award
             on award.season_fixture_id = fixture.id
     where fixture.tournament_id = p_tournament_id
       and (award.season_fixture_id is not null
            or (fixture.status = 'played'
                and fixture.home_score is not null
                and fixture.away_score is not null))
  ),
  sides as (
    select home_team_id as club, home_goals as gf, away_goals as ga from counted
    union all
    select away_team_id, away_goals, home_goals from counted
  ),
  totals as (
    select club,
           count(*)::integer as played,
           count(*) filter (where gf > ga)::integer as won,
           count(*) filter (where gf = ga)::integer as drawn,
           count(*) filter (where gf < ga)::integer as lost,
           coalesce(sum(gf), 0)::integer as gf,
           coalesce(sum(ga), 0)::integer as ga
      from sides group by club
  ),
  adjusted as (
    select adj.team_id, sum(adj.points_delta)::integer as delta
      from public.season_table_adjustments adj
     where adj.tournament_id = p_tournament_id
       -- Only what is already in force. An announced-but-future sanction must
       -- not move today's table.
       and adj.effective_from <= now()
     group by adj.team_id
  ),
  base as (
    -- Every club in the season, so one that has not played yet appears on zero
    -- rather than vanishing. A table missing a club is not a table.
    select club.id as club,
           club.name as club_name,
           coalesce(totals.played, 0) as played,
           coalesce(totals.won, 0) as won,
           coalesce(totals.drawn, 0) as drawn,
           coalesce(totals.lost, 0) as lost,
           coalesce(totals.gf, 0) as gf,
           coalesce(totals.ga, 0) as ga,
           coalesce(totals.gf, 0) - coalesce(totals.ga, 0) as gd,
           coalesce(adjusted.delta, 0) as delta,
           coalesce(totals.won, 0) * v_rules.points_win
             + coalesce(totals.drawn, 0) * v_rules.points_draw
             + coalesce(totals.lost, 0) * v_rules.points_loss
             + coalesce(adjusted.delta, 0) as pts
      from public.teams club
      left join totals on totals.club = club.id
      left join adjusted on adjusted.team_id = club.id
     where club.tournament_id = p_tournament_id
  ),
  keyed as (
    -- The signature of every key that PRECEDES head-to-head. Clubs sharing it
    -- are the clubs a head-to-head mini-league is played among.
    select base.*,
           case when v_h2h_at is null then null::text
                -- `coalesce` around the aggregate, because when head-to-head is
                -- the FIRST tie-break key `generate_series(1, 0)` is empty and
                -- `string_agg` returns null. Concatenating that would make every
                -- tie group null and silently disable head-to-head entirely —
                -- for exactly the competitions that rank it highest.
                else base.pts::text || ':' || coalesce((
                  select string_agg(
                    case v_keys[i]
                      when 'goal_difference' then base.gd::text
                      when 'goals_for' then base.gf::text
                      when 'goals_against' then base.ga::text
                      when 'wins' then base.won::text
                      else ''
                    end, '/' order by i)
                  from generate_series(1, v_h2h_at - 1) as i), '')
           end as tie_group
      from base
  ),
  h2h as (
    select keyed.club,
           coalesce(mini.pts, 0) as h2h_points,
           coalesce(mini.gd, 0) as h2h_gd
      from keyed
      left join lateral (
        select sum(case when side.gf > side.ga then v_rules.points_win
                        when side.gf = side.ga then v_rules.points_draw
                        else v_rules.points_loss end)::integer as pts,
               sum(side.gf - side.ga)::integer as gd
          from (
            select counted.home_team_id as club, counted.home_goals as gf, counted.away_goals as ga,
                   counted.away_team_id as opponent
              from counted
            union all
            select counted.away_team_id, counted.away_goals, counted.home_goals,
                   counted.home_team_id
              from counted
          ) side
         where side.club = keyed.club
           -- Both clubs inside the tie group, which is what makes it a
           -- mini-league rather than a subset of the division's results.
           and exists (select 1 from keyed peer
                        where peer.club = side.opponent
                          and peer.tie_group = keyed.tie_group)
      ) mini on true
     where keyed.tie_group is not null
  ),
  ordered as (
    select keyed.*,
           row_number() over (
             order by keyed.pts desc,
                      predictor_internal.table_key_value(
                        v_keys[1], keyed.gd, keyed.gf, keyed.ga, keyed.won,
                        h2h.h2h_points, h2h.h2h_gd) desc,
                      predictor_internal.table_key_value(
                        v_keys[2], keyed.gd, keyed.gf, keyed.ga, keyed.won,
                        h2h.h2h_points, h2h.h2h_gd) desc,
                      predictor_internal.table_key_value(
                        v_keys[3], keyed.gd, keyed.gf, keyed.ga, keyed.won,
                        h2h.h2h_points, h2h.h2h_gd) desc,
                      predictor_internal.table_key_value(
                        v_keys[4], keyed.gd, keyed.gf, keyed.ga, keyed.won,
                        h2h.h2h_points, h2h.h2h_gd) desc,
                      predictor_internal.table_key_value(
                        v_keys[5], keyed.gd, keyed.gf, keyed.ga, keyed.won,
                        h2h.h2h_points, h2h.h2h_gd) desc,
                      -- The total-order fallback. Two clubs level on every
                      -- configured key still occupy distinct, repeatable
                      -- positions, which is what a rendered or paginated table
                      -- needs and what a real competition settles by playoff.
                      keyed.club_name asc,
                      keyed.club asc
           )::integer as pos
      from keyed
      left join h2h on h2h.club = keyed.club
  )
  select ordered.pos,
         ordered.club,
         ordered.club_name,
         ordered.played,
         ordered.won,
         ordered.drawn,
         ordered.lost,
         ordered.gf,
         ordered.ga,
         ordered.gd,
         ordered.pts,
         ordered.delta,
         case
           when v_rules.promotion_places > 0
                and ordered.pos <= v_rules.promotion_places then 'promotion'
           when v_rules.playoff_places > 0
                and ordered.pos <= v_rules.promotion_places + v_rules.playoff_places
                then 'playoff'
           when v_rules.relegation_places > 0
                and ordered.pos > v_field - v_rules.relegation_places then 'relegation'
           else null
         end
    from ordered
   order by ordered.pos;
end;
$table$;

revoke all on function predictor_internal.season_league_table(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 5. The bounded, player-safe read
-- ===========================================================================
--
-- Granted to `authenticated` only. Making a football table anonymously readable
-- is a publication decision — the same one contracts 147 and 148 declined to
-- take — and `EURO-001` is the reason it matters: this read refuses a
-- tournament outright, so it cannot become a discovery surface for Euro 2028.
--
-- It discloses no player, no prediction, no membership and no entry. A league
-- table is football, and the only privacy question it raises is answered by
-- refusing the tournament kind.

create or replace function public.get_competition_table(p_tournament_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $read$
declare
  v_uid uuid := (select auth.uid());
  v_season record;
  v_rules record;
  v_rows jsonb;
  v_provenance jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  select season.id, season.name, season.kind, season.season_key,
         season.status, season.display_timezone
    into v_season
    from public.tournaments season
   where season.id = p_tournament_id;

  if v_season.id is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  -- A tournament has groups and a bracket, not a league table, and answering
  -- for one here would put Euro 2028 behind a weekly-platform read. Refused by
  -- stored kind rather than by name or slug.
  if v_season.kind is distinct from 'league_season' then
    raise exception 'A league table is a league season''s; % has none', v_season.kind
      using errcode = '22023';
  end if;

  select coalesce(rules.points_win, 3) as points_win,
         coalesce(rules.points_draw, 1) as points_draw,
         coalesce(rules.points_loss, 0) as points_loss,
         coalesce(rules.tie_breakers,
                  array['goal_difference', 'goals_for', 'head_to_head_points']) as tie_breakers,
         coalesce(rules.promotion_places, 0) as promotion_places,
         coalesce(rules.playoff_places, 0) as playoff_places,
         coalesce(rules.relegation_places, 0) as relegation_places,
         rules.tournament_id is not null as configured
    into v_rules
    from (select p_tournament_id as id) season
    left join public.season_table_rules rules on rules.tournament_id = season.id;

  -- Aliased `entry` and not `row`: `row` is a reserved word, so `row.position`
  -- is a syntax error rather than a column reference.
  --
  -- The shape is built explicitly rather than by `to_jsonb(entry)`, so the key a
  -- browser reads is `position` even though the deriver's OUT parameter cannot
  -- be called that, and so that adding a column to the deriver never silently
  -- widens what this read discloses.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', entry.table_position,
           'team_id', entry.team_id,
           'team_name', entry.team_name,
           'played', entry.played,
           'won', entry.won,
           'drawn', entry.drawn,
           'lost', entry.lost,
           'goals_for', entry.goals_for,
           'goals_against', entry.goals_against,
           'goal_difference', entry.goal_difference,
           'points', entry.points,
           'adjustment', entry.adjustment,
           'boundary', entry.boundary
         ) order by entry.table_position), '[]'::jsonb)
    into v_rows
    from predictor_internal.season_league_table(p_tournament_id) entry;

  -- PROVENANCE, and every field of it is measured rather than described.
  --
  -- `season_fixture_result_sources` is contract 135's rule made readable: a
  -- revision with a row there was written by a provider and the row names which;
  -- a revision without one was written by an administrator. So a table can say
  -- how much of itself came from a machine, which is the difference between
  -- "provisional" and "checked" that a player is entitled to see.
  select jsonb_build_object(
           'fixtures_counted', count(*) filter (
             where fixture.status = 'played' or award.season_fixture_id is not null),
           'fixtures_outstanding', count(*) filter (
             where fixture.status in ('scheduled', 'postponed')
               and award.season_fixture_id is null),
           'fixtures_excluded', count(*) filter (
             where fixture.status in ('abandoned', 'void')
               and award.season_fixture_id is null),
           'fixtures_awarded', count(*) filter (where award.season_fixture_id is not null),
           'last_result_at', max(revision.recorded_at),
           'provider_confirmed', count(*) filter (where source.season_fixture_id is not null),
           'administrator_confirmed', count(*) filter (
             where fixture.status = 'played' and source.season_fixture_id is null),
           'providers', coalesce(
             (select jsonb_agg(distinct inner_source.provider)
                from predictor_internal.season_fixture_result_sources inner_source
                join public.season_fixtures inner_fixture
                  on inner_fixture.id = inner_source.season_fixture_id
               where inner_fixture.tournament_id = p_tournament_id),
             '[]'::jsonb))
    into v_provenance
    from public.season_fixtures fixture
    left join public.season_fixture_awards award
           on award.season_fixture_id = fixture.id
    left join lateral (
      select max(rev.recorded_at) as recorded_at
        from predictor_internal.season_fixture_result_revisions rev
       where rev.season_fixture_id = fixture.id
    ) revision on true
    left join lateral (
      select src.season_fixture_id
        from predictor_internal.season_fixture_result_sources src
       where src.season_fixture_id = fixture.id
       order by src.revision desc limit 1
    ) source on true
   where fixture.tournament_id = p_tournament_id;

  return jsonb_build_object(
    'season', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.name,
      'season_key', v_season.season_key,
      'status', v_season.status,
      'display_timezone', v_season.display_timezone),
    'rules', jsonb_build_object(
      -- Whether the competition configured its own rules or is on the defaults
      -- is itself a fact a reader needs: a table published under assumed rules
      -- and one published under stated rules are not equally trustworthy.
      'configured', v_rules.configured,
      'points_win', v_rules.points_win,
      'points_draw', v_rules.points_draw,
      'points_loss', v_rules.points_loss,
      'tie_breakers', to_jsonb(v_rules.tie_breakers),
      'promotion_places', v_rules.promotion_places,
      'playoff_places', v_rules.playoff_places,
      'relegation_places', v_rules.relegation_places),
    'rows', v_rows,
    'provenance', coalesce(v_provenance, jsonb_build_object(
      'fixtures_counted', 0, 'fixtures_outstanding', 0, 'fixtures_excluded', 0,
      'fixtures_awarded', 0, 'last_result_at', null,
      'provider_confirmed', 0, 'administrator_confirmed', 0,
      'providers', '[]'::jsonb)));
end;
$read$;

-- `authenticated` ONLY, and not `service_role`. An earlier draft granted both,
-- which `080_function_privileges.sql` refused: `service_role` may execute only
-- what its own allow-list names, and no job calls this. The dual grant belongs
-- to the league functions `20260724001500_harden_function_privileges.sql`
-- covers, and this is not one of them.
revoke all on function public.get_competition_table(uuid) from public, anon, service_role;
grant execute on function public.get_competition_table(uuid) to authenticated;

-- ===========================================================================
-- 6. Administrator writes for the two facts a competition publishes
-- ===========================================================================
--
-- Gated on `require_competition_admin`, contract 127's gate, and deliberately
-- not on `require_result_admin`: an account trusted to correct a scoreline has
-- not thereby been trusted to deduct nine points from a club. Both admit
-- `super_admin` today; the capability exists so they can be delegated apart.

create or replace function public.admin_set_competition_table_rules(
  p_tournament_id uuid,
  p_points_win smallint,
  p_points_draw smallint,
  p_points_loss smallint,
  p_tie_breakers text[],
  p_promotion_places smallint,
  p_playoff_places smallint,
  p_relegation_places smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $rules$
declare
  v_kind text;
begin
  perform predictor_internal.require_competition_admin();

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  if v_kind is distinct from 'league_season' then
    raise exception 'Only a league season has a league table' using errcode = '22023';
  end if;

  insert into public.season_table_rules as rules (
    tournament_id, points_win, points_draw, points_loss, tie_breakers,
    promotion_places, playoff_places, relegation_places, updated_at)
  values (
    p_tournament_id, p_points_win, p_points_draw, p_points_loss, p_tie_breakers,
    p_promotion_places, p_playoff_places, p_relegation_places, now())
  on conflict (tournament_id) do update
    set points_win = excluded.points_win,
        points_draw = excluded.points_draw,
        points_loss = excluded.points_loss,
        tie_breakers = excluded.tie_breakers,
        promotion_places = excluded.promotion_places,
        playoff_places = excluded.playoff_places,
        relegation_places = excluded.relegation_places,
        updated_at = now();

  return jsonb_build_object('tournament_id', p_tournament_id, 'configured', true);
end;
$rules$;

revoke all on function public.admin_set_competition_table_rules(
  uuid, smallint, smallint, smallint, text[], smallint, smallint, smallint)
  from public, anon;
grant execute on function public.admin_set_competition_table_rules(
  uuid, smallint, smallint, smallint, text[], smallint, smallint, smallint)
  to authenticated;

create or replace function public.admin_record_table_adjustment(
  p_tournament_id uuid,
  p_team_id uuid,
  p_points_delta integer,
  p_reason text,
  p_effective_from timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $adjust$
declare
  v_id uuid;
begin
  perform predictor_internal.require_competition_admin();

  if not exists (
    select 1 from public.teams club
     where club.id = p_team_id and club.tournament_id = p_tournament_id
  ) then
    raise exception 'That club does not play in that season' using errcode = '22023';
  end if;

  insert into public.season_table_adjustments (
    tournament_id, team_id, points_delta, reason, effective_from, decided_by)
  values (
    p_tournament_id, p_team_id, p_points_delta, p_reason,
    coalesce(p_effective_from, now()), (select auth.uid()))
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$adjust$;

revoke all on function public.admin_record_table_adjustment(
  uuid, uuid, integer, text, timestamptz) from public, anon;
grant execute on function public.admin_record_table_adjustment(
  uuid, uuid, integer, text, timestamptz) to authenticated;

create or replace function public.admin_award_fixture_outcome(
  p_season_fixture_id uuid,
  p_home_goals smallint,
  p_away_goals smallint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $awarded$
declare
  v_tournament uuid;
begin
  perform predictor_internal.require_competition_admin();

  select fixture.tournament_id into v_tournament
    from public.season_fixtures fixture where fixture.id = p_season_fixture_id;

  if v_tournament is null then
    raise exception 'That fixture does not exist' using errcode = '22023';
  end if;

  insert into public.season_fixture_awards as award (
    season_fixture_id, tournament_id, home_goals, away_goals, reason, decided_by)
  values (
    p_season_fixture_id, v_tournament, p_home_goals, p_away_goals, p_reason,
    (select auth.uid()))
  on conflict (season_fixture_id) do update
    set home_goals = excluded.home_goals,
        away_goals = excluded.away_goals,
        reason = excluded.reason,
        decided_by = excluded.decided_by,
        recorded_at = now();

  return jsonb_build_object(
    'season_fixture_id', p_season_fixture_id,
    -- Said plainly in the return value, because the whole design rests on it.
    'fixture_result_unchanged', true,
    'predictions_rescored', false);
end;
$awarded$;

revoke all on function public.admin_award_fixture_outcome(uuid, smallint, smallint, text)
  from public, anon;
grant execute on function public.admin_award_fixture_outcome(uuid, smallint, smallint, text)
  to authenticated;

-- ===========================================================================
-- 7. Prove the separations, in the same transaction
-- ===========================================================================

do $$
declare
  v_table text := pg_get_functiondef('predictor_internal.season_league_table(uuid)'::regprocedure);
  v_read text := pg_get_functiondef('public.get_competition_table(uuid)'::regprocedure);
  v_award text := pg_get_functiondef('public.admin_award_fixture_outcome(uuid,smallint,smallint,text)'::regprocedure);
begin
  -- THE SEPARATION THIS CONTRACT RESTS ON. A club table ranks clubs on
  -- football; nothing in it may read a player, a prediction or a score.
  if (v_table || v_read) ~* 'match_predictions|season_matchweek_scores|score_events|public\.entries|entry_totals' then
    raise exception 'A league table must not read a player, a prediction or a score';
  end if;

  -- THE OTHER HALF. An award adjusts the TABLE and never the fixture, because
  -- the fixture is what predictions were settled against.
  if v_award ~* 'update[[:space:]]+public\.season_fixtures|record_season_fixture_result' then
    raise exception 'An awarded outcome must never write the fixture result';
  end if;

  -- Exactly the four writers of `season_fixtures` contract 125 pinned, and this
  -- contract adds none. Counted rather than described.
  if exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'predictor_internal')
      and p.proname in ('admin_award_fixture_outcome', 'admin_record_table_adjustment',
                        'admin_set_competition_table_rules', 'season_league_table')
      and p.prosrc ~* '(insert[[:space:]]+into|update)[[:space:]]+public\.season_fixtures'
  ) then
    raise exception 'Nothing in contract 160 may write season_fixtures';
  end if;

  -- Tournament refusal, which is what keeps this off Euro 2028.
  if v_read !~ 'league_season' then
    raise exception 'The read must refuse a competition that is not a league season';
  end if;

  -- No anonymous caller reaches the read, and no browser role reaches the
  -- derivation or any of the three new tables directly.
  if has_function_privilege('anon', 'public.get_competition_table(uuid)', 'execute') then
    raise exception 'The table read must not be reachable anonymously';
  end if;

  if has_function_privilege('authenticated',
       'predictor_internal.season_league_table(uuid)', 'execute') then
    raise exception 'The derivation must have exactly one caller';
  end if;

  if has_table_privilege('authenticated', 'public.season_table_rules', 'select')
     or has_table_privilege('authenticated', 'public.season_table_adjustments', 'select')
     or has_table_privilege('authenticated', 'public.season_fixture_awards', 'select')
     or has_table_privilege('anon', 'public.season_table_rules', 'select')
     or has_table_privilege('anon', 'public.season_table_adjustments', 'select')
     or has_table_privilege('anon', 'public.season_fixture_awards', 'select')
  then
    raise exception 'No browser role may read the new tables directly';
  end if;

  -- Every new table keeps row-level security on, which is this repository's
  -- standing rule rather than this contract's choice.
  if exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('season_table_rules', 'season_table_adjustments',
                        'season_fixture_awards')
      and not c.relrowsecurity
  ) then
    raise exception 'Every new table must keep row-level security enabled';
  end if;
end;
$$;
