-- ---------------------------------------------------------------------------
-- Contract 151 — MIG-UI-02: one player's season, and what they predicted.
--
-- Blocks domestic player profiles and every player link from a league table or
-- the Match Centre. A name in a standings row that leads nowhere is the shape
-- the UI has today.
--
-- THE DISCLOSURE BOUNDARY, which the register left for an owner decision and
-- which is taken here as the recommendation it names:
--
--   * Identity is visible to PRIVATE-LEAGUE CO-MEMBERS, and to nobody else.
--     Sharing a competition is not enough — a season may have fifty thousand
--     entrants and none of them agreed to be looked up by the others. Sharing a
--     private league is a mutual act.
--   * Prediction detail is visible only AFTER that matchweek's own lock, the
--     same boundary contract 149 uses and for the same reason: a season has no
--     single tournament-wide lock instant, so it has to be the round's own.
--   * THERE IS NO PLAYER DIRECTORY. This answers about one named player and
--     cannot enumerate, search or rank the population. A profile read that
--     could list people is a directory whatever it is called.
--
-- A player may always read their own profile, including matchweeks that have
-- not locked, because those are their own predictions and
-- `get_season_matchweek_card` already shows them.
--
-- POINTS ARE NEVER RECOMPUTED. Season totals and matchweek points come from the
-- same banked authorities the season and the leagues use, so three surfaces
-- cannot disagree about what a player scored.
--
-- Exact-score and correct-outcome COUNTS are derived here, and that is not a
-- second scoring authority: counting how often a prediction matched a result is
-- a fact about predictions, not an award of points. No point value appears in
-- this function. They are counted over SETTLED matchweeks only, which are
-- necessarily past their lock, so the count itself cannot leak an unlocked
-- prediction.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_player_profile(
  p_tournament_id uuid,
  p_player_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $profile$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_is_self boolean;
  v_shares_league boolean;
  v_entry uuid;
  v_display text;
  v_standings jsonb;
  v_season jsonb;
  v_accuracy jsonb;
  v_history jsonb;
  v_jokers jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_tournament_id is null or p_player_id is null then
    raise exception 'A competition season and a player are required' using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'That competition is not a league season; use the tournament player reads'
      using errcode = '22023';
  end if;

  v_is_self := (p_player_id = v_uid);

  -- The boundary. A shared PRIVATE LEAGUE on this season, not a shared
  -- competition: entering the same league season is not consent to be looked up.
  select exists (
    select 1
      from public.league_members mine
      join public.league_members theirs on theirs.league_id = mine.league_id
      join public.leagues league on league.id = mine.league_id
     where mine.user_id = v_uid
       and theirs.user_id = p_player_id
       and league.tournament_id = p_tournament_id
  ) into v_shares_league;

  if not (v_is_self or v_shares_league) then
    raise exception 'You do not share a private league with that player'
      using errcode = 'insufficient_privilege';
  end if;

  select profile.display_name into v_display
    from public.profiles profile where profile.id = p_player_id;

  if v_display is null then
    raise exception 'That player does not exist' using errcode = '22023';
  end if;

  select player_entry.id into v_entry
    from public.entries player_entry
   where player_entry.user_id = p_player_id
     and player_entry.tournament_id = p_tournament_id;

  -- A co-member who never entered the game is a real answer, not an error: they
  -- are in the league and have no season.
  if v_entry is null then
    return jsonb_build_object(
      'player', jsonb_build_object(
        'user_id', p_player_id, 'display_name', v_display, 'is_self', v_is_self),
      'entered', false, 'server_now', now(),
      'season', null, 'accuracy', null, 'jokers', null, 'history', '[]'::jsonb);
  end if;

  -- Banked season totals, from the authority the season and the leagues use.
  v_standings := predictor_internal.season_standings(p_tournament_id);

  select jsonb_build_object(
           'points', standing.points,
           'matchweeks_played', standing.matchweeks_played,
           'rank', standing.season_rank,
           'field_size', standing.field_size)
    into v_season
    from (
      select (row ->> 'entryId')::uuid as entry_id,
             (row ->> 'points')::integer as points,
             (row ->> 'matchweeksPlayed')::integer as matchweeks_played,
             rank() over (order by (row ->> 'points')::integer desc)::integer as season_rank,
             count(*) over ()::integer as field_size
        from jsonb_array_elements(coalesce(v_standings, '[]'::jsonb)) row) standing
   where standing.entry_id = v_entry;

  -- Accuracy, counted over settled matchweeks only. Counting is not scoring:
  -- no point value appears here, and the totals above are never recomputed.
  select jsonb_build_object(
           'fixtures_predicted', count(*),
           'exact_scores', count(*) filter (
             where fixture.home_score = prediction.home_score
               and fixture.away_score = prediction.away_score),
           'correct_outcomes', count(*) filter (
             where sign(fixture.home_score - fixture.away_score)
                 = sign(prediction.home_score - prediction.away_score)))
    into v_accuracy
    from public.season_predictions prediction
    join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
   where prediction.entry_id = v_entry
     and fixture.status = 'played'
     and exists (
       select 1 from public.season_matchweek_scores score
        where score.entry_id = v_entry
          and score.competition_round_id = fixture.competition_round_id);

  select jsonb_build_object(
           'played', count(*),
           'points_from_joker_matchweeks', coalesce(sum(score.points), 0))
    into v_jokers
    from public.season_matchweek_jokers joker
    left join public.season_matchweek_scores score
      on score.entry_id = joker.entry_id
     and score.competition_round_id = joker.competition_round_id
   where joker.entry_id = v_entry;

  -- History. Matchweeks whose own lock has passed, most recent first, bounded.
  -- The caller's own profile is not gated, because these are their own picks.
  select coalesce(jsonb_agg(entry order by ordinal desc), '[]'::jsonb)
    into v_history
    from (
      select round.ordinal,
             jsonb_build_object(
               'matchweek_id', round.id,
               'ordinal', round.ordinal,
               'label', round.label,
               'points', score.points,
               'joker_played', joker.entry_id is not null,
               'predictions', coalesce((
                 select jsonb_object_agg(prediction.season_fixture_id, jsonb_build_object(
                          'home', prediction.home_score,
                          'away', prediction.away_score))
                   from public.season_predictions prediction
                   join public.season_fixtures fixture
                     on fixture.id = prediction.season_fixture_id
                  where prediction.entry_id = v_entry
                    and fixture.competition_round_id = round.id), '{}'::jsonb)
             ) as entry
        from public.competition_rounds round
        left join public.season_matchweek_scores score
          on score.competition_round_id = round.id and score.entry_id = v_entry
        left join public.season_matchweek_jokers joker
          on joker.competition_round_id = round.id and joker.entry_id = v_entry
       where round.tournament_id = p_tournament_id
         and (
           v_is_self
           or predictor_internal.season_matchweek_lock_at(p_tournament_id, round.id, 0)
                <= now()
         )
         and exists (
           select 1 from public.season_predictions prediction
             join public.season_fixtures fixture on fixture.id = prediction.season_fixture_id
            where prediction.entry_id = v_entry
              and fixture.competition_round_id = round.id)
       order by round.ordinal desc
       limit 40) locked;

  return jsonb_build_object(
    'player', jsonb_build_object(
      'user_id', p_player_id, 'display_name', v_display, 'is_self', v_is_self),
    'entered', true,
    'server_now', now(),
    'season', v_season,
    'accuracy', v_accuracy,
    'jokers', v_jokers,
    'history', v_history);
end;
$profile$;

revoke all on function public.get_season_player_profile(uuid, uuid) from public, anon;
grant execute on function public.get_season_player_profile(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_definition text := pg_get_functiondef(
    'public.get_season_player_profile(uuid, uuid)'::regprocedure);
begin
  -- The disclosure boundary is a shared PRIVATE LEAGUE, never a shared season.
  if v_definition !~ 'league_members' or v_definition !~ 'league.tournament_id = p_tournament_id' then
    raise exception 'Identity must be gated on a shared private league';
  end if;

  -- Prediction detail is gated on the matchweek's own lock, server-resolved.
  if v_definition !~ 'season_matchweek_lock_at' then
    raise exception 'Prediction history must be gated on the matchweek lock';
  end if;

  if v_definition ~ 'p_now|p_as_of' then
    raise exception 'The reveal boundary must not accept a client-supplied time';
  end if;

  -- It answers about ONE named player. A profile read that could enumerate the
  -- population is a directory whatever it is called.
  if pg_catalog.array_length(
       (select proargnames from pg_proc where oid =
          'public.get_season_player_profile(uuid, uuid)'::regprocedure), 1) <> 2 then
    raise exception 'The profile read must take exactly a season and one player';
  end if;

  if exists (
    select 1 from information_schema.routine_privileges
     where routine_schema = 'public'
       and routine_name = 'get_season_player_profile'
       and grantee in ('anon', 'PUBLIC')
  ) then
    raise exception 'A player profile must not be readable anonymously';
  end if;
end;
$$;
