-- Contract 210: the live poll window opens before the deadline it protects.
--
-- THE ASSERTION THIS FILE EXISTS FOR is not "the number is 720". A number is
-- trivially re-asserted and tells a later reader nothing about why. What is
-- asserted is the RELATIONSHIP that number exists to satisfy:
--
--     at the instant predictions lock, the feed is already being polled
--     at live cadence rather than once a day
--
-- Contract 209 taught the chain to APPLY a postponement. This one is about
-- whether the chain LOOKS in time to find one, which is the half that decides
-- whether a player ever sees it before their prediction locks.
--
-- WHY THE MATCHWEEK LOCK IS THE INSTANT THAT MATTERS. An ordinary fixture does
-- not lock at its own kickoff. `season_prediction_lock_at` sends it to
-- `season_matchweek_lock_at`, which resolves to the EARLIEST kickoff of the
-- round minus a buffer, and every caller in this schema passes 0. A Sunday
-- fixture therefore locks at Saturday's first kickoff. That instant, not the
-- fixture's own, is what the live window has to cover.
--
-- THE REGRESSION THIS REFUSES is the one contract 210 repaired: a lead of 15
-- minutes, which opens the window a quarter of an hour before the deadline and
-- leaves everything earlier to a once-a-day idle poll. Both leads are exercised
-- below against the installed predicate, so the test fails if someone lowers
-- the lead back toward the default that caused ING-006 -- and it fails for the
-- stated reason rather than on a changed constant.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. That a postponement is detected,
-- decoded or applied: `255_provider_fixture_lifecycle.sql` drives that end to
-- end from real payload shapes. This file asserts only the timing property, and
-- it names no club, because a cadence rule that only holds for one fixture is
-- not a rule.

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- A tournament of its own, so the assertions cannot be moved by seeded data.
-- ---------------------------------------------------------------------------

create temporary table contract_210_fixtures (
  label text primary key,
  fixture_id uuid not null,
  kickoff_at timestamptz not null
) on commit drop;

do $$
declare
  v_tournament uuid;
  v_round uuid;
  v_home uuid;
  v_away uuid;
  v_first timestamptz := '2026-09-05 11:30:00+00';
  v_later timestamptz := '2026-09-06 15:00:00+00';
begin
  insert into public.tournaments (name, slug, display_timezone)
  values ('Contract 210 Cadence League', 'contract-210-cadence', 'Europe/London')
  returning id into v_tournament;

  insert into public.competition_rounds (tournament_id, name, sequence)
  values (v_tournament, 'Matchweek 1', 1)
  returning id into v_round;

  insert into public.teams (name, short_name)
  values ('Contract 210 Home', 'C210H') returning id into v_home;
  insert into public.teams (name, short_name)
  values ('Contract 210 Away', 'C210A') returning id into v_away;

  -- Two fixtures in ONE matchweek, deliberately on different days. The later
  -- one is the fixture a player is predicting; the earlier one is what its
  -- deadline actually resolves to.
  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_tournament, v_round, v_home, v_away, v_first, 'scheduled');
  insert into contract_210_fixtures
  select 'saturday', id, v_first from public.season_fixtures
   where tournament_id = v_tournament and kickoff_at = v_first;

  insert into public.season_fixtures
    (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
  values (v_tournament, v_round, v_away, v_home, v_later, 'scheduled');
  insert into contract_210_fixtures
  select 'sunday', id, v_later from public.season_fixtures
   where tournament_id = v_tournament and kickoff_at = v_later;

  insert into public.provider_poll_targets
    (provider, path, tournament_id, enabled)
  values ('sportmonks', '/contract-210/{{date:+0}}/{{date:+8}}', v_tournament, true);
end;
$$;

-- ---------------------------------------------------------------------------
-- The committed setting, and the default a new target inherits.
-- ---------------------------------------------------------------------------

select is(
  (select live_lead_minutes from public.provider_poll_targets
    where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
  720,
  'a target created after contract 210 inherits the deadline-covering lead'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where enabled and live_lead_minutes < 720),
  0,
  'no enabled target opens its live window too late to cover a deadline'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where enabled and cadence_minutes <> 1440),
  0,
  'the idle cadence is untouched: contract 210 buys coverage, not frequency'
);

select is(
  (select count(*)::integer from public.provider_poll_targets
    where enabled and live_cadence_minutes <> 10),
  0,
  'the live cadence is untouched; only how early the window opens changed'
);

-- ---------------------------------------------------------------------------
-- The deadline this has to cover, derived rather than restated.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_prediction_lock_at(
    (select fixture_id from contract_210_fixtures where label = 'sunday'), 0
  ),
  (select kickoff_at from contract_210_fixtures where label = 'saturday'),
  'the Sunday fixture locks at the SATURDAY kickoff, so that is the instant to cover'
);

-- ---------------------------------------------------------------------------
-- The property itself, against the installed predicate.
-- ---------------------------------------------------------------------------

select ok(
  predictor_internal.provider_target_is_live(
    (select tournament_id from public.provider_poll_targets
      where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
    (select kickoff_at from contract_210_fixtures where label = 'saturday'),
    720, 120
  ),
  'AT the matchweek lock the window is open, so the feed is on live cadence'
);

select ok(
  predictor_internal.provider_target_is_live(
    (select tournament_id from public.provider_poll_targets
      where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
    (select kickoff_at - interval '11 hours' from contract_210_fixtures where label = 'saturday'),
    720, 120
  ),
  'eleven hours BEFORE the lock the window is already open'
);

select ok(
  predictor_internal.provider_target_is_live(
    (select tournament_id from public.provider_poll_targets
      where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
    (select kickoff_at - interval '1 minute' from contract_210_fixtures where label = 'saturday'),
    720, 120
  ),
  'and one minute before the lock, which is the last moment a change can matter'
);

-- The regression, stated as the failure it was rather than as a number.
select ok(
  not predictor_internal.provider_target_is_live(
    (select tournament_id from public.provider_poll_targets
      where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
    (select kickoff_at - interval '1 hour' from contract_210_fixtures where label = 'saturday'),
    15, 120
  ),
  'WITH THE OLD 15-MINUTE LEAD the window was still shut an hour before the lock'
);

select ok(
  not predictor_internal.provider_target_is_live(
    (select tournament_id from public.provider_poll_targets
      where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
    (select kickoff_at - interval '6 hours' from contract_210_fixtures where label = 'saturday'),
    360, 120
  ),
  'and raising the IDLE cadence to six hours would not have opened it either'
);

-- ---------------------------------------------------------------------------
-- Still self-limiting. Contract 145's design must survive the wider lead.
-- ---------------------------------------------------------------------------

do $$
begin
  update public.season_fixtures
     set home_score = 1, away_score = 0, status = 'played'
   where id in (select fixture_id from contract_210_fixtures);
end;
$$;

select ok(
  not predictor_internal.provider_target_is_live(
    (select tournament_id from public.provider_poll_targets
      where path = '/contract-210/{{date:+0}}/{{date:+8}}'),
    (select kickoff_at - interval '1 hour' from contract_210_fixtures where label = 'saturday'),
    720, 120
  ),
  'once every fixture has a score the window closes, however wide the lead'
);

select is(
  (select count(*)::integer from public.season_fixtures
    where id in (select fixture_id from contract_210_fixtures)
      and home_score is null),
  0,
  'and that quiet is caused by the results being in, not by the window shrinking'
);

select * from finish();

rollback;
