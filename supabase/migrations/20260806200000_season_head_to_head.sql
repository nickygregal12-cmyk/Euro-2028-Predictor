-- Contract 129: two season players, one matchweek, side by side.
--
-- ---------------------------------------------------------------------------
-- THE GAP
-- ---------------------------------------------------------------------------
--
-- `get_rival_entry` compares the caller with one other player, and every fact
-- in it is the tournament's: `entries.submitted_at`, `entry_totals`,
-- `match_predictions` over `public.matches` and `predicted_progression`. A
-- competition season writes none of them. Its picks are in `season_predictions`
-- against `season_fixtures`, its totals are banked per matchweek in
-- `season_matchweek_scores`, and it has no progression at all.
--
-- So a season had no head-to-head. Not a wrong one — none. The same shape as
-- contracts 116, 118, 120 and 128, at the comparison surface.
--
-- ---------------------------------------------------------------------------
-- THE REVEAL BOUNDARY IS THE MATCHWEEK'S OWN LOCK
-- ---------------------------------------------------------------------------
--
-- The tournament compares against ONE instant: `tournaments.lock_at`, after
-- which every entry is frozen and everything is revealed at once. A season has
-- no such instant. It locks per matchweek, and matchweek 4 being open says
-- nothing about matchweek 3.
--
-- So the reveal is per matchweek, from `predictor_internal.season_matchweek_lock_at`
-- — the same derivation the write trigger enforces, so a pick that can still be
-- changed can never be shown to an opponent.
--
-- ONE DELIBERATE ASYMMETRY, and it is the safe direction. That function returns
-- NULL when the round's fixture list has incomplete kickoffs, and the write
-- trigger treats that as LOCKED ("this matchweek has unconfirmed kickoff times,
-- so it is locked"). This treats it as NOT REVEALED. The two are consistent
-- rather than contradictory: the picks are indeed final, and declining to show
-- them costs nothing, while revealing on a null would mean a season whose
-- kickoffs have not been published exposes every pick in it.
--
-- ---------------------------------------------------------------------------
-- WHO MAY LOOK
-- ---------------------------------------------------------------------------
--
-- Contract 95's rule: the caller must hold an entry in the season they are
-- asking about, and so must the player they are asking about. It is
-- deliberately NOT `get_rival_entry`'s shared-league rule, and the reason is
-- that the season leaderboard already shows every entrant to every entrant —
-- a season is a competition people play together, not a set of private leagues
-- that happen to share fixtures. Narrowing this to league-mates later remains
-- available and would be a rule change with its own authority; widening it
-- afterwards would not.
--
-- A player is never compared with themselves: the answer is meaningless and
-- would render one column twice.
--
-- Nothing is written. No score, settlement, standing or prediction.

begin;

-- ---------------------------------------------------------------------------
-- One side of the comparison.
--
-- Written once and called twice rather than inlined twice, because the two
-- columns of a head-to-head must be built identically. A copied block that
-- diverges by one join is the kind of defect that shows the caller their own
-- Joker beside their opponent's points.
--
-- It reads only facts the caller is already entitled to at this point: the
-- matchweek is locked, and its callers have both established that.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_entrant_matchweek(
  p_tournament_id uuid,
  p_entry_id uuid,
  p_round_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $side$
  select jsonb_build_object(
    'user_id', p_user_id,
    'display_name', (
      select profile.display_name from public.profiles profile
       where profile.id = p_user_id
    ),
    -- Null rather than zero when the matchweek has not settled. Absence is not
    -- zero points, it is no matchweek — the same distinction
    -- `season_matchweek_scores` was built to preserve.
    'points', (
      select score.points from public.season_matchweek_scores score
       where score.entry_id = p_entry_id
         and score.competition_round_id = p_round_id
    ),
    'joker', exists (
      select 1 from public.season_matchweek_jokers joker
       where joker.entry_id = p_entry_id
         and joker.competition_round_id = p_round_id
    ),
    'predicted', (
      select count(*)::integer
        from public.season_predictions prediction
        join public.season_fixtures fixture
          on fixture.id = prediction.season_fixture_id
       where prediction.entry_id = p_entry_id
         and fixture.competition_round_id = p_round_id
    ),
    'season_points', (
      select coalesce(sum(score.points), 0)::integer
        from public.season_matchweek_scores score
       where score.entry_id = p_entry_id
         and score.tournament_id = p_tournament_id
    )
  );
$side$;

revoke all on function predictor_internal.season_entrant_matchweek(uuid, uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.get_season_head_to_head(
  p_tournament_id uuid,
  p_opponent_id uuid,
  p_matchweek integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $h2h$
declare
  v_ctx record;
  v_uid uuid;
  v_opponent_entry uuid;
  v_buffer integer;
  v_locks_at timestamptz;
begin
  if p_opponent_id is null then
    raise exception 'An opponent is required' using errcode = '22023';
  end if;

  -- Contract 114's resolver: authentication, the matchweek's round and the
  -- caller's own entry, from the one authority that already answers all three.
  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);

  v_uid := (select auth.uid());

  if p_opponent_id = v_uid then
    raise exception 'You cannot compare yourself with yourself'
      using errcode = '22023';
  end if;

  -- The caller's own entry. `require_season_entry` is contract 114's refusal,
  -- reused rather than reworded.
  perform predictor_internal.require_season_entry(v_ctx.o_entry_id);

  select entry.id into v_opponent_entry
    from public.entries entry
   where entry.tournament_id = p_tournament_id
     and entry.user_id = p_opponent_id;

  if v_opponent_entry is null then
    raise exception 'That player has not entered this season'
      using errcode = 'no_data_found';
  end if;

  select definition.buffer_minutes into v_buffer
    from public.game_definitions definition
   where definition.game_key = 'main_predictor';

  v_locks_at := predictor_internal.season_matchweek_lock_at(
    p_tournament_id, v_ctx.o_round_id, v_buffer
  );

  -- See the header for why a null lock hides rather than reveals.
  if v_locks_at is null or now() < v_locks_at then
    raise exception 'Other players'' predictions are hidden until the matchweek locks'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'matchweek', p_matchweek,
    'locked_at', v_locks_at,
    'server_now', now(),
    'you', predictor_internal.season_entrant_matchweek(
      p_tournament_id, v_ctx.o_entry_id, v_ctx.o_round_id, v_uid),
    'opponent', predictor_internal.season_entrant_matchweek(
      p_tournament_id, v_opponent_entry, v_ctx.o_round_id, p_opponent_id),
    'fixtures', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', fixture.id,
          'kickoff_at', fixture.kickoff_at,
          'status', fixture.status,
          'home_name', home_team.name,
          'away_name', away_team.name,
          -- Result exposure follows the matchweek card exactly: a fixture is
          -- 'played' or it has no result to show, whatever a provider has
          -- written provisionally.
          'result_home', case when fixture.status = 'played' then fixture.home_score end,
          'result_away', case when fixture.status = 'played' then fixture.away_score end,
          'your_prediction', case when yours.id is not null then
            jsonb_build_object('home', yours.home_score, 'away', yours.away_score) end,
          'their_prediction', case when theirs.id is not null then
            jsonb_build_object('home', theirs.home_score, 'away', theirs.away_score) end
        )
        order by fixture.kickoff_at nulls last, fixture.id
      ), '[]'::jsonb)
      from public.season_fixtures fixture
      join public.teams home_team on home_team.id = fixture.home_team_id
      join public.teams away_team on away_team.id = fixture.away_team_id
      left join public.season_predictions yours
        on yours.season_fixture_id = fixture.id
       and yours.entry_id = v_ctx.o_entry_id
      left join public.season_predictions theirs
        on theirs.season_fixture_id = fixture.id
       and theirs.entry_id = v_opponent_entry
      where fixture.competition_round_id = v_ctx.o_round_id
    )
  );
end;
$h2h$;

revoke all on function public.get_season_head_to_head(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_season_head_to_head(uuid, uuid, integer)
  to authenticated;

commit;
