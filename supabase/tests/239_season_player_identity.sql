-- Contract 191: a weekly-season standing row becomes a player you can address.
--
-- THE ASSERTIONS THIS FILE EXISTS FOR, in the order they matter:
--
--   1. **The identity cannot collide on a display name.** Two entrants called
--      exactly the same thing get two different `playerRef`s, and each one is
--      that player's own `entries.id`. A frontend that matched on display name
--      would open the wrong player's profile; this is the assertion that makes
--      the invented-identity implementation fail.
--
--   2. **The auth identifier appears only where the profile will answer.** A
--      `compare` row — a same-season entrant who shares no private league —
--      carries a ref and a NULL `playerId`. The easy wrong implementation
--      publishes `entries.user_id` on every row, which is a cross-competition
--      identifier handed to the whole season.
--
--   3. **Contract 151 is not widened.** The same viewer who can now SEE a
--      `compare` row is still refused the profile behind it, and is still
--      refused a pin. Making an address exist must not make a rule move.
--
--   4. **The consolidation did not regress the two functions it touched.** A
--      co-member still reads a profile and still pins a rival, through a
--      boundary that now lives in one function instead of three.
--
-- The leaderboard payload is captured ONCE into a transaction-local setting and
-- every row assertion reads that same capture, so twenty assertions cost one
-- call and none of them can pass against a different page than the others.

begin;

select plan(23);

-- ---------------------------------------------------------------------------
-- One season, four entrants, two of them identically named.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C191 Identity Probe', 2067, t.competition_id, 'id-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

-- A SECOND season, so a reference from elsewhere has somewhere to come from.
-- The whole point of keying on the entry rather than the user is that a ref is
-- meaningless outside the season that issued it.
insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C191 Identity Elsewhere', 2067, t.competition_id, 'id-elsewhere', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.id_season',
  (select id::text from public.tournaments where season_key = 'id-probe'), true);
select set_config('test.id_other',
  (select id::text from public.tournaments where season_key = 'id-elsewhere'), true);

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.id_season')::uuid, 'id-mw1', 1, 'league_matchweek', 'Matchweek 1');

select set_config('test.id_mw1', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.id_season')::uuid and round_key = 'id-mw1'), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values
  (md5('id-mp')::uuid, current_setting('test.id_season')::uuid,
   'main_predictor', true, 'active', false, 'public', now() - interval '5 days'),
  (md5('id-mp-other')::uuid, current_setting('test.id_other')::uuid,
   'main_predictor', true, 'active', false, 'public', now() - interval '5 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('id-user-' || n)::uuid, format('id-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 5) as n;
set local session_replication_role = origin;

-- Users 3 and 4 are called EXACTLY the same thing. That is assertion 1.
insert into public.profiles (id, display_name, welcomed_at) values
  (md5('id-user-1')::uuid, 'Identity Viewer', now()),
  (md5('id-user-2')::uuid, 'Identity Team Mate', now()),
  (md5('id-user-3')::uuid, 'Twin Name', now()),
  (md5('id-user-4')::uuid, 'Twin Name', now()),
  (md5('id-user-5')::uuid, 'Identity Outsider', now());

-- Four entered the probe season. User 5 entered nothing, which is the caller
-- contract 95's boundary refuses.
insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('id-entry-' || n)::uuid, md5('id-user-' || n)::uuid,
       current_setting('test.id_season')::uuid, md5('id-mp')::uuid
from generate_series(1, 4) as n;

-- User 3 also plays the OTHER season, so their ref there is a real entry that
-- simply does not belong to the season being asked about.
insert into public.entries (id, user_id, tournament_id, game_competition_id)
values (md5('id-entry-elsewhere')::uuid, md5('id-user-3')::uuid,
        current_setting('test.id_other')::uuid, md5('id-mp-other')::uuid);

-- Only users 1 and 2 share a private league. That is the whole distinction
-- between `profile` and `compare`.
insert into public.leagues (id, tournament_id, owner_id, name, invite_code, game_competition_id)
values (md5('id-league')::uuid, current_setting('test.id_season')::uuid,
        md5('id-user-1')::uuid, 'Identity Probe League', 'ID0001', md5('id-mp')::uuid);

insert into public.league_members (league_id, user_id, role) values
  (md5('id-league')::uuid, md5('id-user-1')::uuid, 'owner'),
  (md5('id-league')::uuid, md5('id-user-2')::uuid, 'member')
on conflict do nothing;

-- Distinct totals, so position is deterministic for everybody except the twins,
-- who are deliberately level and separated only by the entry key.
insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
values
  (current_setting('test.id_season')::uuid, md5('id-entry-1')::uuid,
   current_setting('test.id_mw1')::uuid, 30, 1, now() - interval '1 hour'),
  (current_setting('test.id_season')::uuid, md5('id-entry-2')::uuid,
   current_setting('test.id_mw1')::uuid, 20, 1, now() - interval '1 hour'),
  (current_setting('test.id_season')::uuid, md5('id-entry-3')::uuid,
   current_setting('test.id_mw1')::uuid, 10, 1, now() - interval '1 hour'),
  (current_setting('test.id_season')::uuid, md5('id-entry-4')::uuid,
   current_setting('test.id_mw1')::uuid, 10, 1, now() - interval '1 hour');

-- ---------------------------------------------------------------------------
-- The guard, before anything else. If the repository already holds a second
-- copy of the visibility rule, every assertion below is measuring the wrong
-- installation.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select predictor_internal.assert_single_season_player_visibility_authority()$$,
  'exactly one function decides who may be seen in a competition season');

-- ---------------------------------------------------------------------------
-- What the viewer sees on the global table. Captured once.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('id-user-1')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select set_config('test.id_board',
  public.get_season_leaderboard(current_setting('test.id_season')::uuid, 50)::text, true);

select set_config('test.id_near',
  public.get_season_leaderboard_neighbourhood(current_setting('test.id_season')::uuid, 3)::text,
  true);

select is(
  (select row ->> 'reach'
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where (row ->> 'isYou')::boolean),
  'self',
  'the caller''s own row reaches themselves');

select is(
  (select row ->> 'playerId'
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where (row ->> 'isYou')::boolean),
  md5('id-user-1')::uuid::text,
  'and carries the caller''s own identifier');

select is(
  (select row ->> 'reach'
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Identity Team Mate'),
  'profile',
  'a private-league co-member is reachable as a profile');

select is(
  (select row ->> 'playerId'
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Identity Team Mate'),
  md5('id-user-2')::uuid::text,
  'and carries the identifier the profile read is keyed on');

select is(
  (select count(distinct row ->> 'reach')::integer
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Twin Name'),
  1,
  'both same-season strangers get the same reach as each other');

select is(
  (select min(row ->> 'reach')
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Twin Name'),
  'compare',
  'and that reach is compare rather than profile');

-- ASSERTION 2. The identifier is withheld, not merely unused. An
-- implementation that published `user_id` on every row passes every other test
-- in this file and fails this one.
select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Twin Name'
      and row -> 'playerId' <> 'null'::jsonb),
  0,
  'a compare-only row carries no authentication identifier');

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row -> 'playerRef' is null or row -> 'playerRef' = 'null'::jsonb),
  0,
  'every row carries a season-scoped reference');

-- ASSERTION 1. Two players with the same name are two different players.
select is(
  (select count(distinct row ->> 'playerRef')::integer
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Twin Name'),
  2,
  'two identically named entrants have two different references');

-- And the reference is the canonical one rather than something invented here.
select is(
  (select row ->> 'playerRef'
     from jsonb_array_elements(current_setting('test.id_board')::jsonb -> 'rows') row
    where row ->> 'displayName' = 'Identity Team Mate'),
  md5('id-entry-2')::uuid::text,
  'the reference is the player''s own entry, which contract 94 already ranks on');

select is(
  (select count(*)::integer
     from jsonb_array_elements(current_setting('test.id_near')::jsonb -> 'rows') row
    where row -> 'playerRef' = 'null'::jsonb or row -> 'reach' = 'null'::jsonb),
  0,
  'the neighbourhood carries the same identity as the page it must agree with');

-- ---------------------------------------------------------------------------
-- One reference in, one destination or one refusal out.
-- ---------------------------------------------------------------------------

select is(
  public.resolve_season_player(
    current_setting('test.id_season')::uuid, md5('id-entry-2')::uuid) ->> 'reach',
  'profile',
  'resolving a co-member''s reference reaches their profile');

select is(
  (public.resolve_season_player(
    current_setting('test.id_season')::uuid, md5('id-entry-2')::uuid)
     ->> 'canViewProfile')::boolean,
  true,
  'and says so without the caller having to interpret the reach itself');

select is(
  public.resolve_season_player(
    current_setting('test.id_season')::uuid, md5('id-entry-3')::uuid) -> 'playerId',
  'null'::jsonb,
  'resolving a compare-only reference yields no authentication identifier');

select is(
  (public.resolve_season_player(
    current_setting('test.id_season')::uuid, md5('id-entry-3')::uuid)
     ->> 'canCompare')::boolean,
  true,
  'though comparison is permitted, which is contract 129''s own rule');

-- A reference is season-scoped. One issued by another season is not a player
-- here, and is refused rather than resolved against the same user.
select throws_ok(
  format($$select public.resolve_season_player(%L::uuid, %L::uuid)$$,
         current_setting('test.id_season'), md5('id-entry-elsewhere')::uuid),
  'P0002',
  null,
  'a reference from another season resolves to nothing here');

-- ---------------------------------------------------------------------------
-- Contract 151 has not moved.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('id-user-3')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.get_season_player_profile(%L::uuid, %L::uuid)$$,
         current_setting('test.id_season'), md5('id-user-1')::uuid),
  '42501',
  null,
  'a viewer who can now SEE a compare row is still refused the profile behind it');

select throws_ok(
  format($$select public.set_pinned_rival(%L::uuid, %L::uuid, true)$$,
         current_setting('test.id_season'), md5('id-user-1')::uuid),
  '42501',
  null,
  'and is still refused a pin, which the consolidation must not have relaxed');

-- ---------------------------------------------------------------------------
-- And the two functions it touched still work for the people it always allowed.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('id-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  (public.get_season_player_profile(
    current_setting('test.id_season')::uuid, md5('id-user-1')::uuid)
     -> 'player' ->> 'display_name'),
  'Identity Viewer',
  'a private-league co-member still reads the profile they always could');

select is(
  (public.get_season_player_profile(
    current_setting('test.id_season')::uuid, md5('id-user-1')::uuid)
     -> 'player' ->> 'player_ref'),
  md5('id-entry-1')::uuid::text,
  'and the profile now names the same reference the standings row carried');

select is(
  (public.set_pinned_rival(
    current_setting('test.id_season')::uuid, md5('id-user-1')::uuid, true)
     ->> 'pinned')::boolean,
  true,
  'and can still pin a rival through the consolidated boundary');

-- ---------------------------------------------------------------------------
-- A caller with no standing in the season is refused before any name is read.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  json_build_object('sub', md5('id-user-5')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select throws_ok(
  format($$select public.resolve_season_player(%L::uuid, %L::uuid)$$,
         current_setting('test.id_season'), md5('id-entry-1')::uuid),
  '42501',
  null,
  'a caller holding no entry in the season may not resolve anybody in it');

reset role;

select * from finish();

rollback;
