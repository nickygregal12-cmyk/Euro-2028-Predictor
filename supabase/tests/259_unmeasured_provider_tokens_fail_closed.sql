-- Contract 213: the unmeasured SportMonks tokens fail closed.
--
-- THE ASSERTION THIS FILE EXISTS FOR is not "seven rows were deleted". A count
-- of deleted rows is trivially re-asserted and proves nothing about behaviour.
-- What is asserted is what the absence BUYS:
--
--     a token the system has never measured resolves to `unknown`, moves no
--     fixture, and is RECORDED where it can be measured against a real payload
--
-- Contract 209 closed the first half of `ING-002` by measuring SportMonks token
-- `10` from retained payloads. It deliberately removed none of contract 135's
-- documentation-seeded tokens, on the grounds that replacing one guess with
-- another is not an improvement. That is right, and it is why contract 213
-- REMOVES them rather than remapping them: the improvement is the absence.
--
-- WHY THE EVIDENCE MATTERED MORE THAN THE INTENT. `14` is the token the
-- provider's documentation calls "postponed", and `10` is what the provider
-- actually sends for one. Both were mapped `postponed`, and nothing in the table
-- distinguished the observed one from the documented one except a note. `15`
-- (`cancelled`) and `16`–`18` (`abandoned`) are worse: acting on either would
-- take a fixture away from a player on no evidence that this provider ever says
-- those words. Read-only measurement across BOTH hosted environments on
-- 20 August 2026 found `1, 2, 3, 5, 10, 22` in 440 retained Development
-- responses and `1, 5, 10` in 21 Production ones — not one of `14`–`21`
-- anywhere.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. That a postponement is detected,
-- decoded or applied end to end: `255_provider_fixture_lifecycle.sql` drives
-- that. This file asserts only what an UNMEASURED token does, and it drives the
-- lifecycle with `sportmonks` rather than `football-data` because SportMonks is
-- the vocabulary contract 213 changed.

begin;

select plan(16);

-- ---------------------------------------------------------------------------
-- 1. The resolution. Pure, and it needs no seeded data at all.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from predictor_internal.provider_status_kinds
    where provider = 'sportmonks'
      and provider_status in ('14', '15', '16', '17', '18', '20', '21')),
  0,
  'the seven documentation-seeded SportMonks tokens are gone from the vocabulary'
);

select is(
  (select count(*)::integer from (
     select unnest(array['14', '15', '16', '17', '18', '20', '21']) as token
   ) t
   where predictor_internal.provider_status_kind('sportmonks', t.token) <> 'unknown'),
  0,
  'and every one of them now resolves to unknown rather than to a kind'
);

-- The measured tokens, each named. A migration that dropped one of these would
-- pass the two assertions above.
select is(
  predictor_internal.provider_status_kind('sportmonks', '1'),
  'scheduled',
  'the measured scheduled token is untouched'
);

select is(
  (select count(*)::integer from (
     select unnest(array['2', '3', '4', '22']) as token
   ) t
   where predictor_internal.provider_status_kind('sportmonks', t.token) <> 'in_play'),
  0,
  'the in-play tokens are untouched'
);

select is(
  predictor_internal.provider_status_kind('sportmonks', '5'),
  'final',
  'the measured final token is untouched'
);

select is(
  predictor_internal.provider_status_kind('sportmonks', '10'),
  'postponed',
  'and contract 209''s measured postponed token is untouched'
);

-- The point of removing `14` rather than remapping it: `postponed` now has
-- exactly one route into it, and that route was measured.
select is(
  (select count(*)::integer from predictor_internal.provider_status_kinds
    where provider = 'sportmonks' and kind = 'postponed'),
  1,
  'exactly one SportMonks token resolves postponed, and it is the measured one'
);

select is(
  (select count(*)::integer from predictor_internal.provider_status_kinds
    where provider = 'sportmonks' and kind = 'final'),
  1,
  'and exactly one resolves final, as contract 209 already required'
);

-- `cancelled` and `abandoned` were reachable ONLY through dropped tokens. After
-- contract 213 no SportMonks token reaches either, which is the honest state:
-- this platform has never seen this provider say those words.
select is(
  (select count(*)::integer from predictor_internal.provider_status_kinds
    where provider = 'sportmonks' and kind in ('cancelled', 'abandoned')),
  0,
  'no SportMonks token resolves cancelled or abandoned on no measurement'
);

select isnt(
  (select count(*)::integer from predictor_internal.provider_status_kinds
    where provider <> 'sportmonks'),
  0,
  'and the delete did not reach another provider''s vocabulary'
);

-- ---------------------------------------------------------------------------
-- 2. The behaviour. One matchweek inside the seeded league season, four clubs,
--    two fixtures, mapped to SportMonks.
--
--    Both fixtures start well in the future, so nothing here is locked by the
--    ordinary matchweek rule and every outcome below is caused by the token
--    under test rather than by the clock.
-- ---------------------------------------------------------------------------

select set_config('test.upt_season',
  (select id::text from public.tournaments where kind = 'league_season' order by name limit 1), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.upt_season')::uuid, 'Unmeasured Rovers'),
  (current_setting('test.upt_season')::uuid, 'Unmeasured United'),
  (current_setting('test.upt_season')::uuid, 'Unmeasured Athletic'),
  (current_setting('test.upt_season')::uuid, 'Unmeasured Wanderers');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.upt_season')::uuid, 'upt-mw1', 975, 'league_matchweek',
        'Unmeasured Token Matchweek 1');

select set_config('test.upt_round', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.upt_season')::uuid and round_key = 'upt-mw1'), true);

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.upt_season')::uuid, current_setting('test.upt_round')::uuid,
       h.id, a.id, k, 'scheduled'
from (values ('Unmeasured Rovers', 'Unmeasured United', now() + interval '10 days'),
             ('Unmeasured Athletic', 'Unmeasured Wanderers', now() + interval '10 days')) as s(hn, an, k)
join public.teams h on h.tournament_id = current_setting('test.upt_season')::uuid and h.name = s.hn
join public.teams a on a.tournament_id = current_setting('test.upt_season')::uuid and a.name = s.an;

select set_config('test.upt_subject', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.upt_round')::uuid
    and h.name = 'Unmeasured Rovers'), true);

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, team_id, evidence_ref)
values
  ('sportmonks', 'round', 'UPT-R1', current_setting('test.upt_season')::uuid,
   current_setting('test.upt_round')::uuid, null, '259_unmeasured_provider_tokens_fail_closed.sql'),
  ('sportmonks', 'team', 'UPT-T1', current_setting('test.upt_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.upt_season')::uuid
     and name = 'Unmeasured Rovers'), '259_unmeasured_provider_tokens_fail_closed.sql'),
  ('sportmonks', 'team', 'UPT-T2', current_setting('test.upt_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.upt_season')::uuid
     and name = 'Unmeasured United'), '259_unmeasured_provider_tokens_fail_closed.sql'),
  ('sportmonks', 'team', 'UPT-T3', current_setting('test.upt_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.upt_season')::uuid
     and name = 'Unmeasured Athletic'), '259_unmeasured_provider_tokens_fail_closed.sql'),
  ('sportmonks', 'team', 'UPT-T4', current_setting('test.upt_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.upt_season')::uuid
     and name = 'Unmeasured Wanderers'), '259_unmeasured_provider_tokens_fail_closed.sql');

-- One decoded entry, in the shape contract 96 stores. The kickoff travels with
-- it because a real payload always carries one, including on the responses that
-- report a postponement without moving the date.
create function pg_temp.upt_entry(p_status text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'provider', 'sportmonks',
    'providerFixtureId', 'UPT-F1',
    'competitionProviderId', 'UPT-C1',
    'seasonProviderId', 'UPT-S1',
    'roundProviderId', 'UPT-R1',
    'homeTeamProviderId', 'UPT-T1',
    'homeTeamName', 'Unmeasured Home',
    'awayTeamProviderId', 'UPT-T2',
    'awayTeamName', 'Unmeasured Away',
    'kickoffAt', to_char((now() + interval '10 days') at time zone 'UTC',
                         'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'status', p_status,
    'homeScore', null,
    'awayScore', null);
$$;

-- ---------------------------------------------------------------------------
-- 3. The dropped token moves nothing.
--
-- THIS IS THE ASSERTION THE WHOLE CONTRACT IS FOR. Before contract 213 this
-- payload would have postponed a real fixture, on a documentation guess, for a
-- token this platform has never seen a provider send.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'sportmonks', current_setting('test.upt_season')::uuid,
     jsonb_build_array(pg_temp.upt_entry('14'))
   ) ->> 'postponed')::integer,
  0,
  'the documented-but-unmeasured postponed token now postpones nothing'
);

select is(
  (select status from public.season_fixtures where id = current_setting('test.upt_subject')::uuid),
  'scheduled',
  'and the fixture keeps the status it had, which is what failing closed means'
);

select is(
  (select count(*)::integer from predictor_internal.season_fixture_lifecycle_transitions
    where season_fixture_id = current_setting('test.upt_subject')::uuid),
  0,
  'nothing was recorded as a transition, because nothing transitioned'
);

-- ---------------------------------------------------------------------------
-- 4. The measured token still works. Removal must not have cost the capability
--    contract 209 bought.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'sportmonks', current_setting('test.upt_season')::uuid,
     jsonb_build_array(pg_temp.upt_entry('10'))
   ) ->> 'postponed')::integer,
  1,
  'the MEASURED postponed token still postpones, so nothing was lost'
);

select is(
  (select status from public.season_fixtures where id = current_setting('test.upt_subject')::uuid),
  'postponed',
  'and the fixture moved on the evidence rather than on the documentation'
);

-- ---------------------------------------------------------------------------
-- 5. An unknown is OBSERVED rather than swallowed.
--
-- This is the other half of "fail closed" and the half that makes the removal
-- reversible on evidence. `apply_provider_fixture_facts` records an unrecognised
-- token once per response with the number of fixtures it blocked, which is where
-- a real payload carrying `15` would eventually be measured from.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from predictor_internal.provider_status_observations
    where provider = 'sportmonks' and provider_status = '15'),
  0,
  'no observation of the dropped cancelled token exists before a payload carries one'
);

select ok(
  (predictor_internal.apply_provider_fixture_facts(
     'sportmonks', current_setting('test.upt_season')::uuid,
     jsonb_build_array(pg_temp.upt_entry('15'))
   ) ->> 'applied')::boolean,
  'a payload carrying a dropped token is still consumed rather than refused whole'
);

select isnt(
  (select count(*)::integer from predictor_internal.provider_status_observations
    where provider = 'sportmonks' and provider_status = '15'),
  0,
  'and the unrecognised token is RECORDED for review rather than silently ignored'
);

select * from finish();

rollback;
