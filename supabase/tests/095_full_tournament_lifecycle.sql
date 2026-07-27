begin;

select plan(45);

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

create or replace function pg_temp.lifecycle_score(
  p_home_name text,
  p_away_name text
)
returns smallint[]
language plpgsql
immutable
as $$
declare
  v_group_index integer := ascii(substring(p_home_name from 6 for 1)) - ascii('A');
  v_home_slot integer := right(p_home_name, 1)::integer;
  v_away_slot integer := right(p_away_name, 1)::integer;
  v_low_slot integer := least(v_home_slot, v_away_slot);
  v_high_slot integer := greatest(v_home_slot, v_away_slot);
  v_winning_goals integer;
begin
  v_winning_goals := case
    when v_low_slot = 3 and v_high_slot = 4 then v_group_index + 1
    when v_low_slot = 1 and v_high_slot = 3 then 3
    else 2
  end;

  if v_home_slot < v_away_slot then
    return array[v_winning_goals::smallint, 0::smallint];
  end if;

  return array[0::smallint, v_winning_goals::smallint];
end;
$$;

create or replace function pg_temp.seed_predictions(
  p_entry_id uuid,
  p_mode text
)
returns void
language plpgsql
as $$
begin
  insert into public.match_predictions (
    entry_id,
    match_id,
    home_score,
    away_score,
    joker,
    version
  )
  select
    p_entry_id,
    match.id,
    case
      when p_mode = 'exact' or (p_mode = 'result' and match.match_ref = 'GA-1')
        then (scores.value)[1]
      when (scores.value)[1] > (scores.value)[2]
        then ((scores.value)[1] + 1)::smallint
      else (scores.value)[1]
    end,
    case
      when p_mode = 'exact' or (p_mode = 'result' and match.match_ref = 'GA-1')
        then (scores.value)[2]
      when (scores.value)[2] > (scores.value)[1]
        then ((scores.value)[2] + 1)::smallint
      else (scores.value)[2]
    end,
    false,
    0
  from public.matches match
  join public.teams home_team on home_team.id = match.home_team_id
  join public.teams away_team on away_team.id = match.away_team_id
  cross join lateral (
    select pg_temp.lifecycle_score(home_team.name, away_team.name) as value
  ) scores
  where match.round = 'group'
    and match.tournament_id = (
      select id from public.tournaments where name = 'UEFA Euro 2028'
    );
end;
$$;

insert into auth.users (
  id,
  email,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '21000000-0000-0000-0000-000000000001',
    'lifecycle-exact@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'lifecycle-result@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    'lifecycle-alternate@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name, welcomed_at) values
  ('21000000-0000-0000-0000-000000000001', 'Lifecycle Exact', now()),
  ('21000000-0000-0000-0000-000000000002', 'Lifecycle Result', now()),
  ('21000000-0000-0000-0000-000000000003', 'Lifecycle Alternate', now())
on conflict (id) do update
  set display_name = excluded.display_name,
      welcomed_at = excluded.welcomed_at;

update public.tournaments
  set lock_at = now() + interval '1 day'
  where name = 'UEFA Euro 2028';

insert into public.entries (id, user_id, tournament_id)
select fixture.entry_id, fixture.user_id, tournament.id
from public.tournaments tournament
cross join (values
  ('21000000-0000-0000-0000-000000000101'::uuid, '21000000-0000-0000-0000-000000000001'::uuid),
  ('21000000-0000-0000-0000-000000000102'::uuid, '21000000-0000-0000-0000-000000000002'::uuid),
  ('21000000-0000-0000-0000-000000000103'::uuid, '21000000-0000-0000-0000-000000000003'::uuid)
) as fixture(entry_id, user_id)
where tournament.name = 'UEFA Euro 2028';

insert into public.leagues (id, tournament_id, owner_id, name, invite_code)
select
  '21000000-0000-0000-0000-000000000201',
  tournament.id,
  '21000000-0000-0000-0000-000000000001',
  'Lifecycle League',
  'LIFE28'
from public.tournaments tournament
where tournament.name = 'UEFA Euro 2028';

insert into public.league_members (league_id, user_id, role) values
  ('21000000-0000-0000-0000-000000000201', '21000000-0000-0000-0000-000000000001', 'owner'),
  ('21000000-0000-0000-0000-000000000201', '21000000-0000-0000-0000-000000000002', 'member'),
  ('21000000-0000-0000-0000-000000000201', '21000000-0000-0000-0000-000000000003', 'member');

select pg_temp.seed_predictions('21000000-0000-0000-0000-000000000101', 'exact');
select pg_temp.seed_predictions('21000000-0000-0000-0000-000000000102', 'result');
select pg_temp.seed_predictions('21000000-0000-0000-0000-000000000103', 'alternate');

insert into public.predicted_progression (entry_id, team_id, stage)
select fixture.entry_id, team.id, fixture.stage
from (values
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team B1', 'champion'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team E1', 'final'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team F1', 'sf'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team C1', 'sf'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team A1', 'qf'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team D2', 'qf'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team A2', 'qf'),
  ('21000000-0000-0000-0000-000000000101'::uuid, 'Team D1', 'qf'),

  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team E1', 'champion'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team B1', 'final'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team C1', 'sf'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team F1', 'sf'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team D1', 'qf'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team A1', 'qf'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team D2', 'qf'),
  ('21000000-0000-0000-0000-000000000102'::uuid, 'Team A2', 'qf'),

  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team B2', 'champion'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team E2', 'final'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team C2', 'sf'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team F2', 'sf'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team F3', 'qf'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team C3', 'qf'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team E3', 'qf'),
  ('21000000-0000-0000-0000-000000000103'::uuid, 'Team D3', 'qf')
) as fixture(entry_id, team_name, stage)
join public.teams team
  on team.name = fixture.team_name
 and team.tournament_id = (
   select id from public.tournaments where name = 'UEFA Euro 2028'
 );

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.submit_entry('21000000-0000-0000-0000-000000000101')$$,
  'the exact-score entry submits through the authoritative validator'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.submit_entry('21000000-0000-0000-0000-000000000102')$$,
  'the result entry submits through the authoritative validator'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$select public.submit_entry('21000000-0000-0000-0000-000000000103')$$,
  'the alternate valid bracket submits through the authoritative validator'
);
reset role;

select is(
  (select count(*) from public.entries where id::text like '21000000-0000-0000-0000-00000000010%' and submitted_at is not null),
  3::bigint,
  'all representative entries are submitted before lock'
);

select is(
  (select count(*) from public.predicted_group_positions where entry_id::text like '21000000-0000-0000-0000-00000000010%'),
  72::bigint,
  'submission materialises all predicted group positions'
);

select is(
  (select count(*) from public.league_members where league_id = '21000000-0000-0000-0000-000000000201'),
  3::bigint,
  'the representative league contains all three users'
);

update public.tournaments
  set lock_at = now() - interval '1 minute'
  where name = 'UEFA Euro 2028';

select lives_ok(
  $test$
  do $body$
  declare
    fixture record;
    score smallint[];
  begin
    for fixture in
      select match.id, home_team.name as home_name, away_team.name as away_name
      from public.matches match
      join public.teams home_team on home_team.id = match.home_team_id
      join public.teams away_team on away_team.id = match.away_team_id
      where match.round = 'group'
      order by match.matchday, match.match_ref
      limit 35
    loop
      score := pg_temp.lifecycle_score(fixture.home_name, fixture.away_name);
      perform public.confirm_match_result(
        fixture.id, 'regulation', score[1], score[2],
        null, null, null, null, 'Lifecycle simulation group result'
      );
    end loop;
  end;
  $body$;
  $test$,
  'the first 35 group results confirm'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'r16'
      union all
      select away_team_id from public.matches where round = 'r16'
    ) participants
    where team_id is null
  ),
  16::bigint,
  'the actual Round of 16 remains unresolved before group completion'
);

select lives_ok(
  $test$
  do $body$
  declare
    fixture record;
    score smallint[];
  begin
    select match.id, home_team.name as home_name, away_team.name as away_name
      into fixture
      from public.matches match
      join public.teams home_team on home_team.id = match.home_team_id
      join public.teams away_team on away_team.id = match.away_team_id
      where match.match_ref = 'GF-6';

    score := pg_temp.lifecycle_score(fixture.home_name, fixture.away_name);
    perform public.confirm_match_result(
      fixture.id, 'regulation', score[1], score[2],
      null, null, null, null, 'Lifecycle final group result'
    );
  end;
  $body$;
  $test$,
  'the 36th group result completes the group stage'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'r16'
      union all
      select away_team_id from public.matches where round = 'r16'
    ) participants
    where team_id is not null
  ),
  16::bigint,
  'group completion populates every Round-of-16 slot'
);

select is(
  (
    select count(distinct team_id)
    from (
      select home_team_id as team_id from public.matches where round = 'r16'
      union all
      select away_team_id from public.matches where round = 'r16'
    ) participants
  ),
  16::bigint,
  'the actual Round of 16 contains 16 distinct teams'
);

select is(
  (
    select jsonb_object_agg(match.match_ref, jsonb_build_array(home_team.name, away_team.name))
    from public.matches match
    join public.teams home_team on home_team.id = match.home_team_id
    join public.teams away_team on away_team.id = match.away_team_id
    where match.round = 'r16'
  ),
  '{
    "R16-1":["Team A1","Team C2"],
    "R16-2":["Team A2","Team B2"],
    "R16-3":["Team B1","Team F3"],
    "R16-4":["Team C1","Team E3"],
    "R16-5":["Team F1","Team C3"],
    "R16-6":["Team D2","Team E2"],
    "R16-7":["Team E1","Team D3"],
    "R16-8":["Team D1","Team F2"]
  }'::jsonb,
  'the best-third allocation matches the CDEF contract'
);

select is(
  (select count(*) from public.rank_history where matchday_key in ('MD1', 'MD2', 'MD3')),
  9::bigint,
  'group completion captures three rank checkpoints for three users'
);

select is(
  (select count(*) from public.entry_totals where entry_id::text like '21000000-0000-0000-0000-00000000010%'),
  3::bigint,
  'scoring produces totals for all representative entries'
);

select ok(
  (
    select exact.total_points > result_entry.total_points
    from public.entry_totals exact
    join public.entry_totals result_entry on result_entry.entry_id = '21000000-0000-0000-0000-000000000102'
    where exact.entry_id = '21000000-0000-0000-0000-000000000101'
  ),
  'the exact-score entry leads the result entry'
);

select ok(
  (
    select result_entry.total_points > alternate.total_points
    from public.entry_totals result_entry
    join public.entry_totals alternate on alternate.entry_id = '21000000-0000-0000-0000-000000000103'
    where result_entry.entry_id = '21000000-0000-0000-0000-000000000102'
  ),
  'the result entry leads the alternate bracket entry'
);

select is(
  pg_temp.capture_sqlstate($sql$
    update public.matches
      set home_team_id = (select id from public.teams where name = 'Team F4')
      where match_ref = 'R16-1'
  $sql$),
  '42501',
  'direct Round-of-16 participant writes are rejected'
);

select lives_ok(
  $sql$
    select public.confirm_match_result(
      (select id from public.matches where match_ref = 'R16-1'),
      'penalties', 1::smallint, 1::smallint, 2::smallint, 2::smallint,
      5::smallint, 4::smallint, 'Lifecycle penalty result'
    )
  $sql$,
  'a Round-of-16 penalty result confirms'
);

select is(
  (
    select team.name
    from public.matches match
    join public.teams team on team.id = match.away_team_id
    where match.match_ref = 'QF-1'
  ),
  'Team A1',
  'the R16-1 winner propagates into QF-1'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.correct_match_result(
      (select id from public.matches where match_ref = 'GA-1'),
      'regulation', 0::smallint, 10::smallint,
      null, null, null, null, 'Correct group winner after R16 started'
    )
  $sql$),
  '55000',
  'a group correction cannot silently rewrite a confirmed R16 fixture'
);

select is(
  (
    select team.name
    from public.matches match
    join public.teams team on team.id = match.home_team_id
    where match.match_ref = 'R16-1'
  ),
  'Team A1',
  'the blocked correction preserves the confirmed participant'
);

select lives_ok(
  $sql$
    select public.clear_match_result(
      (select id from public.matches where match_ref = 'R16-1'),
      'Clear downstream fixture before group replay'
    )
  $sql$,
  'the affected R16 result clears before replay'
);

select lives_ok(
  $sql$
    select public.correct_match_result(
      (select id from public.matches where match_ref = 'GA-1'),
      'regulation', 0::smallint, 10::smallint,
      null, null, null, null, 'Official group result correction'
    )
  $sql$,
  'the group correction succeeds after downstream clearing'
);

select is(
  (
    select team.name
    from public.matches match
    join public.teams team on team.id = match.home_team_id
    where match.match_ref = 'R16-1'
  ),
  'Team A2',
  'group replay replaces the Group A winner in R16-1'
);

select is(
  (select away_team_id from public.matches where match_ref = 'QF-1'),
  null::uuid,
  'clearing R16-1 clears its propagated quarter-final participant'
);

select lives_ok(
  $test$
  do $body$
  declare fixture record;
  begin
    for fixture in select id, match_ref from public.matches where round = 'r16' order by match_ref loop
      if fixture.match_ref = 'R16-1' then
        perform public.confirm_match_result(
          fixture.id, 'penalties', 1::smallint, 1::smallint, 2::smallint, 2::smallint,
          5::smallint, 4::smallint, 'Lifecycle R16 penalties'
        );
      elsif fixture.match_ref = 'R16-2' then
        perform public.confirm_match_result(
          fixture.id, 'extra_time', 1::smallint, 1::smallint, 2::smallint, 1::smallint,
          null, null, 'Lifecycle R16 extra time'
        );
      else
        perform public.confirm_match_result(
          fixture.id, 'regulation', 2::smallint, 0::smallint,
          null, null, null, null, 'Lifecycle R16 regulation'
        );
      end if;
    end loop;
  end;
  $body$;
  $test$,
  'all eight Round-of-16 results play through mixed methods'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'qf'
      union all
      select away_team_id from public.matches where round = 'qf'
    ) participants
    where team_id is not null
  ),
  8::bigint,
  'R16 winners populate every quarter-final slot'
);

select lives_ok(
  $test$
  do $body$
  declare fixture record;
  begin
    for fixture in select id from public.matches where round = 'qf' order by match_ref loop
      perform public.confirm_match_result(
        fixture.id, 'regulation', 2::smallint, 0::smallint,
        null, null, null, null, 'Lifecycle quarter-final result'
      );
    end loop;
  end;
  $body$;
  $test$,
  'all four quarter-finals confirm'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'sf'
      union all
      select away_team_id from public.matches where round = 'sf'
    ) participants
    where team_id is not null
  ),
  4::bigint,
  'quarter-final winners populate every semi-final slot'
);

select lives_ok(
  $test$
  do $body$
  declare fixture record;
  begin
    for fixture in select id from public.matches where round = 'sf' order by match_ref loop
      perform public.confirm_match_result(
        fixture.id, 'regulation', 2::smallint, 0::smallint,
        null, null, null, null, 'Lifecycle semi-final result'
      );
    end loop;
  end;
  $body$;
  $test$,
  'both semi-finals confirm'
);

select is(
  (
    select count(*)
    from (
      select home_team_id as team_id from public.matches where round = 'final'
      union all
      select away_team_id from public.matches where round = 'final'
    ) participants
    where team_id is not null
  ),
  2::bigint,
  'semi-final winners populate both final slots'
);

select lives_ok(
  $sql$
    select public.confirm_match_result(
      (select id from public.matches where round = 'final'),
      'regulation', 2::smallint, 0::smallint,
      null, null, null, null, 'Lifecycle final result'
    )
  $sql$,
  'the final confirms'
);

select is(
  (select count(*) from public.matches where round in ('r16', 'qf', 'sf', 'final') and result_state in ('confirmed', 'corrected')),
  15::bigint,
  'all 15 knockout matches are complete'
);

select is(
  (select count(*) from public.rank_history),
  21::bigint,
  'the tournament captures seven rank checkpoints for three users'
);

select is(
  (
    select team.name
    from public.matches match
    join public.teams team on team.id = match.winner_team_id
    where match.round = 'final'
  ),
  'Team B1',
  'the deterministic knockout path crowns Team B1'
);

select is(
  (
    select count(*)
    from public.score_events event
    join public.teams team on team.id = event.team_id
    where event.entry_id = '21000000-0000-0000-0000-000000000101'
      and event.category = 'knockout'
      and team.name = 'Team B1'
      and event.points = 110
  ),
  1::bigint,
  'the exact entry receives champion progression points'
);

create temporary table final_rank_snapshot on commit drop as
select user_id, rank, total_points, captured_at
from public.rank_history
where matchday_key = 'FINAL';

select lives_ok(
  $sql$
    select public.correct_match_result(
      (select id from public.matches where round = 'final'),
      'penalties', 1::smallint, 1::smallint, 2::smallint, 2::smallint,
      4::smallint, 5::smallint, 'Official final winner correction'
    )
  $sql$,
  'the final corrects to a penalty-decided away winner'
);

select is(
  (
    select team.name
    from public.matches match
    join public.teams team on team.id = match.winner_team_id
    where match.round = 'final'
  ),
  'Team E1',
  'the corrected result changes the champion to Team E1'
);

select is(
  (
    select count(*)
    from public.score_events event
    join public.teams team on team.id = event.team_id
    where event.entry_id = '21000000-0000-0000-0000-000000000101'
      and event.category = 'knockout'
      and team.name = 'Team B1'
      and event.points = 110
  ),
  0::bigint,
  'champion scoring is removed from Team B1 after correction'
);

select lives_ok(
  $sql$
    select public.clear_match_result(
      (select id from public.matches where round = 'final'),
      'Clear final for replay verification'
    )
  $sql$,
  'the final clears for replay'
);

select is(
  (
    select count(*)
    from public.score_events
    where entry_id::text like '21000000-0000-0000-0000-00000000010%'
      and category = 'knockout'
      and points = 110
  ),
  0::bigint,
  'clearing the final removes all champion-level score events'
);

select lives_ok(
  $sql$
    select public.confirm_match_result(
      (select id from public.matches where round = 'final'),
      'regulation', 2::smallint, 0::smallint,
      null, null, null, null, 'Replay final result'
    )
  $sql$,
  'the cleared final can be replayed'
);

select is(
  (
    select team.name
    from public.matches match
    join public.teams team on team.id = match.winner_team_id
    where match.round = 'final'
  ),
  'Team B1',
  'the replay restores Team B1 as champion'
);

select is(
  (
    select count(*)
    from public.match_result_revisions revision
    join public.matches match on match.id = revision.match_id
    where match.round = 'final'
  ),
  4::bigint,
  'confirm, correct, clear and replay remain in revision history'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object(
        'user', history.user_id,
        'rank', history.rank,
        'points', history.total_points,
        'captured', history.captured_at
      )
      order by history.user_id
    )
    from public.rank_history history
    where history.matchday_key = 'FINAL'
  ),
  (
    select jsonb_agg(
      jsonb_build_object(
        'user', snapshot.user_id,
        'rank', snapshot.rank,
        'points', snapshot.total_points,
        'captured', snapshot.captured_at
      )
      order by snapshot.user_id
    )
    from final_rank_snapshot snapshot
  ),
  'final correction and replay do not rewrite historical rank capture'
);

select * from finish();
rollback;
