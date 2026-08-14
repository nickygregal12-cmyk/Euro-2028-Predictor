-- PPLAY-002 closure: a Championship-only player must not merely be able to
-- write the shared season prediction card; the real season Championship points
-- source must consume that same row after the Cup window settles.
--
-- Contract 180 already establishes the shared-card capability and pgTAP 229
-- proves the member -> entry -> prediction join structurally. This test closes
-- the stronger lifecycle acceptance rule from issue #728 by driving the shared
-- Cup scoring machinery itself on a fresh account with no Match Predictor
-- membership.

begin;
select plan(11);

insert into public.tournaments (
  name, year, competition_id, season_key, kind, display_timezone, status
)
select
  'PPLAY Championship scoring',
  2064,
  source.competition_id,
  'pplay-championship-scoring',
  'league_season',
  'Europe/London',
  'active'
from public.tournaments source
where source.kind = 'league_season'
order by source.name
limit 1;

select set_config(
  'test.pplay_score_season',
  (select id::text
     from public.tournaments
    where season_key = 'pplay-championship-scoring'),
  true
);

insert into public.teams (id, tournament_id, name)
values
  (md5('pplay-score-home')::uuid,
   current_setting('test.pplay_score_season')::uuid,
   'PPLAY Home'),
  (md5('pplay-score-away')::uuid,
   current_setting('test.pplay_score_season')::uuid,
   'PPLAY Away');

insert into public.competition_rounds (
  id, tournament_id, round_key, ordinal, kind, label
)
values (
  md5('pplay-score-round')::uuid,
  current_setting('test.pplay_score_season')::uuid,
  'pplay-score-mw1',
  1,
  'league_matchweek',
  'PPLAY scoring matchweek'
);

insert into public.season_fixtures (
  id,
  tournament_id,
  competition_round_id,
  home_team_id,
  away_team_id,
  kickoff_at,
  status
)
values (
  md5('pplay-score-fixture')::uuid,
  current_setting('test.pplay_score_season')::uuid,
  md5('pplay-score-round')::uuid,
  md5('pplay-score-home')::uuid,
  md5('pplay-score-away')::uuid,
  now() + interval '3 days',
  'scheduled'
);

insert into public.bonus_competitions (
  id,
  tournament_id,
  game_key,
  published,
  availability_status,
  draw_required,
  visibility_kind,
  registration_opens_at
)
values
  (
    md5('pplay-score-main')::uuid,
    current_setting('test.pplay_score_season')::uuid,
    'main_predictor',
    true,
    'active',
    false,
    'public',
    now() - interval '5 days'
  ),
  (
    md5('pplay-score-cup')::uuid,
    current_setting('test.pplay_score_season')::uuid,
    'predictor_cup',
    true,
    'active',
    false,
    'public',
    now() - interval '5 days'
  );

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  md5('pplay-score-user')::uuid,
  'pplay-score-user@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);
set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
values (md5('pplay-score-user')::uuid, 'PPLAY scorer', now());

select is(
  (select count(*)::integer from public.entries
    where user_id = md5('pplay-score-user')::uuid)
  + (select count(*)::integer from public.game_memberships
    where user_id = md5('pplay-score-user')::uuid)
  + (select count(*)::integer from public.bonus_competition_entrants
    where user_id = md5('pplay-score-user')::uuid),
  0,
  'the scoring proof starts from a genuinely fresh player'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('pplay-score-user')::uuid,
    'role', 'authenticated',
    'app_metadata', json_build_object()
  )::text,
  true
);
set local role authenticated;

select is(
  public.join_competition_game(md5('pplay-score-cup')::uuid)::jsonb ->> 'game_key',
  'predictor_cup',
  'the fresh player joins the Championship directly'
);

reset role;

select is(
  (select count(*)::integer
     from public.game_memberships membership
     join public.bonus_competitions competition
       on competition.id = membership.game_competition_id
    where membership.user_id = md5('pplay-score-user')::uuid
      and competition.game_key = 'main_predictor'),
  0,
  'Championship entry still creates no Match Predictor membership'
);

select is(
  (select count(*)::integer
     from public.entries entry
    where entry.user_id = md5('pplay-score-user')::uuid
      and entry.tournament_id = current_setting('test.pplay_score_season')::uuid
      and entry.game_membership_id is null),
  1,
  'the shared card exists with no invented owning-game membership'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('pplay-score-user')::uuid,
    'role', 'authenticated',
    'app_metadata', json_build_object()
  )::text,
  true
);
set local role authenticated;

select lives_ok(
  format(
    'select public.save_season_prediction(%L::uuid, %L::uuid, 2::smallint, 1::smallint, null)',
    current_setting('test.pplay_score_season')::uuid,
    md5('pplay-score-fixture')::uuid
  ),
  'the Championship-only player can write the shared prediction card'
);

reset role;

select is(
  (select concat(prediction.home_score, '-', prediction.away_score)
     from public.season_predictions prediction
     join public.entries entry on entry.id = prediction.entry_id
    where entry.user_id = md5('pplay-score-user')::uuid
      and prediction.season_fixture_id = md5('pplay-score-fixture')::uuid),
  '2-1',
  'the submitted score is stored against the Championship-only player entry'
);

insert into public.bonus_competition_windows (
  id,
  competition_id,
  tournament_id,
  sequence,
  label,
  opens_at,
  locks_at,
  settles_at
)
values (
  md5('pplay-score-window')::uuid,
  md5('pplay-score-cup')::uuid,
  current_setting('test.pplay_score_season')::uuid,
  1,
  'PPLAY settled Championship window',
  now() - interval '3 days',
  now() - interval '2 days',
  now() - interval '1 day'
);

insert into public.bonus_cup_groups (
  id, competition_id, ordinal, size
)
values (
  md5('pplay-score-group')::uuid,
  md5('pplay-score-cup')::uuid,
  1,
  3
);

insert into public.bonus_cup_members (
  competition_id, user_id, group_id, draw_number
)
values (
  md5('pplay-score-cup')::uuid,
  md5('pplay-score-user')::uuid,
  md5('pplay-score-group')::uuid,
  1
);

insert into public.season_cup_window_fixtures (
  window_id, season_fixture_id
)
values (
  md5('pplay-score-window')::uuid,
  md5('pplay-score-fixture')::uuid
);

update public.season_fixtures
   set kickoff_at = now() - interval '2 days',
       status = 'played',
       home_score = 2,
       away_score = 1
 where id = md5('pplay-score-fixture')::uuid;

select ok(
  predictor_internal.cup_window_settled(md5('pplay-score-window')::uuid),
  'the real Championship window is settled before scoring is asserted'
);

select is(
  (select source.has_prediction::text
     from predictor_internal.cup_season_fixture_points(
       md5('pplay-score-cup')::uuid,
       md5('pplay-score-window')::uuid
     ) source
    where source.user_id = md5('pplay-score-user')::uuid
      and source.match_id = md5('pplay-score-fixture')::uuid),
  'true',
  'the authoritative season Championship fixture-points source sees the submitted prediction'
);

select is(
  (select score.points::integer
     from predictor_internal.cup_window_scores(
       md5('pplay-score-cup')::uuid,
       md5('pplay-score-window')::uuid
     ) score
    where score.user_id = md5('pplay-score-user')::uuid),
  5,
  'the shared Championship scorer awards exact-score points from that same prediction row'
);

select is(
  (select score.exacts::integer
     from predictor_internal.cup_window_scores(
       md5('pplay-score-cup')::uuid,
       md5('pplay-score-window')::uuid
     ) score
    where score.user_id = md5('pplay-score-user')::uuid),
  1,
  'the scorer records the prediction as an exact score'
);

select is(
  (select score.submitted::text
     from predictor_internal.cup_window_scores(
       md5('pplay-score-cup')::uuid,
       md5('pplay-score-window')::uuid
     ) score
    where score.user_id = md5('pplay-score-user')::uuid),
  'true',
  'the settled Championship window records the fresh player as submitted'
);

select * from finish();
rollback;
