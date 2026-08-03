-- Contract 75: split the Cup's points source from its shared arithmetic.
--
-- ADR 0022 (3 August correction) directs that `predictor_internal.cup_*` be
-- generalised from tournament scope to competition-season scope, so that one
-- implementation serves both, sequenced after C1b. C1b has landed and been
-- applied. This is the first step, and it moves nothing between competitions.
--
-- WHY A SPLIT RATHER THAN A PARAMETER SWAP. `cup_window_scores` already takes
-- `p_competition_id`, which makes it look competition-agnostic. It is not: the
-- tournament is in the body, which reads `public.matches`,
-- `public.match_predictions`, `public.bonus_knockout_predictions` and
-- `entries.tournament_id` directly, and branches on the tournament round
-- vocabulary (`round = 'group'`, the 90-minute columns). A season Cup can
-- reach none of that — its fixtures are `season_fixtures` and its predictions
-- `season_predictions`, and a league matchweek has no extra time.
--
-- So the function was doing two jobs:
--
--   1. a POINTS SOURCE — find this member's prediction for this fixture and
--      score it raw 5/3/0. Genuinely tournament-specific;
--   2. SHARED ARITHMETIC — aggregate per member into points, exacts, corrects,
--      scoreline error and submitted. Competition-agnostic, and exactly what
--      ADR 0022 wants to become one implementation.
--
-- Only (1) is competition-specific, so (1) moves into
-- `cup_tournament_fixture_points` and (2) stays in `cup_window_scores`,
-- consuming a NEUTRAL per-member-per-fixture relation. A season points source
-- returning that same shape then reuses the arithmetic unchanged, which is the
-- generalisation ADR 0022 asks for and the same neutral contract `settleCupTie`
-- already implements by taking fixture points as an input rather than
-- computing them.
--
-- The neutral relation carries derived facts, never scorelines: whether the
-- fixture was confirmed, whether the member predicted, the raw points, whether
-- it was exact, whether it was a correct result, and the scoreline error. A
-- season source can produce all six without a tournament column existing.
--
-- BEHAVIOUR IS UNCHANGED, and the signature is untouched: `cup_window_scores`
-- has sixteen call sites across the two Cup migrations and every one of them
-- keeps working without edit. The details preserved on purpose, because a
-- reimplementation loses them first:
--
--   * the exact-score branch is tested BEFORE the correct-result branch.
--     Reversed, every exact score silently becomes a 3 and the totals stay
--     plausible;
--   * an unconfirmed fixture scores nothing and contributes NO scoreline
--     error — it is not a miss, it simply has not happened;
--   * a missing prediction on a CONFIRMED fixture contributes 999 to the
--     scoreline error. That sentinel makes non-entrants sort last on the
--     tie-break; a zero would sort them ahead of everyone who actually played;
--   * `submitted` is true when the member predicted ANY fixture in the window,
--     confirmed or not;
--   * members are cross-joined against fixtures, so a member who predicted
--     nothing still returns a row of zeros rather than disappearing.
--
-- Evidence: `supabase/tests/127_cup_neutral_points_source.sql` runs the branch
-- table against a real database, and the change was developed against a
-- differential harness that ran the old and new implementations side by side
-- over 300 randomised scenarios with zero mismatches. Removing the 999
-- sentinel from the new source made 48 of 50 scenarios diverge, so the harness
-- was not passing vacuously.

-- ---------------------------------------------------------------------------
-- The tournament points source. Everything tournament-shaped lives here now.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_tournament_fixture_points(
  p_competition_id uuid,
  p_window_id uuid
)
returns table (
  user_id uuid,
  match_id uuid,
  confirmed boolean,
  has_prediction boolean,
  points integer,
  is_exact boolean,
  is_correct boolean,
  scoreline_error integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with fixtures as (
    select
      m.id as match_id,
      m.round,
      case when m.round = 'group' then m.home_score else m.home_score_90 end as actual_home,
      case when m.round = 'group' then m.away_score else m.away_score_90 end as actual_away,
      m.result_state in ('confirmed', 'corrected') as confirmed
    from public.bonus_window_fixtures f
    join public.matches m on m.id = f.match_id
    where f.window_id = p_window_id
  ),
  member_predictions as (
    select
      member.user_id,
      fixture.match_id,
      fixture.confirmed,
      fixture.actual_home,
      fixture.actual_away,
      coalesce(original.home_score, shared.home_score) as predicted_home,
      coalesce(original.away_score, shared.away_score) as predicted_away
    from public.bonus_cup_members member
    cross join fixtures fixture
    left join public.entries entry
      on fixture.round = 'group'
      and entry.user_id = member.user_id
      and entry.tournament_id = (
        select c.tournament_id from public.bonus_competitions c
        where c.id = p_competition_id
      )
    left join public.match_predictions original
      on original.entry_id = entry.id and original.match_id = fixture.match_id
    left join public.bonus_knockout_predictions shared
      on fixture.round <> 'group'
      and shared.user_id = member.user_id
      and shared.match_id = fixture.match_id
    where member.competition_id = p_competition_id
  )
  select
    mp.user_id,
    mp.match_id,
    mp.confirmed,
    mp.predicted_home is not null as has_prediction,
    (case
      when not mp.confirmed or mp.predicted_home is null then 0
      when mp.predicted_home = mp.actual_home
        and mp.predicted_away = mp.actual_away then 5
      when sign(mp.predicted_home - mp.predicted_away)
        = sign(mp.actual_home - mp.actual_away) then 3
      else 0
    end)::integer as points,
    coalesce(
      mp.confirmed
        and mp.predicted_home = mp.actual_home
        and mp.predicted_away = mp.actual_away, false) as is_exact,
    (case
      when not mp.confirmed or mp.predicted_home is null then false
      when mp.predicted_home = mp.actual_home
        and mp.predicted_away = mp.actual_away then false
      when sign(mp.predicted_home - mp.predicted_away)
        = sign(mp.actual_home - mp.actual_away) then true
      else false
    end) as is_correct,
    (case
      when not mp.confirmed then 0
      when mp.predicted_home is null then 999
      else abs(mp.predicted_home - mp.actual_home)
        + abs(mp.predicted_away - mp.actual_away)
    end)::integer as scoreline_error
  from member_predictions mp
$$;

revoke all on function predictor_internal.cup_tournament_fixture_points(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The shared arithmetic. No tournament relation appears below this line — that
-- is the whole point, and `cupPointsSourceBoundary.test.ts` asserts it.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_window_scores(
  p_competition_id uuid,
  p_window_id uuid
)
returns table (
  user_id uuid,
  points integer,
  exacts integer,
  corrects integer,
  scoreline_error integer,
  submitted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    source.user_id,
    coalesce(sum(source.points), 0)::integer as points,
    coalesce(sum(case when source.is_exact then 1 else 0 end), 0)::integer as exacts,
    coalesce(sum(case when source.is_correct then 1 else 0 end), 0)::integer as corrects,
    coalesce(sum(source.scoreline_error), 0)::integer as scoreline_error,
    bool_or(source.has_prediction) as submitted
  from predictor_internal.cup_tournament_fixture_points(p_competition_id, p_window_id) source
  group by source.user_id
$$;

revoke all on function predictor_internal.cup_window_scores(uuid, uuid)
  from public, anon, authenticated;
