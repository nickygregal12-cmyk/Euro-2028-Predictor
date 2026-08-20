-- Contract 212: the matchweek card publishes the lock it is enforced against.
--
-- THE ASSERTION THIS FILE EXISTS FOR is a RELATIONSHIP, not a constant:
--
--     for every fixture on the card, the instant the card publishes is the
--     instant `season_prediction_lock_at` would enforce against a write
--
-- Asserting a value instead would prove nothing, and would have proved nothing
-- before this contract either. `season_prediction_lock_at` sends an UNMOVED
-- fixture to `season_matchweek_lock_at` — the round's earliest kickoff minus a
-- buffer that every caller in this schema resolves to zero — so on an ordinary
-- matchweek the old matchweek-wide publication and the per-fixture authority
-- agree exactly. A suite that seeded four ordinary fixtures and compared
-- timestamps would have passed against the BROKEN card. The divergent fixture
-- is the whole test, and it is seeded below on purpose.
--
-- WHAT ING-005 ACTUALLY WAS. Contract 119 made enforcement per fixture and left
-- publication per matchweek. The surface was therefore STRICTER than the rule:
-- a rescheduled or postponed fixture read as locked while the trigger would
-- have accepted the write. Nothing illegal was possible — which is exactly why
-- this could sit unnoticed — but a player was told they could not do something
-- they could.
--
-- THE THREE DIVERGENT CASES, all seeded here rather than described:
--
--   * a POSTPONED fixture with a FUTURE kickoff still has a deadline, and it is
--     its own kickoff rather than the matchweek's;
--   * a POSTPONED fixture whose old kickoff is BEHIND us has no known date, so
--     it has no instant to publish and must not read as locked — locking on the
--     date it was called off on is the permanent lock a postponement must never
--     create;
--   * a RESCHEDULED fixture answers for its own new kickoff, which is contract
--     119 unchanged.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. That a provider payload produces any
-- of those states: `255_provider_fixture_lifecycle.sql` drives that end to end.
-- This file starts from the state and asserts what the card says about it. It
-- names no club, and it takes no fixture from any real calendar: a publication
-- rule that only holds for one club's postponement is not a rule.

begin;

select plan(14);

-- `get_season_matchweek_card` is a PLAYER read and refuses an unauthenticated
-- caller with 42501, by way of `season_card_context`. The subject below is a
-- claim and nothing more: the context tolerates a caller with no entry (a
-- player browsing before joining sees an empty card), and every assertion in
-- this file is about the FIXTURE half of the card, which does not depend on
-- whose entry it is.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000212', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000212","role":"authenticated"}', true);

-- ---------------------------------------------------------------------------
-- A season of its own, so no seeded row can move an assertion below.
--
-- Every column this table constrains by value is INHERITED from a real league
-- season rather than guessed, so the row stays legal as those vocabularies
-- grow. SIX clubs, not two: `assert_season_fixture_shape` enforces that a club
-- plays at most once per matchweek, so three fixtures in one matchweek cannot
-- be the same pair rearranged.
-- ---------------------------------------------------------------------------

create temporary table contract_212_fixtures (
  label text primary key,
  fixture_id uuid not null
) on commit drop;

create temporary table contract_212_season (
  tournament_id uuid not null,
  round_id uuid not null,
  buffer_minutes integer
) on commit drop;

do $$
declare
  v_tournament uuid;
  v_round uuid;
  v_club uuid[] := '{}';
  v_one uuid;
  v_ordinary timestamptz := '2026-09-05 11:30:00+00';
  v_middle   timestamptz := '2026-09-05 14:00:00+00';
  v_late     timestamptz := '2026-09-06 15:00:00+00';
  v_index integer;
begin
  insert into public.tournaments
    (competition_id, name, year, season_key, kind, display_timezone, status)
  select source.competition_id,
         'Contract 212 Lock Publication Season',
         source.year,
         'contract-212-lock-publication',
         source.kind,
         source.display_timezone,
         source.status
    from public.tournaments source
   where source.kind = 'league_season'
   order by source.name
   limit 1
  returning id into v_tournament;

  -- A LIVE Main Predictor availability, because the buffer is read from its
  -- game definition and a season without one publishes no instant at all. Its
  -- `availability_status` is inherited from a real row for the same reason the
  -- tournament's columns are: a vocabulary that grows must not strand this file.
  -- The series is fresh, so `bonus_competitions_series_sequence_key` cannot
  -- collide with a seeded one.
  insert into public.bonus_competitions
    (tournament_id, game_key, availability_status, visibility_kind,
     series_id, series_sequence, published)
  select v_tournament, 'main_predictor', source.availability_status, 'public',
         gen_random_uuid(), 1, source.published
    from public.bonus_competitions source
   where source.game_key = 'main_predictor'
     and source.visibility_kind = 'public'
   order by source.created_at
   limit 1;

  insert into public.competition_rounds
    (tournament_id, round_key, ordinal, kind, label)
  values (v_tournament, 'c212-mw1', 974, 'league_matchweek', 'Contract 212 Matchweek 1')
  returning id into v_round;

  for v_index in 1..6 loop
    insert into public.teams (tournament_id, name)
    values (v_tournament, 'Contract 212 Club ' || v_index)
    returning id into v_one;
    v_club := v_club || v_one;
  end loop;

  -- The ordinary fixture. Its kickoff is the EARLIEST of the round, so it is
  -- also what the matchweek rule resolves to for everything that has not moved.
  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_tournament, v_round, v_club[1], v_club[2], v_ordinary, 'scheduled')
  returning id into v_one;
  insert into contract_212_fixtures values ('ordinary', v_one);

  -- A second ordinary fixture, later on the same weekend. This is the one that
  -- proves the matchweek rule is still in force: it must publish the EARLIEST
  -- kickoff and not its own.
  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_tournament, v_round, v_club[3], v_club[4], v_late, 'scheduled')
  returning id into v_one;
  insert into contract_212_fixtures values ('later_same_matchweek', v_one);

  -- The fixture that moved. Seeded scheduled at a middle instant and mutated
  -- per assertion below, so one row carries all three divergent states in turn
  -- and the club count stays legal.
  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_tournament, v_round, v_club[5], v_club[6], v_middle, 'scheduled')
  returning id into v_one;
  insert into contract_212_fixtures values ('moved', v_one);

  insert into contract_212_season
  values (v_tournament, v_round,
          predictor_internal.season_prediction_buffer_minutes(v_tournament));
end;
$$;

-- ---------------------------------------------------------------------------
-- The buffer is read from the game definition, not assumed.
--
-- This is asserted for the same reason the migration resolves it rather than
-- passing 0: the value IS 0 today on every season, so a hard-coded 0 would pass
-- every timestamp comparison in this file. What is checked is therefore that
-- the helper resolves the SAME buffer the enforcement trigger reads — from the
-- live Main Predictor availability's game definition — rather than that it
-- returns any particular number.
-- ---------------------------------------------------------------------------

select is(
  (select buffer_minutes from contract_212_season),
  (select definition.buffer_minutes
     from public.bonus_competitions availability
     join public.game_definitions definition on definition.game_key = availability.game_key
    where availability.tournament_id = (select tournament_id from contract_212_season)
      and availability.game_key = 'main_predictor'
      and availability.id = predictor_internal.live_competition_id(
        (select tournament_id from contract_212_season), 'main_predictor'
      )),
  'the card resolves the same lock buffer the enforcement trigger reads'
);

select isnt(
  (select buffer_minutes from contract_212_season),
  null,
  'and it resolves one at all for a season with a live Main Predictor'
);

-- ---------------------------------------------------------------------------
-- The relationship, on every fixture of an ordinary matchweek.
-- ---------------------------------------------------------------------------

create or replace function pg_temp.published_lock(p_label text)
returns timestamptz
language sql
as $$
  select (fixture ->> 'lock_at')::timestamptz
    from contract_212_season season,
         jsonb_array_elements(
           public.get_season_matchweek_card(season.tournament_id, 974) -> 'fixtures'
         ) fixture
   where (fixture ->> 'id')::uuid
       = (select fixture_id from contract_212_fixtures where label = p_label);
$$;

create or replace function pg_temp.published_locked(p_label text)
returns boolean
language sql
as $$
  select (fixture ->> 'locked')::boolean
    from contract_212_season season,
         jsonb_array_elements(
           public.get_season_matchweek_card(season.tournament_id, 974) -> 'fixtures'
         ) fixture
   where (fixture ->> 'id')::uuid
       = (select fixture_id from contract_212_fixtures where label = p_label);
$$;

create or replace function pg_temp.enforced_lock(p_label text)
returns timestamptz
language sql
as $$
  select predictor_internal.season_prediction_lock_at(
    (select fixture_id from contract_212_fixtures where label = p_label),
    (select buffer_minutes from contract_212_season)
  );
$$;

select is(
  (select count(*)::integer
     from contract_212_season season,
          jsonb_array_elements(
            public.get_season_matchweek_card(season.tournament_id, 974) -> 'fixtures'
          ) fixture
    where not (fixture ? 'lock_at') or not (fixture ? 'locked')),
  0,
  'every fixture on the card publishes both a lock instant and whether it has passed'
);

select is(
  (select count(*)::integer
     from contract_212_season season,
          jsonb_array_elements(
            public.get_season_matchweek_card(season.tournament_id, 974) -> 'fixtures'
          ) fixture
    where (fixture ->> 'lock_at')::timestamptz is distinct from
          predictor_internal.season_prediction_lock_at(
            (fixture ->> 'id')::uuid, season.buffer_minutes
          )),
  0,
  'and every published instant is the one the enforcement authority would use'
);

select is(
  pg_temp.published_lock('later_same_matchweek'),
  (select min(kickoff_at) from public.season_fixtures
    where competition_round_id = (select round_id from contract_212_season)),
  'an unmoved fixture still publishes its MATCHWEEK deadline, not its own kickoff'
);

select isnt(
  pg_temp.published_lock('later_same_matchweek'),
  (select kickoff_at from public.season_fixtures
    where id = (select fixture_id from contract_212_fixtures where label = 'later_same_matchweek')),
  'which for a later fixture is a different instant, so the matchweek rule is intact'
);

-- ---------------------------------------------------------------------------
-- The divergence. This is the fault ING-005 named.
-- ---------------------------------------------------------------------------

-- A POSTPONED fixture whose kickoff is still ahead of us. The football may
-- still start then, so that instant is its deadline — and it is not the
-- matchweek's.
update public.season_fixtures
   set status = 'postponed', kickoff_at = now() + interval '30 days'
 where id = (select fixture_id from contract_212_fixtures where label = 'moved');

select is(
  pg_temp.published_lock('moved'),
  pg_temp.enforced_lock('moved'),
  'a postponed fixture with a future kickoff publishes what the trigger enforces'
);

select isnt(
  pg_temp.published_lock('moved'),
  (select min(kickoff_at) from public.season_fixtures
    where competition_round_id = (select round_id from contract_212_season)
      and id <> (select fixture_id from contract_212_fixtures where label = 'moved')),
  'and that instant DIVERGES from the matchweek instant the card used to publish'
);

select is(
  pg_temp.published_locked('moved'),
  false,
  'so the player is not told a fixture they may still predict is locked'
);

-- The same fixture, now with its old kickoff behind us: a postponement with no
-- announced replacement date. There is nothing to print and nothing to lock on.
update public.season_fixtures
   set kickoff_at = now() - interval '2 days'
 where id = (select fixture_id from contract_212_fixtures where label = 'moved');

select is(
  pg_temp.published_lock('moved'),
  null,
  'a postponement with no known date publishes no instant rather than an infinity'
);

select is(
  pg_temp.published_locked('moved'),
  false,
  'and it is open, because locking on the date it was called off on is permanent'
);

-- A RESCHEDULED fixture. Contract 119 unchanged: the revision is what makes it
-- answer for itself, and the card must publish that answer.
update public.season_fixtures
   set status = 'scheduled', kickoff_at = now() + interval '45 days'
 where id = (select fixture_id from contract_212_fixtures where label = 'moved');

insert into predictor_internal.season_fixture_revisions
  (tournament_id, season_fixture_id, provider, previous_kickoff_at, new_kickoff_at)
values (
  (select tournament_id from contract_212_season),
  (select fixture_id from contract_212_fixtures where label = 'moved'),
  'sportmonks',
  '2026-09-05 14:00:00+00',
  now() + interval '45 days'
);

select is(
  pg_temp.published_lock('moved'),
  pg_temp.enforced_lock('moved'),
  'a rescheduled fixture publishes what the trigger enforces, which is its own kickoff'
);

select isnt(
  pg_temp.published_lock('moved'),
  (select min(kickoff_at) from public.season_fixtures
    where competition_round_id = (select round_id from contract_212_season)
      and id <> (select fixture_id from contract_212_fixtures where label = 'moved')),
  'and not the matchweek instant, which is the divergence ING-005 was about'
);

-- ---------------------------------------------------------------------------
-- Failing closed. The mirror image of the fault, and no better than it.
--
-- A fixture whose kickoff is unknown is the one state contract 83 already
-- refuses a write for, so the card must publish LOCKED rather than an inviting
-- null. `season_prediction_lock_at` returns null there, and `locked` coalesces
-- that to true.
-- ---------------------------------------------------------------------------

-- The revision row is left in place, and not because it is convenient:
-- `block_season_fixture_revision_rewrite` refuses to let one be deleted, which
-- is the right rule and is asserted elsewhere. It also makes this the stronger
-- case. The moved fixture is still RESCHEDULED here, so it takes the
-- rescheduled branch of the authority, finds its own kickoff cleared, and falls
-- back to the matchweek rule — where every kickoff is now unknown. A fixture
-- that answers for itself must fail closed too, not only the ones that never
-- moved.
update public.season_fixtures set kickoff_at = null
 where competition_round_id = (select round_id from contract_212_season);

select is(
  (select count(*)::integer
     from contract_212_season season,
          jsonb_array_elements(
            public.get_season_matchweek_card(season.tournament_id, 974) -> 'fixtures'
          ) fixture
    where (fixture ->> 'locked')::boolean is not true),
  0,
  'a matchweek with unconfirmed kickoffs publishes every fixture LOCKED, not open'
);

select * from finish();

rollback;
