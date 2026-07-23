begin;

select plan(21);

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
-- Real winner propagation: two R16 matches feed one QF.
-- ---------------------------------------------------------------------------
insert into public.tournaments (
  id, name, year, starts_on, ends_on, lock_at
) values (
  '20000000-0000-0000-0000-000000000101',
  'Bracket Propagation Test',
  2040,
  '2040-06-01',
  '2040-07-01',
  '2040-06-01 17:00:00+00'
);

insert into public.teams (id, tournament_id, name) values
  ('20000000-0000-0000-0000-000000000301', '20000000-0000-0000-0000-000000000101', 'Propagation A'),
  ('20000000-0000-0000-0000-000000000302', '20000000-0000-0000-0000-000000000101', 'Propagation B'),
  ('20000000-0000-0000-0000-000000000303', '20000000-0000-0000-0000-000000000101', 'Propagation C'),
  ('20000000-0000-0000-0000-000000000304', '20000000-0000-0000-0000-000000000101', 'Propagation D');

insert into public.matches (
  id, tournament_id, match_ref, round,
  home_source, away_source, home_team_id, away_team_id,
  match_date, kickoff_at, venue
) values
  (
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000101',
    'R16-P1', 'r16', 'W-A', 'RU-C',
    '20000000-0000-0000-0000-000000000301',
    '20000000-0000-0000-0000-000000000302',
    '2040-06-20', '2040-06-20 17:00:00+00', 'Propagation Stadium'
  ),
  (
    '20000000-0000-0000-0000-000000000402',
    '20000000-0000-0000-0000-000000000101',
    'R16-P2', 'r16', 'W-B', 'RU-D',
    '20000000-0000-0000-0000-000000000303',
    '20000000-0000-0000-0000-000000000304',
    '2040-06-20', '2040-06-20 20:00:00+00', 'Propagation Stadium'
  ),
  (
    '20000000-0000-0000-0000-000000000403',
    '20000000-0000-0000-0000-000000000101',
    'QF-P1', 'qf', 'W-R16-P1', 'W-R16-P2',
    null, null,
    '2040-06-25', '2040-06-25 20:00:00+00', 'Propagation Stadium'
  );

set local role service_role;

select lives_ok(
  $$select public.confirm_match_result(
    '20000000-0000-0000-0000-000000000401'::uuid,
    'regulation', 2::smallint, 0::smallint
  )$$,
  'confirming the first R16 result succeeds'
);

select is(
  (
    select m.home_team_id
    from public.matches m
    where m.id = '20000000-0000-0000-0000-000000000403'
  ),
  '20000000-0000-0000-0000-000000000301'::uuid,
  'the first confirmed R16 winner fills the QF home side'
);

select lives_ok(
  $$select public.confirm_match_result(
    '20000000-0000-0000-0000-000000000402'::uuid,
    'regulation', 0::smallint, 1::smallint
  )$$,
  'confirming the second R16 result succeeds'
);

select is(
  (
    select m.away_team_id
    from public.matches m
    where m.id = '20000000-0000-0000-0000-000000000403'
  ),
  '20000000-0000-0000-0000-000000000304'::uuid,
  'the second confirmed R16 winner fills the QF away side'
);

select lives_ok(
  $$select public.confirm_match_result(
    '20000000-0000-0000-0000-000000000403'::uuid,
    'regulation', 1::smallint, 0::smallint
  )$$,
  'the populated QF can be confirmed'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.correct_match_result(
      '20000000-0000-0000-0000-000000000401'::uuid,
      'regulation', 0::smallint, 1::smallint,
      null, null, null, null,
      'Corrected R16 winner'
    )
  $sql$),
  '55000',
  'an upstream winner cannot change while the downstream QF result is confirmed'
);

select lives_ok(
  $$select public.clear_match_result(
    '20000000-0000-0000-0000-000000000403'::uuid,
    'Clear downstream before upstream correction'
  )$$,
  'the downstream QF result can be cleared first'
);

select lives_ok(
  $$select public.correct_match_result(
    '20000000-0000-0000-0000-000000000401'::uuid,
    'regulation', 0::smallint, 1::smallint,
    null, null, null, null,
    'Corrected R16 winner'
  )$$,
  'the upstream winner can change after the downstream result is cleared'
);

select is(
  (
    select m.home_team_id
    from public.matches m
    where m.id = '20000000-0000-0000-0000-000000000403'
  ),
  '20000000-0000-0000-0000-000000000302'::uuid,
  'the corrected R16 winner replaces the scheduled QF participant'
);

select lives_ok(
  $$select public.clear_match_result(
    '20000000-0000-0000-0000-000000000402'::uuid,
    'Result entered against the wrong fixture'
  )$$,
  'an upstream result can be cleared while its child remains scheduled'
);

select is(
  (
    select m.away_team_id
    from public.matches m
    where m.id = '20000000-0000-0000-0000-000000000403'
  ),
  null::uuid,
  'clearing the upstream result removes its propagated QF participant'
);

select is(
  pg_temp.capture_sqlstate($sql$
    update public.matches
      set home_team_id = '20000000-0000-0000-0000-000000000301'
      where id = '20000000-0000-0000-0000-000000000403'
  $sql$),
  '42501',
  'even the service role cannot directly forge a winner-fed participant'
);

reset role;

-- ---------------------------------------------------------------------------
-- Full predicted bracket replay against the seeded Euro 2028 structure.
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '20000000-0000-0000-0000-000000000001',
  'bracket-owner@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

update public.tournaments
  set lock_at = now() + interval '1 day'
  where name = 'UEFA Euro 2028';

insert into public.entries (id, user_id, tournament_id)
select
  '20000000-0000-0000-0000-000000000201',
  '20000000-0000-0000-0000-000000000001',
  t.id
from public.tournaments t
where t.name = 'UEFA Euro 2028';

-- Lower-numbered group slots beat higher-numbered slots. This produces A1>A2>A3>A4
-- through F1>F2>F3>F4. Selected score-margin changes make A-D the four best thirds.
insert into public.match_predictions (entry_id, match_id, home_score, away_score)
select
  '20000000-0000-0000-0000-000000000201',
  m.id,
  case
    when right(m.home_source, 1)::integer < right(m.away_source, 1)::integer then 1
    else 0
  end::smallint,
  case
    when right(m.home_source, 1)::integer > right(m.away_source, 1)::integer then 1
    else 0
  end::smallint
from public.matches m
join public.tournaments t on t.id = m.tournament_id
where t.name = 'UEFA Euro 2028'
  and m.round = 'group';

update public.match_predictions mp
  set home_score = case m.match_ref
        when 'GA-2' then 3
        when 'GB-2' then 2
        when 'GE-3' then 2
        when 'GE-6' then 2
        when 'GF-3' then 3
        when 'GF-6' then 3
        else mp.home_score
      end
from public.matches m
where m.id = mp.match_id
  and mp.entry_id = '20000000-0000-0000-0000-000000000201'
  and m.match_ref in ('GA-2','GB-2','GE-3','GE-6','GF-3','GF-6');

select is(
  (
    select count(*)::integer
    from public.predicted_group_positions pgp
    where pgp.entry_id = '20000000-0000-0000-0000-000000000201'
  ),
  24,
  'the six predicted group tables materialise all 24 finishing positions'
);

select is(
  (
    select string_agg(r.group_letter, '' order by r.group_letter)
    from predictor_internal.predicted_third_place_ranking(
      '20000000-0000-0000-0000-000000000201'
    ) r
    where (
      (not r.unresolved and r.resolved_position <= 4)
      or
      (r.unresolved and r.higher_count + r.block_size <= 4)
    )
  ),
  'ABCD',
  'the predicted best-third contract selects groups A, B, C and D'
);

insert into public.predicted_progression (entry_id, team_id, stage)
select
  '20000000-0000-0000-0000-000000000201',
  tm.id,
  picks.stage
from (values
  ('Team B1', 'champion'),
  ('Team E1', 'final'),
  ('Team F1', 'sf'),
  ('Team C1', 'sf'),
  ('Team A1', 'qf'),
  ('Team D2', 'qf'),
  ('Team A2', 'qf'),
  ('Team D1', 'qf')
) as picks(team_name, stage)
join public.tournaments t on t.name = 'UEFA Euro 2028'
join public.teams tm on tm.tournament_id = t.id and tm.name = picks.team_name;

select ok(
  predictor_internal.assert_knockout_source_tree(
    (select id from public.tournaments where name = 'UEFA Euro 2028')
  ),
  'the committed Euro knockout fixtures form one complete source tree'
);

select is(
  (
    select count(*)::integer
    from predictor_internal.predicted_round_of_16(
      '20000000-0000-0000-0000-000000000201'
    )
  ),
  8,
  'the saved group predictions resolve all eight R16 fixtures'
);

select ok(
  predictor_internal.validate_predicted_bracket_tree(
    '20000000-0000-0000-0000-000000000201'
  ),
  'the valid progression rows replay one complete 15-match bracket tree'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'predictor_internal.validate_predicted_bracket_tree(uuid)',
    'execute'
  ),
  'authenticated clients cannot call the private bracket validator directly'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(
  public.submit_entry('20000000-0000-0000-0000-000000000201') is not null,
  'a complete replayable bracket submits successfully'
);

-- Direct authenticated progression DML is denied by REL-004. Corrupt the
-- fixture as service_role, then return to the authenticated owner to prove
-- repeat submission still rejects the hostile match-by-match tree.
reset role;
set local role service_role;

-- Preserve all four stage counts but make R16-1 claim that both A1 and C2 advance.
delete from public.predicted_progression pp
using public.teams tm
where pp.entry_id = '20000000-0000-0000-0000-000000000201'
  and pp.team_id = tm.id
  and tm.name = 'Team D1';

insert into public.predicted_progression (entry_id, team_id, stage)
select
  '20000000-0000-0000-0000-000000000201',
  tm.id,
  'qf'
from public.tournaments t
join public.teams tm on tm.tournament_id = t.id
where t.name = 'UEFA Euro 2028'
  and tm.name = 'Team C2';

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select count(*)::integer
    from public.predicted_progression pp
    where pp.entry_id = '20000000-0000-0000-0000-000000000201'
  ),
  8,
  'the hostile bracket still has the legacy-accepted total of eight rows'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.submit_entry('20000000-0000-0000-0000-000000000201')
  $sql$),
  '23514',
  'repeat submission rejects stage counts that cannot replay a valid bracket tree'
);

reset role;

select * from finish();
rollback;
