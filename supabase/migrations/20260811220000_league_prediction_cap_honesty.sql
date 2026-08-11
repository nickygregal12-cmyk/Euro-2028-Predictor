-- Contract 171 — a capped league read stops choosing arbitrarily, and says it
-- capped.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS ACTUALLY WRONG, MEASURED RATHER THAN ASSUMED
-- ---------------------------------------------------------------------------
--
-- Roadmap item 10 said the older leaderboard, league and comparison reads had
-- no page bound. Measured against the migrations, that was wrong in both
-- directions and this contract records the measurement rather than the memory:
--
--   * `get_leaderboard` and both `get_league_members` have had CLAMPED KEYSET
--     pagination since `20260729122200_final_standings_tiebreaks.sql`;
--   * of 51 read-shaped RPCs in the deployment contract, 34 take no size
--     argument, and all but two of those are singular reads, football-bounded
--     (a club table is twenty clubs; ADR 0014 caps a Championship group at
--     twenty) or aggregates;
--   * the two that carry a league's whole membership — `get_league_match_picks`
--     and `get_season_league_matchweek_predictions` — are ALSO bounded, at 250
--     and 200 rows.
--
-- So there is no unbounded read. What there is instead is worse in one case and
-- merely silent in the other.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT: A CAP WITH NO ORDER IS AN ARBITRARY CHOICE
-- ---------------------------------------------------------------------------
--
-- `get_season_league_matchweek_predictions` — contract 149 — applies
--
--     where membership.league_id = p_league_id
--     limit 200) revealed;
--
-- with NO `order by` inside the capped subquery. The aggregate outside it then
-- orders what survived by points. So for a league of more than two hundred
-- members, WHICH two hundred are ranked is whatever the plan happened to
-- produce — and the ranked table can omit the league leader while presenting
-- itself as the league's table. Two identical calls may return different
-- members.
--
-- The cap now carries the same total order the aggregate uses, so it keeps the
-- TOP rows rather than an accident of the plan. Points first, then name, then
-- the member key, so the order is total and a member cannot sit on the boundary
-- and flicker between renders.
--
-- `get_league_match_picks` was already deterministic: it has ordered by display
-- name before truncating since `20260727182300_bounded_read_models.sql`. It is
-- not changed in that respect, and this contract says so rather than implying
-- both reads were equally wrong.
--
-- ---------------------------------------------------------------------------
-- AND A CAP THAT DOES NOT SAY IT CAPPED IS A LIE BY OMISSION
-- ---------------------------------------------------------------------------
--
-- Both reads return the league's REAL size beside a truncated list —
-- `member_count` and `total_members` respectively. A surface receiving 200 rows
-- and a count of 300 cannot tell truncation from a hundred members who did not
-- predict, and those two need opposite copy: "showing 200 of 300" against
-- "100 members have not predicted".
--
-- Each read now states how many rows it actually carried and whether that was
-- all of them.
--
-- ---------------------------------------------------------------------------
-- WHY NO PAGE ARGUMENT
-- ---------------------------------------------------------------------------
--
-- Adding `p_limit`/`p_after` cannot be done with `create or replace`: the new
-- overload would also match a two-argument call, so every existing call becomes
-- ambiguous and the old function must be DROPPED first. That is a destructive
-- migration and belongs to the guarded lane, as contract 158's
-- `get_league_preview` did.
--
-- It would also be paging nothing today. `predictor_internal.operating_limits`
-- caps the closed rollout at fifty users and twenty leagues site-wide, so no
-- league can currently reach either bound. Making these payloads HONEST is what
-- is needed now, and it is additive; a page argument becomes worth its
-- destructive migration when a real league approaches the cap, and the
-- `members_truncated` flag added here is what will show that it has.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- Neither signature changes, so no caller breaks and no grant moves. Both keys
-- added are ADDITIVE: every key either read emitted before, it still emits.
-- Neither read's reveal boundary, membership gate or refusal moves — contract
-- 149's matchweek lock and the tournament's own lock decide disclosure exactly
-- as they did.

begin;

create or replace function public.get_league_match_picks(
  p_league_id uuid,
  p_match_id uuid
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
  v_lock timestamptz;
  v_round text;
  v_home uuid;
  v_away uuid;
  v_locked boolean;
  v_total integer;
  v_predicted integer;
  v_picks jsonb := '[]'::jsonb;
begin
  if v_uid is null or not exists (
    select 1
    from public.league_members membership
    where membership.league_id = p_league_id
      and membership.user_id = v_uid
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  select
    match.tournament_id,
    match.round,
    match.home_team_id,
    match.away_team_id
    into v_tournament, v_round, v_home, v_away
    from public.matches match
    where match.id = p_match_id;

  if v_tournament is null then
    raise exception 'Match not found'
      using errcode = 'no_data_found';
  end if;

  if not exists (
    select 1
    from public.leagues league
    where league.id = p_league_id
      and league.tournament_id = v_tournament
  ) then
    raise exception 'Not a member of this league'
      using errcode = 'insufficient_privilege';
  end if;

  select tournament.lock_at
    into v_lock
    from public.tournaments tournament
    where tournament.id = v_tournament;

  v_locked := v_lock is not null and now() >= v_lock;

  select count(*)::integer
    into v_total
    from public.league_members membership
    join public.entries entry
      on entry.user_id = membership.user_id
     and entry.tournament_id = v_tournament
     and entry.submitted_at is not null
    where membership.league_id = p_league_id;

  if v_round = 'group' then
    select count(*)::integer
      into v_predicted
      from public.league_members membership
      join public.entries entry
        on entry.user_id = membership.user_id
       and entry.tournament_id = v_tournament
       and entry.submitted_at is not null
      join public.match_predictions prediction
        on prediction.entry_id = entry.id
       and prediction.match_id = p_match_id
      where membership.league_id = p_league_id;

    if v_locked then
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'display_name', bounded.display_name,
            'is_you', bounded.is_you,
            'home_score', bounded.home_score,
            'away_score', bounded.away_score,
            'joker', bounded.joker
          )
          order by bounded.display_name, bounded.user_id
        ),
        '[]'::jsonb
      )
        into v_picks
        from (
          select
            profile.display_name,
            membership.user_id,
            (membership.user_id = v_uid) as is_you,
            prediction.home_score,
            prediction.away_score,
            prediction.joker
          from public.league_members membership
          join public.entries entry
            on entry.user_id = membership.user_id
           and entry.tournament_id = v_tournament
           and entry.submitted_at is not null
          join public.profiles profile
            on profile.id = membership.user_id
          join public.match_predictions prediction
            on prediction.entry_id = entry.id
           and prediction.match_id = p_match_id
          where membership.league_id = p_league_id
          order by profile.display_name, membership.user_id
          limit 250
        ) bounded;
    end if;

    return jsonb_build_object(
      'kind', 'group',
      'locked', v_locked,
      'total_members', v_total,
      'predicted_count', v_predicted,
      -- CONTRACT 171. The cap below is deterministic — it has always ordered
      -- by display name before truncating — but it was silent, so a league of
      -- 300 returned 250 rows beside a total of 300 and a surface could not
      -- tell truncation from members who had not predicted.
      'picks_returned', jsonb_array_length(coalesce(v_picks, '[]'::jsonb)),
      'picks_truncated', jsonb_array_length(coalesce(v_picks, '[]'::jsonb)) >= 250,
      'picks', v_picks
    );
  end if;

  v_predicted := v_total;

  if v_locked then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'display_name', bounded.display_name,
          'is_you', bounded.is_you,
          'home_stage', bounded.home_stage,
          'away_stage', bounded.away_stage
        )
        order by bounded.display_name, bounded.user_id
      ),
      '[]'::jsonb
    )
      into v_picks
      from (
        select
          profile.display_name,
          membership.user_id,
          (membership.user_id = v_uid) as is_you,
          (
            select progression.stage
            from public.predicted_progression progression
            where progression.entry_id = entry.id
              and progression.team_id = v_home
          ) as home_stage,
          (
            select progression.stage
            from public.predicted_progression progression
            where progression.entry_id = entry.id
              and progression.team_id = v_away
          ) as away_stage
        from public.league_members membership
        join public.entries entry
          on entry.user_id = membership.user_id
         and entry.tournament_id = v_tournament
         and entry.submitted_at is not null
        join public.profiles profile
          on profile.id = membership.user_id
        where membership.league_id = p_league_id
        order by profile.display_name, membership.user_id
        limit 250
      ) bounded;
  end if;

  return jsonb_build_object(
    'kind', 'knockout',
    'locked', v_locked,
    'total_members', v_total,
    'predicted_count', v_predicted,
    'home_team_id', v_home,
    'away_team_id', v_away,
    'picks_returned', jsonb_array_length(coalesce(v_picks, '[]'::jsonb)),
    'picks_truncated', jsonb_array_length(coalesce(v_picks, '[]'::jsonb)) >= 250,
    'picks', v_picks
  );
end;
$$;

revoke all on function public.get_league_match_picks(uuid, uuid) from public, anon;
grant execute on function public.get_league_match_picks(uuid, uuid) to authenticated;

comment on function public.get_league_match_picks(uuid, uuid) is
  'Contract 44, amended by contract 171. One league''s picks for one match, '
  'capped at 250 rows in display-name order and now STATING that it capped: '
  'picks_returned and picks_truncated let a surface tell truncation from '
  'members who did not predict.';

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
         -- CONTRACT 171. The cap was applied with NO ordering, so which 200
         -- members survived it was arbitrary — and the aggregate above then
         -- ranked that arbitrary subset by points, which can omit the league
         -- leader. The order here is the same total order the aggregate uses,
         -- so the cap keeps the TOP rows rather than an accident of the plan.
         order by score.points desc nulls last,
                  lower(profile.display_name) collate "C",
                  md5(membership.user_id::text)
         limit 200) revealed;
  else
    v_members := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'league', jsonb_build_object('id', p_league_id, 'name', v_league_name),
    -- CONTRACT 171. How many member rows this payload actually carries, and
    -- whether that is all of them. `member_count` below is the league's real
    -- size, so without these two a surface showing 200 rows beside a count of
    -- 300 has no way to tell truncation from members who did not predict.
    'members_returned', jsonb_array_length(coalesce(v_members, '[]'::jsonb)),
    'members_truncated', v_revealed and (
      select count(*) from public.league_members membership
       where membership.league_id = p_league_id) > 200,
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

comment on function public.get_season_league_matchweek_predictions(uuid, uuid) is
  'Contract 149, amended by contract 171. The cap now carries the same total '
  'order as the aggregate above it, so it keeps the top rows rather than an '
  'arbitrary two hundred, and the payload states how many rows it carried and '
  'whether that was all of them.';

commit;

-- ---------------------------------------------------------------------------
-- What must be true of this migration.
-- ---------------------------------------------------------------------------

do $assert$
declare
  v_season text := pg_catalog.pg_get_functiondef(
    'public.get_season_league_matchweek_predictions(uuid, uuid)'::regprocedure);
  v_tournament text := pg_catalog.pg_get_functiondef(
    'public.get_league_match_picks(uuid, uuid)'::regprocedure);
begin
  -- THE ASSERTION THIS CONTRACT EXISTS FOR. No cap may be applied without an
  -- order, because an unordered cap is an arbitrary choice presented as a table.
  if v_season ~ 'p_league_id\s*\n\s*limit\s+200' then
    raise exception
      'The season league read still caps its members with no ordering';
  end if;

  if v_season !~ 'order by score\.points desc nulls last' then
    raise exception
      'The season league read does not cap in the order its aggregate ranks by';
  end if;

  -- Both reads say what they carried.
  if v_season !~ 'members_returned' or v_season !~ 'members_truncated' then
    raise exception 'The season league read does not report truncation';
  end if;

  if v_tournament !~ 'picks_returned' or v_tournament !~ 'picks_truncated' then
    raise exception 'The tournament league read does not report truncation';
  end if;

  -- The tournament read keeps the deterministic order it always had.
  if v_tournament !~ 'order by profile\.display_name, membership\.user_id' then
    raise exception 'The tournament league read lost its deterministic cap order';
  end if;

  -- Neither reveal boundary moves.
  if v_season !~ 'season_matchweek_lock_at' then
    raise exception 'The season league read lost its matchweek lock boundary';
  end if;

  -- Neither becomes anonymously executable.
  if pg_catalog.has_function_privilege(
       'anon', 'public.get_season_league_matchweek_predictions(uuid, uuid)', 'execute')
     or pg_catalog.has_function_privilege(
       'anon', 'public.get_league_match_picks(uuid, uuid)', 'execute') then
    raise exception 'A league prediction read became anonymously executable';
  end if;
end;
$assert$;
