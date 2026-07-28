begin;

select plan(31);

create or replace function pg_temp.capture_sqlstate(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: seven entrants → one four-player group (a,b,c,d by draw number
-- 1–4) and one three-player group (e,f,g by draw number 5–7). Engineered so
-- the gate exercises every qualification law:
--   - group 1 finishes a 9 / c 6 / b 3 / d 0 (d never submits — walkovers);
--   - group 2 is a THREE-WAY CYCLE on identical table points, window
--     points, exacts and corrects — only the §5.2 steps 4–5 mini
--     head-to-head separates g (mini PD +2), e (0), f (−2);
--   - wildcards (target round(7×2÷3)=5, automatic a/c/g) go to e and b,
--     ranked per game (§6.3); seeds: a1 g2 c3 e4 b5 (§7.1 bands);
--   - Q=5, P=4 → one playoff tie (seed 4 e vs seed 5 b), three byes;
--   - the playoff settles on points, semi 1 on points, semi 2 on
--     Extra-Time Accuracy and the final on the Penalty Number (§8);
--   - champion (g) and Golden Predictor (a) intentionally differ (§11.3).
-- ---------------------------------------------------------------------------

select set_config(
  'test.b7c_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.b7c_tournament_id')::uuid;

-- Six designated real group matches, one per Cup window.
select set_config('test.b7c_m' || n.n,
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.b7c_tournament_id')::uuid
      and m.round = 'group'
    order by m.matchday, m.match_ref
    offset n.n - 1 limit 1),
  true)
from generate_series(1, 6) as n(n);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('b7c-user-' || n)::uuid,
  format('b7c-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 7) as n;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('b7c-user-' || n)::uuid, format('B7c Player %s', n), now()
from generate_series(1, 7) as n;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select md5('b7c-entry-' || n)::uuid, md5('b7c-user-' || n)::uuid,
  current_setting('test.b7c_tournament_id')::uuid, now()
from generate_series(1, 7) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at,
  registration_closes_at, draw_required
) values (
  md5('b7c-comp')::uuid,
  current_setting('test.b7c_tournament_id')::uuid,
  'predictor_cup', true,
  now() - interval '3 hours', now() - interval '1 hour', true
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('b7c-comp')::uuid, md5('b7c-user-' || n)::uuid, now() - interval '2 hours'
from generate_series(1, 7) as n;

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
select
  md5('b7c-w' || n)::uuid, md5('b7c-comp')::uuid, n,
  format('Cup Window %s', n),
  now() - interval '2 hours', now() - interval '1 hour'
from generate_series(1, 6) as n;

select public.admin_draw_predictor_cup(md5('b7c-comp')::uuid, 'EURO2028-B7C-SEED');

insert into public.bonus_window_fixtures (window_id, match_id)
select md5('b7c-w' || n)::uuid, current_setting('test.b7c_m' || n)::uuid
from generate_series(1, 6) as n;

-- Resolve the drawn actors by neutral draw number: group 1 = 1–4 (a,b,c,d),
-- group 2 = 5–7 (e,f,g).
select set_config('test.b7c_' || chr(96 + member.draw_number),
  member.user_id::text, true)
from public.bonus_cup_members member
where member.competition_id = md5('b7c-comp')::uuid;

create or replace function pg_temp.uid_of(p_letter text)
returns uuid
language sql
as $$ select current_setting('test.b7c_' || p_letter)::uuid $$;

create or replace function pg_temp.entry_of(p_letter text)
returns uuid
language sql
as $$
  select entry.id from public.entries entry
  where entry.user_id = pg_temp.uid_of(p_letter)
    and entry.tournament_id = current_setting('test.b7c_tournament_id')::uuid
$$;

create or replace function pg_temp.match_of(p_n integer)
returns uuid
language sql
as $$ select current_setting('test.b7c_m' || p_n)::uuid $$;

-- Actuals: m1 2-0 · m2 1-1 · m3 1-0 · m4 2-0 · m5 1-1 · m6 2-1.
insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  -- a: three exacts in the group, exact in the semi, result in the final.
  (pg_temp.entry_of('a'), pg_temp.match_of(1), 2, 0),
  (pg_temp.entry_of('a'), pg_temp.match_of(2), 1, 1),
  (pg_temp.entry_of('a'), pg_temp.match_of(3), 1, 0),
  (pg_temp.entry_of('a'), pg_temp.match_of(5), 1, 1),
  (pg_temp.entry_of('a'), pg_temp.match_of(6), 1, 0),
  -- b: result, result, wrong; wrong in the playoff.
  (pg_temp.entry_of('b'), pg_temp.match_of(1), 1, 0),
  (pg_temp.entry_of('b'), pg_temp.match_of(2), 0, 0),
  (pg_temp.entry_of('b'), pg_temp.match_of(3), 0, 0),
  (pg_temp.entry_of('b'), pg_temp.match_of(4), 0, 1),
  -- c: three results; high-error result in the semi.
  (pg_temp.entry_of('c'), pg_temp.match_of(1), 2, 1),
  (pg_temp.entry_of('c'), pg_temp.match_of(2), 2, 2),
  (pg_temp.entry_of('c'), pg_temp.match_of(3), 3, 1),
  (pg_temp.entry_of('c'), pg_temp.match_of(5), 3, 3),
  -- d: never submits anything.
  -- e/f/g: identical 8-point, one-exact, one-result group profiles in a
  -- head-to-head cycle; only the mini head-to-head separates them.
  (pg_temp.entry_of('e'), pg_temp.match_of(1), 2, 0),
  (pg_temp.entry_of('e'), pg_temp.match_of(2), 2, 1),
  (pg_temp.entry_of('e'), pg_temp.match_of(3), 2, 0),
  (pg_temp.entry_of('e'), pg_temp.match_of(4), 1, 0),
  (pg_temp.entry_of('e'), pg_temp.match_of(5), 1, 0),
  (pg_temp.entry_of('f'), pg_temp.match_of(1), 0, 1),
  (pg_temp.entry_of('f'), pg_temp.match_of(2), 1, 1),
  (pg_temp.entry_of('f'), pg_temp.match_of(3), 2, 1),
  (pg_temp.entry_of('g'), pg_temp.match_of(1), 3, 1),
  (pg_temp.entry_of('g'), pg_temp.match_of(2), 1, 1),
  (pg_temp.entry_of('g'), pg_temp.match_of(3), 0, 0),
  (pg_temp.entry_of('g'), pg_temp.match_of(5), 2, 2),
  (pg_temp.entry_of('g'), pg_temp.match_of(6), 3, 2);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_function('public', 'admin_finalise_predictor_cup_groups', array['uuid'],
  'the qualification gate exists');
select has_function('public', 'admin_settle_predictor_cup_round', array['uuid', 'uuid'],
  'the round settle operation exists');
select has_function('public', 'submit_cup_penalty_number',
  array['uuid', 'uuid', 'smallint', 'integer'],
  'the Penalty Number submission exists');

-- ---------------------------------------------------------------------------
-- The gate refuses until every group window has settled
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(format(
    'select public.admin_finalise_predictor_cup_groups(%L::uuid)',
    md5('b7c-comp')
  )),
  '55000',
  'qualification refuses while group results are unconfirmed'
);

select public.confirm_match_result(pg_temp.match_of(1), 'regulation', 2::smallint, 0::smallint);
select public.confirm_match_result(pg_temp.match_of(2), 'regulation', 1::smallint, 1::smallint);
select public.confirm_match_result(pg_temp.match_of(3), 'regulation', 1::smallint, 0::smallint);

select set_config('request.jwt.claim.sub', pg_temp.uid_of('a')::text, true);
set local role authenticated;
select is(
  pg_temp.capture_sqlstate(format(
    'select public.admin_finalise_predictor_cup_groups(%L::uuid)',
    md5('b7c-comp')
  )),
  '42501',
  'authenticated users cannot run the qualification gate'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- ---------------------------------------------------------------------------
-- Qualification: mini head-to-head, wildcards, seeds, playoff and byes
-- ---------------------------------------------------------------------------

select is(
  (select public.admin_finalise_predictor_cup_groups(md5('b7c-comp')::uuid)
    - 'competition_id'),
  jsonb_build_object(
    'entrants', 7, 'qualifiers', 5, 'automatic', 3, 'wildcards', 2,
    'target', 5, 'bracket', 4, 'playoff_ties', 1, 'byes', 3
  ),
  'the gate reports 7 entrants, 5 qualifiers, a 4-bracket, 1 playoff tie and 3 byes'
);

select is(
  (
    select array_agg(member.group_position order by member.draw_number)
    from public.bonus_cup_members member
    where member.competition_id = md5('b7c-comp')::uuid
      and member.draw_number between 5 and 7
  ),
  array[2, 3, 1]::smallint[],
  'the three-way cycle resolves by mini head-to-head difference: g first, e second, f third'
);

select is(
  (
    select array_agg(coalesce(member.qualified_as, 'out') order by member.draw_number)
    from public.bonus_cup_members member
    where member.competition_id = md5('b7c-comp')::uuid
  ),
  array['winner', 'wildcard', 'runner_up', 'out', 'wildcard', 'out', 'winner'],
  'automatic places go to a, c and g; the wildcards are e and b; d and f are eliminated'
);

select is(
  (
    select array_agg(member.user_id order by member.seed)
    from public.bonus_cup_members member
    where member.competition_id = md5('b7c-comp')::uuid
      and member.seed is not null
  ),
  array[
    pg_temp.uid_of('a'), pg_temp.uid_of('g'), pg_temp.uid_of('c'),
    pg_temp.uid_of('e'), pg_temp.uid_of('b')
  ],
  'seeding bands order the qualifiers a, g, c, e, b'
);

select is(
  (
    select jsonb_build_object(
      'window', fixture.window_id, 'slot', fixture.bracket_slot,
      'home', fixture.home_user_id, 'away', fixture.away_user_id
    )
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('b7c-comp')::uuid
      and fixture.stage = 'playoff'
  ),
  jsonb_build_object(
    'window', md5('b7c-w4')::uuid, 'slot', 1,
    'home', pg_temp.uid_of('e'), 'away', pg_temp.uid_of('b')
  ),
  'the single playoff tie pairs seed 4 (e) at home against seed 5 (b) in window 4'
);

select is(
  (
    select array_agg(entrant.outcome order by member.draw_number)
    from public.bonus_competition_entrants entrant
    join public.bonus_cup_members member
      on member.competition_id = entrant.competition_id
      and member.user_id = entrant.user_id
    where entrant.competition_id = md5('b7c-comp')::uuid
  ),
  array['qualified', 'qualified', 'qualified', 'eliminated',
        'qualified', 'eliminated', 'qualified'],
  'entrant outcomes record qualification and group-stage elimination'
);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.admin_finalise_predictor_cup_groups(%L::uuid)',
    md5('b7c-comp')
  )),
  '55000',
  'the gate runs exactly once'
);

-- ---------------------------------------------------------------------------
-- Playoff: settles on points only after official confirmation
-- ---------------------------------------------------------------------------

select is(
  pg_temp.capture_sqlstate(format(
    'select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)',
    md5('b7c-comp'), md5('b7c-w4')
  )),
  '55000',
  'a round cannot settle before its designated fixtures are confirmed'
);

select public.confirm_match_result(pg_temp.match_of(4), 'regulation', 2::smallint, 0::smallint);

select public.admin_settle_predictor_cup_round(md5('b7c-comp')::uuid, md5('b7c-w4')::uuid);

select is(
  (
    select jsonb_build_object('winner', fixture.winner_user_id, 'decided', fixture.decided_by)
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('b7c-comp')::uuid
      and fixture.stage = 'playoff'
  ),
  jsonb_build_object('winner', pg_temp.uid_of('e'), 'decided', 'points'),
  'the playoff is decided on Cup points and e advances'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object(
        'slot', fixture.bracket_slot, 'size', fixture.round_size,
        'home', fixture.home_user_id, 'away', fixture.away_user_id
      )
      order by fixture.bracket_slot
    )
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('b7c-comp')::uuid
      and fixture.stage = 'knockout' and fixture.round_size = 4
  ),
  jsonb_build_array(
    jsonb_build_object('slot', 1, 'size', 4,
      'home', pg_temp.uid_of('a'), 'away', pg_temp.uid_of('e')),
    jsonb_build_object('slot', 2, 'size', 4,
      'home', pg_temp.uid_of('g'), 'away', pg_temp.uid_of('c'))
  ),
  'the fixed bracket seats byes and the playoff winner: a–e and g–c semi-finals in window 5'
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('b7c-comp')::uuid
      and entrant.user_id = pg_temp.uid_of('b')
  ),
  'eliminated',
  'the playoff loser is eliminated'
);

-- ---------------------------------------------------------------------------
-- Semi-finals: one decided on points, one on Extra-Time Accuracy
-- ---------------------------------------------------------------------------

select public.confirm_match_result(pg_temp.match_of(5), 'regulation', 1::smallint, 1::smallint);

select public.admin_settle_predictor_cup_round(md5('b7c-comp')::uuid, md5('b7c-w5')::uuid);

select is(
  (
    select jsonb_agg(
      jsonb_build_object('slot', fixture.bracket_slot,
        'winner', fixture.winner_user_id, 'decided', fixture.decided_by)
      order by fixture.bracket_slot
    )
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('b7c-comp')::uuid
      and fixture.stage = 'knockout' and fixture.round_size = 4
  ),
  jsonb_build_array(
    jsonb_build_object('slot', 1, 'winner', pg_temp.uid_of('a'), 'decided', 'points'),
    jsonb_build_object('slot', 2, 'winner', pg_temp.uid_of('g'), 'decided', 'extra_time')
  ),
  'semi 1 settles on points (a) and semi 2 on lower scoreline error (g, AET)'
);

select is(
  (
    select jsonb_build_object(
      'size', fixture.round_size, 'window', fixture.window_id,
      'home', fixture.home_user_id, 'away', fixture.away_user_id
    )
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('b7c-comp')::uuid
      and fixture.stage = 'knockout' and fixture.round_size = 2
  ),
  jsonb_build_object(
    'size', 2, 'window', md5('b7c-w6')::uuid,
    'home', pg_temp.uid_of('a'), 'away', pg_temp.uid_of('g')
  ),
  'the final pairs the semi winners a (home) and g in window 6'
);

-- ---------------------------------------------------------------------------
-- Penalty Numbers: parity lanes, versions, lock and the guaranteed decider
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
update public.matches
set kickoff_at = now() + interval '2 hours'
where id = pg_temp.match_of(6);
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', pg_temp.uid_of('a')::text, true);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.submit_cup_penalty_number(%L::uuid, %L::uuid, 4::smallint, null)',
    md5('b7c-comp'), md5('b7c-w6')
  )),
  '23514',
  'the home side holds the ODD lane — an even number is refused'
);

select is(
  (public.submit_cup_penalty_number(
    md5('b7c-comp')::uuid, md5('b7c-w6')::uuid, 5::smallint, null
  ) ->> 'version')::integer,
  0,
  'a stores Penalty Number 5 in the odd lane at version 0'
);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.submit_cup_penalty_number(%L::uuid, %L::uuid, 7::smallint, 5)',
    md5('b7c-comp'), md5('b7c-w6')
  )),
  'PT409',
  'a stale Penalty Number version is refused'
);

select is(
  (
    select jsonb_build_object(
      'lane', payload -> 'penalty_number' ->> 'lane',
      'value', (payload -> 'penalty_number' ->> 'value')::integer
    )
    from public.get_my_cup(current_setting('test.b7c_tournament_id')::uuid) payload
  ),
  jsonb_build_object('lane', 'odd', 'value', 5),
  'the my-cup read shows my odd-lane Penalty Number for the pending final'
);

select set_config('request.jwt.claim.sub', pg_temp.uid_of('d')::text, true);
select is(
  pg_temp.capture_sqlstate(format(
    'select public.submit_cup_penalty_number(%L::uuid, %L::uuid, 2::smallint, null)',
    md5('b7c-comp'), md5('b7c-w6')
  )),
  'P0002',
  'a user without a tie in the round cannot submit a Penalty Number'
);

select set_config('request.jwt.claim.sub', pg_temp.uid_of('g')::text, true);
select is(
  (public.submit_cup_penalty_number(
    md5('b7c-comp')::uuid, md5('b7c-w6')::uuid, 2::smallint, null
  ) ->> 'version')::integer,
  0,
  'g stores Penalty Number 2 in the even lane'
);

set local session_replication_role = replica;
update public.matches
set kickoff_at = now() - interval '1 hour'
where id = pg_temp.match_of(6);
set local session_replication_role = origin;

select set_config('request.jwt.claim.sub', pg_temp.uid_of('a')::text, true);
select is(
  pg_temp.capture_sqlstate(format(
    'select public.submit_cup_penalty_number(%L::uuid, %L::uuid, 7::smallint, 0)',
    md5('b7c-comp'), md5('b7c-w6')
  )),
  '55000',
  'the Penalty Number locks at the round''s first kickoff'
);
select set_config('request.jwt.claim.sub', '', true);

-- ---------------------------------------------------------------------------
-- The final: Penalty Number decider, champion and completion
-- ---------------------------------------------------------------------------

select public.confirm_match_result(pg_temp.match_of(6), 'regulation', 2::smallint, 1::smallint);

select public.admin_settle_predictor_cup_round(md5('b7c-comp')::uuid, md5('b7c-w6')::uuid);

select is(
  (
    select jsonb_build_object('winner', fixture.winner_user_id, 'decided', fixture.decided_by)
    from public.bonus_cup_fixtures fixture
    where fixture.competition_id = md5('b7c-comp')::uuid
      and fixture.stage = 'knockout' and fixture.round_size = 2
  ),
  jsonb_build_object('winner', pg_temp.uid_of('g'), 'decided', 'penalty_number'),
  'the tied final is decided by the closer Penalty Number: g (2) beats a (5) on 3 actual goals'
);

select ok(
  (
    select competition.completed_at is not null
    from public.bonus_competitions competition
    where competition.id = md5('b7c-comp')::uuid
  ),
  'the competition completes when the final settles'
);

select is(
  (
    select entrant.outcome from public.bonus_competition_entrants entrant
    where entrant.competition_id = md5('b7c-comp')::uuid
      and entrant.user_id = pg_temp.uid_of('g')
  ),
  'champion',
  'the final winner is recorded as Predictor Cup Champion'
);

select is(
  (
    select jsonb_build_object(
      'finalised', count(*) filter (where audit.action = 'cup_groups_finalised'),
      'rounds', count(*) filter (where audit.action = 'cup_round_settled'),
      'champion', count(*) filter (where audit.action = 'cup_champion')
    )
    from public.bonus_competition_audit audit
    where audit.competition_id = md5('b7c-comp')::uuid
  ),
  jsonb_build_object('finalised', 1, 'rounds', 3, 'champion', 1),
  'the gate, every settled round and the champion are audited'
);

select is(
  pg_temp.capture_sqlstate(format(
    'select public.admin_settle_predictor_cup_round(%L::uuid, %L::uuid)',
    md5('b7c-comp'), md5('b7c-w6')
  )),
  '55000',
  'a settled round cannot settle twice'
);

-- ---------------------------------------------------------------------------
-- The my-cup read carries the honours: champion and Golden Predictor
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', pg_temp.uid_of('g')::text, true);

select is(
  (
    select jsonb_build_object(
      'champion', payload -> 'champion' ->> 'user_id',
      'my_seed', (payload -> 'my_member' ->> 'seed')::integer,
      'bracket_ties', jsonb_array_length(payload -> 'bracket'),
      'golden_leader', payload -> 'golden_predictor' -> 'top' -> 0 ->> 'user_id',
      'golden_leader_points',
        (payload -> 'golden_predictor' -> 'top' -> 0 ->> 'points')::integer,
      'my_golden_points',
        (payload -> 'golden_predictor' -> 'me' ->> 'points')::integer
    )
    from public.get_my_cup(current_setting('test.b7c_tournament_id')::uuid) payload
  ),
  jsonb_build_object(
    'champion', pg_temp.uid_of('g')::text,
    'my_seed', 2,
    'bracket_ties', 4,
    'golden_leader', pg_temp.uid_of('a')::text,
    'golden_leader_points', 23,
    'my_golden_points', 14
  ),
  'the champion (g) and the Golden Predictor leader (a) are separate honours'
);

select set_config('request.jwt.claim.sub', '', true);

select * from finish();

rollback;
