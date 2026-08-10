-- ---------------------------------------------------------------------------
-- Contract 149 — MIG-UI-01: what a private league predicted, once the matchweek
-- has locked.
--
-- The tournament has had `get_league_match_picks` since long before a season
-- existed. A season has had nothing, so the Match Centre's "Your leagues"
-- section, the mobile per-fixture league comparison, the desktop matchweek
-- matrix and every "See league predictions" journey had no read to call. This
-- is the same shape of gap as contracts 116, 118, 120, 122, 124, 128 and 129:
-- an authority written for the tournament, never widened, failing by returning
-- nothing rather than by erroring.
--
-- THE REVEAL BOUNDARY IS THE MATCHWEEK'S OWN LOCK, and it is the whole point of
-- the function. Contract 129 established the principle for head-to-head: a
-- season has no single tournament-wide lock instant, so the boundary has to be
-- the round's own, resolved server-side from
-- `predictor_internal.season_matchweek_lock_at`. There is no client-supplied
-- time anywhere in this function, because a reveal boundary a caller can pass
-- an argument to is not a boundary.
--
-- Before the lock it HIDES rather than refuses. A refusal would be
-- indistinguishable from "you may not see this league", and the surface asking
-- is one the caller is entitled to look at — they simply cannot see other
-- people's picks yet. So it answers with `revealed: false`, the instant the
-- lock falls, and no predictions at all: not other members' picks reduced to a
-- count, not a redacted shape a client could infer from. The caller's OWN
-- predictions are not returned either, for a reason worth stating: this read
-- exists to compare a league, and a surface that showed your own row before
-- lock and everyone else's after would be two different reads wearing one name.
-- `get_season_matchweek_card` is where a player sees their own picks.
--
-- Membership is the boundary, not game entry — the rule contract 128 chose for
-- `get_season_league_standings` and for the same reason: a league member who
-- has not entered the game still sees their own league, and the alternative
-- hides a league from the person who created it. A member who entered nothing
-- appears with no predictions rather than being dropped, so the member count and
-- the prediction count are different numbers and both are returned.
--
-- Points come from `season_matchweek_scores` and are null until that row
-- settles. They are never recomputed here: a league must not be able to
-- disagree with the season about what a matchweek was worth.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_league_matchweek_predictions(
  p_league_id uuid,
  p_competition_round_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $picks$
declare
  v_uid uuid := (select auth.uid());
  v_tournament uuid;
  v_kind text;
  v_league_name text;
  v_round record;
  v_lock_at timestamptz;
  v_revealed boolean;
  v_fixtures jsonb;
  v_members jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_league_id is null or p_competition_round_id is null then
    raise exception 'A league and a matchweek are required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.league_members membership
     where membership.league_id = p_league_id and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league' using errcode = 'insufficient_privilege';
  end if;

  select league.tournament_id, league.name, season.kind
    into v_tournament, v_league_name, v_kind
    from public.leagues league
    join public.tournaments season on season.id = league.tournament_id
   where league.id = p_league_id;

  if v_tournament is null then
    raise exception 'League not found' using errcode = 'no_data_found';
  end if;

  if v_kind is distinct from 'league_season' then
    raise exception
      'This league belongs to a tournament rather than a competition season; its picks come from get_league_match_picks'
      using errcode = '23514';
  end if;

  select round.id, round.ordinal, round.label
    into v_round
    from public.competition_rounds round
   where round.id = p_competition_round_id
     and round.tournament_id = v_tournament;

  -- A round from another season is not a missing round; saying so stops a
  -- caller concluding the matchweek was empty.
  if not found then
    raise exception 'That matchweek does not belong to this league''s season'
      using errcode = '22023';
  end if;

  -- Buffer zero: ADR 0020 gives Main Predictor a matchweek lock policy with no
  -- buffer, and this read must agree with the policy that closed the entry
  -- rather than carry a second opinion about when picks became final.
  v_lock_at := predictor_internal.season_matchweek_lock_at(
    v_tournament, p_competition_round_id, 0);

  -- A matchweek with no kickoff yet has no lock instant, and an unlocked
  -- matchweek is the un-revealed case rather than an error.
  v_revealed := v_lock_at is not null and now() >= v_lock_at;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', fixture.id,
           'kickoff_at', fixture.kickoff_at,
           'status', fixture.status,
           'home', home.name,
           'away', away.name,
           'result', case when fixture.status = 'played' then jsonb_build_object(
             'home', fixture.home_score, 'away', fixture.away_score) end)
         order by coalesce(fixture.kickoff_at, 'infinity'::timestamptz), fixture.id), '[]'::jsonb)
    into v_fixtures
    from public.season_fixtures fixture
    join public.teams home on home.id = fixture.home_team_id
    join public.teams away on away.id = fixture.away_team_id
   where fixture.competition_round_id = p_competition_round_id;

  if v_revealed then
    select coalesce(jsonb_agg(entry order by sort_points desc nulls last, sort_name, member_key), '[]'::jsonb)
      into v_members
      from (
        select
          lower(profile.display_name) collate "C" as sort_name,
          md5(membership.user_id::text) as member_key,
          score.points as sort_points,
          jsonb_build_object(
            'user_id', membership.user_id,
            'display_name', profile.display_name,
            'is_self', membership.user_id = v_uid,

            -- Null until the matchweek settles. Absent points and zero points
            -- are different answers and the surface has to be able to tell.
            'points', score.points,
            'settled_at', score.settled_at,

            'joker_played', joker.entry_id is not null,

            'predictions', coalesce((
              select jsonb_object_agg(prediction.season_fixture_id, jsonb_build_object(
                       'home', prediction.home_score,
                       'away', prediction.away_score))
                from public.season_predictions prediction
                join public.season_fixtures fixture
                  on fixture.id = prediction.season_fixture_id
               where prediction.entry_id = player_entry.id
                 and fixture.competition_round_id = p_competition_round_id
            ), '{}'::jsonb)
          ) as entry
          from public.league_members membership
          join public.profiles profile on profile.id = membership.user_id
          left join public.entries player_entry
            on player_entry.user_id = membership.user_id
           and player_entry.tournament_id = v_tournament
          left join public.season_matchweek_scores score
            on score.entry_id = player_entry.id
           and score.competition_round_id = p_competition_round_id
          left join public.season_matchweek_jokers joker
            on joker.entry_id = player_entry.id
           and joker.competition_round_id = p_competition_round_id
         where membership.league_id = p_league_id
         limit 200) revealed;
  else
    v_members := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', p_league_id, 'name', v_league_name),
    'matchweek', jsonb_build_object(
      'id', v_round.id,
      'ordinal', v_round.ordinal,
      'label', v_round.label,
      'locks_at', v_lock_at),
    'revealed', v_revealed,
    'server_now', now(),
    'fixtures', v_fixtures,
    'member_count', (
      select count(*)::integer from public.league_members membership
       where membership.league_id = p_league_id),
    -- How many of those members actually predicted this matchweek. Only
    -- meaningful once revealed, and zero rather than a lie before it.
    'predicted_count', case when v_revealed then (
      select count(distinct prediction.entry_id)::integer
        from public.season_predictions prediction
        join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
        join public.entries player_entry on player_entry.id = prediction.entry_id
        join public.league_members membership
          on membership.user_id = player_entry.user_id
         and membership.league_id = p_league_id
       where fixture.competition_round_id = p_competition_round_id) else 0 end,
    'members', v_members);
end;
$picks$;

revoke all on function public.get_season_league_matchweek_predictions(uuid, uuid)
  from public, anon;
grant execute on function public.get_season_league_matchweek_predictions(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_definition text := pg_get_functiondef(
    'public.get_season_league_matchweek_predictions(uuid, uuid)'::regprocedure);
begin
  -- The reveal boundary is server-resolved. A parameterised instant would let a
  -- caller choose when other people's predictions became visible.
  if v_definition !~ 'season_matchweek_lock_at' then
    raise exception 'The reveal boundary must come from the season matchweek lock authority';
  end if;

  if v_definition ~ 'p_now|p_as_of|p_at\b' then
    raise exception 'The reveal boundary must not accept a client-supplied time';
  end if;

  -- Hiding, not refusing, and hiding completely.
  if v_definition !~ 'v_members := ''\[\]''::jsonb' then
    raise exception 'Before the lock the member list must be empty rather than redacted';
  end if;

  if v_definition !~ 'insufficient_privilege' then
    raise exception 'Non-members must be refused';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = 'get_season_league_matchweek_predictions'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'League predictions must not be readable anonymously';
  end if;
end;
$$;
