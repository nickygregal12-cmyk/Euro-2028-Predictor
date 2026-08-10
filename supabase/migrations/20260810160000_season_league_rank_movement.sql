-- ---------------------------------------------------------------------------
-- Contract 150 — MIG-UI-03: how a league table moved over one settled matchweek.
--
-- The gap to a rival is already derivable in the browser from the rows contract
-- 128 returns, because both players are on screen at once. Movement is not:
-- "5th → 3rd" needs the table as it stood BEFORE the matchweek, and history is
-- not on screen. That is the whole reason this is a read rather than another
-- subtraction in the client, and it is what blocks the Hub league cards, the
-- Match Centre's post-match impact and half of Player & League Insights.
--
-- DERIVED, NOT STORED. The register is explicit that stored snapshots are a
-- last resort, and they are not needed: `season_matchweek_scores` already holds
-- every banked matchweek total with the round it belongs to, so the table
-- before a matchweek is the sum of the rounds ordered before it, and the table
-- after is that sum plus the matchweek itself. A snapshot table would add a
-- second thing that can disagree with the first, and it would need backfilling
-- for every matchweek already played.
--
-- ONLY SETTLED MATCHWEEKS MOVE ANYTHING. `settled_at` is the gate, not the
-- presence of a row and not the fixture status: a matchweek being scored is a
-- matchweek whose totals are still changing, and reporting a climb from it
-- would show a player a position they never held. An unsettled matchweek is
-- answered honestly with `settled: false` and no movement, rather than refused
-- — the caller is entitled to ask about this week.
--
-- Ordering is by the round's ORDINAL rather than by `settled_at`, because a
-- postponed matchweek settles late and would otherwise appear to come after
-- matchweeks that were played later. ADR 0020's amendment is the same idea
-- contract 139 states for fixtures: a matchweek keeps its number.
--
-- Ranking is `rank()` within the league, matching contract 128 exactly — equal
-- totals share a rank and the next rank skips. Recomputed inside the league
-- because a private league is its own table, and taken from the same banked
-- totals as the season so the two cannot disagree about what a player scored.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_league_rank_movement(
  p_league_id uuid,
  p_competition_round_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $movement$
declare
  v_uid uuid := (select auth.uid());
  v_tournament uuid;
  v_kind text;
  v_round record;
  v_settled boolean;
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_league_id is null then
    raise exception 'League is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.league_members membership
     where membership.league_id = p_league_id and membership.user_id = v_uid
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

  if v_kind is distinct from 'league_season' then
    raise exception
      'This league belongs to a tournament rather than a competition season; movement is a season measure'
      using errcode = '23514';
  end if;

  -- No matchweek named means the most recent one that actually settled, which
  -- is the question every calling surface is really asking.
  if p_competition_round_id is null then
    select round.id, round.ordinal, round.label
      into v_round
      from public.competition_rounds round
     where round.tournament_id = v_tournament
       and exists (
         select 1 from public.season_matchweek_scores score
          where score.competition_round_id = round.id
            and score.settled_at is not null)
     order by round.ordinal desc
     limit 1;
  else
    select round.id, round.ordinal, round.label
      into v_round
      from public.competition_rounds round
     where round.id = p_competition_round_id
       and round.tournament_id = v_tournament;

    if not found then
      raise exception 'That matchweek does not belong to this league''s season'
        using errcode = '22023';
    end if;
  end if;

  -- A season with nothing settled yet is a real state, not an error.
  if v_round.id is null then
    return jsonb_build_object(
      'league', jsonb_build_object('id', p_league_id),
      'matchweek', null, 'settled', false, 'server_now', now(),
      'members', '[]'::jsonb);
  end if;

  select exists (
    select 1 from public.season_matchweek_scores score
     where score.competition_round_id = v_round.id
       and score.settled_at is not null)
    into v_settled;

  if not v_settled then
    return jsonb_build_object(
      'league', jsonb_build_object('id', p_league_id),
      'matchweek', jsonb_build_object(
        'id', v_round.id, 'ordinal', v_round.ordinal, 'label', v_round.label),
      'settled', false, 'server_now', now(),
      'members', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(entry order by rank_after, sort_name, member_key), '[]'::jsonb)
    into v_rows
    from (
      with member as (
        select membership.user_id, profile.display_name,
               lower(profile.display_name) collate "C" as sort_name,
               md5(membership.user_id::text) as member_key,
               player_entry.id as entry_id
          from public.league_members membership
          join public.profiles profile on profile.id = membership.user_id
          left join public.entries player_entry
            on player_entry.user_id = membership.user_id
           and player_entry.tournament_id = v_tournament
         where membership.league_id = p_league_id
      ),
      -- Ordered by ORDINAL, never by settled_at: a postponed matchweek settles
      -- late and must not appear to come after matchweeks played after it.
      banked as (
        select score.entry_id, round.ordinal, score.points
          from public.season_matchweek_scores score
          join public.competition_rounds round on round.id = score.competition_round_id
         where score.tournament_id = v_tournament
           and score.settled_at is not null
      ),
      totals as (
        select member.*,
               coalesce((select sum(banked.points) from banked
                          where banked.entry_id = member.entry_id
                            and banked.ordinal < v_round.ordinal), 0)::integer as points_before,
               coalesce((select sum(banked.points) from banked
                          where banked.entry_id = member.entry_id
                            and banked.ordinal <= v_round.ordinal), 0)::integer as points_after,
               (select banked.points from banked
                 where banked.entry_id = member.entry_id
                   and banked.ordinal = v_round.ordinal) as points_this_matchweek
          from member
      ),
      ranked as (
        select totals.*,
               rank() over (order by totals.points_before desc)::integer as rank_before,
               rank() over (order by totals.points_after desc)::integer as rank_after,
               max(totals.points_before) over ()::integer as leader_before,
               max(totals.points_after) over ()::integer as leader_after
          from totals
      )
      select
        ranked.rank_after, ranked.sort_name, ranked.member_key,
        jsonb_build_object(
          'user_id', ranked.user_id,
          'display_name', ranked.display_name,
          'is_self', ranked.user_id = v_uid,
          'points_before', ranked.points_before,
          'points_after', ranked.points_after,
          'points_this_matchweek', ranked.points_this_matchweek,
          'rank_before', ranked.rank_before,
          'rank_after', ranked.rank_after,
          -- Positive means climbed. Stated as a signed number rather than a
          -- direction word so the caller decides how to say it.
          'movement', ranked.rank_before - ranked.rank_after,
          'gap_to_leader_before', ranked.leader_before - ranked.points_before,
          'gap_to_leader_after', ranked.leader_after - ranked.points_after
        ) as entry
      from ranked
      limit 200) movement;

  return jsonb_build_object(
    'league', jsonb_build_object('id', p_league_id),
    'matchweek', jsonb_build_object(
      'id', v_round.id, 'ordinal', v_round.ordinal, 'label', v_round.label),
    'settled', true,
    'server_now', now(),
    'members', v_rows);
end;
$movement$;

revoke all on function public.get_season_league_rank_movement(uuid, uuid) from public, anon;
grant execute on function public.get_season_league_rank_movement(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_definition text := pg_get_functiondef(
    'public.get_season_league_rank_movement(uuid, uuid)'::regprocedure);
begin
  -- Movement may only be derived from matchweeks that have SETTLED. Reporting a
  -- climb out of a matchweek still being scored shows a position never held.
  if v_definition !~ 'settled_at is not null' then
    raise exception 'Movement must be derived from settled matchweeks only';
  end if;

  -- Ordered by ordinal, so a postponed matchweek keeps its number.
  if v_definition !~ 'banked.ordinal < v_round.ordinal' then
    raise exception 'The before-table must be ordered by matchweek ordinal';
  end if;

  -- Derived, not stored: nothing here may read or write a snapshot relation.
  if v_definition ~* 'rank_history|rank_snapshot' then
    raise exception 'Movement is derived from banked totals, not from a stored snapshot';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = 'get_season_league_rank_movement'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'League movement must not be readable anonymously';
  end if;
end;
$$;
