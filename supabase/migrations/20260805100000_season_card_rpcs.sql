-- Contract 114: the season matchweek card reaches the browser.
--
-- Contracts 68–96 built the Main Predictor's storage, locks, Jokers, scoring
-- and settlement, and then deliberately exposed none of it: every season table
-- revokes every browser grant, and until now `get_season_leaderboard` was the
-- only season function `authenticated` could call. The fixtures migration
-- recorded the intent — reads "arrive through a bounded RPC when the season
-- surfaces land". The season Match Predictor surface has now landed (UI-04,
-- behind its route flag), so this is that bounded RPC layer: one read and
-- three writes, each scoped to the caller's own entry, with every rule
-- enforced by the triggers that already own it rather than restated here.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD. No table grant — browser roles still
-- cannot touch `season_fixtures`, `season_predictions`, `season_matchweek_cards`
-- or `season_matchweek_jokers` directly, and RLS stays enabled with no
-- policies. No new rule: locks come from contract 69's trigger, the Joker
-- allowance from contract 69's trigger, version conflicts from contract 47's
-- shared `enforce_write_version`, and card semantics from contract 81. No read
-- of another player's data: the card read returns the caller's own predictions
-- and nothing about anyone else — reveal rules are not in question because
-- nothing is revealed.

begin;

-- ---------------------------------------------------------------------------
-- PART A — optimistic concurrency for season predictions.
--
-- Same mechanism as the tournament's contract 47, via the same trigger
-- function, so there is one version-conflict implementation in the database.
-- The incoming NEW.version is the version the client last read; a mismatch
-- raises PT409, which the browser's `isVersionConflict` already classifies as
-- terminal. Default 0 so the pre-existing development rows and fresh inserts
-- both start at 0, exactly as match_predictions did.
-- ---------------------------------------------------------------------------

alter table public.season_predictions
  add column version integer not null default 0;

create trigger enforce_version_season_predictions
  before update on public.season_predictions
  for each row execute function public.enforce_write_version();

-- ---------------------------------------------------------------------------
-- PART B — the lock also guards the delete path.
--
-- Contract 69's lock trigger fires on insert and update, which was complete
-- while nothing could delete: no browser role had any path to these tables.
-- A clear-prediction RPC changes that. Deleting a prediction after lock would
-- retroactively blank a banked fixture, and un-playing a Joker after lock
-- would halve a locked matchweek's score — both rewrite a competitive state
-- the lock froze. The function is redefined (append-only: redefinition in a
-- new migration, never an edit to the applied one) to serve DELETE, reading
-- OLD where NEW does not exist, and delete triggers attach it to both tables.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.enforce_season_matchweek_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_round uuid;
  v_tournament uuid;
  v_buffer integer;
  v_earliest timestamptz;
  v_missing integer;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  if tg_table_name = 'season_predictions' then
    select fixture.competition_round_id, fixture.tournament_id
      into v_round, v_tournament
      from public.season_fixtures fixture
     where fixture.id = v_row.season_fixture_id;
  else
    v_round := v_row.competition_round_id;
    v_tournament := v_row.tournament_id;
  end if;

  select definition.buffer_minutes into v_buffer
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = v_tournament
     and availability.game_key = 'main_predictor';

  if v_buffer is null then
    raise exception 'No Main Predictor availability for this season, so its lock cannot be resolved'
      using errcode = '23514';
  end if;

  select min(fixture.kickoff_at), count(*) filter (where fixture.kickoff_at is null)
    into v_earliest, v_missing
    from public.season_fixtures fixture
   where fixture.competition_round_id = v_round;

  if v_earliest is null or v_missing > 0 then
    raise exception 'This matchweek has unconfirmed kickoff times, so it is locked'
      using errcode = '55000';
  end if;

  if now() >= v_earliest - make_interval(mins => v_buffer) then
    raise exception 'This matchweek is locked'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_table_name = 'season_predictions' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger enforce_season_matchweek_lock_on_delete
  before delete on public.season_predictions
  for each row execute function predictor_internal.enforce_season_matchweek_lock();

create trigger enforce_season_matchweek_lock_on_delete
  before delete on public.season_matchweek_jokers
  for each row execute function predictor_internal.enforce_season_matchweek_lock();

-- ---------------------------------------------------------------------------
-- PART C — shared internal resolvers for the RPC layer.
--
-- Both are the boring lookups every function below needs. Kept internal:
-- neither is a browser capability, and `predictor_internal` functions carry no
-- Data API execution by default.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_card_context(
  p_tournament_id uuid,
  p_matchweek integer,
  out o_round_id uuid,
  out o_entry_id uuid,
  out o_matchweek_count integer,
  out o_half_size integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if p_tournament_id is null or p_matchweek is null then
    raise exception 'Season and matchweek are required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select count(*)::integer into o_matchweek_count
    from public.competition_rounds
   where tournament_id = p_tournament_id
     and kind = 'league_matchweek';

  if o_matchweek_count = 0 then
    raise exception 'This competition has no league matchweeks' using errcode = '22023';
  end if;

  o_half_size := o_matchweek_count / 2;

  select id into o_round_id
    from public.competition_rounds
   where tournament_id = p_tournament_id
     and kind = 'league_matchweek'
     and ordinal = p_matchweek;

  if o_round_id is null then
    raise exception 'Matchweek % does not exist in this season', p_matchweek
      using errcode = '22023';
  end if;

  -- The caller's own entry, or null. The read tolerates a missing entry (a
  -- player browsing before joining sees an empty card); every write refuses.
  select id into o_entry_id
    from public.entries
   where tournament_id = p_tournament_id
     and user_id = v_uid;
end;
$$;

revoke all on function predictor_internal.season_card_context(uuid, integer)
  from public, anon, authenticated;

create or replace function predictor_internal.require_season_entry(p_entry_id uuid)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_entry_id is null then
    raise exception 'You have not joined the Main Predictor for this season'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function predictor_internal.require_season_entry(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- PART D — the bounded read.
--
-- Everything the matchweek card renders, and only the caller's own data:
-- fixtures with kickoffs, statuses and confirmed results; the caller's saved
-- predictions with their versions (the client must echo these back, which is
-- what makes PT409 detectable); card status; Joker usage split by half so the
-- browser can display the allowance without recomputing the boundary; and the
-- settled matchweek total once settlement has written one.
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
  v_card_status text;
  v_joker jsonb;
  v_fixtures jsonb;
  v_points integer;
begin
  select * into v_ctx
    from predictor_internal.season_card_context(p_tournament_id, p_matchweek);

  if v_ctx.o_entry_id is null then
    v_card_status := 'no_submission';
  else
    select status into v_card_status
      from public.season_matchweek_cards
     where entry_id = v_ctx.o_entry_id
       and competition_round_id = v_ctx.o_round_id;
    v_card_status := coalesce(v_card_status, 'no_submission');
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

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', fixture.id,
      'kickoff_at', fixture.kickoff_at,
      'status', fixture.status,
      'home_name', home_team.name,
      'away_name', away_team.name,
      'result_home', case when fixture.status = 'played' then fixture.home_score end,
      'result_away', case when fixture.status = 'played' then fixture.away_score end,
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
    left join public.season_predictions prediction
      on prediction.season_fixture_id = fixture.id
     and prediction.entry_id = v_ctx.o_entry_id
   where fixture.competition_round_id = v_ctx.o_round_id;

  return jsonb_build_object(
    'matchweek', jsonb_build_object('number', p_matchweek, 'of', v_ctx.o_matchweek_count),
    'card_status', v_card_status,
    'joker', v_joker,
    'settled_points', v_points,
    'fixtures', v_fixtures
  );
end;
$$;

revoke all on function public.get_season_matchweek_card(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_matchweek_card(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- PART E — the three writes. Rules live in the triggers; these route to them.
-- ---------------------------------------------------------------------------

-- Save or clear one prediction. Both scores null clears (the card model's
-- "blank is a blank"); mixed nulls are contradictory input and refuse. The
-- card row is created as provisional on first engagement, which is exactly
-- the browser's optimistic transition — engaging the matchweek is what stops
-- it being unbanked.
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
    -- The delete trigger from Part B enforces the lock.
    delete from public.season_predictions
     where entry_id = v_entry and season_fixture_id = p_season_fixture_id;
  else
    insert into public.season_predictions
      (tournament_id, entry_id, season_fixture_id, home_score, away_score, version)
    values
      (p_tournament_id, v_entry, p_season_fixture_id, p_home, p_away, coalesce(p_version, 0))
    on conflict (entry_id, season_fixture_id) do update
      set home_score = excluded.home_score,
          away_score = excluded.away_score,
          version = excluded.version;
  end if;

  -- Engaging the matchweek at all makes the card provisional. Never downgrades
  -- a confirmed card: on conflict does nothing.
  insert into public.season_matchweek_cards (tournament_id, entry_id, competition_round_id, status)
  values (p_tournament_id, v_entry, v_round, 'provisional')
  on conflict (tournament_id, entry_id, competition_round_id) do nothing;

  select version into v_version
    from public.season_predictions
   where entry_id = v_entry and season_fixture_id = p_season_fixture_id;

  return jsonb_build_object('version', v_version);
end;
$$;

revoke all on function public.save_season_prediction(uuid, uuid, smallint, smallint, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.save_season_prediction(uuid, uuid, smallint, smallint, integer)
  to authenticated;

-- Play or take back the matchweek Joker. Insert routes through contract 69's
-- allowance and lock triggers; delete routes through Part B's lock trigger, so
-- a Joker cannot be added to or removed from a locked matchweek.
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
  else
    delete from public.season_matchweek_jokers
     where entry_id = v_ctx.o_entry_id
       and competition_round_id = v_ctx.o_round_id;
  end if;

  return jsonb_build_object('played', p_played);
end;
$$;

revoke all on function public.set_season_matchweek_joker(uuid, integer, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.set_season_matchweek_joker(uuid, integer, boolean)
  to authenticated;

-- Mark the card finished. Intent only — contract 82 removed everything a
-- confirmation could adopt, so provisional and confirmed submit the same
-- thing — but "I meant to leave that blank" and "I had not got to it" are
-- different things to have said, and the ledger keeps them apart. Refused
-- after lock: a statement of intent about a frozen card is backdating.
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
    (p_tournament_id, v_ctx.o_entry_id, v_ctx.o_round_id, 'confirmed', now())
  on conflict (tournament_id, entry_id, competition_round_id) do update
    set status = 'confirmed',
        confirmed_at = now(),
        updated_at = now();

  return jsonb_build_object('card_status', 'confirmed');
end;
$$;

revoke all on function public.confirm_season_matchweek_card(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_season_matchweek_card(uuid, integer)
  to authenticated;

commit;
