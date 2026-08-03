-- Contract 70: the season scoring counterpart, with TypeScript parity.
--
-- ADR 0012 requires an independent season scoring authority with
-- TypeScript/PostgreSQL parity. `src/domain/season/scoring.ts` is the
-- TypeScript side; this is the PostgreSQL one, and
-- `tests/database-parity/seasonScoringParity.test.ts` holds them in step.
--
-- The rules mirrored here, each of which can be got wrong quietly:
--
--   - exact score is 5 TOTAL. It REPLACES the correct-result 3 rather than
--     stacking with it. A stacking implementation awards 8 and nobody notices
--     until a league table is wrong;
--   - a missing or malformed prediction scores zero. Unknown data never awards
--     points;
--   - the Joker doubles the WHOLE matchweek, never one fixture;
--   - only a played fixture scores. `matchweekSettlement` is explicit that an
--     abandoned fixture's partial score never stands, and contract 68 already
--     refuses to store one, so "played" is the only settled state.
--
-- These values coincide with the tournament's exact-5/result-3 today because
-- ADR 0012 chose to keep them, not because one authority serves both. The two
-- implementations stay separate; do not merge them for convenience.

-- ---------------------------------------------------------------------------
-- One fixture's points.
--
-- Immutable and side-effect free: the same inputs always give the same answer,
-- which is what lets the parity test reason about it as a pure function.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_fixture_points(
  p_prediction_home smallint,
  p_prediction_away smallint,
  p_result_home smallint,
  p_result_away smallint
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    -- Unknown data never awards points: a missing prediction, or a fixture
    -- with no result, scores zero rather than being treated as a draw.
    when p_prediction_home is null or p_prediction_away is null then 0
    when p_result_home is null or p_result_away is null then 0
    when p_prediction_home < 0 or p_prediction_away < 0 then 0
    when p_result_home < 0 or p_result_away < 0 then 0
    -- Exact score REPLACES correct result. Ordering matters: putting the
    -- outcome branch first would award 3 for a perfect prediction.
    when p_prediction_home = p_result_home and p_prediction_away = p_result_away then 5
    when sign(p_prediction_home - p_prediction_away) = sign(p_result_home - p_result_away) then 3
    else 0
  end;
$$;

revoke all on function predictor_internal.season_fixture_points(smallint, smallint, smallint, smallint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- One matchweek's points for one entry.
--
-- The Joker doubles the matchweek total, applied once at the end — never per
-- fixture, which would give a different answer whenever a matchweek had more
-- than one scoring fixture.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_matchweek_points(
  p_entry_id uuid,
  p_competition_round_id uuid
)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    sum(
      predictor_internal.season_fixture_points(
        prediction.home_score,
        prediction.away_score,
        fixture.home_score,
        fixture.away_score
      )
    ),
    0
  )::integer
  * case
      when exists (
        select 1 from public.season_matchweek_jokers joker
         where joker.entry_id = p_entry_id
           and joker.competition_round_id = p_competition_round_id
      ) then 2
      else 1
    end
  from public.season_fixtures fixture
  -- A left join, so a fixture the player did not predict still counts as a
  -- zero rather than vanishing. An inner join would silently make "predicted
  -- nothing" indistinguishable from "no fixtures", and both would read as a
  -- clean zero for different reasons.
  left join public.season_predictions prediction
    on prediction.season_fixture_id = fixture.id
   and prediction.entry_id = p_entry_id
  where fixture.competition_round_id = p_competition_round_id
    and fixture.status = 'played';
$$;

revoke all on function predictor_internal.season_matchweek_points(uuid, uuid)
  from public, anon, authenticated;
