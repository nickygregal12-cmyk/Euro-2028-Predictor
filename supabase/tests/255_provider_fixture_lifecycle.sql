-- Contract 209: a postponement reaches the fixture, and a reschedule reaches it
-- back.
--
-- THE ASSERTION THIS FILE EXISTS FOR is the round trip, driven end to end from
-- decoded provider payloads rather than by setting `status` by hand:
--
--     scheduled -> postponed -> no date -> new date -> deadline open again
--                            -> provider recants -> scheduled
--
-- Setting the status directly would prove the surfaces read a column. It would
-- not prove that a future postponement flows through on its own, which is the
-- only thing `FINDING G` is closed by, so every transition below is caused by a
-- payload in the exact `normalized_payload` shape contract 96 stores.
--
-- IT ALSO PINS THE TWO DIRECTIONS OF THE DEADLINE, because they are opposite
-- failures and a rule that only avoids one is not safe. A postponed fixture
-- whose slot has passed must NOT stay locked for ever; one whose new slot is
-- still ahead MUST lock at it. The second is the half that is easy to lose:
-- SportMonks assigns a new date while still reporting the fixture postponed, so
-- "postponed means open" alone would leave a prediction editable into a match
-- that is being played.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. That points are awarded, or that a
-- matchweek settles. `144_season_matchweek_scoring_job.sql` and
-- `177_season_fixture_result_entry.sql` drive those, and this file asserts only
-- the property a postponement adds: that the settlement card still calls the
-- fixture awaited, so nothing settles on it.
--
-- Self-contained apart from the seeded league season it borrows, which it needs
-- for the Main Predictor availability the lock trigger resolves through.

begin;

select plan(49);

-- ---------------------------------------------------------------------------
-- The record this contract adds is evidence, so it is unreachable.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name = 'season_fixture_lifecycle_transitions'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role can reach the lifecycle record');

select is(
  (select relation.relrowsecurity
     from pg_class relation join pg_namespace ns on ns.oid = relation.relnamespace
    where ns.nspname = 'predictor_internal'
      and relation.relname = 'season_fixture_lifecycle_transitions'),
  true,
  'and it has row level security enabled');

-- ---------------------------------------------------------------------------
-- The token, and the two resolutions that had stopped working.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.provider_status_kind('sportmonks', '10'),
  'postponed',
  'SportMonks state 10 is postponed, measured from five consecutive retained payloads');

select is(
  (select count(*)::integer from predictor_internal.provider_status_kinds
    where provider = 'sportmonks' and kind = 'final'),
  1,
  'and measuring it made nothing new final');

select ok(
  'https://api.sportmonks.com/v3/football/fixtures/between/2026-08-19/2026-08-27?filters=fixtureLeagues:501'
  like '%' || predictor_internal.provider_poll_path_pattern(
    '/fixtures/between/{{date:+0}}/{{date:+8}}?filters=fixtureLeagues:501') escape '\',
  'a dispatched URL matches the pattern of the stored path that produced it');

select ok(
  not ('https://api.sportmonks.com/v3/football/fixtures/between/2026-08-19/2026-08-27?filters=fixtureLeagues:501'
       like '%' || predictor_internal.provider_poll_path_pattern(
         '/standings/season/{{date:+0}}') escape '\'),
  'and a path describing a different question still does not match');

-- ---------------------------------------------------------------------------
-- Setup. One matchweek inside the seeded league season, four clubs, two
-- fixtures, mapped to football-data. Contract 209's rules are provider-neutral
-- and football-data has the clearest published vocabulary, so the transitions
-- are driven with it.
-- ---------------------------------------------------------------------------

select set_config('test.pfl_season',
  (select id::text from public.tournaments where kind = 'league_season' order by name limit 1), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Rovers'),
  (current_setting('test.pfl_season')::uuid, 'Lifecycle United'),
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Athletic'),
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Wanderers');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.pfl_season')::uuid, 'pfl-mw1', 971, 'league_matchweek',
        'Lifecycle Matchweek 1');

select set_config('test.pfl_round', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.pfl_season')::uuid and round_key = 'pfl-mw1'), true);

-- Both fixtures start well in the future, so nothing here is locked by the
-- ordinary matchweek rule and every refusal below is caused by the state under
-- test rather than by the clock.
insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pfl_season')::uuid, current_setting('test.pfl_round')::uuid,
       h.id, a.id, k, 'scheduled'
from (values ('Lifecycle Rovers', 'Lifecycle United', now() + interval '10 days'),
             ('Lifecycle Athletic', 'Lifecycle Wanderers', now() + interval '10 days')) as s(hn, an, k)
join public.teams h on h.tournament_id = current_setting('test.pfl_season')::uuid and h.name = s.hn
join public.teams a on a.tournament_id = current_setting('test.pfl_season')::uuid and a.name = s.an;

select set_config('test.pfl_moved', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.pfl_round')::uuid
    and h.name = 'Lifecycle Rovers'), true);
select set_config('test.pfl_other', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.pfl_round')::uuid
    and h.name = 'Lifecycle Athletic'), true);

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, team_id, evidence_ref)
values
  ('football-data', 'round', 'PFL-R1', current_setting('test.pfl_season')::uuid,
   current_setting('test.pfl_round')::uuid, null, '255_provider_fixture_lifecycle.sql'),
  ('football-data', 'team', 'PFL-T1', current_setting('test.pfl_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.pfl_season')::uuid
     and name = 'Lifecycle Rovers'), '255_provider_fixture_lifecycle.sql'),
  ('football-data', 'team', 'PFL-T2', current_setting('test.pfl_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.pfl_season')::uuid
     and name = 'Lifecycle United'), '255_provider_fixture_lifecycle.sql'),
  ('football-data', 'team', 'PFL-T3', current_setting('test.pfl_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.pfl_season')::uuid
     and name = 'Lifecycle Athletic'), '255_provider_fixture_lifecycle.sql'),
  ('football-data', 'team', 'PFL-T4', current_setting('test.pfl_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.pfl_season')::uuid
     and name = 'Lifecycle Wanderers'), '255_provider_fixture_lifecycle.sql');

-- One decoded entry, in the shape contract 96 stores. The kickoff travels with
-- it because a real payload always carries one, including on the responses that
-- report a postponement without moving the date.
create function pg_temp.pfl_entry(p_home text, p_away text, p_status text, p_kickoff timestamptz)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'provider', 'football-data',
    'providerFixtureId', 'PFL-F-' || p_home,
    'competitionProviderId', 'PFL-C1',
    'seasonProviderId', 'PFL-S1',
    'roundProviderId', 'PFL-R1',
    'homeTeamProviderId', p_home,
    'homeTeamName', 'Lifecycle Home',
    'awayTeamProviderId', p_away,
    'awayTeamName', 'Lifecycle Away',
    'kickoffAt', to_char(p_kickoff at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'status', p_status,
    'homeScore', null,
    'awayScore', null);
$$;

-- ---------------------------------------------------------------------------
-- 1. An ordinary scheduled fixture is left alone.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T1', 'PFL-T2', 'SCHEDULED', now() + interval '10 days'))
   ) ->> 'postponed')::integer,
  0,
  'a provider reporting an ordinary scheduled fixture moves nothing');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_moved')::uuid),
  'scheduled',
  'and the fixture is still scheduled');

-- ---------------------------------------------------------------------------
-- 2. A prediction exists BEFORE the postponement, so every later assertion is
--    about what happens to work somebody already did.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('pfl-player')::uuid, 'pfl-player@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
values (current_setting('test.pfl_season')::uuid, md5('pfl-player')::uuid);

select set_config('test.pfl_entry', (select id::text from public.entries
  where tournament_id = current_setting('test.pfl_season')::uuid
    and user_id = md5('pfl-player')::uuid), true);

insert into public.season_predictions
  (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values (current_setting('test.pfl_season')::uuid, current_setting('test.pfl_entry')::uuid,
        current_setting('test.pfl_moved')::uuid, 2, 1);

-- ---------------------------------------------------------------------------
-- 3. scheduled -> postponed, on the provider's word and nobody else's.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T1', 'PFL-T2', 'POSTPONED', now() + interval '10 days'))
   ) ->> 'postponed')::integer,
  1,
  'a provider postponement is applied automatically');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_moved')::uuid),
  'postponed',
  'and the fixture says so');

select is(
  (select previous_status || ' -> ' || new_status
     from predictor_internal.season_fixture_lifecycle_transitions
    where season_fixture_id = current_setting('test.pfl_moved')::uuid),
  'scheduled -> postponed',
  'with the transition recorded against the response that caused it');

select is(
  (select count(*)::integer from public.season_predictions
    where season_fixture_id = current_setting('test.pfl_moved')::uuid),
  1,
  'the prediction that already existed is untouched');

select is(
  (select home_score || '-' || away_score from public.season_predictions
    where season_fixture_id = current_setting('test.pfl_moved')::uuid),
  '2-1',
  'and still says what the player said');

select is(
  (select count(*)::integer from public.season_fixtures
    where competition_round_id = current_setting('test.pfl_round')::uuid),
  2,
  'no second fixture was created for the postponed match');

-- ---------------------------------------------------------------------------
-- 3b. The queue asks a human only where a human still has something to decide.
--
-- Contract 174 stages a proposal for every postponement, abandonment and
-- cancellation a provider reports. Contract 209 now REACHES `postponed` on its
-- own, so a proposal for one is a request for a decision that has already been
-- taken — and a queue of those is worse than no queue, because an administrator
-- learns to clear it without reading it.
--
-- The cancellation beside it is the control, and it is also `FINDING G §F`'s
-- second transition: postponed -> cancelled. A provider may not void a fixture,
-- so the proposal is staged and the calendar is untouched until somebody
-- approves it.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.detect_provider_calendar_changes(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T1', 'PFL-T2', 'POSTPONED', now() + interval '10 days')),
     null, now(), null, null) ->> 'staged')::integer,
  0,
  'a postponement the platform has already applied stages no proposal');

select is(
  (predictor_internal.detect_provider_calendar_changes(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T1', 'PFL-T2', 'CANCELLED', now() + interval '10 days')),
     null, now(), null, null) ->> 'staged')::integer,
  1,
  'but a cancellation of that same fixture does, because voiding it is still a human decision');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_moved')::uuid),
  'postponed',
  'and staging it changed no calendar: the fixture is still postponed, not void');

-- THE GUARD IS CONDITIONAL, NOT A BLANKET SKIP. A future change that dropped
-- the status comparison and simply stopped staging postponements would pass
-- every assertion above and silently empty contract 174's queue for the one
-- case an administrator still owns: a fixture the platform does NOT already
-- hold as postponed.
select is(
  (predictor_internal.detect_provider_calendar_changes(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T3', 'PFL-T4', 'POSTPONED', now() + interval '10 days')),
     null, now(), null, null) ->> 'staged')::integer,
  1,
  'and a postponement of a fixture the platform still calls scheduled does stage one');

-- ---------------------------------------------------------------------------
-- 4. It does not score, and it does not settle.
-- ---------------------------------------------------------------------------

select is(
  (select home_score from public.season_fixtures
    where id = current_setting('test.pfl_moved')::uuid),
  null::smallint,
  'a postponed fixture carries no score -- not nil-nil, not anything');

select is(
  (select entry->>'state'
     from jsonb_array_elements(
       predictor_internal.season_matchweek_card(current_setting('test.pfl_round')::uuid)) entry
    where entry->>'id' = current_setting('test.pfl_moved')),
  'scheduled',
  'the settlement card still calls it awaited, so the matchweek cannot settle on it');

select is(
  predictor_internal.lms_outcome_from_fixture('postponed', null::smallint, null::smallint, true),
  'postponed',
  'and Last Man Standing survives it, consuming nothing');

-- ---------------------------------------------------------------------------
-- 4b. And it does not settle a Championship tie either.
--
-- `cup_window_settled` is the shared window-settlement authority the Championship
-- and Last Man Standing both consume, and its season half asks "is any linked
-- fixture not `played`?". A postponed fixture is not played, so the window stays
-- outstanding — which is what stops a tie being decided on a match nobody has
-- yet played.
--
-- TWO WINDOWS, BECAUSE ONE PROVES NOTHING. A machinery that always answered
-- "unsettled" would pass the first assertion and be useless. The second window
-- links a fixture that HAS been played, over the same competition and the same
-- elapsed lock, and must settle.
-- ---------------------------------------------------------------------------

insert into public.teams (tournament_id, name) values
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Thistle'),
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Academical');

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at,
   status, home_score, away_score)
select current_setting('test.pfl_season')::uuid, current_setting('test.pfl_round')::uuid,
       h.id, a.id, now() - interval '3 days', 'played', 2, 0
from public.teams h, public.teams a
 where h.tournament_id = current_setting('test.pfl_season')::uuid and h.name = 'Lifecycle Thistle'
   and a.tournament_id = current_setting('test.pfl_season')::uuid and a.name = 'Lifecycle Academical';

select set_config('test.pfl_played', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.pfl_round')::uuid
    and h.name = 'Lifecycle Thistle'), true);

-- Private, so it cannot collide with whatever public Championship the seeded
-- season already holds; a fresh competition has no predecessor, so the
-- successor-window calendar guard has no boundary to enforce.
--
-- The invite code is supplied rather than left to the registration trigger:
-- `bonus_competitions_private_identity` requires name, owner AND invite_code to
-- be present on the row itself, and it is a CHECK, so it is evaluated before
-- any AFTER trigger could fill one in.
insert into public.bonus_competitions
  (id, tournament_id, game_key, published, draw_required, visibility_kind,
   name, owner_id, invite_code)
values (md5('pfl-cup')::uuid, current_setting('test.pfl_season')::uuid, 'predictor_cup',
        true, false, 'private', 'Lifecycle Championship', md5('pfl-player')::uuid,
        'PFL209');

insert into public.bonus_competition_windows
  (id, competition_id, sequence, label, opens_at, locks_at)
values
  (md5('pfl-window-off')::uuid, md5('pfl-cup')::uuid, 971, 'Lifecycle tie (postponed)',
   now() - interval '4 hours', now() - interval '2 hours'),
  (md5('pfl-window-on')::uuid, md5('pfl-cup')::uuid, 972, 'Lifecycle tie (played)',
   now() - interval '4 hours', now() - interval '2 hours');

insert into public.season_cup_window_fixtures (window_id, season_fixture_id) values
  (md5('pfl-window-off')::uuid, current_setting('test.pfl_moved')::uuid),
  (md5('pfl-window-on')::uuid, current_setting('test.pfl_played')::uuid);

select is(
  predictor_internal.cup_season_window_unsettled(md5('pfl-window-off')::uuid),
  true,
  'a tie whose fixture is postponed is still outstanding');

select is(
  predictor_internal.cup_window_settled(md5('pfl-window-off')::uuid),
  false,
  'so the window does not settle, however long ago its lock passed');

select is(
  predictor_internal.cup_season_window_unsettled(md5('pfl-window-on')::uuid),
  false,
  'and the same authority calls a played fixture settled -- so the assertion above is not vacuous');

select is(
  predictor_internal.cup_window_settled(md5('pfl-window-on')::uuid),
  true,
  'which is a window that DOES settle, over the same competition and the same elapsed lock');

-- ---------------------------------------------------------------------------
-- 5. The date is gone, and so is the deadline that depended on it.
-- ---------------------------------------------------------------------------

-- The slot passes. This is the exact shape of `FINDING G §D`: the original
-- Saturday elapses while the fixture is postponed and no new date exists.
update public.season_fixtures
   set kickoff_at = now() - interval '1 hour'
 where id = current_setting('test.pfl_moved')::uuid;

select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.pfl_moved')::uuid,
    (select buffer_minutes from public.game_definitions where game_key = 'main_predictor')),
  'infinity'::timestamptz,
  'a postponed fixture whose slot has passed is not locked by it');

select lives_ok(
  format($$update public.season_predictions set home_score = 3
             where season_fixture_id = %L::uuid$$, current_setting('test.pfl_moved')),
  'so the prediction is still editable, rather than frozen for ever by a kickoff that never happened');

-- ---------------------------------------------------------------------------
-- 6. The new date arrives, on the same fixture.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.import_provider_fixture_revisions(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T1', 'PFL-T2', 'POSTPONED', now() + interval '21 days'))
   ) ->> 'revised')::integer,
  1,
  'a postponed fixture accepts its replacement date, which contract 117 refused');

select is(
  (select count(*)::integer from public.season_fixtures
    where competition_round_id = current_setting('test.pfl_round')::uuid),
  2,
  'and it is the SAME fixture -- rescheduling creates no second row');

select is(
  (select count(*)::integer from public.season_predictions
    where season_fixture_id = current_setting('test.pfl_moved')::uuid),
  1,
  'so the prediction survives the reschedule, with no duplicate beside it');

select is(
  (select count(*)::integer from predictor_internal.season_fixture_revisions
    where season_fixture_id = current_setting('test.pfl_moved')::uuid),
  1,
  'and the move is recorded once, with the instant it moved from');

select ok(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.pfl_moved')::uuid,
    (select buffer_minutes from public.game_definitions where game_key = 'main_predictor')) > now(),
  'the deadline is active again, ahead of the new kickoff');

-- THE HALF THAT IS EASY TO LOSE. The provider is still calling it postponed, so
-- a rule reading "postponed means open" would leave this editable into the
-- match. It locks at the new kickoff instead.
select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.pfl_moved')::uuid,
    (select buffer_minutes from public.game_definitions where game_key = 'main_predictor')),
  (select kickoff_at from public.season_fixtures where id = current_setting('test.pfl_moved')::uuid)
    - make_interval(mins => (select buffer_minutes from public.game_definitions
                              where game_key = 'main_predictor')),
  'and it is the NEW kickoff minus the buffer, even while the provider still says postponed');

select is(
  (select count(*)::integer from public.season_fixtures
    where id = current_setting('test.pfl_moved')::uuid
      and kickoff_at <= now()),
  0,
  'a kickoff is never moved backwards into the past by an import');

-- ---------------------------------------------------------------------------
-- 7. The provider stops calling it postponed.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T1', 'PFL-T2', 'TIMED', now() + interval '21 days'))
   ) ->> 'reinstated')::integer,
  1,
  'a provider that recants is believed, which is what makes believing it in the first place safe');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_moved')::uuid),
  'scheduled',
  'and the fixture is scheduled again, at its new date');

select is(
  (select count(*)::integer from predictor_internal.season_fixture_lifecycle_transitions
    where season_fixture_id = current_setting('test.pfl_moved')::uuid),
  2,
  'both directions are recorded, so a player who saw each can be told why');

-- ---------------------------------------------------------------------------
-- 8. What a provider may NOT do.
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T3', 'PFL-T4', 'CANCELLED', now() + interval '10 days'))
   ) ->> 'postponed')::integer,
  0,
  'a cancellation changes no fixture: it removes a match from the competition, which is a human decision');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_other')::uuid),
  'scheduled',
  'and the fixture is untouched by it');

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T3', 'PFL-T4', 'SUSPENDED', now() + interval '10 days'))
   ) ->> 'postponed')::integer,
  0,
  'nor does an abandonment, for the same reason');

-- A settled fixture is immovable in either direction, whatever a feed says.
update public.season_fixtures
   set status = 'played', home_score = 1, away_score = 0
 where id = current_setting('test.pfl_other')::uuid;

select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'football-data', current_setting('test.pfl_season')::uuid,
     jsonb_build_array(pg_temp.pfl_entry('PFL-T3', 'PFL-T4', 'POSTPONED', now() + interval '10 days'))
   ) ->> 'postponed')::integer,
  0,
  'and a fixture carrying a result is never moved: postponing it would rescore a settled matchweek');

-- ---------------------------------------------------------------------------
-- 9. A fixture that will not be played has nothing to predict.
-- ---------------------------------------------------------------------------

update public.season_fixtures
   set status = 'void', home_score = null, away_score = null
 where id = current_setting('test.pfl_other')::uuid;

select is(
  predictor_internal.season_prediction_lock_at(
    current_setting('test.pfl_other')::uuid,
    (select buffer_minutes from public.game_definitions where game_key = 'main_predictor')),
  '-infinity'::timestamptz,
  'a voided fixture is locked whatever its kickoff says');

-- ---------------------------------------------------------------------------
-- 9b. THE FIXTURE THE FEED HAS NOT MOVED YET.
--
-- On 19 August 2026 the audit found four Scottish Premiership fixtures carrying
-- SportMonks token `10` and one — Rangers v St. Mirren — still carrying token
-- `1`. That one is not a defect on this side: the provider has not moved it.
-- The owner's decision is to leave it as the feed reports it, on the condition
-- that it flips ON ITS OWN the moment the feed says so.
--
-- This is that condition, written as a PROVIDER CONTRACT and not as those two
-- clubs. It drives the real SportMonks token through the real applier: a
-- fixture the feed still calls not-started is left alone, and the SAME fixture
-- becomes postponed on the next response that says `10`, with no operator
-- action between the two. Naming Rangers here would prove something about a
-- row rather than about the pipeline, which `FINDING G §I` refuses.
--
-- It also drives SportMonks rather than football-data deliberately. Everything
-- above uses football-data's published vocabulary; the token this whole finding
-- turned on is a SportMonks numeric state, and a vocabulary entry asserted only
-- by `provider_status_kind` is not the same as one proved through the applier.
-- ---------------------------------------------------------------------------

insert into public.teams (tournament_id, name) values
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Sporting'),
  (current_setting('test.pfl_season')::uuid, 'Lifecycle Corinthians');

insert into public.provider_entity_map
  (provider, entity_kind, provider_id, tournament_id, competition_round_id, team_id, evidence_ref)
values
  ('sportmonks', 'round', 'PFL-SM-R1', current_setting('test.pfl_season')::uuid,
   current_setting('test.pfl_round')::uuid, null, '255_provider_fixture_lifecycle.sql'),
  ('sportmonks', 'team', 'PFL-SM-T1', current_setting('test.pfl_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.pfl_season')::uuid
     and name = 'Lifecycle Sporting'), '255_provider_fixture_lifecycle.sql'),
  ('sportmonks', 'team', 'PFL-SM-T2', current_setting('test.pfl_season')::uuid, null,
   (select id from public.teams where tournament_id = current_setting('test.pfl_season')::uuid
     and name = 'Lifecycle Corinthians'), '255_provider_fixture_lifecycle.sql');

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.pfl_season')::uuid, current_setting('test.pfl_round')::uuid,
       h.id, a.id, now() + interval '3 days', 'scheduled'
from public.teams h, public.teams a
 where h.tournament_id = current_setting('test.pfl_season')::uuid and h.name = 'Lifecycle Sporting'
   and a.tournament_id = current_setting('test.pfl_season')::uuid and a.name = 'Lifecycle Corinthians';

select set_config('test.pfl_feed', (select f.id::text from public.season_fixtures f
  join public.teams h on h.id = f.home_team_id
  where f.competition_round_id = current_setting('test.pfl_round')::uuid
    and h.name = 'Lifecycle Sporting'), true);

create function pg_temp.pfl_sm(p_status text)
returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object(
    'provider', 'sportmonks',
    'providerFixtureId', 'PFL-SM-F1',
    'seasonProviderId', 'PFL-SM-S1',
    'roundProviderId', 'PFL-SM-R1',
    'homeTeamProviderId', 'PFL-SM-T1',
    'homeTeamName', 'Lifecycle Sporting',
    'awayTeamProviderId', 'PFL-SM-T2',
    'awayTeamName', 'Lifecycle Corinthians',
    'kickoffAt', to_char((now() + interval '3 days') at time zone 'UTC',
                         'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'status', p_status,
    'homeScore', null,
    'awayScore', null));
$$;

-- Poll one: the feed still calls it not started. This is the state Rangers v
-- St. Mirren was in when the audit ran.
select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'sportmonks', current_setting('test.pfl_season')::uuid, pg_temp.pfl_sm('1')
   ) ->> 'postponed')::integer,
  0,
  'a fixture the feed still calls not-started is left exactly as it is');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_feed')::uuid),
  'scheduled',
  'so the site keeps showing it as an ordinary fixture, which is what the feed says');

-- Poll two: the feed moves. Nothing else changes -- no operator, no approval,
-- no migration, no second mapping.
select is(
  (predictor_internal.apply_provider_fixture_lifecycle(
     'sportmonks', current_setting('test.pfl_season')::uuid, pg_temp.pfl_sm('10')
   ) ->> 'postponed')::integer,
  1,
  'and the NEXT response that says token 10 postpones it, with nothing done in between');

select is(
  (select status from public.season_fixtures where id = current_setting('test.pfl_feed')::uuid),
  'postponed',
  'which is what every surface reads, because every surface reads this column');

select is(
  (select t.provider || ' ' || t.provider_status || ' -> ' || t.new_status
     from predictor_internal.season_fixture_lifecycle_transitions t
    where t.season_fixture_id = current_setting('test.pfl_feed')::uuid),
  'sportmonks 10 -> postponed',
  'and the reason is recorded as the provider token it came from, not as a decision somebody took');

-- ---------------------------------------------------------------------------
-- 10. The reads carry the schedule, so no surface has to infer it from a date.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('pfl-player')::uuid, 'role', 'authenticated')::text, true);
set local role authenticated;

select is(
  (public.get_season_fixture(current_setting('test.pfl_moved')::uuid))
    #>> '{fixture,schedule,rescheduled}',
  'true',
  'the addressed fixture read says it has been rescheduled');

select is(
  (public.get_season_fixture(current_setting('test.pfl_other')::uuid))
    #>> '{fixture,schedule,rescheduled}',
  'false',
  'and says so only where a revision actually recorded a move');

reset role;

select * from finish();
rollback;
