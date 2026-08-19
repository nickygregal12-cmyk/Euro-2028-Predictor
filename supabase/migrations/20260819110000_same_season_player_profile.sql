-- Contract 206 / PROF-001: a season entrant may open another entrant's bounded
-- competitive profile by the season-scoped player reference the leaderboard
-- already issued, without publishing the target's authentication identifier.
--
-- Contract 191 deliberately kept two concepts separate:
--   * `profile` = shared-private-league reach;
--   * `compare` = both players entered this competition season.
-- ADR 0031 / issue #863 now allows the bounded season profile at the second
-- boundary too. The distinction is still useful: pinning a rival and Prediction
-- DNA remain private-league-only, so turning every `compare` into `profile`
-- would silently widen unrelated features. Contract 206 therefore preserves the
-- reach vocabulary and widens only the PROFILE CAPABILITY of `compare`.
--
-- The new public address is `entries.id`, never `auth.users.id`. The legacy
-- UUID-addressed profile RPC remains deliberately narrow for existing callers.
-- A same-season-only viewer gets the profile through
-- `get_season_player_profile_by_ref` and the payload omits `player.user_id`
-- entirely. The target UUID is used internally to join existing authorities but
-- is never returned by the new path.
--
-- Prediction reveal is unchanged: another player's matchweek appears only after
-- that matchweek's own lock. Self still sees their own unlocked picks.

begin;

-- One payload builder for the two public entry points. It decides no permission;
-- callers must establish reach before calling it. Keeping the metrics/reveal
-- derivation here prevents the legacy UUID path and the new ref path drifting.
create or replace function predictor_internal.season_player_profile_payload(
  p_tournament_id uuid,
  p_player_id uuid,
  p_entry_id uuid,
  p_reach text,
  p_is_self boolean,
  p_include_user_id boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $payload$
declare
  v_display text;
  v_standings jsonb;
  v_season jsonb;
  v_accuracy jsonb;
  v_history jsonb;
  v_jokers jsonb;
  v_player jsonb;
begin
  select profile.display_name into v_display
    from public.profiles profile
   where profile.id = p_player_id;

  if v_display is null then
    raise exception 'That player does not exist' using errcode = '22023';
  end if;

  v_player := jsonb_build_object(
    'display_name', v_display,
    'is_self', p_is_self,
    'player_ref', p_entry_id,
    'reach', p_reach
  );

  if p_include_user_id then
    v_player := jsonb_build_object('user_id', p_player_id) || v_player;
  end if;

  -- The legacy private-league path can address a league member who never
  -- entered the season game. A ref-addressed call can never arrive here with a
  -- null entry because the ref itself is the entry.
  if p_entry_id is null then
    return jsonb_build_object(
      'player', v_player,
      'entered', false,
      'server_now', now(),
      'season', null,
      'accuracy', null,
      'jokers', null,
      'history', '[]'::jsonb
    );
  end if;

  -- Canonical banked standings. Rank is read from season_standings, not
  -- recomputed here.
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
             (row ->> 'rank')::integer as season_rank,
             count(*) over ()::integer as field_size
        from jsonb_array_elements(coalesce(v_standings, '[]'::jsonb)) row
    ) standing
   where standing.entry_id = p_entry_id;

  -- Accuracy is a count over settled evidence, not a second scoring authority.
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
    join public.season_fixtures fixture
      on fixture.id = prediction.season_fixture_id
   where prediction.entry_id = p_entry_id
     and fixture.status = 'played'
     and exists (
       select 1
         from public.season_matchweek_scores score
        where score.entry_id = p_entry_id
          and score.competition_round_id = fixture.competition_round_id
     );

  select jsonb_build_object(
           'played', count(*),
           'points_from_joker_matchweeks', coalesce(sum(score.points), 0))
    into v_jokers
    from public.season_matchweek_jokers joker
    left join public.season_matchweek_scores score
      on score.entry_id = joker.entry_id
     and score.competition_round_id = joker.competition_round_id
   where joker.entry_id = p_entry_id;

  -- Contract 151's reveal rule, unchanged. For another player the matchweek's
  -- own lock must have passed. Nothing is inferred from a missing round.
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
                 select jsonb_object_agg(
                          prediction.season_fixture_id,
                          jsonb_build_object(
                            'home', prediction.home_score,
                            'away', prediction.away_score))
                   from public.season_predictions prediction
                   join public.season_fixtures fixture
                     on fixture.id = prediction.season_fixture_id
                  where prediction.entry_id = p_entry_id
                    and fixture.competition_round_id = round.id
               ), '{}'::jsonb)
             ) as entry
        from public.competition_rounds round
        left join public.season_matchweek_scores score
          on score.competition_round_id = round.id
         and score.entry_id = p_entry_id
        left join public.season_matchweek_jokers joker
          on joker.competition_round_id = round.id
         and joker.entry_id = p_entry_id
       where round.tournament_id = p_tournament_id
         and (
           p_is_self
           or predictor_internal.season_matchweek_lock_at(
                p_tournament_id, round.id, 0) <= now()
         )
         and exists (
           select 1
             from public.season_predictions prediction
             join public.season_fixtures fixture
               on fixture.id = prediction.season_fixture_id
            where prediction.entry_id = p_entry_id
              and fixture.competition_round_id = round.id
         )
       order by round.ordinal desc
       limit 40
    ) locked;

  return jsonb_build_object(
    'player', v_player,
    'entered', true,
    'server_now', now(),
    'season', v_season,
    'accuracy', v_accuracy,
    'jokers', v_jokers,
    'history', v_history
  );
end;
$payload$;

comment on function predictor_internal.season_player_profile_payload(uuid, uuid, uuid, text, boolean, boolean) is
  'Contract 206. Shared bounded profile payload builder. It owns no permission: '
  'public entry points establish reach first. p_include_user_id exists only so '
  'the pre-existing private-league UUID RPC can preserve its payload; the new '
  'season-ref RPC passes false and therefore emits no authentication id.';

revoke all on function predictor_internal.season_player_profile_payload(uuid, uuid, uuid, text, boolean, boolean)
  from public, anon, authenticated, service_role;

-- Preserve the legacy UUID-addressed contract. It still requires self or a
-- shared private league; a UUID acquired elsewhere cannot be used as a new
-- cross-competition profile lookup key.
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
  v_reach text;
  v_entry uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_tournament_id is null or p_player_id is null then
    raise exception 'A competition season and a player are required' using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season
   where season.id = p_tournament_id;

  if v_kind is null then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  if v_kind <> 'league_season' then
    raise exception 'That competition is not a league season; use the tournament player reads'
      using errcode = '22023';
  end if;

  v_reach := predictor_internal.season_player_reach(
    p_tournament_id, v_uid, p_player_id);

  if v_reach not in ('self', 'profile') then
    raise exception 'You do not share a private league with that player'
      using errcode = 'insufficient_privilege';
  end if;

  select player_entry.id into v_entry
    from public.entries player_entry
   where player_entry.user_id = p_player_id
     and player_entry.tournament_id = p_tournament_id;

  return predictor_internal.season_player_profile_payload(
    p_tournament_id,
    p_player_id,
    v_entry,
    v_reach,
    v_reach = 'self',
    true
  );
end;
$profile$;

revoke all on function public.get_season_player_profile(uuid, uuid)
  from public, anon;
grant execute on function public.get_season_player_profile(uuid, uuid)
  to authenticated;

-- The new address for PROF-001. The caller's season membership is checked before
-- the target ref is resolved so an outsider cannot probe whether a ref exists.
create or replace function public.get_season_player_profile_by_ref(
  p_tournament_id uuid,
  p_player_ref uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $profile_ref$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_player_id uuid;
  v_reach text;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null or p_player_ref is null then
    raise exception 'A competition season and a player reference are required'
      using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season
   where season.id = p_tournament_id;

  if v_kind is null or v_kind <> 'league_season' then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  select entry.user_id into v_player_id
    from public.entries entry
   where entry.id = p_player_ref
     and entry.tournament_id = p_tournament_id;

  if v_player_id is null then
    raise exception 'That player is not in this competition season'
      using errcode = 'no_data_found';
  end if;

  v_reach := predictor_internal.season_player_reach(
    p_tournament_id, v_uid, v_player_id);

  if v_reach not in ('self', 'profile', 'compare') then
    raise exception 'You may not view that player' using errcode = '42501';
  end if;

  -- No caller of the ref-addressed path needs the target's auth UUID. Keep the
  -- season-scoped ref as the only identity that leaves this function.
  return predictor_internal.season_player_profile_payload(
    p_tournament_id,
    v_player_id,
    p_player_ref,
    v_reach,
    v_reach = 'self',
    false
  );
end;
$profile_ref$;

comment on function public.get_season_player_profile_by_ref(uuid, uuid) is
  'Contract 206 / PROF-001. One season-scoped entry ref in, one bounded '
  'reveal-safe competitive profile out. The caller must be an entrant in the '
  'same season. The payload deliberately omits auth.users/profile UUID identity; '
  'player_ref is the only navigation identity exposed by this path.';

revoke all on function public.get_season_player_profile_by_ref(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.get_season_player_profile_by_ref(uuid, uuid)
  to authenticated;

-- Contract 191's resolver already separates reach from the UUID it conditionally
-- returns. PROF-001 changes only the capability: compare can now open the
-- bounded ref profile, while playerId remains withheld unless the caller was
-- already at the older self/private-league boundary.
create or replace function public.resolve_season_player(
  p_tournament_id uuid,
  p_player_ref uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $resolve$
declare
  v_uid uuid := (select auth.uid());
  v_kind text;
  v_player uuid;
  v_display text;
  v_reach text;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null or p_player_ref is null then
    raise exception 'A competition season and a player reference are required'
      using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season
   where season.id = p_tournament_id;

  if v_kind is null or v_kind <> 'league_season' then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  select entry.user_id into v_player
    from public.entries entry
   where entry.id = p_player_ref
     and entry.tournament_id = p_tournament_id;

  if v_player is null then
    raise exception 'That player is not in this competition season'
      using errcode = 'no_data_found';
  end if;

  v_reach := predictor_internal.season_player_reach(
    p_tournament_id, v_uid, v_player);

  if v_reach = 'none' then
    raise exception 'You may not view that player' using errcode = '42501';
  end if;

  select profile.display_name into v_display
    from public.profiles profile
   where profile.id = v_player;

  return jsonb_build_object(
    'playerRef', p_player_ref,
    'reach', v_reach,
    'displayName', v_display,
    -- The UUID continues to obey the older narrow boundary. A compare-only row
    -- can open the by-ref profile without learning this value.
    'playerId', case
      when v_reach in ('self', 'profile') then to_jsonb(v_player)
      else null
    end,
    'canViewProfile', v_reach in ('self', 'profile', 'compare'),
    'canCompare', v_reach in ('self', 'profile', 'compare'),
    'server_now', now()
  );
end;
$resolve$;

comment on function public.resolve_season_player(uuid, uuid) is
  'Contract 206. Resolves one season-scoped player reference and states '
  'capabilities. compare now permits the bounded by-ref profile, but playerId '
  'remains limited to self/shared-private-league reach.';

revoke all on function public.resolve_season_player(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.resolve_season_player(uuid, uuid)
  to authenticated;

comment on function predictor_internal.season_player_reach(uuid, uuid, uuid) is
  'Contract 206 over Contract 191. Sole season-player reach classification: '
  'self, profile (shared private league), compare (same-season entrant), none. '
  'PROF-001 permits a bounded profile at compare through the season-ref RPC '
  'without turning compare into profile; co-member-only features such as pin '
  'and Prediction DNA therefore remain narrower.';

-- The old catalogue guard still proves nobody reintroduced the shared-league
-- boundary elsewhere. Contract 206 adds a capability at `compare`; it does not
-- copy the co-membership rule.
select predictor_internal.assert_single_season_player_visibility_authority();

commit;
