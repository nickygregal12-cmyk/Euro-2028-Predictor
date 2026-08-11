-- Contract 174: a provider calendar change is staged instead of discarded.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that detection cannot publish. It runs
-- automatically, every five minutes, with nobody watching, against data this
-- platform does not control. So the test that matters is not that a proposal
-- appears — it is that `season_fixtures` is untouched until an administrator
-- decides, and that the administrator's decision refuses a fixture which has
-- since gained a result.
--
-- The second is withdrawal's coverage window. "The provider stopped sending
-- this fixture" is only evidence if the payload was complete over some span,
-- and a poll is not. Detection with no declared span must stage NO withdrawal,
-- however many of our fixtures the payload fails to mention.

begin;

select plan(20);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C174 Change Proposals', 2058, t.competition_id, 'change-proposals', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.cp_season',
  (select id::text from public.tournaments where season_key = 'change-proposals'), true);

insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label, window_opens_at, window_closes_at)
values (md5('cp-r5')::uuid, current_setting('test.cp_season')::uuid, 'cp-mw5', 5,
        'league_matchweek', 'Matchweek 5',
        now() - interval '2 days', now() + interval '8 days');

insert into public.teams (id, tournament_id, name) values
  (md5('cp-t1')::uuid, current_setting('test.cp_season')::uuid, 'CP Rovers'),
  (md5('cp-t2')::uuid, current_setting('test.cp_season')::uuid, 'CP United'),
  (md5('cp-t3')::uuid, current_setting('test.cp_season')::uuid, 'CP City'),
  (md5('cp-t4')::uuid, current_setting('test.cp_season')::uuid, 'CP Athletic');

-- The provider identity map, so the mapping-gap gate is satisfied by real rows
-- rather than by the test asserting against its own stub.
insert into public.provider_entity_map (
  tournament_id, provider, entity_kind, provider_id, competition_round_id, team_id, evidence_ref)
values
  (current_setting('test.cp_season')::uuid, 'sportmonks', 'round', 'CP-R5', md5('cp-r5')::uuid, null, 'c174-suite'),
  (current_setting('test.cp_season')::uuid, 'sportmonks', 'team', 'CP-1', null, md5('cp-t1')::uuid, 'c174-suite'),
  (current_setting('test.cp_season')::uuid, 'sportmonks', 'team', 'CP-2', null, md5('cp-t2')::uuid, 'c174-suite'),
  (current_setting('test.cp_season')::uuid, 'sportmonks', 'team', 'CP-3', null, md5('cp-t3')::uuid, 'c174-suite'),
  (current_setting('test.cp_season')::uuid, 'sportmonks', 'team', 'CP-4', null, md5('cp-t4')::uuid, 'c174-suite');

-- The status token this suite uses, inserted rather than assumed.
--
-- The first CI run of this file read `staged: 1` where it wanted 2, and the
-- reason is contract 135's fail-closed vocabulary working: `CANCL` is not in
-- `provider_status_kinds`, so `v_kind` was null and the cancellation staged
-- nothing at all. That is the correct behaviour and the test was wrong to
-- assume a token. A fixture that owns its own vocabulary row also keeps this
-- file independent of whichever tokens a seed happens to carry.
insert into predictor_internal.provider_status_kinds (provider, provider_status, kind, note)
values ('sportmonks', 'CP-CANCL', 'cancelled', 'contract 174 suite fixture')
on conflict (provider, provider_status) do nothing;

-- Two fixtures we hold. One the provider will report cancelled; one it will
-- simply stop mentioning.
insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values
  (md5('cp-f1')::uuid, current_setting('test.cp_season')::uuid, md5('cp-r5')::uuid,
   md5('cp-t1')::uuid, md5('cp-t2')::uuid, now() + interval '3 days', 'scheduled'),
  (md5('cp-f2')::uuid, current_setting('test.cp_season')::uuid, md5('cp-r5')::uuid,
   md5('cp-t3')::uuid, md5('cp-t4')::uuid, now() + interval '4 days', 'scheduled');

select set_config('test.cp_payload', jsonb_build_array(
  -- one we hold, reported cancelled
  jsonb_build_object(
    'roundProviderId','CP-R5','homeTeamProviderId','CP-1','awayTeamProviderId','CP-2',
    'kickoffAt', (now() + interval '3 days')::text, 'providerFixtureId','CP-P1',
    'status','CP-CANCL','homeTeamName','CP Rovers','awayTeamName','CP United'),
  -- one we have never heard of
  jsonb_build_object(
    'roundProviderId','CP-R5','homeTeamProviderId','CP-3','awayTeamProviderId','CP-1',
    'kickoffAt', (now() + interval '5 days')::text, 'providerFixtureId','CP-P9',
    'status','NS','homeTeamName','CP City','awayTeamName','CP Rovers')
)::text, true);

-- ---------------------------------------------------------------------------
-- DETECTION STAGES, AND PUBLISHES NOTHING
-- ---------------------------------------------------------------------------

select set_config('test.cp_result',
  predictor_internal.detect_provider_calendar_changes(
    'sportmonks', current_setting('test.cp_season')::uuid,
    current_setting('test.cp_payload')::jsonb, null, now(), null, null)::text, true);

select is(
  current_setting('test.cp_result')::jsonb ->> 'staged', '2',
  'the discovered fixture and the cancellation are both staged');

select is(
  (select count(*)::integer from public.season_fixtures
    where tournament_id = current_setting('test.cp_season')::uuid),
  2,
  'AND NO FIXTURE IS CREATED OR CHANGED — detection runs unattended, so this is the boundary');

select is(
  (select fixture.status from public.season_fixtures fixture where fixture.id = md5('cp-f1')::uuid),
  'scheduled',
  'the cancelled fixture is still scheduled, because nobody has decided yet');

select is(
  (select proposal.proposal_kind from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.tournament_id = current_setting('test.cp_season')::uuid
      and proposal.season_fixture_id is null),
  'discovered',
  'a fixture we do not hold is staged rather than created');

select is(
  (select proposal.proposal_kind from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.season_fixture_id = md5('cp-f1')::uuid),
  'cancelled',
  'and the provider''s own status token decides the kind, through contract 135''s vocabulary');

-- ---------------------------------------------------------------------------
-- WITHDRAWAL NEEDS A DECLARED SPAN
-- ---------------------------------------------------------------------------

select is(
  current_setting('test.cp_result')::jsonb ->> 'withdrawalChecked', 'false',
  'with no coverage window, withdrawal detection does not run');

select is(
  (select count(*)::integer from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.tournament_id = current_setting('test.cp_season')::uuid
      and proposal.proposal_kind = 'withdrawn'),
  0,
  'so the fixture the payload never mentioned is NOT proposed for voiding — a poll is not a complete view');

select is(
  (predictor_internal.detect_provider_calendar_changes(
     'sportmonks', current_setting('test.cp_season')::uuid,
     current_setting('test.cp_payload')::jsonb, null, now(),
     now(), now() + interval '7 days') ->> 'withdrawalChecked'),
  'true',
  'given an explicit span the caller declares complete, it does run');

select is(
  (select proposal.season_fixture_id from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.proposal_kind = 'withdrawn'
      and proposal.tournament_id = current_setting('test.cp_season')::uuid),
  md5('cp-f2')::uuid,
  'and names the fixture inside the span that the payload did not mention');

-- ---------------------------------------------------------------------------
-- RE-DETECTION IS IDEMPOTENT
-- ---------------------------------------------------------------------------

select is(
  (predictor_internal.detect_provider_calendar_changes(
     'sportmonks', current_setting('test.cp_season')::uuid,
     current_setting('test.cp_payload')::jsonb, null, now(), null, null) ->> 'staged'),
  '0',
  'a second pass over the same payload stages nothing new');

select is(
  (select max(proposal.seen_count)::integer
     from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.tournament_id = current_setting('test.cp_season')::uuid),
  3,
  'it counts the repetition instead, so a rejected proposal cannot refill the queue');

-- ---------------------------------------------------------------------------
-- THE ADMINISTRATOR BOUNDARY
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('cp-' || who)::uuid, format('cp-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['plain', 'admin']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('cp-plain')::uuid, 'Ordinary Ola', now()),
  (md5('cp-admin')::uuid, 'Admin Ada', now());

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cp-plain')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format('select public.admin_provider_change_proposals(%L)', current_setting('test.cp_season')),
  '42501',
  'Competition administration is not authorised',
  'an ordinary signed-in player cannot read the queue');

reset role;

select set_config('test.cp_cancelled',
  (select proposal.id::text from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.tournament_id = current_setting('test.cp_season')::uuid
      and proposal.proposal_kind = 'cancelled'), true);
select set_config('test.cp_discovered',
  (select proposal.id::text from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.tournament_id = current_setting('test.cp_season')::uuid
      and proposal.proposal_kind = 'discovered'), true);
select set_config('test.cp_withdrawn',
  (select proposal.id::text from predictor_internal.provider_calendar_change_proposals proposal
    where proposal.tournament_id = current_setting('test.cp_season')::uuid
      and proposal.proposal_kind = 'withdrawn'), true);

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cp-admin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select set_config('test.cp_view',
  public.admin_provider_change_proposals(current_setting('test.cp_season')::uuid)::text, true);

-- The proposal ids are resolved as the OWNER, before any assertion runs as
-- `authenticated`. A signed-in caller cannot read `predictor_internal` — which
-- is the point of the schema — so looking an id up inside an argument
-- expression fails with `permission denied` and tests nothing about the
-- function under test. The first CI run of this file died exactly there.
select set_config('test.cp_cancelled', '', true);

select is(
  current_setting('test.cp_view')::jsonb ->> 'total', '3',
  'the administrator sees all three staged changes');

select is(
  current_setting('test.cp_view')::jsonb ->> 'truncated', 'false',
  'and is told whether the list was truncated, which contract 171 established a count alone cannot say');

-- ---------------------------------------------------------------------------
-- APPROVAL IS THE ONLY THING THAT MAY CHANGE A FIXTURE
-- ---------------------------------------------------------------------------

select is(
  (public.admin_decide_provider_change_proposal(
     current_setting('test.cp_cancelled')::uuid,
     'approve') -> 'resulting_action' ->> 'status'),
  'void',
  'approving a cancellation voids the fixture, using a status the CHECK already allowed');

select is(
  (select fixture.status from public.season_fixtures fixture where fixture.id = md5('cp-f1')::uuid),
  'void',
  'and the fixture actually moves');

select is(
  (public.admin_decide_provider_change_proposal(
     current_setting('test.cp_discovered')::uuid,
     'approve') -> 'resulting_action' ->> 'created_season_fixture_id') is not null,
  true,
  'approving a discovered proposal creates the fixture, and says which');

select is(
  (select count(*)::integer from public.season_fixtures fixture
    where fixture.tournament_id = current_setting('test.cp_season')::uuid),
  3,
  'so the season now holds three — the two it started with and the approved one');

-- ---------------------------------------------------------------------------
-- A FIXTURE WITH A RESULT IS NEVER OVERWRITTEN
--
-- Re-checked under the row lock rather than trusted from the snapshot taken at
-- detection, because a result can be confirmed between the two.
-- ---------------------------------------------------------------------------

reset role;
update public.season_fixtures
   set status = 'played', home_score = 2, away_score = 1
 where id = md5('cp-f2')::uuid;

select set_config('request.jwt.claims',
  json_build_object('sub', md5('cp-admin')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select throws_ok(
  format('select public.admin_decide_provider_change_proposal(%L, %L)',
    current_setting('test.cp_withdrawn')::uuid,
    'approve'),
  '55000',
  'That fixture now has a result; approving would rescore a settled matchweek',
  'a fixture that has gained a result since detection cannot be voided');

select is(
  (select fixture.status || ' ' || fixture.home_score::text
     from public.season_fixtures fixture where fixture.id = md5('cp-f2')::uuid),
  'played 2',
  'and the settled result is untouched');

reset role;
select set_config('request.jwt.claims', null, true);

select * from finish();
rollback;
