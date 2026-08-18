-- Contract 192: where a weekly player HAS BEEN, and how they compare with one
-- rival across a whole season.
--
-- ---------------------------------------------------------------------------
-- TWO GAPS, MEASURED ON CONTRACT 191
-- ---------------------------------------------------------------------------
--
-- **There is no rank over time.** `get_season_league_rank_movement` (contract
-- 150) answers "5th → 3rd" for ONE matchweek inside ONE private league, and
-- `get_h2h_rank_history` (contract 48) is the tournament's, keyed on seven
-- hard-coded matchday keys and reading `entry_totals`, which a season never
-- writes. So a season could produce POINTS over time — every banked matchweek
-- is in `season_matchweek_scores` — and could not produce POSITION over time
-- for the season itself. Those are different sentences: a player who scores
-- steadily while the field scores faster is climbing on one chart and falling
-- on the other, and the falling one is the true one.
--
-- **There is no season-long head-to-head.** `get_season_head_to_head` (contract
-- 129) compares two players over ONE matchweek and returns their fixtures and
-- picks. It is the right read for "what did we each predict last Saturday" and
-- cannot answer "how do we compare" — no cumulative record, no rivalry totals,
-- no gap, and nothing at all without naming a matchweek. Asking it thirty-eight
-- times is the browser loop this contract exists to prevent.
--
-- ---------------------------------------------------------------------------
-- ONE RANKING INTERPRETATION, NOT TWO
-- ---------------------------------------------------------------------------
--
-- `predictor_internal.season_rank_history` is the only new derivation here, and
-- its ordering is contract 94's, character for character:
--
--     rank() over (order by points desc)
--
-- partitioned by matchweek, because the question is per matchweek. `rank`
-- rather than `row_number` or `dense_rank`, so equal totals share a rank and
-- the next rank SKIPS, exactly as `season_standings` does — `dense_rank` would
-- give 1, 2, 2, 3 where the authority gives 1, 2, 2, 4.
--
-- THE PROPERTY THAT MAKES THAT CHECKABLE RATHER THAN MERELY CLAIMED: at the
-- LAST settled matchweek the cumulative total is the season total, so the rank
-- this function reports must equal the rank `season_standings` reports for the
-- same entry. `240_season_rank_history_and_rivalry.sql` runs both authorities
-- and requires them to agree, entry by entry, rather than comparing two
-- `order by` clauses by eye. Copying an ordering is not evidence that it was
-- copied correctly; running both is.
--
-- THE FIELD IS EVERY ENTRY IN THE SEASON, and that is a deliberate choice with
-- a visible cost. `season_standings` LEFT-joins from `public.entries`, so a
-- player who has banked nothing is on 0 from 0 rather than missing from their
-- own table — and this reuses that field unchanged. The consequence is that
-- somebody who joined at matchweek 10 appears in the field at matchweek 3 on
-- zero points. The alternative — excluding an entry from matchweeks before it
-- existed — is a SECOND interpretation of who is in the table, and it would
-- make this function disagree with the standings it is measured against. The
-- honest answer is to reuse the canonical field and report `matchweeksPlayed`
-- beside it, which is what ADR 0012 pairs with points for exactly this reason.
--
-- ---------------------------------------------------------------------------
-- WHAT MAY BE REVEALED, AND WHEN
-- ---------------------------------------------------------------------------
--
-- **Rank history exposes no prediction at all.** It carries a matchweek, a
-- cumulative total and a position. Every one of those is already visible to
-- every entrant of the season through `get_season_leaderboard`, and contract
-- 122's period standings already publish banked totals over spans. The reach
-- boundary is still applied — contract 191's authority, `compare` or better —
-- and only SETTLED matchweeks appear, so there is no in-flight total to read a
-- pick out of.
--
-- **The rivalry read is stricter, and deliberately stricter than it needs to
-- be.** A matchweek is compared only when it is SETTLED *and*
-- `predictor_internal.season_matchweek_lock_at` says it has locked. Settlement
-- already implies the fixtures were played, so the lock test refuses almost
-- nothing — but that function returns NULL when a round's kickoff list is
-- incomplete, and contract 129 chose to treat NULL as NOT REVEALED. Reusing
-- that choice costs a settled matchweek in an unpublished calendar and buys
-- the property that these two comparison reads can never disagree about
-- whether a matchweek is open.
--
-- No individual prediction is returned by either function. The exact-score and
-- correct-outcome COUNTS are contract 151's derivation, over compared
-- matchweeks only; counting how often a prediction matched a result is a fact
-- about predictions rather than an award of points, and no point value is
-- computed anywhere here.
--
-- ---------------------------------------------------------------------------
-- A MATCHWEEK THE OPPONENT COULD NOT PLAY IS NOT A WIN
-- ---------------------------------------------------------------------------
--
-- The head-to-head record counts a matchweek only when BOTH players have a
-- banked score for it. The easy implementation folds a missing row to zero and
-- awards the matchweek, which manufactures a 12–0 rivalry record against
-- somebody who joined in February. `matchweeksCompared` is returned beside the
-- record so the number is never read without its denominator.
--
-- ---------------------------------------------------------------------------
-- BOUNDED
-- ---------------------------------------------------------------------------
--
-- One request answers the whole comparison. `recent` is clamped to 20 and the
-- history to 60 matchweeks — both above any real season calendar, so they
-- truncate nothing today and cannot become unbounded if one grows. Neither
-- function is called per row by anything, and neither takes a page.
--
-- Nothing is written. No score, settlement, standing, rank or prediction.

begin;

-- ---------------------------------------------------------------------------
-- Position over time. The one new derivation.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_rank_history(
  p_tournament_id uuid
)
returns table (
  entry_id uuid,
  competition_round_id uuid,
  ordinal integer,
  label text,
  points integer,
  standing_rank integer,
  field_size integer
)
language sql
stable
security definer
set search_path = ''
as $history$
  with settled as (
    -- A banked row IS a settlement: `season_matchweek_scores.settled_at` is
    -- NOT NULL and `settle_season_matchweek_scores` is what writes the row in
    -- the first place, so the presence of rows for a round is the gate and
    -- there is no half-scored row to filter out. Contract 150 measured this
    -- and it is reused rather than re-derived.
    select round.id as round_id, round.ordinal, round.label
      from public.competition_rounds round
     where round.tournament_id = p_tournament_id
       and exists (
         select 1
           from public.season_matchweek_scores score
          where score.competition_round_id = round.id
            and score.tournament_id = p_tournament_id)
  ),
  field as (
    -- Contract 94's field, unchanged. See the header for why a late joiner is
    -- in it from the first matchweek rather than excluded from the ones they
    -- could not play.
    select entry.id as entry_id
      from public.entries entry
     where entry.tournament_id = p_tournament_id
  ),
  cumulative as (
    select
      field.entry_id,
      settled.round_id,
      settled.ordinal,
      settled.label,
      -- Ordered by ORDINAL rather than by `settled_at`, for contract 150's
      -- reason: a postponed matchweek settles late and would otherwise appear
      -- to come after matchweeks that were played later. A matchweek keeps its
      -- number.
      sum(coalesce(score.points, 0)) over (
        partition by field.entry_id
        order by settled.ordinal
        rows between unbounded preceding and current row
      )::integer as points
    from field
    cross join settled
    -- LEFT, so a settled matchweek this entry banked nothing for carries the
    -- running total forward rather than dropping the row and skipping a point
    -- on the chart.
    left join public.season_matchweek_scores score
      on score.entry_id = field.entry_id
     and score.competition_round_id = settled.round_id
     and score.tournament_id = p_tournament_id
  )
  select
    cumulative.entry_id,
    cumulative.round_id,
    cumulative.ordinal,
    cumulative.label,
    cumulative.points,
    -- Contract 94's ordering, per matchweek. `rank`, so equal totals share a
    -- rank and the next rank skips.
    rank() over (
      partition by cumulative.ordinal order by cumulative.points desc
    )::integer,
    count(*) over (partition by cumulative.ordinal)::integer
  from cumulative;
$history$;

comment on function predictor_internal.season_rank_history(uuid) is
  'Contract 192. Cumulative points, rank and field size at every SETTLED '
  'matchweek of a competition season. The ranking expression is contract 94''s '
  'and the field is contract 94''s; at the last settled matchweek this must '
  'agree with predictor_internal.season_standings entry for entry, and the '
  'pgTAP suite runs both rather than comparing their order-by clauses by eye.';

revoke all on function predictor_internal.season_rank_history(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Which matchweeks a comparison may speak about.
--
-- Settled AND revealed, with contract 129's treatment of a null lock. Written
-- once and used by the rivalry read for both players, because the two columns
-- of a head-to-head must be built from the same set of matchweeks — a copied
-- block that diverged by one round would show a rivalry record neither player
-- could reproduce.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_revealed_settled_rounds(
  p_tournament_id uuid
)
returns table (
  competition_round_id uuid,
  ordinal integer,
  label text
)
language sql
stable
security definer
set search_path = ''
as $rounds$
  select round.id, round.ordinal, round.label
    from public.competition_rounds round
   where round.tournament_id = p_tournament_id
     and exists (
       select 1
         from public.season_matchweek_scores score
        where score.competition_round_id = round.id
          and score.tournament_id = p_tournament_id)
     -- Contract 129's boundary, and its asymmetry: a NULL lock hides rather
     -- than reveals. Settlement already implies the fixtures were played, so
     -- this refuses almost nothing — it buys the property that the two
     -- comparison reads can never disagree about whether a matchweek is open.
     and predictor_internal.season_matchweek_lock_at(
           p_tournament_id,
           round.id,
           coalesce((
             select definition.buffer_minutes
               from public.game_definitions definition
              where definition.game_key = 'main_predictor'), 0)
         ) <= now();
$rounds$;

comment on function predictor_internal.season_revealed_settled_rounds(uuid) is
  'Contract 192. The matchweeks a season comparison may speak about: settled, '
  'and past their own lock by contract 129''s authority, which hides on a null '
  'lock rather than revealing.';

revoke all on function predictor_internal.season_revealed_settled_rounds(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Position over time, for one player.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_rank_history(
  p_tournament_id uuid,
  p_player_ref uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $read$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_entry uuid;
  v_player uuid;
  v_reach text;
  v_display text;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null or v_kind <> 'league_season' then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  -- Contract 95's boundary, in contract 95's order: established before any
  -- name is read, so the refusing path touches no display name.
  if not exists (
    select 1 from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  -- No reference means the caller's own history, which is the common case and
  -- saves a surface having to look up its own address to ask about itself.
  if p_player_ref is null then
    select entry.id, entry.user_id into v_entry, v_player
      from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid;
  else
    select entry.id, entry.user_id into v_entry, v_player
      from public.entries entry
     where entry.id = p_player_ref
       and entry.tournament_id = p_tournament_id;
  end if;

  if v_entry is null then
    raise exception 'That player is not in this competition season'
      using errcode = 'no_data_found';
  end if;

  -- Contract 191's authority. `compare` is enough here and nowhere weaker than
  -- what a season entrant can already read: a matchweek, a cumulative total
  -- and a position are exactly what `get_season_leaderboard` already shows
  -- every entrant, and no prediction appears in this payload at all.
  v_reach := predictor_internal.season_player_reach(p_tournament_id, v_uid, v_player);
  if v_reach = 'none' then
    raise exception 'You may not view that player' using errcode = '42501';
  end if;

  select profile.display_name into v_display
    from public.profiles profile where profile.id = v_player;

  return jsonb_build_object(
    'playerRef', v_entry,
    'reach', v_reach,
    'displayName', v_display,
    'playerId', case when v_reach in ('self', 'profile') then to_jsonb(v_player) end,
    'server_now', now(),
    'matchweeks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'matchweekId', history.competition_round_id,
          'ordinal', history.ordinal,
          'label', history.label,
          'points', history.points,
          -- The whole reason this read exists. Points over time is derivable
          -- from the matchweek scores; POSITION over time is not.
          'rank', history.standing_rank,
          -- Rank never travels without its field, which is already true of
          -- every other rank surface on the platform.
          'fieldSize', history.field_size)
        order by history.ordinal)
      from (
        select * from predictor_internal.season_rank_history(p_tournament_id) row
         where row.entry_id = v_entry
         order by row.ordinal
         -- Above any real season calendar, so it truncates nothing today and
         -- cannot become unbounded if one grows.
         limit 60) history), '[]'::jsonb));
end;
$read$;

revoke all on function public.get_season_rank_history(uuid, uuid) from public, anon;
grant execute on function public.get_season_rank_history(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- One season, two players, one request.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_rivalry(
  p_tournament_id uuid,
  p_opponent_ref uuid,
  p_recent integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $rivalry$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_entry uuid;
  v_opponent_entry uuid;
  v_opponent uuid;
  v_reach text;
  v_recent integer;
  v_standings jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null or p_opponent_ref is null then
    raise exception 'A competition season and an opponent are required'
      using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null or v_kind <> 'league_season' then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  select entry.id into v_entry
    from public.entries entry
   where entry.tournament_id = p_tournament_id
     and entry.user_id = v_uid;

  if v_entry is null then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  select entry.id, entry.user_id into v_opponent_entry, v_opponent
    from public.entries entry
   where entry.id = p_opponent_ref
     and entry.tournament_id = p_tournament_id;

  if v_opponent_entry is null then
    raise exception 'That player is not in this competition season'
      using errcode = 'no_data_found';
  end if;

  -- Contract 129's refusal, reused: the answer is meaningless and would render
  -- one column twice.
  if v_opponent_entry = v_entry then
    raise exception 'You cannot compare yourself with yourself'
      using errcode = '22023';
  end if;

  -- Contract 191's authority. The permission rule is here rather than in React,
  -- which is the whole point of it being a server contract.
  v_reach := predictor_internal.season_player_reach(p_tournament_id, v_uid, v_opponent);
  if v_reach = 'none' then
    raise exception 'You may not compare with that player' using errcode = '42501';
  end if;

  v_recent := least(greatest(coalesce(p_recent, 5), 1), 20);

  -- Season totals come from the authority the season, the leagues and the
  -- profile all read, so four surfaces cannot disagree about what a player
  -- scored. Nothing is recomputed.
  v_standings := predictor_internal.season_standings(p_tournament_id);

  return (
    with compared as (
      -- Settled, revealed, and banked BY BOTH. See the header: a matchweek the
      -- opponent could not play is not a win.
      select revealed.competition_round_id, revealed.ordinal, revealed.label,
             mine.points as your_points, theirs.points as their_points
        from predictor_internal.season_revealed_settled_rounds(p_tournament_id) revealed
        join public.season_matchweek_scores mine
          on mine.competition_round_id = revealed.competition_round_id
         and mine.entry_id = v_entry
        join public.season_matchweek_scores theirs
          on theirs.competition_round_id = revealed.competition_round_id
         and theirs.entry_id = v_opponent_entry
    ),
    standing as (
      select
        (row ->> 'entryId')::uuid as entry_id,
        (row ->> 'rank')::integer as standing_rank,
        (row ->> 'points')::integer as points,
        (row ->> 'matchweeksPlayed')::integer as matchweeks_played,
        count(*) over ()::integer as field_size
      from jsonb_array_elements(coalesce(v_standings, '[]'::jsonb)) row
    ),
    accuracy as (
      -- Contract 151's derivation, over the COMPARED matchweeks only and for
      -- both players identically. Counting how often a prediction matched a
      -- result is a fact about predictions; no point value appears here.
      select
        prediction.entry_id,
        count(*)::integer as fixtures_predicted,
        count(*) filter (
          where fixture.home_score = prediction.home_score
            and fixture.away_score = prediction.away_score)::integer as exact_scores,
        count(*) filter (
          where sign(fixture.home_score - fixture.away_score)
              = sign(prediction.home_score - prediction.away_score))::integer as correct_outcomes
      from public.season_predictions prediction
      join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
      where prediction.entry_id in (v_entry, v_opponent_entry)
        and fixture.status = 'played'
        and fixture.competition_round_id in (
          select compared.competition_round_id from compared)
      group by prediction.entry_id
    ),
    side as (
      select
        person.entry_id,
        person.user_id,
        profile.display_name,
        standing.standing_rank,
        standing.points,
        standing.matchweeks_played,
        standing.field_size,
        coalesce(accuracy.fixtures_predicted, 0) as fixtures_predicted,
        coalesce(accuracy.exact_scores, 0) as exact_scores,
        coalesce(accuracy.correct_outcomes, 0) as correct_outcomes
      from (values (v_entry, v_uid), (v_opponent_entry, v_opponent))
             as person(entry_id, user_id)
      join public.profiles profile on profile.id = person.user_id
      left join standing on standing.entry_id = person.entry_id
      left join accuracy on accuracy.entry_id = person.entry_id
    )
    select jsonb_build_object(
      'server_now', now(),
      -- Stated rather than left to be counted off the `recent` array, which is
      -- truncated. A record without its denominator is the misleading half.
      'matchweeksCompared', (select count(*)::integer from compared),
      'you', (
        select jsonb_build_object(
          'playerRef', side.entry_id,
          'displayName', side.display_name,
          'reach', 'self',
          'playerId', to_jsonb(side.user_id),
          'points', coalesce(side.points, 0),
          'rank', side.standing_rank,
          'fieldSize', side.field_size,
          'matchweeksPlayed', coalesce(side.matchweeks_played, 0),
          'exactScores', side.exact_scores,
          'correctOutcomes', side.correct_outcomes,
          'fixturesCompared', side.fixtures_predicted)
        from side where side.entry_id = v_entry),
      'opponent', (
        select jsonb_build_object(
          'playerRef', side.entry_id,
          'displayName', side.display_name,
          'reach', v_reach,
          -- Contract 191's rule, unchanged: the auth identifier only where a
          -- profile will answer.
          'playerId', case when v_reach in ('self', 'profile')
                           then to_jsonb(side.user_id) end,
          'points', coalesce(side.points, 0),
          'rank', side.standing_rank,
          'fieldSize', side.field_size,
          'matchweeksPlayed', coalesce(side.matchweeks_played, 0),
          'exactScores', side.exact_scores,
          'correctOutcomes', side.correct_outcomes,
          'fixturesCompared', side.fixtures_predicted)
        from side where side.entry_id = v_opponent_entry),
      -- Signed and stated in one direction, so a caller never has to work out
      -- which way round it is: positive means the opponent is ahead.
      'pointsGap', coalesce(
        (select side.points from side where side.entry_id = v_opponent_entry), 0)
        - coalesce(
        (select side.points from side where side.entry_id = v_entry), 0),
      'record', jsonb_build_object(
        'yourWins', (select count(*) filter (
          where compared.your_points > compared.their_points)::integer from compared),
        'theirWins', (select count(*) filter (
          where compared.their_points > compared.your_points)::integer from compared),
        'draws', (select count(*) filter (
          where compared.your_points = compared.their_points)::integer from compared)),
      'recent', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'matchweekId', recent.competition_round_id,
            'ordinal', recent.ordinal,
            'label', recent.label,
            'yourPoints', recent.your_points,
            'theirPoints', recent.their_points,
            'outcome', case
              when recent.your_points > recent.their_points then 'you'
              when recent.their_points > recent.your_points then 'them'
              else 'level' end)
          order by recent.ordinal desc)
        from (
          select * from compared order by compared.ordinal desc limit v_recent
        ) recent), '[]'::jsonb))
  );
end;
$rivalry$;

revoke all on function public.get_season_rivalry(uuid, uuid, integer) from public, anon;
grant execute on function public.get_season_rivalry(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_history text := pg_get_functiondef(
    'predictor_internal.season_rank_history(uuid)'::regprocedure);
  v_read text := pg_get_functiondef(
    'public.get_season_rank_history(uuid, uuid)'::regprocedure);
  v_rivalry text := pg_get_functiondef(
    'public.get_season_rivalry(uuid, uuid, integer)'::regprocedure);
  v_rounds text := pg_get_functiondef(
    'predictor_internal.season_revealed_settled_rounds(uuid)'::regprocedure);
begin
  -- Contract 191's authority is still the only one deciding who may be seen.
  perform predictor_internal.assert_single_season_player_visibility_authority();

  -- ONE ranking interpretation. `rank`, not `row_number` and not `dense_rank`.
  if v_history !~ 'rank\(\) over \(\s*partition by cumulative.ordinal order by cumulative.points desc' then
    raise exception 'Rank history must reuse contract 94''s ranking expression';
  end if;

  if v_history ~ 'dense_rank\(\)' then
    raise exception 'Rank history must not introduce a second tie interpretation';
  end if;

  -- The field is contract 94's, read from `public.entries` rather than from the
  -- score rows. Deriving it from who has scored would silently shrink the field
  -- in early matchweeks and inflate everybody's position.
  if v_history !~ 'from public.entries entry' then
    raise exception 'Rank history must rank over the season''s whole field';
  end if;

  -- Ordered by ordinal, never by settlement time: a postponed matchweek keeps
  -- its number.
  if v_history !~ 'order by settled.ordinal' or v_history ~ 'order by [a-z_]*\.settled_at' then
    raise exception 'Rank history must accumulate by matchweek number, not by settlement time';
  end if;

  -- Both reads take their permission from contract 191 rather than restating it.
  if v_read !~ 'season_player_reach' or v_rivalry !~ 'season_player_reach' then
    raise exception 'Both reads must take their boundary from the visibility authority';
  end if;

  if v_read !~ 'v_reach = ''none''' or v_rivalry !~ 'v_reach = ''none''' then
    raise exception 'Both reads must refuse a viewer with no permitted reach';
  end if;

  -- The rivalry read hides on a null lock, through contract 129's authority.
  if v_rounds !~ 'season_matchweek_lock_at' then
    raise exception 'A comparison must derive its reveal from the matchweek lock authority';
  end if;

  if v_rivalry ~ 'p_now|p_as_of' or v_read ~ 'p_now|p_as_of' then
    raise exception 'A reveal boundary must not accept a client-supplied time';
  end if;

  -- The head-to-head record is INNER-joined to both players' banked rows. A
  -- LEFT join here is the defect that manufactures a 12-0 record against
  -- somebody who joined in February, and it reads almost identically.
  if v_rivalry ~ 'left join public.season_matchweek_scores' then
    raise exception 'A matchweek only one player banked must not count as a win';
  end if;

  -- Neither read returns an individual prediction. The counts are aggregates.
  if v_rivalry ~ '''your_prediction''|''their_prediction''|jsonb_object_agg\(\s*prediction' then
    raise exception 'The rivalry read must not return individual predictions';
  end if;

  -- Bounded, and by a literal rather than by a caller's number.
  if v_read !~ 'limit 60' then
    raise exception 'Rank history must be bounded';
  end if;

  if v_rivalry !~ 'least\(greatest\(coalesce\(p_recent, 5\), 1\), 20\)' then
    raise exception 'The recent window must be clamped rather than trusted';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name in ('get_season_rank_history', 'get_season_rivalry')
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'No season comparison read may be executable anonymously';
  end if;
end;
$$;

commit;
