-- ===========================================================================
-- CONTRACT 212 — the matchweek card publishes the lock it is actually enforced
-- against.
--
-- This closes `ING-005`, which is not a data fault and not a security fault. It
-- is the surface disagreeing with the rule in the direction that costs a player
-- something.
--
-- WHAT WAS WRONG, EXACTLY.
--
-- Contract 119 made ENFORCEMENT per fixture: `enforce_season_matchweek_lock`
-- resolves a `season_predictions` write through
-- `predictor_internal.season_prediction_lock_at(fixture, buffer)`, which gives a
-- RESCHEDULED fixture its own kickoff and a POSTPONED one either its future
-- kickoff or no deadline at all. `get_season_matchweek_card` never learned any
-- of that. It published kickoffs and nothing else, so every client derived one
-- MATCHWEEK instant from the earliest kickoff on the card and drew the whole
-- card against it.
--
-- For an ordinary matchweek the two agree exactly, and that is why this went
-- unnoticed: `season_prediction_lock_at` delegates an unmoved fixture to
-- `season_matchweek_lock_at`, which is the round's earliest kickoff minus the
-- buffer, and every caller in the schema passes a buffer that resolves to zero.
-- The two answers diverge only for the fixture that MOVED — which is the only
-- fixture anyone needed them to be right about.
--
-- The consequence is one-directional and worth stating plainly, because it
-- decides how urgent this is. The surface was STRICTER than the rule. Nothing
-- illegal was ever possible: the trigger is the authority and it never accepted
-- a write it should have refused. What happened instead is that a player with a
-- postponed or rescheduled fixture was TOLD they could not predict it, while
-- the database would have taken the prediction. A game that refuses a legal
-- move is a broken game even when it is a safe one.
--
-- WHAT THIS CONTRACT DOES.
--
-- It publishes, per fixture on the card, the same instant the trigger would
-- enforce. Two fields:
--
--   * `lock_at`  — the finite instant this fixture locks at, or null when there
--                  is no finite instant to draw.
--   * `locked`   — whether that lock has already passed, as the database sees
--                  the clock right now.
--
-- BOTH, rather than one, and the reason is `season_prediction_lock_at`'s two
-- infinite answers. A `void` or `abandoned` fixture returns `-infinity`: locked
-- forever, no instant a surface could print. A `postponed` fixture whose old
-- kickoff is already behind us returns `infinity`: open indefinitely, and again
-- no printable instant — the new date is not known yet, which is the whole
-- meaning of a postponement. An infinity serialised into JSON is a string no
-- `Date` parser accepts, so publishing only `lock_at` would hand every client a
-- value it must special-case and some client eventually would not. `lock_at` is
-- therefore null in both infinite cases and `locked` carries the truth.
--
-- FAILING CLOSED IS PART OF THE CONTRACT. When the derivation yields NULL —
-- a matchweek with an unconfirmed kickoff, which is exactly the state contract
-- 83 already refuses a write for — `locked` is published TRUE. The card must
-- never invite an edit the trigger will refuse; that is the mirror image of the
-- fault being fixed here and it would be no better.
--
-- THE BUFFER IS READ, NOT ASSUMED. It would have been shorter to pass 0. Every
-- caller in the schema does resolve to 0 today, so the tests would have passed
-- and the value would have been a constant pretending to be a derivation. The
-- buffer belongs to `game_definitions.buffer_minutes` for the `main_predictor`
-- game on the tournament's LIVE availability, which is what contract 104's
-- `live_competition_id` resolves and what the enforcement trigger reads. This
-- migration adds `predictor_internal.season_prediction_buffer_minutes` so the
-- card reads that one place rather than restating the query.
--
-- WHY THE TRIGGER IS NOT REWRITTEN TO CALL THE HELPER. It should be, on the
-- face of it — two copies of one rule is what this repository dislikes most.
-- But `supabase/tests/155_live_competition_callers.sql` PINS the body of
-- `enforce_season_matchweek_lock` to contract 104's resolver, and it earned that
-- pin: it caught contract 114's redefinition copying an older body. Re-emitting
-- the trigger here to route through a helper would move the resolver out of the
-- pinned body and turn a working guard into a passing one that no longer checks
-- anything. The copies are instead held together where it counts — the new
-- pgTAP suite asserts the card's published instant EQUALS what
-- `season_prediction_lock_at` returns at the trigger's own buffer, so if the two
-- ever drift the suite says so.
--
-- WHAT THIS CONTRACT DOES NOT DO.
--
-- It does not reverse contract 119. Enforcement is unchanged: not one line of
-- `enforce_season_matchweek_lock` or `season_prediction_lock_at` moves. It adds
-- no column, no table, no policy and no grant; the RPC signature is untouched,
-- so the deployment contract's signature list is unchanged and only its counts
-- move. It does not add a "postponed" label, a club-specific rule, or any
-- frontend-side notion of a deadline: the instant is the database's, published,
-- and drawn.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The buffer, resolved in one place.
--
-- Null rather than an exception when a season has no live Main Predictor
-- availability. The trigger raises there because a WRITE with no resolvable
-- rule must not proceed; a READ with no resolvable rule must still answer, and
-- it answers by publishing `locked` true and no instant. Same fact, two
-- appropriate reactions.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_prediction_buffer_minutes(
  p_tournament_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $buffer$
  select definition.buffer_minutes
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = p_tournament_id
     and availability.game_key = 'main_predictor'
     and availability.id = predictor_internal.live_competition_id(
       p_tournament_id, 'main_predictor'
     );
$buffer$;

revoke all on function predictor_internal.season_prediction_buffer_minutes(uuid)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.season_prediction_buffer_minutes(uuid) is
  'Contract 212. The Main Predictor lock buffer for a season, from the live '
  'availability''s game definition. Null when the season has no live Main '
  'Predictor, which a read must publish as locked rather than as open.';

-- ---------------------------------------------------------------------------
-- 2. The card, republished with the per-fixture lock.
--
-- Everything else in this body is contract 136's verbatim. The only changes are
-- the buffer resolution above the fixture query, the lateral that asks the
-- authority per fixture, and the two new keys in the fixture object. Fields are
-- ADDED, never renamed or removed, so a client built against contract 136 keeps
-- reading exactly what it read.
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
  v_buffer integer;
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

  -- Contract 212. Resolved once for the card rather than once per fixture: the
  -- buffer is a property of the season's Main Predictor availability, and a
  -- per-row lookup would invite a future edit that made it a per-fixture one.
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
      -- Contract 212. The instant this fixture is enforced against, and whether
      -- it has passed. Finite instants only: `-infinity` (void or abandoned) and
      -- `infinity` (postponed with its old kickoff behind us) are real answers
      -- with nothing to print, so they publish a null instant and let `locked`
      -- speak. A null derivation publishes locked, which is the direction a
      -- surface must fail in.
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
    -- The authority, asked rather than re-implemented. A null buffer is not
    -- special-cased here on purpose: `season_prediction_lock_at` already
    -- returns null for a null or negative buffer, and `locked` turns that into
    -- true above. Re-testing it here would be a second copy of a rule that is
    -- already stated once, in the place that owns it.
    left join lateral (
      select predictor_internal.season_prediction_lock_at(fixture.id, v_buffer) as lock_at
    ) fixture_lock on true
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
  from public, anon, service_role;
grant execute on function public.get_season_matchweek_card(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Shape assertions, inside the migration transaction.
--
-- These check the INSTALLATION rather than the behaviour — behaviour is suite
-- 258's job, against seeded fixtures it controls. What can go wrong here is the
-- helper landing unreachable or the card landing without its new keys, and both
-- are worth catching before the transaction commits rather than after.
-- ---------------------------------------------------------------------------

do $$
declare
  v_source text;
begin
  if not exists (
    select 1 from pg_catalog.pg_proc proc
      join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
     where ns.nspname = 'predictor_internal'
       and proc.proname = 'season_prediction_buffer_minutes'
  ) then
    raise exception
      'Contract 212: season_prediction_buffer_minutes did not install, so the '
      'card would have had to guess a buffer.';
  end if;

  if exists (
    select 1 from information_schema.role_routine_grants
     where specific_schema = 'predictor_internal'
       and routine_name = 'season_prediction_buffer_minutes'
       and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
  ) then
    raise exception
      'Contract 212: season_prediction_buffer_minutes must not be reachable by a '
      'browser or service role.';
  end if;

  select proc.prosrc into v_source
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'public'
     and proc.proname = 'get_season_matchweek_card';

  if v_source is null then
    raise exception 'Contract 212: get_season_matchweek_card is missing.';
  end if;

  -- The card must ASK the authority. A body that computed a lock itself would
  -- pass every value assertion on an ordinary matchweek and be wrong on the one
  -- fixture that moved, which is precisely the fault being closed.
  if pg_catalog.strpos(v_source, 'season_prediction_lock_at') = 0 then
    raise exception
      'Contract 212: the card does not call season_prediction_lock_at, so its '
      'published instant is a second implementation of the lock rule.';
  end if;

  if pg_catalog.strpos(v_source, 'season_prediction_buffer_minutes') = 0 then
    raise exception
      'Contract 212: the card does not resolve the buffer from the game '
      'definition, so it is publishing against a hard-coded one.';
  end if;

  if pg_catalog.strpos(v_source, '''lock_at''') = 0
     or pg_catalog.strpos(v_source, '''locked''') = 0 then
    raise exception
      'Contract 212: the card does not publish both lock_at and locked, and the '
      'two infinite lock answers need both.';
  end if;
end;
$$;

commit;
