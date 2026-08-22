-- ===========================================================================
-- CONTRACT 214 — a confirmation describes the CURRENT season card, not a card
-- that existed before the player's latest edit.
--
-- Closes UX-008. A confirmed card stayed confirmed after a prediction or Joker
-- changed while the matchweek was still open. The browser therefore displayed
-- "Your card is confirmed" for a different card from the one on screen.
--
-- The existing card row remains the one confirmation authority. This contract
-- adds no receipt/event table and no second ledger. A successful material edit
-- clears that row's confirmation back to provisional; a failed or no-op write
-- leaves it alone. The read publishes the server's existing confirmed_at and a
-- compact reference derived from the card id + confirmation instant. Reconfirming
-- after an edit therefore produces a new reference without storing another id.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. One deterministic, server-derived display reference.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_card_confirmation_reference(
  p_card_id uuid,
  p_confirmed_at timestamptz,
  p_matchweek integer
)
returns text
language sql
immutable
set search_path = ''
as $reference$
  select case
    when p_card_id is null or p_confirmed_at is null or p_matchweek is null then null
    else 'MW' || p_matchweek::text || '-' || upper(substr(md5(
      p_card_id::text || ':' ||
      ((extract(epoch from p_confirmed_at) * 1000000)::bigint)::text
    ), 1, 8))
  end;
$reference$;

revoke all on function predictor_internal.season_card_confirmation_reference(uuid, timestamptz, integer)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.season_card_confirmation_reference(uuid, timestamptz, integer) is
  'Contract 214. Human-readable reference for the current card confirmation, derived from the existing card id and confirmed_at. It stores no second receipt authority.';

-- ---------------------------------------------------------------------------
-- 2. A prediction save invalidates confirmation only when card content changed.
-- ---------------------------------------------------------------------------

create or replace function public.save_season_prediction(
  p_tournament_id uuid,
  p_season_fixture_id uuid,
  p_home smallint,
  p_away smallint,
  p_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_entry uuid;
  v_round uuid;
  v_ordinal integer;
  v_version integer;
  v_affected integer := 0;
  v_changed boolean := false;
begin
  if p_tournament_id is null or p_season_fixture_id is null then
    raise exception 'Season and fixture are required' using errcode = '22023';
  end if;
  if (p_home is null) <> (p_away is null) then
    raise exception 'A prediction needs both scores, or neither to clear it'
      using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select id into v_entry
    from public.entries
   where tournament_id = p_tournament_id and user_id = v_uid;
  perform predictor_internal.require_season_entry(v_entry);

  select fixture.competition_round_id, round.ordinal
    into v_round, v_ordinal
    from public.season_fixtures fixture
    join public.competition_rounds round on round.id = fixture.competition_round_id
   where fixture.id = p_season_fixture_id
     and fixture.tournament_id = p_tournament_id;

  if v_round is null then
    raise exception 'This fixture does not belong to this season' using errcode = '22023';
  end if;

  if p_home is null then
    delete from public.season_predictions
     where entry_id = v_entry and season_fixture_id = p_season_fixture_id;
    get diagnostics v_affected = row_count;
    v_changed := v_affected > 0;
  else
    -- The WHERE is load-bearing. The version trigger still owns a real UPDATE,
    -- but submitting the value already stored is a no-op: it must neither bump
    -- the version nor invalidate a confirmation that still describes the card.
    insert into public.season_predictions
      (tournament_id, entry_id, season_fixture_id, home_score, away_score, version)
    values
      (p_tournament_id, v_entry, p_season_fixture_id, p_home, p_away, coalesce(p_version, 0))
    on conflict (entry_id, season_fixture_id) do update
      set home_score = excluded.home_score,
          away_score = excluded.away_score,
          version = excluded.version
      where public.season_predictions.home_score is distinct from excluded.home_score
         or public.season_predictions.away_score is distinct from excluded.away_score;
    get diagnostics v_affected = row_count;
    v_changed := v_affected > 0;
  end if;

  if v_changed then
    -- First engagement still creates the provisional card, as contract 114 did.
    -- An existing confirmed card is deliberately downgraded because its content
    -- just changed. The constraint requires confirmed_at to clear with status.
    insert into public.season_matchweek_cards
      (tournament_id, entry_id, competition_round_id, status)
    values
      (p_tournament_id, v_entry, v_round, 'provisional')
    on conflict (tournament_id, entry_id, competition_round_id) do update
      set status = 'provisional',
          confirmed_at = null,
          updated_at = now()
      where public.season_matchweek_cards.status = 'confirmed';
  end if;

  select version into v_version
    from public.season_predictions
   where entry_id = v_entry and season_fixture_id = p_season_fixture_id;

  return jsonb_build_object('version', v_version, 'changed', v_changed);
end;
$$;

revoke all on function public.save_season_prediction(uuid, uuid, smallint, smallint, integer)
  from public, anon, service_role;
grant execute on function public.save_season_prediction(uuid, uuid, smallint, smallint, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Joker changes invalidate the same confirmation; Joker no-ops do not.
-- ---------------------------------------------------------------------------

create or replace function public.set_season_matchweek_joker(
  p_tournament_id uuid,
  p_matchweek integer,
  p_played boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_affected integer := 0;
  v_changed boolean := false;
begin
  if p_played is null then
    raise exception 'Played is required' using errcode = '22023';
  end if;

  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);
  perform predictor_internal.require_season_entry(v_ctx.o_entry_id);

  if p_played then
    insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
    values (p_tournament_id, v_ctx.o_entry_id, v_ctx.o_round_id)
    on conflict (entry_id, competition_round_id) do nothing;
    get diagnostics v_affected = row_count;
  else
    delete from public.season_matchweek_jokers
     where entry_id = v_ctx.o_entry_id
       and competition_round_id = v_ctx.o_round_id;
    get diagnostics v_affected = row_count;
  end if;

  v_changed := v_affected > 0;

  if v_changed then
    update public.season_matchweek_cards
       set status = 'provisional',
           confirmed_at = null,
           updated_at = now()
     where tournament_id = p_tournament_id
       and entry_id = v_ctx.o_entry_id
       and competition_round_id = v_ctx.o_round_id
       and status = 'confirmed';
  end if;

  return jsonb_build_object('played', p_played, 'changed', v_changed);
end;
$$;

revoke all on function public.set_season_matchweek_joker(uuid, integer, boolean)
  from public, anon, service_role;
grant execute on function public.set_season_matchweek_joker(uuid, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Confirmation returns the same server facts the read publishes.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_season_matchweek_card(
  p_tournament_id uuid,
  p_matchweek integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_buffer integer;
  v_lock_at timestamptz;
  v_card_id uuid;
  v_confirmed_at timestamptz;
begin
  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);
  perform predictor_internal.require_season_entry(v_ctx.o_entry_id);

  select definition.buffer_minutes into v_buffer
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = p_tournament_id
     and availability.game_key = 'main_predictor';

  v_lock_at := predictor_internal.season_matchweek_lock_at(
    p_tournament_id, v_ctx.o_round_id, coalesce(v_buffer, 0));

  if v_lock_at is null or now() >= v_lock_at then
    raise exception 'This matchweek is locked' using errcode = '55000';
  end if;

  insert into public.season_matchweek_cards
    (tournament_id, entry_id, competition_round_id, status, confirmed_at)
  values
    (p_tournament_id, v_ctx.o_entry_id, v_ctx.o_round_id, 'confirmed', clock_timestamp())
  on conflict (tournament_id, entry_id, competition_round_id) do update
    set status = 'confirmed',
        confirmed_at = clock_timestamp(),
        updated_at = now()
  returning id, confirmed_at into v_card_id, v_confirmed_at;

  return jsonb_build_object(
    'card_status', 'confirmed',
    'confirmed_at', v_confirmed_at,
    'confirmation_reference', predictor_internal.season_card_confirmation_reference(
      v_card_id, v_confirmed_at, p_matchweek
    )
  );
end;
$$;

revoke all on function public.confirm_season_matchweek_card(uuid, integer)
  from public, anon, service_role;
grant execute on function public.confirm_season_matchweek_card(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Republish the contract-212 card with confirmation facts added.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_matchweek_card(
  p_tournament_id uuid,
  p_matchweek integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ctx record;
  v_card_id uuid;
  v_card_status text;
  v_confirmed_at timestamptz;
  v_confirmation_reference text;
  v_joker jsonb;
  v_fixtures jsonb;
  v_points integer;
  v_buffer integer;
begin
  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);

  if v_ctx.o_entry_id is null then
    v_card_status := 'no_submission';
  else
    select id, status, confirmed_at
      into v_card_id, v_card_status, v_confirmed_at
      from public.season_matchweek_cards
     where entry_id = v_ctx.o_entry_id
       and competition_round_id = v_ctx.o_round_id;
    v_card_status := coalesce(v_card_status, 'no_submission');
  end if;

  if v_card_status = 'confirmed' then
    v_confirmation_reference := predictor_internal.season_card_confirmation_reference(
      v_card_id, v_confirmed_at, p_matchweek
    );
  else
    v_confirmed_at := null;
    v_confirmation_reference := null;
  end if;

  select jsonb_build_object(
      'played', count(*) filter (where round.id = v_ctx.o_round_id) > 0,
      'used_first_half', count(*) filter (where round.ordinal <= v_ctx.o_half_size),
      'used_second_half', count(*) filter (where round.ordinal > v_ctx.o_half_size),
      'matchweek_count', v_ctx.o_matchweek_count
    )
    into v_joker
    from public.season_matchweek_jokers joker
    join public.competition_rounds round on round.id = joker.competition_round_id
   where joker.entry_id = v_ctx.o_entry_id
     and round.kind = 'league_matchweek';

  select points into v_points
    from public.season_matchweek_scores
   where entry_id = v_ctx.o_entry_id
     and competition_round_id = v_ctx.o_round_id;

  v_buffer := predictor_internal.season_prediction_buffer_minutes(p_tournament_id);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', fixture.id,
      'kickoff_at', fixture.kickoff_at,
      'status', fixture.status,
      'home_name', home_team.name,
      'away_name', away_team.name,
      'home_short_code', home_identity.short_code,
      'away_short_code', away_identity.short_code,
      'home_club_colours', home_identity.club_colours,
      'away_club_colours', away_identity.club_colours,
      'lock_at', case
        when fixture_lock.lock_at is null then null
        when fixture_lock.lock_at in ('infinity'::timestamptz, '-infinity'::timestamptz) then null
        else fixture_lock.lock_at
      end,
      'locked', coalesce(pg_catalog.now() >= fixture_lock.lock_at, true),
      'result_home', case when fixture.status = 'played' then fixture.home_score end,
      'result_away', case when fixture.status = 'played' then fixture.away_score end,
      'live', case when live.season_fixture_id is not null then jsonb_build_object(
        'kind', live.kind,
        'home', live.home_score,
        'away', live.away_score,
        'observed_at', live.observed_at
      ) end,
      'prediction', case when prediction.id is not null then jsonb_build_object(
        'home', prediction.home_score,
        'away', prediction.away_score,
        'version', prediction.version
      ) end
    ) order by fixture.kickoff_at nulls last, fixture.id), '[]'::jsonb)
    into v_fixtures
    from public.season_fixtures fixture
    join public.teams home_team on home_team.id = fixture.home_team_id
    join public.teams away_team on away_team.id = fixture.away_team_id
    left join predictor_internal.club_identity_reference home_identity
      on home_identity.normalised_name
       = predictor_internal.normalised_club_name(home_team.name)
    left join predictor_internal.club_identity_reference away_identity
      on away_identity.normalised_name
       = predictor_internal.normalised_club_name(away_team.name)
    left join predictor_internal.season_fixture_live_state live
      on live.season_fixture_id = fixture.id
    left join public.season_predictions prediction
      on prediction.season_fixture_id = fixture.id
     and prediction.entry_id = v_ctx.o_entry_id
    left join lateral (
      select predictor_internal.season_prediction_lock_at(fixture.id, v_buffer) as lock_at
    ) fixture_lock on true
   where fixture.competition_round_id = v_ctx.o_round_id;

  return jsonb_build_object(
    'matchweek', jsonb_build_object('number', p_matchweek, 'of', v_ctx.o_matchweek_count),
    'card_status', v_card_status,
    'confirmed_at', v_confirmed_at,
    'confirmation_reference', v_confirmation_reference,
    'joker', v_joker,
    'settled_points', v_points,
    'fixtures', v_fixtures
  );
end;
$$;

revoke all on function public.get_season_matchweek_card(uuid, integer)
  from public, anon, service_role;
grant execute on function public.get_season_matchweek_card(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Installation assertions: the contract cannot silently lose its three
-- defining properties in a later partial edit.
-- ---------------------------------------------------------------------------

do $$
declare
  v_read text;
  v_save text;
  v_joker text;
begin
  select proc.prosrc into v_read
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'public' and proc.proname = 'get_season_matchweek_card';

  select proc.prosrc into v_save
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'public' and proc.proname = 'save_season_prediction';

  select proc.prosrc into v_joker
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'public' and proc.proname = 'set_season_matchweek_joker';

  if v_read is null
     or strpos(v_read, '''confirmed_at''') = 0
     or strpos(v_read, '''confirmation_reference''') = 0 then
    raise exception 'Contract 214: the card read does not publish confirmation evidence';
  end if;

  if v_save is null
     or strpos(v_save, 'confirmed_at = null') = 0
     or strpos(v_save, 'v_changed') = 0 then
    raise exception 'Contract 214: prediction changes do not invalidate confirmation selectively';
  end if;

  if v_joker is null
     or strpos(v_joker, 'confirmed_at = null') = 0
     or strpos(v_joker, 'v_changed') = 0 then
    raise exception 'Contract 214: Joker changes do not invalidate confirmation selectively';
  end if;
end;
$$;

commit;
