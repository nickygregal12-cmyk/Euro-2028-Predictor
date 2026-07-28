begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures: six entrants → two three-player groups. Matchday 1 bundles two
-- real MD1 fixtures (m1, m2). In group 1: X (2-0 exact + 0-0 result) faces
-- Y (1-0 result only); Z is on a bye but predicts m1 exactly (bye points
-- count for tie-breaks). In group 2: P (1-0 result) faces Q (nothing —
-- walkover); R is on a bye with no predictions.
-- ---------------------------------------------------------------------------

select set_config(
  'test.b7b_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.b7b_tournament_id')::uuid;

select set_config(
  'test.b7b_m1',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.b7b_tournament_id')::uuid
      and m.round = 'group' and m.matchday = 1
    order by m.match_ref limit 1),
  true
);

select set_config(
  'test.b7b_m2',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.b7b_tournament_id')::uuid
      and m.round = 'group' and m.matchday = 1
    order by m.match_ref offset 1 limit 1),
  true
);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('b7b-user-' || n)::uuid,
  format('b7b-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 6) as n;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('b7b-user-' || n)::uuid, format('B7b Player %s', n), now()
from generate_series(1, 6) as n;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select md5('b7b-entry-' || n)::uuid, md5('b7b-user-' || n)::uuid,
  current_setting('test.b7b_tournament_id')::uuid, now()
from generate_series(1, 6) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at,
  registration_closes_at, draw_required
) values (
  md5('b7b-comp')::uuid,
  current_setting('test.b7b_tournament_id')::uuid,
  'predictor_cup', true,
  now() - interval '3 hours', now() - interval '1 hour', true
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('b7b-comp')::uuid, md5('b7b-user-' || n)::uuid, now() - interval '2 hours'
from generate_series(1, 6) as n;

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values
  (md5('b7b-w1')::uuid, md5('b7b-comp')::uuid, 1, 'Cup Matchday 1', now() - interval '2 hours', now() + interval '1 hour'),
  (md5('b7b-w2')::uuid, md5('b7b-comp')::uuid, 2, 'Cup Matchday 2', now() + interval '1 day', now() + interval '2 days'),
  (md5('b7b-w3')::uuid, md5('b7b-comp')::uuid, 3, 'Cup Matchday 3', now() + interval '3 days', now() + interval '4 days');

select public.admin_draw_predictor_cup(md5('b7b-comp')::uuid, 'EURO2028-B7B-SEED');

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('b7b-w1')::uuid, current_setting('test.b7b_m1')::uuid),
  (md5('b7b-w1')::uuid, current_setting('test.b7b_m2')::uuid);

-- Resolve the drawn actors: group 1 and 2 matchday-1 ties plus the byes.
select set_config('test.b7b_x',
  (select f.home_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('b7b-comp')::uuid and g.ordinal = 1 and f.matchday = 1), true);
select set_config('test.b7b_y',
  (select f.away_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('b7b-comp')::uuid and g.ordinal = 1 and f.matchday = 1), true);
select set_config('test.b7b_z',
  (select member.user_id::text from public.bonus_cup_members member
    join public.bonus_cup_groups g on g.id = member.group_id
    where g.ordinal = 1 and member.competition_id = md5('b7b-comp')::uuid
      and member.user_id not in (
        current_setting('test.b7b_x')::uuid, current_setting('test.b7b_y')::uuid
      )), true);
select set_config('test.b7b_p',
  (select f.home_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('b7b-comp')::uuid and g.ordinal = 2 and f.matchday = 1), true);
select set_config('test.b7b_q',
  (select f.away_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('b7b-comp')::uuid and g.ordinal = 2 and f.matchday = 1), true);

create or replace function pg_temp.entry_of(p_user text)
returns uuid
language sql
as $$
  select entry.id from public.entries entry
  where entry.user_id = p_user::uuid
    and entry.tournament_id = current_setting('test.b7b_tournament_id')::uuid
$$;

insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  (pg_temp.entry_of(current_setting('test.b7b_x')), current_setting('test.b7b_m1')::uuid, 2, 0),
  (pg_temp.entry_of(current_setting('test.b7b_x')), current_setting('test.b7b_m2')::uuid, 0, 0),
  (pg_temp.entry_of(current_setting('test.b7b_y')), current_setting('test.b7b_m1')::uuid, 1, 0),
  (pg_temp.entry_of(current_setting('test.b7b_p')), current_setting('test.b7b_m1')::uuid, 1, 0),
  (pg_temp.entry_of(current_setting('test.b7b_z')), current_setting('test.b7b_m1')::uuid, 2, 0);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_function('predictor_internal', 'cup_window_scores', array['uuid', 'uuid'],
  'the internal Cup window scorer exists');
select has_function('predictor_internal', 'cup_window_settled', array['uuid'],
  'the internal Cup settlement check exists');

-- ---------------------------------------------------------------------------
-- Scoring accumulates only from officially confirmed results
-- ---------------------------------------------------------------------------

select public.confirm_match_result(
  current_setting('test.b7b_m1')::uuid, 'regulation', 2::smallint, 0::smallint
);

select is(
  (
    select s.points from predictor_internal.cup_window_scores(
      md5('b7b-comp')::uuid, md5('b7b-w1')::uuid
    ) s where s.user_id = current_setting('test.b7b_x')::uuid
  ),
  5,
  'a partially confirmed window banks only its confirmed fixtures'
);

select public.confirm_match_result(
  current_setting('test.b7b_m2')::uuid, 'regulation', 1::smallint, 1::smallint
);

select is(
  (
    select jsonb_build_object(
      'points', s.points, 'exacts', s.exacts, 'corrects', s.corrects, 'submitted', s.submitted
    )
    from predictor_internal.cup_window_scores(
      md5('b7b-comp')::uuid, md5('b7b-w1')::uuid
    ) s where s.user_id = current_setting('test.b7b_x')::uuid
  ),
  '{"points": 8, "exacts": 1, "corrects": 1, "submitted": true}'::jsonb,
  'exact 5 plus result 3 over the designated fixtures, raw and jokerless'
);

select is(
  (
    select jsonb_build_object('points', s.points, 'error', s.scoreline_error)
    from predictor_internal.cup_window_scores(
      md5('b7b-comp')::uuid, md5('b7b-w1')::uuid
    ) s where s.user_id = current_setting('test.b7b_y')::uuid
  ),
  '{"points": 3, "error": 1000}'::jsonb,
  'a missing fixture charges the 999 sentinel error a blank can never beat'
);

select is(
  (
    select s.submitted from predictor_internal.cup_window_scores(
      md5('b7b-comp')::uuid, md5('b7b-w1')::uuid
    ) s where s.user_id = current_setting('test.b7b_q')::uuid
  ),
  false,
  'a complete non-submitter is recognised as such'
);

select is(
  (select predictor_internal.cup_window_settled(md5('b7b-w1')::uuid)),
  false,
  'a confirmed round does not settle before its deadline'
);

-- The matchday deadline passes.
update public.bonus_competition_windows
set locks_at = now() - interval '30 minutes'
where id = md5('b7b-w1')::uuid;

select is(
  (select predictor_internal.cup_window_settled(md5('b7b-w1')::uuid)),
  true,
  'the round settles once locked, confirmed and past any settle instant'
);

-- ---------------------------------------------------------------------------
-- Head-to-head results and the ranked table
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', current_setting('test.b7b_x'), true);
set local role authenticated;

select is(
  (
    select jsonb_build_object(
      'result', fixture ->> 'result',
      'mine', fixture -> 'my_points',
      'theirs', fixture -> 'opponent_points'
    )
    from jsonb_array_elements(
      public.get_my_cup(current_setting('test.b7b_tournament_id')::uuid) -> 'my_fixtures'
    ) fixture
    where (fixture ->> 'matchday')::integer = 1
  ),
  '{"result": "win", "mine": 8, "theirs": 3}'::jsonb,
  'the settled tie reports its head-to-head score and winner'
);

select is(
  (
    select jsonb_agg(row_entry ->> 'user_id' order by (row_entry ->> 'position')::integer)
    from jsonb_array_elements(
      public.get_my_cup(current_setting('test.b7b_tournament_id')::uuid)
        -> 'my_group' -> 'standings'
    ) row_entry
  ),
  jsonb_build_array(
    current_setting('test.b7b_x'),
    current_setting('test.b7b_z'),
    current_setting('test.b7b_y')
  ),
  'the table ranks by table points, then window points break the tie — the bye player''s exact outranks the loser'
);

select is(
  (
    select jsonb_build_object(
      'played', row_entry -> 'played',
      'table_points', row_entry -> 'table_points',
      'pf', row_entry -> 'points_for',
      'pa', row_entry -> 'points_against'
    )
    from jsonb_array_elements(
      public.get_my_cup(current_setting('test.b7b_tournament_id')::uuid)
        -> 'my_group' -> 'standings'
    ) row_entry
    where row_entry ->> 'user_id' = current_setting('test.b7b_x')
  ),
  '{"played": 1, "table_points": 3, "pf": 8, "pa": 3}'::jsonb,
  'table columns carry P, Pts, PF and PA'
);

select is(
  (
    select fixture ->> 'status'
    from jsonb_array_elements(
      public.get_my_cup(current_setting('test.b7b_tournament_id')::uuid) -> 'my_fixtures'
    ) fixture
    where (fixture ->> 'matchday')::integer = 2
  ),
  'pending',
  'future matchdays stay pending'
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.b7b_p'), true);
set local role authenticated;

select is(
  (
    select fixture ->> 'result'
    from jsonb_array_elements(
      public.get_my_cup(current_setting('test.b7b_tournament_id')::uuid) -> 'my_fixtures'
    ) fixture
    where (fixture ->> 'matchday')::integer = 1
  ),
  'walkover_win',
  'a submitter beats a complete non-submitter by walkover'
);

reset role;
select set_config('request.jwt.claim.sub', current_setting('test.b7b_q'), true);
set local role authenticated;

select is(
  (
    select fixture ->> 'result'
    from jsonb_array_elements(
      public.get_my_cup(current_setting('test.b7b_tournament_id')::uuid) -> 'my_fixtures'
    ) fixture
    where (fixture ->> 'matchday')::integer = 1
  ),
  'walkover_loss',
  'the non-submitter records the walkover loss'
);

reset role;

select * from finish();
rollback;
