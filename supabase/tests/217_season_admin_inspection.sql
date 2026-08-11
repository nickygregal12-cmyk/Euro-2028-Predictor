-- Contract 168: the inspection reads the administrator commands assume.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that `blocked_total` counts the whole
-- staged calendar and counts EXACTLY the conditions the per-row `blockers` list
-- names. An earlier draft counted only the mapping failures, so a calendar with
-- one unmapped team and one past kickoff reported `blocked_total: 1` while two
-- rows visibly carried a blocker — a summary disagreeing with the list it
-- summarises. It was found by driving the read, not by reading it.
--
-- The second is that a raw provider payload never reaches a client. The
-- proposal carries a reference to the archived response, and custody keeps the
-- body server-side.

begin;

select plan(12);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C168 Admin Inspection', 2053, t.competition_id, 'admin-inspect', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.ai_season',
  (select id::text from public.tournaments where season_key = 'admin-inspect'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('ai-t1')::uuid, current_setting('test.ai_season')::uuid, 'AI Rovers'),
  (md5('ai-t2')::uuid, current_setting('test.ai_season')::uuid, 'AI United');

-- The custody row's real shape: `raw_body` is TEXT, there is no `payload`
-- column at all, and `provider_raw_responses_provider_origin` requires the URL
-- to match the provider's real API origin — a custody row that cannot say where
-- it came from is not custody. The marker goes in the body, which is precisely
-- what must not reach a client.
insert into predictor_internal.provider_raw_responses (
  id, provider, request_url, request_method, response_status, raw_body, fetched_at)
values (md5('ai-raw')::uuid, 'sportmonks', 'https://api.sportmonks.com/v3/football/fixtures', 'GET', 200,
        '{"marker":"THIS-BODY-MUST-NEVER-REACH-A-CLIENT"}', now())
on conflict do nothing;

-- Two clubs mapped, one provider id deliberately left unmapped.
insert into public.provider_entity_map (
  provider, entity_kind, provider_id, tournament_id, team_id, evidence_ref)
values ('sportmonks', 'team', 'ai-1001', current_setting('test.ai_season')::uuid,
        md5('ai-t1')::uuid, 'pgTAP 217'),
       ('sportmonks', 'team', 'ai-1002', current_setting('test.ai_season')::uuid,
        md5('ai-t2')::uuid, 'pgTAP 217');

insert into predictor_internal.provider_fixture_proposals (
  raw_response_id, provider, tournament_id, provider_fixture_id, round_provider_id,
  home_team_provider_id, home_team_name, away_team_provider_id, away_team_name,
  proposed_kickoff_at, provider_status)
values
  -- Clean.
  (md5('ai-raw')::uuid, 'sportmonks', current_setting('test.ai_season')::uuid,
   'AI-F1', 'AI-R1', 'ai-1001', 'AI Rovers FC', 'ai-1002', 'AI United FC',
   now() + interval '10 days', 'NS'),
  -- Unmapped away club.
  (md5('ai-raw')::uuid, 'sportmonks', current_setting('test.ai_season')::uuid,
   'AI-F2', 'AI-R1', 'ai-1001', 'AI Rovers FC', 'ai-9999', 'Mystery FC',
   now() + interval '11 days', 'NS'),
  -- Kickoff already in the past. A DIFFERENT class of blocker from the one
  -- above, which is what makes the summary assertion meaningful.
  (md5('ai-raw')::uuid, 'sportmonks', current_setting('test.ai_season')::uuid,
   'AI-F3', 'AI-R2', 'ai-1002', 'AI United FC', 'ai-1001', 'AI Rovers FC',
   now() - interval '2 days', 'NS');

-- ---------------------------------------------------------------------------
-- THE GATE, checked before any row is read
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (md5('ai-plain')::uuid, 'ai-plain@example.test', 'authenticated', 'authenticated',
        '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;
insert into public.profiles (id, display_name, welcomed_at)
values (md5('ai-plain')::uuid, 'Plain Player', now());

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ai-plain')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.admin_provider_proposal_detail(%L::uuid)$$,
         current_setting('test.ai_season')),
  '42501', null,
  'a non-administrator cannot see a staged calendar');

select throws_ok(
  format($$select public.admin_competition_entrants(%L::uuid)$$, md5('ai-lms')::uuid),
  '42501', null,
  'nor a competition''s entrants — and the gate fires before the competition is even looked up');

-- ---------------------------------------------------------------------------
-- THE ADMINISTRATOR'S VIEW
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('ai-plain')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select set_config('test.ai_view',
  public.admin_provider_proposal_detail(current_setting('test.ai_season')::uuid)::text, true);

select is(
  current_setting('test.ai_view')::jsonb ->> 'total', '3',
  'the whole staged calendar is counted');

select is(
  (select entry -> 'home' ->> 'mapped_team_name'
     from jsonb_array_elements(current_setting('test.ai_view')::jsonb -> 'proposals') entry
    where entry ->> 'provider_fixture_id' = 'AI-F1'),
  'AI Rovers',
  'the provider''s evidence sits beside OUR mapping''s answer');

select is(
  (select entry -> 'away' ->> 'mapped_team_name'
     from jsonb_array_elements(current_setting('test.ai_view')::jsonb -> 'proposals') entry
    where entry ->> 'provider_fixture_id' = 'AI-F2'),
  null,
  'and an unmapped club maps to nothing rather than to a guess');

select is(
  (select entry -> 'blockers' ->> 0
     from jsonb_array_elements(current_setting('test.ai_view')::jsonb -> 'proposals') entry
    where entry ->> 'provider_fixture_id' = 'AI-F2'),
  'unmapped_away_team',
  'a blocker is NAMED, because "12 problems" tells an administrator nothing to fix');

select is(
  (select entry -> 'blockers' ->> 0
     from jsonb_array_elements(current_setting('test.ai_view')::jsonb -> 'proposals') entry
    where entry ->> 'provider_fixture_id' = 'AI-F3'),
  'kickoff_in_the_past',
  'and a different failure is named differently');

select is(
  (select jsonb_array_length(entry -> 'blockers')
     from jsonb_array_elements(current_setting('test.ai_view')::jsonb -> 'proposals') entry
    where entry ->> 'provider_fixture_id' = 'AI-F1'),
  0,
  'a clean proposal carries no blocker');

-- THE ASSERTION THIS FILE EXISTS FOR.
select is(
  current_setting('test.ai_view')::jsonb ->> 'blocked_total', '2',
  'BLOCKED_TOTAL COUNTS EVERY CLASS the per-row list names, not only the mapping failures');

select is(
  public.admin_provider_proposal_detail(
    current_setting('test.ai_season')::uuid, null, 1, 0) ->> 'blocked_total',
  '2',
  'and it counts the whole calendar even when one row is asked for');

-- The second assertion.
select ok(
  current_setting('test.ai_view') !~ 'THIS-BODY-MUST-NEVER-REACH-A-CLIENT',
  'the archived provider payload never reaches a client: only its id is returned');

select ok(
  current_setting('test.ai_view') ~ 'raw_response_id',
  'and that id IS returned, because an administrator is entitled to the provenance');

-- ---------------------------------------------------------------------------
-- ENTRANTS, AND THE ELIGIBILITY THE DISQUALIFY COMMAND NEEDS
-- ---------------------------------------------------------------------------

reset role;

insert into public.bonus_competitions (
  id, tournament_id, game_key, name, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (md5('ai-lms')::uuid, current_setting('test.ai_season')::uuid, 'last_man_standing',
        'Public LMS', true, 'active', false, 'public', now() - interval '10 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('ai-e' || n)::uuid, format('ai-e%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('ai-e1')::uuid, 'Active Ann', now()),
  (md5('ai-e2')::uuid, 'Gone Greg', now());

insert into public.bonus_competition_entrants (competition_id, user_id, outcome) values
  (md5('ai-lms')::uuid, md5('ai-e1')::uuid, 'active'),
  (md5('ai-lms')::uuid, md5('ai-e2')::uuid, 'active');

insert into public.game_memberships (
  tournament_id, game_competition_id, user_id, status, disqualified_at) values
  (current_setting('test.ai_season')::uuid, md5('ai-lms')::uuid, md5('ai-e1')::uuid, 'active', null),
  (current_setting('test.ai_season')::uuid, md5('ai-lms')::uuid, md5('ai-e2')::uuid,
   'disqualified', now());

select set_config('request.jwt.claims',
  json_build_object('sub', md5('ai-plain')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object('admin_role', 'super_admin'))::text, true);
set local role authenticated;

select is(
  (select entry ->> 'disqualifiable'
     from jsonb_array_elements(
       public.admin_competition_entrants(md5('ai-lms')::uuid) -> 'entrants') entry
    where entry ->> 'display_name' = 'Gone Greg'),
  'false',
  'an entrant already disqualified is not offered as a candidate, so a control the server would refuse is withheld');

reset role;

select * from finish();

rollback;
