-- Contract 175: the What-If projection.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the projection is not a second
-- scoring engine. Two matchweeks are driven in which every fixture is played —
-- one with a Joker and one without — and the projection is required to equal
-- `predictor_internal.season_matchweek_points` EXACTLY. That is the only thing
-- standing between this contract and a second answer to "what did that
-- matchweek score", and a comment cannot enforce it.
--
-- The second is the reveal boundary: before a matchweek's own lock the league
-- block hides completely rather than refusing, and it carries no member rows at
-- all — not even redacted ones, because who has already predicted is itself
-- information before a lock.

begin;

select plan(23);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C175 What If', 2058, t.competition_id, 'what-if', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.wi_season',
  (select id::text from public.tournaments where season_key = 'what-if'), true);

insert into public.teams (id, tournament_id, name) values
  (md5('wi-t1')::uuid, current_setting('test.wi_season')::uuid, 'WI Rovers'),
  (md5('wi-t2')::uuid, current_setting('test.wi_season')::uuid, 'WI United'),
  (md5('wi-t3')::uuid, current_setting('test.wi_season')::uuid, 'WI City'),
  (md5('wi-t4')::uuid, current_setting('test.wi_season')::uuid, 'WI Athletic'),
  (md5('wi-t5')::uuid, current_setting('test.wi_season')::uuid, 'WI Albion'),
  (md5('wi-t6')::uuid, current_setting('test.wi_season')::uuid, 'WI Wanderers');

-- Three rounds:
--   6 — fully played and settled          <- the parity case
--   7 — one fixture in play, two played   <- the projection case, locked
--   8 — not yet open                      <- the pre-lock hide case
-- The windows ascend and do not touch, because `assert_round_play_window`
-- refuses a round claiming time another round already claims.
insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label,
  window_opens_at, window_closes_at)
values
  (md5('wi-r6')::uuid, current_setting('test.wi_season')::uuid, 'wi-mw6', 6,
   'league_matchweek', 'Matchweek 6',
   now() - interval '30 days', now() - interval '22 days'),
  (md5('wi-r7')::uuid, current_setting('test.wi_season')::uuid, 'wi-mw7', 7,
   'league_matchweek', 'Matchweek 7',
   now() - interval '5 days', now() + interval '1 day'),
  (md5('wi-r8')::uuid, current_setting('test.wi_season')::uuid, 'wi-mw8', 8,
   'league_matchweek', 'Matchweek 8',
   now() + interval '3 days', now() + interval '10 days');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id,
  kickoff_at, status, home_score, away_score)
values
  -- Matchweek 6: both played.
  (md5('wi-f6a')::uuid, current_setting('test.wi_season')::uuid, md5('wi-r6')::uuid,
   md5('wi-t1')::uuid, md5('wi-t2')::uuid, now() - interval '28 days', 'played', 1, 0),
  (md5('wi-f6b')::uuid, current_setting('test.wi_season')::uuid, md5('wi-r6')::uuid,
   md5('wi-t3')::uuid, md5('wi-t4')::uuid, now() - interval '27 days', 'played', 2, 2),
  -- Matchweek 7: one still in play, two settled.
  (md5('wi-f7a')::uuid, current_setting('test.wi_season')::uuid, md5('wi-r7')::uuid,
   md5('wi-t1')::uuid, md5('wi-t2')::uuid, now() - interval '2 hours', 'scheduled', null, null),
  (md5('wi-f7b')::uuid, current_setting('test.wi_season')::uuid, md5('wi-r7')::uuid,
   md5('wi-t3')::uuid, md5('wi-t4')::uuid, now() - interval '3 days', 'played', 2, 0),
  (md5('wi-f7c')::uuid, current_setting('test.wi_season')::uuid, md5('wi-r7')::uuid,
   md5('wi-t5')::uuid, md5('wi-t6')::uuid, now() - interval '3 days', 'played', 0, 0),
  -- Matchweek 8: not kicked off.
  (md5('wi-f8a')::uuid, current_setting('test.wi_season')::uuid, md5('wi-r8')::uuid,
   md5('wi-t1')::uuid, md5('wi-t2')::uuid, now() + interval '5 days', 'scheduled', null, null);

-- The provider's provisional view of the fixture still being played. Contract
-- 135's table: an opinion, never an official result.
insert into predictor_internal.season_fixture_live_state (
  season_fixture_id, tournament_id, provider, provider_status, kind,
  home_score, away_score)
values (md5('wi-f7a')::uuid, current_setting('test.wi_season')::uuid,
        'sportmonks', 'INPLAY_2ND_HALF', 'in_play', 1, 1);

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('wi-' || who)::uuid, format('wi-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['ana', 'ben', 'cal', 'dee']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('wi-ana')::uuid, 'Ana', now()),
  (md5('wi-ben')::uuid, 'Ben', now()),
  (md5('wi-cal')::uuid, 'Cal', now()),
  (md5('wi-dee')::uuid, 'Dee', now());

insert into public.bonus_competitions (
  tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at)
values (current_setting('test.wi_season')::uuid, 'main_predictor', true, 'active',
        false, 'public', now() - interval '60 days');

-- Ana and Ben enter; Cal joins the league and never enters, which contract 128
-- established must be a row on zero rather than a dropped member.
insert into public.entries (id, user_id, tournament_id) values
  (md5('wi-e-ana')::uuid, md5('wi-ana')::uuid, current_setting('test.wi_season')::uuid),
  (md5('wi-e-ben')::uuid, md5('wi-ben')::uuid, current_setting('test.wi_season')::uuid);

select set_config('test.wi_ana', md5('wi-e-ana')::uuid::text, true);
select set_config('test.wi_ben', md5('wi-e-ben')::uuid::text, true);

-- Predictions. Matchweek 7 is already locked, so the lock trigger would refuse
-- them through the ordinary path; setup writes them with triggers disabled
-- because this suite tests the READ, not the write path contract 114 owns.
set local session_replication_role = replica;
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  -- Matchweek 6. Ana 3 (one correct outcome), Ben 5 (one exact).
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid, md5('wi-f6a')::uuid, 2, 1),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid, md5('wi-f6b')::uuid, 1, 0),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid, md5('wi-f6a')::uuid, 0, 1),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid, md5('wi-f6b')::uuid, 2, 2),
  -- Matchweek 7. Ana 10 raw before the Joker (two exacts, one miss); Ben 3.
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid, md5('wi-f7a')::uuid, 2, 1),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid, md5('wi-f7b')::uuid, 2, 0),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid, md5('wi-f7c')::uuid, 0, 0),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid, md5('wi-f7a')::uuid, 1, 2),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid, md5('wi-f7b')::uuid, 1, 0),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid, md5('wi-f7c')::uuid, 1, 0);

-- Ben's Joker on the settled matchweek, Ana's on the live one.
insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id) values
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid, md5('wi-r6')::uuid),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid, md5('wi-r7')::uuid);
set local session_replication_role = origin;

-- The banked matchweek 6 totals, which are what the two players carry into the
-- projection. They are the values the scoring authority itself produces —
-- asserted below rather than assumed, so this suite cannot bank a fiction.
insert into public.season_matchweek_scores (
  tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored)
values
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ana')::uuid,
   md5('wi-r6')::uuid, 3, false, 2),
  (current_setting('test.wi_season')::uuid, current_setting('test.wi_ben')::uuid,
   md5('wi-r6')::uuid, 10, true, 2);

-- A private league on this season holding Ana, Ben and the entryless Cal, and a
-- second league holding only Dee, for the non-member refusal.
insert into public.leagues (id, tournament_id, owner_id, name, invite_code) values
  (md5('wi-league')::uuid, current_setting('test.wi_season')::uuid,
   md5('wi-ana')::uuid, 'What If League', 'WHATIFLEAGUE1'),
  (md5('wi-other')::uuid, current_setting('test.wi_season')::uuid,
   md5('wi-dee')::uuid, 'Other League', 'OTHERLEAGUE12');

insert into public.league_members (league_id, user_id, role) values
  (md5('wi-league')::uuid, md5('wi-ana')::uuid, 'owner'),
  (md5('wi-league')::uuid, md5('wi-ben')::uuid, 'member'),
  (md5('wi-league')::uuid, md5('wi-cal')::uuid, 'member'),
  (md5('wi-other')::uuid, md5('wi-dee')::uuid, 'owner');

-- ---------------------------------------------------------------------------
-- 1. THE PARITY ASSERTION. The projection is the scoring authority's answer.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_matchweek_projection(
    current_setting('test.wi_ana')::uuid, md5('wi-r6')::uuid),
  predictor_internal.season_matchweek_points(
    current_setting('test.wi_ana')::uuid, md5('wi-r6')::uuid),
  'over a fully played matchweek the projection equals the scoring authority exactly');

select is(
  predictor_internal.season_matchweek_projection(
    current_setting('test.wi_ana')::uuid, md5('wi-r6')::uuid),
  3,
  'and that shared answer is the one ADR 0012 gives: one correct outcome, no Joker');

select is(
  predictor_internal.season_matchweek_projection(
    current_setting('test.wi_ben')::uuid, md5('wi-r6')::uuid),
  predictor_internal.season_matchweek_points(
    current_setting('test.wi_ben')::uuid, md5('wi-r6')::uuid),
  'the Joker doubles the projection exactly as it doubles the banked total');

select is(
  predictor_internal.season_matchweek_projection(
    current_setting('test.wi_ben')::uuid, md5('wi-r6')::uuid),
  10,
  'one exact score, doubled once at the matchweek and never per fixture');

-- ---------------------------------------------------------------------------
-- 2. THE PROJECTION ITSELF, over a provisional score.
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', md5('wi-ana')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('test.wi_r7',
  public.get_season_matchweek_projection(
    current_setting('test.wi_season')::uuid, 7, null)::text, true);

select is(
  (current_setting('test.wi_r7')::jsonb ->> 'projected_points')::integer,
  20,
  'the live 1-1 scores nothing, the two settled fixtures score two exacts, and the Joker doubles the ten');

select is(
  (current_setting('test.wi_r7')::jsonb ->> 'locked')::boolean,
  true,
  'a matchweek whose earliest kickoff has passed reports itself locked');

select is(
  (current_setting('test.wi_r7')::jsonb ->> 'settled')::boolean,
  false,
  'and it is not settled, so the projection is not competing with a banked total');

select is(
  (select entry ->> 'basis'
     from jsonb_array_elements(current_setting('test.wi_r7')::jsonb -> 'fixtures') entry
    where entry ->> 'fixture_id' = md5('wi-f7a')::uuid::text),
  'provisional',
  'the in-play fixture names its basis as provisional rather than presenting a provider score as official');

select is(
  (select entry ->> 'basis'
     from jsonb_array_elements(current_setting('test.wi_r7')::jsonb -> 'fixtures') entry
    where entry ->> 'fixture_id' = md5('wi-f7b')::uuid::text),
  'official',
  'and a confirmed fixture names its basis as official');

-- ---------------------------------------------------------------------------
-- 3. THE BRANCHES.
-- ---------------------------------------------------------------------------

select is(
  (select (entry -> 'branches' -> 'home_scores' ->> 'matchweek_points')::integer
     from jsonb_array_elements(current_setting('test.wi_r7')::jsonb -> 'fixtures') entry
    where entry ->> 'fixture_id' = md5('wi-f7a')::uuid::text),
  30,
  'if the home side scores, Ana''s 2-1 becomes exact and the doubled matchweek goes from 20 to 30');

select is(
  (select (entry -> 'branches' -> 'away_scores' ->> 'matchweek_points')::integer
     from jsonb_array_elements(current_setting('test.wi_r7')::jsonb -> 'fixtures') entry
    where entry ->> 'fixture_id' = md5('wi-f7a')::uuid::text),
  20,
  'if the away side scores, her prediction is still wrong and the projection does not move');

select is(
  (select entry -> 'branches'
     from jsonb_array_elements(current_setting('test.wi_r7')::jsonb -> 'fixtures') entry
    where entry ->> 'fixture_id' = md5('wi-f7b')::uuid::text),
  'null'::jsonb,
  'a played fixture carries no branch, because a settled result has no next goal');

select is(
  (select entry -> 'branches'
     from jsonb_array_elements(
            public.get_season_matchweek_projection(
              current_setting('test.wi_season')::uuid, 8, null) -> 'fixtures') entry
    where entry ->> 'fixture_id' = md5('wi-f8a')::uuid::text),
  'null'::jsonb,
  'and a fixture that has not kicked off carries none either, rather than branching from an assumed nil-nil');

-- ---------------------------------------------------------------------------
-- 4. THE LEAGUE CONSEQUENCE, AFTER THE LOCK.
-- ---------------------------------------------------------------------------

select set_config('test.wi_league',
  (public.get_season_matchweek_projection(
    current_setting('test.wi_season')::uuid, 7, md5('wi-league')::uuid) -> 'league')::text, true);

select is(
  (current_setting('test.wi_league')::jsonb ->> 'revealed')::boolean,
  true,
  'after the matchweek''s own lock the league consequence is revealed');

select is(
  (select (entry ->> 'projected_rank')::integer
     from jsonb_array_elements(current_setting('test.wi_league')::jsonb -> 'table') entry
    where entry ->> 'user_id' = md5('wi-ana')::uuid::text),
  1,
  'Ana projects to first: three banked plus a doubled twenty');

select is(
  (select (entry ->> 'current_rank')::integer
     from jsonb_array_elements(current_setting('test.wi_league')::jsonb -> 'table') entry
    where entry ->> 'user_id' = md5('wi-ana')::uuid::text),
  2,
  'while she is currently second, which is the rank swap the feature exists to show');

select is(
  (select (entry ->> 'projected_points')::integer
     from jsonb_array_elements(current_setting('test.wi_league')::jsonb -> 'table') entry
    where entry ->> 'user_id' = md5('wi-ben')::uuid::text),
  13,
  'Ben''s ten banked and three projected are the banked authority''s numbers, never recomputed');

select is(
  (select (entry ->> 'entered')::boolean
     from jsonb_array_elements(current_setting('test.wi_league')::jsonb -> 'table') entry
    where entry ->> 'user_id' = md5('wi-cal')::uuid::text),
  false,
  'a league member who never entered the game appears on zero rather than being dropped from the table');

-- ---------------------------------------------------------------------------
-- 5. THE REVEAL BOUNDARY, BEFORE THE LOCK.
-- ---------------------------------------------------------------------------

select set_config('test.wi_early',
  (public.get_season_matchweek_projection(
    current_setting('test.wi_season')::uuid, 8, md5('wi-league')::uuid) -> 'league')::text, true);

select is(
  (current_setting('test.wi_early')::jsonb ->> 'revealed')::boolean,
  false,
  'before the matchweek locks the league block hides rather than refusing');

select is(
  jsonb_array_length(current_setting('test.wi_early')::jsonb -> 'table'),
  0,
  'and it hides completely: no member rows at all, because who has predicted is itself information');

-- ---------------------------------------------------------------------------
-- 6. REFUSALS, AND THAT IT WRITES NOTHING.
-- ---------------------------------------------------------------------------

select throws_ok(
  format('select public.get_season_matchweek_projection(%L, 7, %L)',
         current_setting('test.wi_season'), md5('wi-other')::uuid),
  '42501',
  null,
  'a league the caller is not a member of is refused');

select set_config('request.jwt.claim.sub', md5('wi-cal')::uuid::text, true);

select throws_ok(
  format('select public.get_season_matchweek_projection(%L, 7, null)',
         current_setting('test.wi_season')),
  '42501',
  null,
  'a caller with no entry in this season has no projection of their own to read');

reset role;

select is(
  (select count(*)::integer from public.season_matchweek_scores
    where tournament_id = current_setting('test.wi_season')::uuid),
  2,
  'and nothing the read did banked a point: the two seeded matchweek totals are still the only ones');

select * from finish();
rollback;
