-- Contract 156: the season Wrapped and permanent history archive.
--
-- THE THREE ASSERTIONS THIS FILE EXISTS FOR are the ones that make storing a
-- snapshot safe at all, given contract 150 deliberately refused to store one:
--
--   * it cannot be taken while the season is still being played;
--   * taking it twice changes nothing;
--   * once written it cannot be rewritten, so a later formula cannot restate
--     a past a player has already been shown.

begin;

select plan(11);

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C156 Wrapped Probe', 2045, t.competition_id, 'wr-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t where t.kind = 'league_season' order by t.name limit 1;

select set_config('test.wr_season',
  (select id::text from public.tournaments where season_key = 'wr-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.wr_season')::uuid, 'Eta FC'),
  (current_setting('test.wr_season')::uuid, 'Theta FC');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
values (current_setting('test.wr_season')::uuid, 'wr-mw1', 1, 'league_matchweek', 'Matchweek 1'),
       (current_setting('test.wr_season')::uuid, 'wr-mw2', 2, 'league_matchweek', 'Matchweek 2');

select set_config('test.wr_mw1', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.wr_season')::uuid and round_key = 'wr-mw1'), true);
select set_config('test.wr_mw2', (select id::text from public.competition_rounds
  where tournament_id = current_setting('test.wr_season')::uuid and round_key = 'wr-mw2'), true);

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status)
select current_setting('test.wr_season')::uuid, current_setting('test.wr_mw1')::uuid,
       (select id from public.teams where tournament_id = current_setting('test.wr_season')::uuid and name = 'Eta FC'),
       (select id from public.teams where tournament_id = current_setting('test.wr_season')::uuid and name = 'Theta FC'),
       now() + interval '1 day', 'scheduled';

select set_config('test.wr_fx1', (select id::text from public.season_fixtures
  where competition_round_id = current_setting('test.wr_mw1')::uuid), true);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('wr-mp')::uuid, current_setting('test.wr_season')::uuid,
  'main_predictor', true, 'active', false, 'public', now() - interval '5 days');

set local session_replication_role = replica;
insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('wr-user-' || n)::uuid, format('wr-%s@example.test', n),
       'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 2) as n;
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at) values
  (md5('wr-user-1')::uuid, 'Winner', now()),
  (md5('wr-user-2')::uuid, 'Runner Up', now());

insert into public.entries (id, user_id, tournament_id, game_competition_id)
select md5('wr-entry-' || n)::uuid, md5('wr-user-' || n)::uuid,
       current_setting('test.wr_season')::uuid, md5('wr-mp')::uuid
from generate_series(1, 2) as n;

-- A prediction that turns out exactly right, so the accuracy counts have
-- something true to report.
insert into public.season_predictions (tournament_id, entry_id, season_fixture_id, home_score, away_score)
values (current_setting('test.wr_season')::uuid, md5('wr-entry-1')::uuid,
        current_setting('test.wr_fx1')::uuid, 3, 1);

insert into public.season_matchweek_jokers (tournament_id, entry_id, competition_round_id)
values (current_setting('test.wr_season')::uuid, md5('wr-entry-1')::uuid,
        current_setting('test.wr_mw1')::uuid);

set local session_replication_role = replica;
update public.season_fixtures
   set kickoff_at = now() - interval '3 hours', status = 'played', home_score = 3, away_score = 1
 where id = current_setting('test.wr_fx1')::uuid;
set local session_replication_role = origin;

insert into public.season_matchweek_scores
  (tournament_id, entry_id, competition_round_id, points, fixtures_scored, settled_at)
values
  (current_setting('test.wr_season')::uuid, md5('wr-entry-1')::uuid, current_setting('test.wr_mw1')::uuid, 24, 1, now()),
  (current_setting('test.wr_season')::uuid, md5('wr-entry-1')::uuid, current_setting('test.wr_mw2')::uuid,  6, 1, now()),
  (current_setting('test.wr_season')::uuid, md5('wr-entry-2')::uuid, current_setting('test.wr_mw1')::uuid,  5, 1, now()),
  (current_setting('test.wr_season')::uuid, md5('wr-entry-2')::uuid, current_setting('test.wr_mw2')::uuid,  5, 1, now());

-- ---------------------------------------------------------------------------
-- FIRST: it refuses a season still being played.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.finalise_season_wrapped(current_setting('test.wr_season')::uuid) ->> 'reason',
  'season_not_complete',
  'an active season cannot be finalised, because its table is still moving');

select is(
  (select count(*)::integer from public.season_wrapped
    where tournament_id = current_setting('test.wr_season')::uuid),
  0,
  'and the refusal wrote nothing');

-- ---------------------------------------------------------------------------
-- The season ends.
-- ---------------------------------------------------------------------------

update public.tournaments set status = 'complete'
 where id = current_setting('test.wr_season')::uuid;

select is(
  predictor_internal.finalise_season_wrapped(current_setting('test.wr_season')::uuid) ->> 'outcome',
  'finalised',
  'a complete season is finalised');

select is(
  (select final_points from public.season_wrapped
    where entry_id = md5('wr-entry-1')::uuid),
  30,
  'the final total is the banked one, not a recomputation');

select is(
  (select final_rank from public.season_wrapped where entry_id = md5('wr-entry-1')::uuid),
  1,
  'the winner is ranked first');

select is(
  (select field_size from public.season_wrapped where entry_id = md5('wr-entry-1')::uuid),
  2,
  'against the field that actually played');

select is(
  (select best_matchweek_ordinal from public.season_wrapped where entry_id = md5('wr-entry-1')::uuid),
  1,
  'the best matchweek is the highest-scoring one');

select is(
  (select exact_scores from public.season_wrapped where entry_id = md5('wr-entry-1')::uuid),
  1,
  'an exact score is counted');

-- ---------------------------------------------------------------------------
-- SECOND: taking it twice changes nothing.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.finalise_season_wrapped(current_setting('test.wr_season')::uuid) ->> 'outcome',
  'already_finalised',
  'finalising twice is idempotent, so a retried job cannot restate a past');

-- ---------------------------------------------------------------------------
-- THIRD: it cannot be rewritten.
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$update public.season_wrapped set final_rank = 99
            where entry_id = %L::uuid$$, md5('wr-entry-1')::uuid),
  '55006',
  null,
  'a finalised Wrapped is immutable, so a later formula cannot change what a player was told');

-- ---------------------------------------------------------------------------
-- A player reads their own.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  json_build_object('sub', md5('wr-user-2')::uuid, 'role', 'authenticated',
                    'app_metadata', json_build_object())::text, true);
set local role authenticated;

select is(
  public.get_season_wrapped(current_setting('test.wr_season')::uuid) -> 'season' ->> 'rank',
  '2',
  'and each player reads their own finish rather than the whole table');

select * from finish();

rollback;
