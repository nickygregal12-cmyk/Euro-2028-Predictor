-- Contract 206 / PROF-001: a same-season entrant may read another entrant's
-- bounded competitive profile by playerRef without learning the auth UUID.
--
-- This suite makes the dangerous implementations fail:
--   * widening the legacy UUID RPC -> old-RPC refusal fails;
--   * returning user_id on the new path -> identity assertions fail;
--   * resolving by display name -> the duplicate-name ref assertions fail;
--   * weakening reveal -> the future matchweek appears;
--   * widening every `profile` feature -> pin/DNA refusals fail;
--   * resolving the ref before caller scope -> the outsider assertion fails.

begin;

select plan(21);

insert into public.tournaments
  (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C206 Profile Scope', 2068, t.competition_id, 'c206-profile',
       'league_season', t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

insert into public.tournaments
  (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C206 Other Season', 2068, t.competition_id, 'c206-other',
       'league_season', t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.c206_season',
  (select id::text from public.tournaments where season_key = 'c206-profile'), true);
select set_config('test.c206_other',
  (select id::text from public.tournaments where season_key = 'c206-other'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.c206_season')::uuid, 'C206 North'),
  (current_setting('test.c206_season')::uuid, 'C206 South');

insert into public.competition_rounds
  (tournament_id, round_key, ordinal, kind, label)
values
  (current_setting('test.c206_season')::uuid, 'c206-mw1', 1, 'league_matchweek', 'Matchweek 1'),
  (current_setting('test.c206_season')::uuid, 'c206-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.c206_mw1',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.c206_season')::uuid
      and round_key = 'c206-mw1'), true);
select set_config('test.c206_mw2',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.c206_season')::uuid
      and round_key = 'c206-mw2'), true);

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.c206_season')::uuid,
       current_setting('test.c206_mw1')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.c206_season')::uuid and name = 'C206 North'),
       (select id from public.teams where tournament_id = current_setting('test.c206_season')::uuid and name = 'C206 South'),
       now() + interval '1 day', 'scheduled';

insert into public.season_fixtures
  (tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.c206_season')::uuid,
       current_setting('test.c206_mw2')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.c206_season')::uuid and name = 'C206 South'),
       (select id from public.teams where tournament_id = current_setting('test.c206_season')::uuid and name = 'C206 North'),
       now() + interval '6 days', 'scheduled';

select set_config('test.c206_fx1',
  (select id::text from public.season_fixtures
    where competition_round_id = current_setting('test.c206_mw1')::uuid), true);
select set_config('test.c206_fx2',
  (select id::text from public.season_fixtures
    where competition_round_id = current_setting('test.c206_mw2')::uuid), true);

insert into public.bonus_competitions
  (id, tournament_id, game_key, published, availability_status,
   draw_required, visibility_kind, registration_opens_at)
values
  (md5('c206-mp')::uuid, current_setting('test.c206_season')::uuid,
   'main_predictor', true, 'active', false, 'public', now() - interval '5 days'),
  (md5('c206-mp-other')::uuid, current_setting('test.c206_other')::uuid,
   'main_predictor', true, 'active', false, 'public', now() - interval '5 days');

set local session_replication_role = replica;
insert into auth.users
  (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('c206-user-' || n)::uuid, format('c206-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from generate_series(1, 4) as n;
set local session_replication_role = origin;

-- Users 2 and 3 deliberately share a display name. The ref, never the name,
-- must decide which profile was requested.
insert into public.profiles (id, display_name, welcomed_at) values
  (md5('c206-user-1')::uuid, 'C206 Viewer', now()),
  (md5('c206-user-2')::uuid, 'Duplicate Player', now()),
  (md5('c206-user-3')::uuid, 'Duplicate Player', now()),
  (md5('c206-user-4')::uuid, 'C206 Outsider', now());

insert into public.entries (id, user_id, tournament_id, game_competition_id) values
  (md5('c206-entry-1')::uuid, md5('c206-user-1')::uuid,
   current_setting('test.c206_season')::uuid, md5('c206-mp')::uuid),
  (md5('c206-entry-2')::uuid, md5('c206-user-2')::uuid,
   current_setting('test.c206_season')::uuid, md5('c206-mp')::uuid),
  (md5('c206-entry-3')::uuid, md5('c206-user-3')::uuid,
   current_setting('test.c206_season')::uuid, md5('c206-mp')::uuid),
  (md5('c206-entry-other')::uuid, md5('c206-user-2')::uuid,
   current_setting('test.c206_other')::uuid, md5('c206-mp-other')::uuid);

-- User 2 predicts both matchweeks while both are open. Only MW1 is then moved
-- past lock and settled; MW2 must stay absent from another player's profile.
insert into public.season_predictions
  (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values
  (current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid,
   current_setting('test.c206_fx1')::uuid, 2, 1),
  (current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid,
   current_setting('test.c206_fx2')::uuid, 1, 1);

-- Do this through the ordinary fixture path, exactly as the contract-151
-- regression does. Suppressing triggers here made the test describe a state the
-- application never produces and left the reveal authority answering "not yet".
update public.season_fixtures
   set kickoff_at = now() - interval '3 hours',
       status = 'played', home_score = 2, away_score = 1
 where id = current_setting('test.c206_fx1')::uuid;

insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
values
  (current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid,
   current_setting('test.c206_mw1')::uuid, 14, 1, now() - interval '1 hour');

select ok(
  predictor_internal.season_matchweek_lock_at(
    current_setting('test.c206_season')::uuid,
    current_setting('test.c206_mw1')::uuid,
    0
  ) <= now(),
  'the fixture setup genuinely puts Matchweek 1 past its canonical lock');

-- Viewer and target share NO private league. Their reach is therefore compare.
select set_config('request.jwt.claims',
  json_build_object('sub', md5('c206-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.resolve_season_player(
    current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid) ->> 'reach',
  'compare',
  'same-season strangers retain compare reach');

select is(
  (public.resolve_season_player(
    current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid)
      ->> 'canViewProfile')::boolean,
  true,
  'compare now carries the bounded-profile capability');

select is(
  public.resolve_season_player(
    current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid) -> 'playerId',
  'null'::jsonb,
  'the capability does not publish the authentication identifier');

select set_config('test.c206_profile',
  public.get_season_player_profile_by_ref(
    current_setting('test.c206_season')::uuid,
    md5('c206-entry-2')::uuid)::text, true);

select is(
  current_setting('test.c206_profile')::jsonb -> 'player' ->> 'display_name',
  'Duplicate Player',
  'a same-season viewer can read the bounded profile by ref');

select ok(
  not (current_setting('test.c206_profile')::jsonb -> 'player' ? 'user_id'),
  'the by-ref player object contains no user_id key');

select ok(
  position(md5('c206-user-2')::uuid::text in current_setting('test.c206_profile')) = 0,
  'the target authentication UUID appears nowhere in the payload');

select is(
  current_setting('test.c206_profile')::jsonb -> 'player' ->> 'player_ref',
  md5('c206-entry-2')::uuid::text,
  'the returned identity is the season-scoped entry ref');

select is(
  current_setting('test.c206_profile')::jsonb -> 'player' ->> 'reach',
  'compare',
  'the payload preserves the reach classification rather than relabelling it profile');

select is(
  jsonb_array_length(current_setting('test.c206_profile')::jsonb -> 'history'),
  1,
  'another player sees only matchweeks whose own lock has passed');

select is(
  coalesce(
    current_setting('test.c206_profile')::jsonb -> 'history' -> 0 ->> 'label',
    '<missing>'
  ),
  'Matchweek 1',
  'and the revealed matchweek is the locked one');

select ok(
  position(current_setting('test.c206_fx2') in current_setting('test.c206_profile')) = 0,
  'the unlocked prediction is absent rather than emptied or leaked');

-- The old UUID path remains narrow. The new product rule does not turn a UUID
-- learned elsewhere into a season-profile directory key.
select throws_ok(
  format($$select public.get_season_player_profile(%L::uuid, %L::uuid)$$,
         current_setting('test.c206_season'), md5('c206-user-2')::uuid),
  '42501',
  null,
  'the legacy UUID profile still refuses a same-season stranger');

select throws_ok(
  format($$select public.set_pinned_rival(%L::uuid, %L::uuid, true)$$,
         current_setting('test.c206_season'), md5('c206-user-2')::uuid),
  '42501',
  null,
  'same-season profile visibility does not widen pinned rivals');

select throws_ok(
  format($$select public.get_season_prediction_dna(%L::uuid, %L::uuid)$$,
         current_setting('test.c206_season'), md5('c206-user-2')::uuid),
  '42501',
  null,
  'same-season profile visibility does not widen Prediction DNA');

-- Duplicate display names remain distinct because each ref resolves exactly one
-- entry. The second twin has no predictions; the point is identity, not content.
select is(
  public.get_season_player_profile_by_ref(
    current_setting('test.c206_season')::uuid, md5('c206-entry-3')::uuid)
      -> 'player' ->> 'player_ref',
  md5('c206-entry-3')::uuid::text,
  'an identically named player resolves to their own distinct ref');

select isnt(
  public.get_season_player_profile_by_ref(
    current_setting('test.c206_season')::uuid, md5('c206-entry-3')::uuid)
      -> 'player' ->> 'player_ref',
  current_setting('test.c206_profile')::jsonb -> 'player' ->> 'player_ref',
  'display-name equality cannot collapse two players into one');

select throws_ok(
  format($$select public.get_season_player_profile_by_ref(%L::uuid, %L::uuid)$$,
         current_setting('test.c206_season'), md5('c206-entry-other')::uuid),
  'P0002',
  null,
  'a ref issued by another season resolves to nothing in this season');

-- An outsider is refused BEFORE target resolution. Use the real ref, because
-- the property is that knowing it does not make the season queryable.
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('c206-user-4')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_season_player_profile_by_ref(%L::uuid, %L::uuid)$$,
         current_setting('test.c206_season'), md5('c206-entry-2')::uuid),
  '42501',
  null,
  'a caller with no entry in the season cannot read a known ref');

-- Self uses the same ref address and still does not need its auth UUID returned.
reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('c206-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (public.get_season_player_profile_by_ref(
    current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid)
      -> 'player' ->> 'is_self')::boolean,
  true,
  'the by-ref path identifies the caller as self when appropriate');

select ok(
  not (public.get_season_player_profile_by_ref(
    current_setting('test.c206_season')::uuid, md5('c206-entry-2')::uuid)
      -> 'player' ? 'user_id'),
  'even the by-ref self payload keeps playerRef as its navigation identity');

reset role;
select * from finish();
rollback;
