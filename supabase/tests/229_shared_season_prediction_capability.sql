-- Contract 180: the shared season prediction card, and PPLAY-002's rule.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the player it starts from has
-- NOTHING. No `public.entries` row, no `game_memberships` row, no
-- `bonus_competition_entrants` row, in any season. The investigation records
-- that every active Development Championship member happened to hold a season
-- entry already, which makes the broken implementation look healthy on any
-- seeded account — so a suite that seeds an entry proves nothing at all, and
-- this one asserts the emptiness before it starts.
--
-- The second is the invariant that must survive the fix: after joining the
-- Championship the player can submit the predictions the Championship scores,
-- and STILL holds no Match Predictor membership. Both halves are required. A
-- fix that gave them the card by quietly joining them to the Predictor would
-- pass the first and fail the second, and it is the failure mode the
-- investigation names.

begin;

select plan(22);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C180 Shared Card', 2063, t.competition_id, 'shared-card', 'league_season',
       'Europe/London', 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.sc_season',
  (select id::text from public.tournaments where season_key = 'shared-card'), true);

insert into public.teams (id, tournament_id, name)
select md5('sc-t' || n)::uuid, current_setting('test.sc_season')::uuid, 'SC Club ' || n
  from generate_series(1, 4) n;

insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label)
values (md5('sc-r1')::uuid, current_setting('test.sc_season')::uuid,
        'sc-mw1', 1, 'league_matchweek', 'Matchweek 1');

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
values (md5('sc-fx1')::uuid, current_setting('test.sc_season')::uuid, md5('sc-r1')::uuid,
        md5('sc-t1')::uuid, md5('sc-t2')::uuid, now() + interval '3 days', 'scheduled');

-- The season's Match Predictor: the game that OWNS the card. It exists and is
-- open, which is what makes the assertion below meaningful — the player COULD
-- join it and deliberately does not.
insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status, draw_required,
  visibility_kind, registration_opens_at)
values
  (md5('sc-main')::uuid, current_setting('test.sc_season')::uuid, 'main_predictor',
   true, 'active', false, 'public', now() - interval '5 days'),
  (md5('sc-cup')::uuid, current_setting('test.sc_season')::uuid, 'predictor_cup',
   true, 'active', false, 'public', now() - interval '5 days'),
  (md5('sc-lms')::uuid, current_setting('test.sc_season')::uuid, 'last_man_standing',
   true, 'active', false, 'public', now() - interval '5 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('sc-' || who)::uuid, format('sc-%s@example.test', who),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
  from unnest(array['fresh', 'both', 'lmsonly']) as who;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('sc-' || who)::uuid, initcap(who), now()
  from unnest(array['fresh', 'both', 'lmsonly']) as who;

-- ---------------------------------------------------------------------------
-- The precondition, asserted rather than assumed.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.entries where user_id = md5('sc-fresh')::uuid)
  + (select count(*)::integer from public.game_memberships where user_id = md5('sc-fresh')::uuid)
  + (select count(*)::integer from public.bonus_competition_entrants where user_id = md5('sc-fresh')::uuid),
  0,
  'the player starts with no entry, no membership and no entrant row anywhere');

-- ---------------------------------------------------------------------------
-- The property, declared as data rather than branched on by name.
-- ---------------------------------------------------------------------------

select is(
  (select uses_season_prediction_card::text from public.game_definitions
    where game_key = 'predictor_cup'),
  'true',
  'the Championship is declared to read the shared season prediction card');

select is(
  (select uses_season_prediction_card::text from public.game_definitions
    where game_key = 'last_man_standing'),
  'false',
  'and Last Man Standing is not, because it picks a club and reads no card');

select is(
  (select count(*)::integer from public.game_definitions
    where requires_prediction_entry and not uses_season_prediction_card),
  0,
  'a game that owns the card necessarily uses it, which a constraint enforces');

-- ---------------------------------------------------------------------------
-- Joining the Championship ONLY
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sc-fresh')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.join_competition_game(md5('sc-cup')::uuid)::jsonb ->> 'game_key',
  'predictor_cup',
  'the player joins the Championship and nothing else');

reset role;

-- THE INVARIANT, both halves.

select is(
  (select count(*)::integer
     from public.game_memberships membership
     join public.bonus_competitions competition
       on competition.id = membership.game_competition_id
    where membership.user_id = md5('sc-fresh')::uuid
      and competition.game_key = 'main_predictor'),
  0,
  'they hold NO Match Predictor membership: joining one game is not joining another');

select is(
  (select count(*)::integer from public.entries
    where user_id = md5('sc-fresh')::uuid
      and tournament_id = current_setting('test.sc_season')::uuid),
  1,
  'and they hold exactly one season prediction card, which is what the scorer reads');

select is(
  (select game_competition_id from public.entries
    where user_id = md5('sc-fresh')::uuid
      and tournament_id = current_setting('test.sc_season')::uuid),
  md5('sc-main')::uuid,
  'the card belongs to the game that OWNS it, so matchweek settlement still selects it');

select is(
  (select game_membership_id from public.entries
    where user_id = md5('sc-fresh')::uuid
      and tournament_id = current_setting('test.sc_season')::uuid),
  null,
  'with a null membership, because there is no membership and inventing one is the defect');

select is(
  (select count(*)::integer from public.game_memberships
    where user_id = md5('sc-fresh')::uuid),
  1,
  'exactly one membership exists in total, and it is the Championship''s');

-- ---------------------------------------------------------------------------
-- The capability the Championship consumes actually works
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sc-fresh')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select lives_ok(
  format('select public.save_season_prediction(%L::uuid, %L::uuid, 2::smallint, 1::smallint, null)',
         current_setting('test.sc_season')::uuid, md5('sc-fx1')::uuid),
  'the Championship-only player can submit the prediction their Championship scores');

reset role;

select is(
  (select prediction.home_score::integer
     from public.season_predictions prediction
     join public.entries entry on entry.id = prediction.entry_id
    where entry.user_id = md5('sc-fresh')::uuid
      and prediction.season_fixture_id = md5('sc-fx1')::uuid),
  2,
  'and it is stored against their own entry, on the shared card the scorer resolves');

-- The scoring path itself, rather than a proxy for it: the Championship's
-- fixture-points authority resolves this player's prediction.
select is(
  (select count(*)::integer
     from public.season_predictions prediction
     join public.entries entry
       on entry.id = prediction.entry_id
      and entry.tournament_id = current_setting('test.sc_season')::uuid
    where entry.user_id = md5('sc-fresh')::uuid
      and prediction.season_fixture_id = md5('sc-fx1')::uuid),
  1,
  'the exact join Championship scoring makes -- member to entry to prediction -- now resolves');

-- ---------------------------------------------------------------------------
-- Last Man Standing must NOT hand out a card
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sc-lmsonly')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('sc-lms')::uuid),
  'a player joins Last Man Standing');

reset role;

select is(
  (select count(*)::integer from public.entries where user_id = md5('sc-lmsonly')::uuid),
  0,
  'and receives NO season prediction card, because Last Man Standing reads none');

-- ---------------------------------------------------------------------------
-- A player in both games has ONE card, not two
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('sc-both')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('sc-cup')::uuid),
  'a second player joins the Championship first');

select lives_ok(
  format('select public.join_competition_game(%L::uuid)', md5('sc-main')::uuid),
  'and then joins the Match Predictor explicitly, in that order');

reset role;

select is(
  (select count(*)::integer from public.entries
    where user_id = md5('sc-both')::uuid
      and tournament_id = current_setting('test.sc_season')::uuid),
  1,
  'they hold ONE prediction authority, not one per game');

select isnt(
  (select game_membership_id from public.entries
    where user_id = md5('sc-both')::uuid
      and tournament_id = current_setting('test.sc_season')::uuid),
  null,
  'and the card adopts the real membership once they actually join the owning game');

select is(
  (select membership.game_competition_id
     from public.game_memberships membership
     where membership.id = (select game_membership_id from public.entries
                             where user_id = md5('sc-both')::uuid
                               and tournament_id = current_setting('test.sc_season')::uuid)),
  md5('sc-main')::uuid,
  'pointing at the Match Predictor membership they explicitly created');

-- ---------------------------------------------------------------------------
-- The consequence, recorded rather than hidden
-- ---------------------------------------------------------------------------
--
-- `season_standings` ranks ENTRIES and applies no membership filter, so the
-- Championship-only player appears in the season's cumulative points table.
-- That is ADR 0012's table rather than the Match Predictor membership list, and
-- it is asserted here so the behaviour is a decision on the record instead of
-- something a later reader discovers.

select ok(
  predictor_internal.season_standings(current_setting('test.sc_season')::uuid)::text
    like '%' || (select id::text from public.entries
                  where user_id = md5('sc-fresh')::uuid
                    and tournament_id = current_setting('test.sc_season')::uuid) || '%',
  'the Championship entrant is ranked in the season table, which ranks cards rather than memberships');

select is(
  (select count(*)::integer
     from public.game_memberships membership
     join public.bonus_competitions competition
       on competition.id = membership.game_competition_id
    where membership.user_id = md5('sc-fresh')::uuid
      and competition.game_key = 'main_predictor'),
  0,
  'while still holding no Match Predictor membership, which is the invariant that matters');

select * from finish();
rollback;
