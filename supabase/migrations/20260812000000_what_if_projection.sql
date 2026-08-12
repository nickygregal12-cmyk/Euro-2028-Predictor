-- ---------------------------------------------------------------------------
-- Contract 175 — INNOV-001: what the current score is worth, and what the next
-- goal would be worth.
--
-- Promoted from the Innovation Lab register by the owner authorisation of
-- 12 August 2026 and recorded in ADR 0027. Nothing here is approved because it
-- appears in `docs/product/innovation-lab.md`; that document decides nothing.
--
-- ---------------------------------------------------------------------------
-- THE ONE RULE THIS CONTRACT MUST NOT BREAK
-- ---------------------------------------------------------------------------
--
-- A projection is not a second scoring engine. Every point value below comes
-- from `predictor_internal.season_fixture_points` — ADR 0012's authority, the
-- same function `season_matchweek_points` folds over and the same one the
-- settlement job banks from. This contract supplies the INPUTS (a hypothetical
-- score instead of a settled one) and never the RULE.
--
-- The Joker is the one place where a projection could accidentally restate a
-- rule rather than reuse one, because the doubling lives in
-- `season_matchweek_points` rather than in the per-fixture function. It is
-- applied here the same way — once, to the matchweek total, never per fixture —
-- and `224_what_if_projection.sql` proves the two agree by driving a matchweek
-- in which every fixture is played and requiring the projection to equal
-- `season_matchweek_points` exactly, with and without the Joker. That
-- assertion, not this paragraph, is what stops the two drifting.
--
-- ---------------------------------------------------------------------------
-- PROVISIONAL IS NOT OFFICIAL, AND THE READ SAYS WHICH IT USED
-- ---------------------------------------------------------------------------
--
-- Each fixture reports its basis explicitly:
--
--   * `official`    — `season_fixtures.status = 'played'` with a stored score.
--                     Contract 125's protected writer is the only thing that
--                     puts one there. This is settled and carries no branches.
--   * `provisional` — contract 135's `season_fixture_live_state`, which is a
--                     provider opinion and decides nothing. Labelled, and the
--                     only basis that produces branches.
--   * `none`        — no score of any kind. Scores nothing and says so, rather
--                     than being reported as a nil-nil the player might read as
--                     a real state of play.
--
-- A projection over a provisional score never becomes a banked point. This
-- function writes nothing at all.
--
-- ---------------------------------------------------------------------------
-- WHOSE PROJECTION THE CALLER MAY SEE
-- ---------------------------------------------------------------------------
--
-- Their own, always: these are their own predictions.
--
-- A rival's, only inside a private league they share AND only once that
-- matchweek's own lock has passed. That is contract 149's boundary exactly, and
-- for its reason: a season has no single lock instant, so it has to be the
-- round's own, resolved server-side from
-- `predictor_internal.season_matchweek_lock_at` with no client-supplied time
-- anywhere. Before the lock the league block HIDES rather than refuses —
-- refusing would be indistinguishable from "you may not see this league" — and
-- it hides completely: no member rows, not even redacted ones.
--
-- Membership rather than game entry is the boundary, as contract 128 chose, so
-- a member who entered nothing appears on their banked total with no projection
-- rather than being dropped from their own league's table.
--
-- ---------------------------------------------------------------------------
-- BOUNDED
-- ---------------------------------------------------------------------------
--
-- One matchweek of one season, and at most 200 league members carried in
-- contract 171's total order — points, then display name, then user id — so
-- which members survive a truncation is deterministic and the league leader
-- cannot be the row that falls off. The read states how many it carried and
-- whether that was all of them, for the reason contract 171 records: a
-- truncated list beside the league's real size is indistinguishable from
-- members who did not predict. There is no whole-competition projection: a
-- season may hold fifty thousand entries and projecting all of them is not a
-- question anybody asked.
--
-- Banked totals are never recomputed. They come from
-- `predictor_internal.season_standings`, the authority the season and the
-- leagues already share, so a projection cannot disagree with the table it is
-- projecting from.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- The projected points of one entry over one matchweek, under a hypothetical
-- score for one named fixture.
--
-- `p_branch_fixture_id` null means "no hypothetical": every fixture is scored
-- on the basis it actually has. Otherwise that one fixture is scored on the
-- supplied score and every other fixture keeps its own basis, which is what
-- makes a branch answer "what would the NEXT goal do" rather than "what would
-- a different matchweek do".
--
-- The joker multiplier is read from the same table `season_matchweek_points`
-- reads it from, and applied once at the end, to the total.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_matchweek_projection(
  p_entry_id uuid,
  p_competition_round_id uuid,
  p_branch_fixture_id uuid default null,
  p_branch_home smallint default null,
  p_branch_away smallint default null
)
returns integer
language sql
stable
set search_path = ''
as $projection$
  with basis as (
    select
      fixture.id as fixture_id,
      prediction.home_score as predicted_home,
      prediction.away_score as predicted_away,
      case
        when p_branch_fixture_id is not null and fixture.id = p_branch_fixture_id
          then p_branch_home
        when fixture.status = 'played' then fixture.home_score
        else live.home_score
      end as basis_home,
      case
        when p_branch_fixture_id is not null and fixture.id = p_branch_fixture_id
          then p_branch_away
        when fixture.status = 'played' then fixture.away_score
        else live.away_score
      end as basis_away
    from public.season_fixtures fixture
    -- LEFT, for the reason `season_matchweek_points` gives: a fixture the
    -- player did not predict is a zero rather than a missing row.
    left join public.season_predictions prediction
      on prediction.season_fixture_id = fixture.id
     and prediction.entry_id = p_entry_id
    left join predictor_internal.season_fixture_live_state live
      on live.season_fixture_id = fixture.id
     and live.kind in ('in_play', 'final')
    where fixture.competition_round_id = p_competition_round_id
      -- A void, postponed or abandoned fixture with no branch supplied scores
      -- nothing, exactly as settlement treats it. It is kept in the fold rather
      -- than filtered out so a branch may still be asked about it.
      and (fixture.status <> 'void' or fixture.id = p_branch_fixture_id)
  )
  select coalesce(
    sum(
      predictor_internal.season_fixture_points(
        basis.predicted_home, basis.predicted_away,
        basis.basis_home, basis.basis_away)
    ), 0)::integer
  * case
      when exists (
        select 1 from public.season_matchweek_jokers joker
         where joker.entry_id = p_entry_id
           and joker.competition_round_id = p_competition_round_id
      ) then 2
      else 1
    end
  from basis;
$projection$;

revoke all on function predictor_internal.season_matchweek_projection(
  uuid, uuid, uuid, smallint, smallint)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The bounded browser read.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_matchweek_projection(
  p_tournament_id uuid,
  p_matchweek integer,
  p_league_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $whatif$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_round uuid;
  v_ordinal integer;
  v_label text;
  v_entry uuid;
  v_buffer integer;
  v_locks_at timestamptz;
  v_locked boolean;
  v_joker boolean;
  v_fixtures jsonb;
  v_points integer;
  v_league jsonb := null;
  v_table jsonb := '[]'::jsonb;
  v_league_name text;
  v_member_total integer;
  v_carried integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_tournament_id is null or p_matchweek is null then
    raise exception 'A competition season and a matchweek are required'
      using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'That competition is not a league season' using errcode = '22023';
  end if;

  select round.id, round.ordinal, round.label
    into v_round, v_ordinal, v_label
    from public.competition_rounds round
   where round.tournament_id = p_tournament_id
     and round.kind = 'league_matchweek'
     and round.ordinal = p_matchweek;

  if v_round is null then
    raise exception 'Matchweek % does not exist in this season', p_matchweek
      using errcode = '22023';
  end if;

  select player_entry.id into v_entry
    from public.entries player_entry
   where player_entry.user_id = v_uid
     and player_entry.tournament_id = p_tournament_id;

  if v_entry is null then
    raise exception 'You have not entered this season' using errcode = 'insufficient_privilege';
  end if;

  -- The lock, from the authority that owns it. `season_matchweek_lock_at`
  -- returns null when a kickoff is unconfirmed, and contract 170 established
  -- that null is "not derivable" rather than "no deadline"; an underivable
  -- lock is treated as not yet passed for the reveal test, which fails closed.
  select definition.buffer_minutes into v_buffer
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = p_tournament_id
     and availability.game_key = 'main_predictor'
     and availability.id = predictor_internal.live_competition_id(
       p_tournament_id, 'main_predictor');

  v_locks_at := predictor_internal.season_matchweek_lock_at(
    p_tournament_id, v_round, coalesce(v_buffer, 0));
  v_locked := v_locks_at is not null and now() >= v_locks_at;

  v_joker := exists (
    select 1 from public.season_matchweek_jokers joker
     where joker.entry_id = v_entry and joker.competition_round_id = v_round);

  -- Per-fixture detail, with the branches. A branch exists only where the
  -- fixture is not settled: a played fixture's result is final, and offering
  -- "if the home side scored" against it would invite a player to read a
  -- settled matchweek as still moving.
  select coalesce(jsonb_agg(row order by kickoff_at, fixture_id), '[]'::jsonb)
    into v_fixtures
    from (
      select
        fixture.kickoff_at,
        fixture.id as fixture_id,
        jsonb_build_object(
          'fixture_id', fixture.id,
          'home_team_id', fixture.home_team_id,
          'away_team_id', fixture.away_team_id,
          'kickoff_at', fixture.kickoff_at,
          'status', fixture.status,
          'basis', case
                     when fixture.status = 'played' and fixture.home_score is not null
                       then 'official'
                     when live.home_score is not null then 'provisional'
                     else 'none'
                   end,
          'official', case
                        when fixture.status = 'played' and fixture.home_score is not null
                          then jsonb_build_object(
                                 'home', fixture.home_score, 'away', fixture.away_score)
                        else null
                      end,
          'provisional', case
                           when live.home_score is not null
                             then jsonb_build_object(
                                    'home', live.home_score,
                                    'away', live.away_score,
                                    'provider_status', live.provider_status,
                                    'kind', live.kind,
                                    'observed_at', live.observed_at)
                           else null
                         end,
          'prediction', case
                          when prediction.home_score is not null
                            then jsonb_build_object(
                                   'home', prediction.home_score,
                                   'away', prediction.away_score)
                          else null
                        end,
          -- Undoubled, per fixture. The Joker doubles a matchweek and not a
          -- fixture, so showing a doubled per-fixture figure would restate the
          -- rule wrongly on the one surface a player would check it against.
          'points', predictor_internal.season_fixture_points(
                      prediction.home_score, prediction.away_score,
                      case when fixture.status = 'played' then fixture.home_score
                           else live.home_score end,
                      case when fixture.status = 'played' then fixture.away_score
                           else live.away_score end),
          -- Branches exist only for a fixture that is actually IN PLAY. A
          -- fixture that has not kicked off has no current score, and offering
          -- "if the home side scored" against an assumed nil-nil would put a
          -- state of play on screen that nobody is playing. A played fixture is
          -- final and has no next goal.
          'branches', case
            when fixture.status = 'played' then null
            when live.kind is distinct from 'in_play' then null
            when live.home_score is null or live.away_score is null then null
            else jsonb_build_object(
              'home_scores', jsonb_build_object(
                'home', coalesce(live.home_score, 0) + 1,
                'away', coalesce(live.away_score, 0),
                'matchweek_points', predictor_internal.season_matchweek_projection(
                  v_entry, v_round, fixture.id,
                  (coalesce(live.home_score, 0) + 1)::smallint,
                  coalesce(live.away_score, 0)::smallint)),
              'away_scores', jsonb_build_object(
                'home', coalesce(live.home_score, 0),
                'away', coalesce(live.away_score, 0) + 1,
                'matchweek_points', predictor_internal.season_matchweek_projection(
                  v_entry, v_round, fixture.id,
                  coalesce(live.home_score, 0)::smallint,
                  (coalesce(live.away_score, 0) + 1)::smallint)))
          end) as row
      from public.season_fixtures fixture
      left join public.season_predictions prediction
        on prediction.season_fixture_id = fixture.id
       and prediction.entry_id = v_entry
      left join predictor_internal.season_fixture_live_state live
        on live.season_fixture_id = fixture.id
       and live.kind in ('in_play', 'final')
     where fixture.competition_round_id = v_round
    ) fixtures;

  v_points := predictor_internal.season_matchweek_projection(v_entry, v_round);

  -- ---------------------------------------------------------------------
  -- The league consequence, if one was asked for.
  -- ---------------------------------------------------------------------
  if p_league_id is not null then
    select league.name into v_league_name
      from public.leagues league
      join public.league_members mine
        on mine.league_id = league.id and mine.user_id = v_uid
     where league.id = p_league_id
       and league.tournament_id = p_tournament_id;

    if v_league_name is null then
      raise exception 'That private league is not on this season, or you are not a member'
        using errcode = 'insufficient_privilege';
    end if;

    if not v_locked then
      -- Hides, and hides completely. Not a member count, not a predicted
      -- count, not a redacted row: who has already predicted is itself
      -- information before a lock.
      v_league := jsonb_build_object(
        'league_id', p_league_id,
        'name', v_league_name,
        'revealed', false,
        'reason', 'matchweek_not_locked',
        'locks_at', v_locks_at,
        'members_returned', 0,
        'members_truncated', false,
        'table', '[]'::jsonb);
    else
      select count(*)::integer into v_member_total
        from public.league_members member where member.league_id = p_league_id;

      with standing as (
        select (row ->> 'entryId')::uuid as entry_id,
               (row ->> 'points')::integer as points
          from jsonb_array_elements(
                 coalesce(predictor_internal.season_standings(p_tournament_id), '[]'::jsonb)) row
      ),
      carried as (
        select
          membership.user_id,
          coalesce(profile.display_name, 'Player') as display_name,
          player_entry.id as entry_id,
          coalesce(standing.points, 0) as banked_points,
          -- The banked contribution of THIS matchweek, so the projection
          -- replaces it rather than being added on top of it. A settled
          -- matchweek that is then projected must not count twice.
          coalesce(score.points, 0) as banked_this_matchweek,
          case
            when player_entry.id is null then null
            else predictor_internal.season_matchweek_projection(player_entry.id, v_round)
          end as projected_matchweek
        from public.league_members membership
        left join public.profiles profile on profile.id = membership.user_id
        left join public.entries player_entry
          on player_entry.user_id = membership.user_id
         and player_entry.tournament_id = p_tournament_id
        left join standing on standing.entry_id = player_entry.id
        left join public.season_matchweek_scores score
          on score.entry_id = player_entry.id
         and score.competition_round_id = v_round
        where membership.league_id = p_league_id
        -- Contract 171's total order. Deterministic, so a truncation cannot
        -- drop an arbitrary member, and the leader cannot be the one dropped.
        order by coalesce(standing.points, 0) desc,
                 coalesce(profile.display_name, 'Player'),
                 membership.user_id
        limit 200
      ),
      projected as (
        select
          carried.*,
          carried.banked_points - carried.banked_this_matchweek
            + coalesce(carried.projected_matchweek, 0) as projected_points
        from carried
      ),
      -- Ranked in its own step: a window function cannot be an argument to the
      -- aggregate below it, and both ranks are over the CARRIED rows, which is
      -- why the read reports whether it truncated.
      ranked as (
        select
          projected.*,
          rank() over (order by projected.banked_points desc) as current_rank,
          rank() over (order by projected.projected_points desc) as projected_rank
        from projected
      )
      select count(*)::integer,
             coalesce(jsonb_agg(
               jsonb_build_object(
                 'user_id', ranked.user_id,
                 'display_name', ranked.display_name,
                 'is_self', ranked.user_id = v_uid,
                 'entered', ranked.entry_id is not null,
                 'banked_points', ranked.banked_points,
                 'projected_matchweek_points', ranked.projected_matchweek,
                 'projected_points', ranked.projected_points,
                 'current_rank', ranked.current_rank,
                 'projected_rank', ranked.projected_rank)
               order by ranked.projected_points desc, ranked.display_name, ranked.user_id),
               '[]'::jsonb)
        into v_carried, v_table
        from ranked;

      v_league := jsonb_build_object(
        'league_id', p_league_id,
        'name', v_league_name,
        'revealed', true,
        'reason', null,
        'locks_at', v_locks_at,
        'members_total', v_member_total,
        'members_returned', v_carried,
        'members_truncated', v_carried < v_member_total,
        'table', v_table);
    end if;
  end if;

  return jsonb_build_object(
    'server_now', now(),
    'tournament_id', p_tournament_id,
    'matchweek', jsonb_build_object(
      'matchweek_id', v_round, 'ordinal', v_ordinal, 'label', v_label),
    'locks_at', v_locks_at,
    'locked', v_locked,
    'joker_played', v_joker,
    -- Post-Joker, exactly as `season_matchweek_points` reports it, so a
    -- projection and a banked total are the same kind of number.
    'projected_points', v_points,
    'settled', exists (
      select 1 from public.season_matchweek_scores score
       where score.entry_id = v_entry and score.competition_round_id = v_round),
    'fixtures', v_fixtures,
    'league', v_league);
end;
$whatif$;

revoke all on function public.get_season_matchweek_projection(uuid, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_matchweek_projection(uuid, integer, uuid)
  to authenticated;

comment on function public.get_season_matchweek_projection(uuid, integer, uuid) is
  'Contract 175 (INNOV-001). Read-only projection of one matchweek under the '
  'current or a hypothetical score, using the ADR 0012 scoring authority. '
  'Writes nothing, banks nothing, and reveals a rival only after that '
  'matchweek''s own lock inside a shared private league.';

commit;
