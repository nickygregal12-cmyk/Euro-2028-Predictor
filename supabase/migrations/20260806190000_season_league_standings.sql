-- Contract 128: a season league has a standings table of its own.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED
-- ---------------------------------------------------------------------------
--
-- `get_league_members` is the private-league standings read, and every fact in
-- it is the tournament shape:
--
--   standing_metrics(v_tournament)   reads score_events, matches, match_predictions
--   v_final                          "is every tournament fixture confirmed"
--   predicted_count                  counts match_predictions
--
-- A competition season writes none of those. Its points are banked per
-- matchweek in `season_matchweek_scores`, and on hosted development the two
-- league seasons hold 0 rows in `score_events` and 0 in `matches` against 380
-- and 198 `season_fixtures`. So a league on a season returned EVERY MEMBER ON
-- ZERO, ranked alphabetically, with no error anywhere.
--
-- Leagues are already season-capable: contract 66 gave `public.leagues` a
-- `game_competition_id` and backfilled a league season to its `main_predictor`
-- availability, and `create_game_league` accepts any game competition. So this
-- is not a surface that does not exist yet — it is one that answers wrongly.
-- Sixth instance of the contract 86/98/116/118/120 shape: a read written for
-- what existed, never widened, failing silently rather than erroring.
--
-- ---------------------------------------------------------------------------
-- A NEW READ RATHER THAN A WIDENED ONE
-- ---------------------------------------------------------------------------
--
-- Contract 118 widened `get_bonus_games` in place because the two competition
-- kinds answered the same question with different sources. This does not,
-- because they do not answer the same question. The tournament table carries
-- exact scores, correct outcomes, correct knockout teams, the champion and a
-- group-goals tie-break — the five ADR-approved final tie-breakers. A season
-- has none of them. ADR 0012 ranks a season on cumulative points and pairs the
-- total with matchweeks played, because two players on 84 from 22 and 23
-- matchweeks are not tied in meaning.
--
-- Returning empty columns for five metrics a season does not have would be the
-- same defect in the opposite direction.
--
-- ---------------------------------------------------------------------------
-- AND THE OLD READ REFUSES
-- ---------------------------------------------------------------------------
--
-- Adding the season read is only half the fix while the wrong one stays
-- reachable for the same league. `get_league_members` is redefined from its own
-- committed text with ONE guard inserted — verified by diff rather than by
-- reading, the method contract 118 established after contract 114 silently
-- reverted contract 104 — and it refuses a season league by naming the read
-- that answers.
--
-- ---------------------------------------------------------------------------
-- WHAT IS TAKEN FROM THE AUTHORITY AND WHAT IS COMPUTED HERE
-- ---------------------------------------------------------------------------
--
-- Points and matchweeks played come from `predictor_internal.season_standings`,
-- the same function `get_season_leaderboard` reads, so a league total can never
-- disagree with the season total for the same player.
--
-- The RANK is recomputed inside the league, and that is deliberate. A private
-- league is its own table: its leader is its best member, not "47th in the
-- season". `get_league_members` has always done this for the tournament, using
-- `rank()` so equal totals share a rank and the next rank skips — the same
-- standard competition ranking `season_standings` applies season-wide.
--
-- A member with no entry is listed on zero rather than omitted, matching both
-- `get_league_members` and `season_standings`' own LEFT join: a player who has
-- joined the league belongs in its table whether or not they have played.
--
-- Rank is shown even when everyone is level, unlike the tournament read which
-- hides it until a total separates them. That is the season authority's
-- behaviour, not a new decision — `get_season_leaderboard` returns rank 1 for a
-- season nobody has scored in, because on ADR 0012's cumulative rule they are
-- genuinely all level rather than unranked.
--
-- No score, settlement or standing is written. This is a read.

begin;

-- ---------------------------------------------------------------------------
-- The tournament read, refusing the competition kind it cannot answer for.
-- ---------------------------------------------------------------------------

create or replace function public.get_league_members(
  p_league_id uuid,
  p_limit integer default 50,
  p_after text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tournament uuid;
  v_limit integer;
  v_cursor jsonb;
  v_after_position integer;
  v_cursor_final boolean;
  v_final boolean;
  v_result jsonb;
begin
  if p_league_id is null then
    raise exception 'League is required' using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select league.tournament_id
    into v_tournament
  from public.leagues league
  where league.id = p_league_id;

  if v_tournament is null then
    raise exception 'League not found' using errcode = 'no_data_found';
  end if;

  -- Contract 128. Everything below this line is the tournament shape: the
  -- metrics come from `standing_metrics`, which reads `score_events`,
  -- `matches` and `match_predictions`, and `v_final` asks whether every
  -- tournament fixture is confirmed. A competition season writes none of
  -- those — its points live in `season_matchweek_scores` — so a season league
  -- returned every member on zero, in alphabetical order, with no error.
  --
  -- Refusing is the correction. A fabricated all-zero standings table is the
  -- defect contracts 116, 118 and 120 exist to kill, and it is worse here than
  -- an error because it looks like a real answer. The message names the read
  -- that does answer.
  if (
    select season.kind from public.tournaments season where season.id = v_tournament
  ) = 'league_season' then
    raise exception
      'This league belongs to a competition season; its standings come from get_season_league_standings'
      using errcode = '23514';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'League standings page size must be at least 1' using errcode = '22023';
  else
    v_limit := least(p_limit, 100);
  end if;

  select count(*) > 0
     and count(*) = count(*) filter (
       where match.result_state in ('confirmed', 'corrected')
     )
    into v_final
  from public.matches match
  where match.tournament_id = v_tournament;

  if p_after is not null and btrim(p_after) <> '' then
    begin
      v_cursor := convert_from(decode(p_after, 'hex'), 'UTF8')::jsonb;
      v_after_position := (v_cursor ->> 'position')::integer;
      v_cursor_final := (v_cursor ->> 'final')::boolean;
    exception when others then
      raise exception 'Invalid league standings cursor' using errcode = '22023';
    end;

    if v_after_position is null
       or v_after_position < 1
       or v_cursor_final is null
       or v_cursor_final is distinct from v_final
    then
      raise exception 'Invalid league standings cursor' using errcode = '22023';
    end if;
  end if;

  with prediction_counts as (
    select prediction.entry_id, count(*)::integer as predicted_count
    from public.match_predictions prediction
    group by prediction.entry_id
  ),
  base as (
    select
      membership.user_id,
      profile.display_name,
      lower(profile.display_name) collate "C" as sort_name,
      md5(membership.user_id::text) as member_key,
      coalesce(metric.total_points, 0)::integer as total_points,
      coalesce(metric.exact_scores, 0)::integer as exact_scores,
      coalesce(metric.correct_outcomes, 0)::integer as correct_outcomes,
      coalesce(metric.correct_knockout_teams, 0)::integer as correct_knockout_teams,
      coalesce(metric.correct_champion, false) as correct_champion,
      metric.total_goals_diff,
      (membership.role = 'owner') as is_owner,
      (entry.submitted_at is not null) as has_entry,
      coalesce(predictions.predicted_count, 0)::integer as predicted_count,
      membership.joined_at
    from public.league_members membership
    join public.profiles profile on profile.id = membership.user_id
    left join public.entries entry
      on entry.user_id = membership.user_id
     and entry.tournament_id = v_tournament
    left join predictor_internal.standing_metrics(v_tournament) metric
      on metric.user_id = membership.user_id
    left join prediction_counts predictions on predictions.entry_id = entry.id
    where membership.league_id = p_league_id
  ),
  summary as (
    select
      count(*)::integer as total_count,
      count(distinct member.total_points)::integer as distinct_totals
    from base member
  ),
  ranked as (
    select
      member.*,
      summary.total_count,
      summary.distinct_totals,
      row_number() over (
        order by
          member.total_points desc,
          case when v_final then member.exact_scores end desc nulls last,
          case when v_final then member.correct_outcomes end desc nulls last,
          case when v_final then member.correct_knockout_teams end desc nulls last,
          case when v_final then member.correct_champion::integer end desc nulls last,
          case when v_final then member.total_goals_diff end asc nulls last,
          member.sort_name,
          member.display_name collate "C",
          member.member_key
      )::integer as position,
      rank() over (
        order by
          member.total_points desc,
          case when v_final then member.exact_scores end desc nulls last,
          case when v_final then member.correct_outcomes end desc nulls last,
          case when v_final then member.correct_knockout_teams end desc nulls last,
          case when v_final then member.correct_champion::integer end desc nulls last,
          case when v_final then member.total_goals_diff end asc nulls last
      )::integer as standard_rank,
      count(*) over (
        partition by
          member.total_points,
          case when v_final then member.exact_scores end,
          case when v_final then member.correct_outcomes end,
          case when v_final then member.correct_knockout_teams end,
          case when v_final then member.correct_champion end,
          case when v_final then member.total_goals_diff end
      )::integer as same_rank_count
    from base member
    cross join summary
  ),
  candidates as (
    select ranked_member.*
    from ranked ranked_member
    where v_after_position is null or ranked_member.position > v_after_position
    order by ranked_member.position
    limit v_limit + 1
  ),
  page_rows as (
    select candidate.*
    from candidates candidate
    order by candidate.position
    limit v_limit
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'userId', row.user_id,
          'displayName', row.display_name,
          'totalPoints', row.total_points,
          'rank', case
            when not v_final and row.distinct_totals <= 1 then null
            else row.standard_rank
          end,
          'tied', row.same_rank_count > 1
            and (v_final or row.distinct_totals > 1),
          'position', row.position,
          'isYou', row.user_id = v_uid,
          'isOwner', row.is_owner,
          'hasEntry', row.has_entry,
          'predictedCount', row.predicted_count,
          'joinedAt', row.joined_at
        )
        order by row.position
      )
      from page_rows row
    ), '[]'::jsonb),
    'totalCount', summary.total_count,
    'pageSize', v_limit,
    'hasMore', (select count(*) from candidates) > v_limit,
    'nextCursor', case
      when (select count(*) from candidates) > v_limit then (
        select encode(
          convert_to(
            jsonb_build_object(
              'position', row.position,
              'final', v_final
            )::text,
            'UTF8'
          ),
          'hex'
        )
        from page_rows row
        order by row.position desc
        limit 1
      )
      else null
    end,
    'finalStandings', v_final,
    'you', (
      select jsonb_build_object(
        'userId', row.user_id,
        'displayName', row.display_name,
        'totalPoints', row.total_points,
        'rank', case
          when not v_final and row.distinct_totals <= 1 then null
          else row.standard_rank
        end,
        'tied', row.same_rank_count > 1
          and (v_final or row.distinct_totals > 1),
        'position', row.position,
        'isOwner', row.is_owner,
        'hasEntry', row.has_entry,
        'predictedCount', row.predicted_count,
        'joinedAt', row.joined_at
      )
      from ranked row
      where row.user_id = v_uid
      limit 1
    )
  )
    into v_result
  from summary;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- The season league's own table.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_league_standings(
  p_league_id uuid,
  p_limit integer default 50,
  p_after text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $season$
declare
  v_uid uuid := (select auth.uid());
  v_tournament uuid;
  v_kind text;
  v_limit integer;
  v_cursor jsonb;
  v_after_position integer;
  v_standings jsonb;
begin
  if p_league_id is null then
    raise exception 'League is required' using errcode = '22023';
  end if;

  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- The boundary, and it is league membership rather than game entry. A league
  -- member who has not entered the game still sees their league's table; that
  -- is what `get_league_members` has always done, and the alternative would
  -- hide a league from the person who created it.
  if not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select league.tournament_id, season.kind
    into v_tournament, v_kind
  from public.leagues league
  join public.tournaments season on season.id = league.tournament_id
  where league.id = p_league_id;

  if v_tournament is null then
    raise exception 'League not found' using errcode = 'no_data_found';
  end if;

  -- The mirror of the refusal added to `get_league_members` above. Neither read
  -- answers for the other's competition kind, so a caller that picks the wrong
  -- one is told rather than given a plausible table.
  if v_kind is distinct from 'league_season' then
    raise exception
      'This league belongs to a tournament rather than a competition season; its standings come from get_league_members'
      using errcode = '23514';
  end if;

  if p_limit is null then
    v_limit := 50;
  elsif p_limit < 1 then
    raise exception 'League standings page size must be at least 1' using errcode = '22023';
  else
    v_limit := least(p_limit, 100);
  end if;

  if p_after is not null and btrim(p_after) <> '' then
    begin
      v_cursor := convert_from(decode(p_after, 'hex'), 'UTF8')::jsonb;
      v_after_position := (v_cursor ->> 'position')::integer;
    exception when others then
      raise exception 'Invalid league standings cursor' using errcode = '22023';
    end;

    -- Two guards, as in the season leaderboard: a cursor silently reinterpreted
    -- as page one repeats rows the caller has already seen and reads as a UI
    -- bug rather than a rejected input.
    if v_after_position is null or v_after_position < 1 then
      raise exception 'Invalid league standings cursor' using errcode = '22023';
    end if;
  end if;

  -- The authority. Points and matchweeks played are taken from it and never
  -- recomputed here, so a league total cannot disagree with the season total
  -- for the same player.
  v_standings := predictor_internal.season_standings(v_tournament);

  return (
    with standing as (
      select
        (row ->> 'entryId')::uuid as entry_id,
        (row ->> 'points')::integer as points,
        (row ->> 'matchweeksPlayed')::integer as matchweeks_played
      from jsonb_array_elements(coalesce(v_standings, '[]'::jsonb)) row
    ),
    base as (
      select
        membership.user_id,
        profile.display_name,
        -- `collate "C"` for the same reason both existing reads use it: a
        -- locale-dependent sort makes the page a caller sees depend on the
        -- database's collation, and a cursor issued under one ordering would
        -- page through a different one.
        lower(profile.display_name) collate "C" as sort_name,
        md5(membership.user_id::text) as member_key,
        coalesce(standing.points, 0)::integer as points,
        coalesce(standing.matchweeks_played, 0)::integer as matchweeks_played,
        (membership.role = 'owner') as is_owner,
        (entry.id is not null) as has_entry,
        membership.joined_at
      from public.league_members membership
      join public.profiles profile on profile.id = membership.user_id
      left join public.entries entry
        on entry.user_id = membership.user_id
       and entry.tournament_id = v_tournament
      left join standing on standing.entry_id = entry.id
      where membership.league_id = p_league_id
    ),
    ranked as (
      select
        member.*,
        -- Recomputed WITHIN the league, because a private league is its own
        -- table. `rank()` rather than `dense_rank()`: equal totals share a rank
        -- and the next rank skips, which is what season_standings applies
        -- season-wide.
        rank() over (order by member.points desc)::integer as standing_rank,
        row_number() over (
          order by member.points desc, member.sort_name,
                   member.display_name collate "C", member.member_key
        )::integer as position,
        count(*) over (partition by member.points)::integer as same_rank_count,
        count(*) over ()::integer as total_count
      from base member
    ),
    candidates as (
      select ranked_member.* from ranked ranked_member
       where v_after_position is null or ranked_member.position > v_after_position
       order by ranked_member.position
       limit v_limit + 1
    ),
    page_rows as (
      select candidate.* from candidates candidate
       order by candidate.position
       limit v_limit
    )
    select jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'userId', row.user_id,
            'displayName', row.display_name,
            'points', row.points,
            'rank', row.standing_rank,
            -- Shown beside points because ADR 0012 pairs them.
            'matchweeksPlayed', row.matchweeks_played,
            'tied', row.same_rank_count > 1,
            'position', row.position,
            'isYou', row.user_id = v_uid,
            'isOwner', row.is_owner,
            'hasEntry', row.has_entry,
            'joinedAt', row.joined_at)
          order by row.position)
        from page_rows row), '[]'::jsonb),
      'totalCount', coalesce((select max(total_count) from ranked), 0),
      'pageSize', v_limit,
      'hasMore', (select count(*) from candidates) > v_limit,
      'nextCursor', case
        when (select count(*) from candidates) > v_limit then (
          select encode(
            convert_to(jsonb_build_object('position', row.position)::text, 'UTF8'),
            'hex')
          from page_rows row order by row.position desc limit 1)
        else null
      end,
      -- The caller's own row, whatever page they asked for.
      'you', (
        select jsonb_build_object(
          'userId', row.user_id,
          'displayName', row.display_name,
          'points', row.points,
          'rank', row.standing_rank,
          'matchweeksPlayed', row.matchweeks_played,
          'tied', row.same_rank_count > 1,
          'position', row.position,
          'isOwner', row.is_owner,
          'hasEntry', row.has_entry,
          'joinedAt', row.joined_at)
        from ranked row where row.user_id = v_uid limit 1))
  );
end;
$season$;

revoke all on function public.get_season_league_standings(uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.get_season_league_standings(uuid, integer, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  -- The redefinition kept its own boundary. `get_league_members` holds the
  -- authentication check and the league-membership refusal, and a redefinition
  -- that dropped either would widen a private league to every signed-in
  -- account.
  if (
    select pg_catalog.pg_get_functiondef(to_regprocedure(
      'public.get_league_members(uuid, integer, text)'))
  ) not like '%Not a member of this league%' then
    raise exception 'the league standings read lost its membership refusal';
  end if;

  if (
    select pg_catalog.pg_get_functiondef(to_regprocedure(
      'public.get_season_league_standings(uuid, integer, text)'))
  ) not like '%Not a member of this league%' then
    raise exception 'the season league standings read has no membership refusal';
  end if;

  -- Reads only. Neither function may write a score or a standing.
  if exists (
    select 1 from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname in ('get_league_members', 'get_season_league_standings')
      and not proc.provolatile in ('s', 'i')
  ) then
    raise exception 'a standings read is not declared stable';
  end if;
end;
$$;

commit;
