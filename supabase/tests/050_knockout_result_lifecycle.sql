begin;

select plan(38);

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
    '10000000-0000-0000-0000-000000000001',
    'result-home@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'result-away@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values
  (
    '10000000-0000-0000-0000-000000000101',
    'Result Lifecycle One',
    2028,
    '2028-06-09',
    '2028-07-09',
    '2028-06-09 17:00:00+00'
  ),
  (
    '10000000-0000-0000-0000-000000000102',
    'Result Lifecycle Foreign',
    2032,
    '2032-06-09',
    '2032-07-09',
    '2032-06-09 17:00:00+00'
  );

insert into public.groups (id, tournament_id, letter) values
  (
    '10000000-0000-0000-0000-000000000201',
    '10000000-0000-0000-0000-000000000101',
    'A'
  );

insert into public.teams (id, tournament_id, name) values
  ('10000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000101', 'Lifecycle Home'),
  ('10000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000101', 'Lifecycle Away'),
  ('10000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000101', 'Lifecycle Third'),
  ('10000000-0000-0000-0000-000000000304', '10000000-0000-0000-0000-000000000101', 'Lifecycle Fourth'),
  ('10000000-0000-0000-0000-000000000311', '10000000-0000-0000-0000-000000000102', 'Foreign Participant');

insert into public.group_teams (group_id, team_id, slot) values
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000301', 1),
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000302', 2),
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000303', 3),
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000304', 4);

insert into public.matches (
  id,
  tournament_id,
  match_ref,
  round,
  group_id,
  matchday,
  home_source,
  away_source,
  home_team_id,
  away_team_id,
  match_date,
  kickoff_at,
  venue
) values
  (
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000101',
    'GA-LIFECYCLE',
    'group',
    '10000000-0000-0000-0000-000000000201',
    1,
    'A1',
    'A2',
    '10000000-0000-0000-0000-000000000301',
    '10000000-0000-0000-0000-000000000302',
    '2028-06-09',
    '2028-06-09 17:00:00+00',
    'Lifecycle Stadium'
  ),
  (
    '10000000-0000-0000-0000-000000000402',
    '10000000-0000-0000-0000-000000000101',
    'FINAL-LIFECYCLE',
    'final',
    null,
    null,
    'W-SF-1',
    'W-SF-2',
    '10000000-0000-0000-0000-000000000301',
    '10000000-0000-0000-0000-000000000302',
    '2028-07-09',
    '2028-07-09 20:00:00+00',
    'Lifecycle Stadium'
  ),
  (
    '10000000-0000-0000-0000-000000000403',
    '10000000-0000-0000-0000-000000000101',
    'QF-LIFECYCLE',
    'qf',
    null,
    null,
    'W-R16-1',
    'W-R16-2',
    '10000000-0000-0000-0000-000000000303',
    '10000000-0000-0000-0000-000000000304',
    '2028-07-01',
    '2028-07-01 20:00:00+00',
    'Lifecycle Stadium'
  ),
  (
    '10000000-0000-0000-0000-000000000404',
    '10000000-0000-0000-0000-000000000101',
    'R16-FOREIGN',
    'r16',
    null,
    null,
    'W-A',
    'RU-B',
    '10000000-0000-0000-0000-000000000311',
    '10000000-0000-0000-0000-000000000302',
    '2028-06-25',
    '2028-06-25 20:00:00+00',
    'Lifecycle Stadium'
  );

insert into public.entries (
  id,
  user_id,
  tournament_id,
  submitted_at
) values
  (
    '10000000-0000-0000-0000-000000000501',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000101',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000502',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000101',
    now()
  );

insert into public.predicted_progression (entry_id, team_id, stage) values
  ('10000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000301', 'champion'),
  ('10000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000302', 'champion');

select ok(
  not has_function_privilege(
    'authenticated',
    'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
    'execute'
  ),
  'authenticated clients cannot confirm a result'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
    'execute'
  ),
  'the server role can execute the confirmation RPC'
);

select ok(
  not has_table_privilege('authenticated', 'public.match_result_revisions', 'select'),
  'authenticated clients cannot read the private revision log directly'
);

select is(
  pg_temp.capture_sqlstate($sql$
    update public.matches
      set home_score = 1,
          away_score = 0
      where id = '10000000-0000-0000-0000-000000000402'
  $sql$),
  '42501',
  'direct score writes are rejected even for a privileged SQL caller'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.correct_match_result(
      '10000000-0000-0000-0000-000000000402',
      'regulation',
      1::smallint,
      0::smallint,
      null,
      null,
      null,
      null,
      'not yet confirmed'
    )
  $sql$),
  '55000',
  'a scheduled match cannot be corrected'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.clear_match_result(
      '10000000-0000-0000-0000-000000000402',
      'not yet confirmed'
    )
  $sql$),
  '55000',
  'a scheduled match cannot be cleared'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000401',
      'extra_time',
      1::smallint,
      1::smallint,
      2::smallint,
      1::smallint
    )
  $sql$),
  '23514',
  'a group-stage result cannot use extra time'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000401',
      'regulation',
      1::smallint,
      1::smallint
    )
  $sql$),
  null::text,
  'a group-stage draw confirms through the lifecycle'
);

select is(
  (
    select jsonb_build_object(
      'state', m.result_state,
      'method', m.result_method,
      'score', jsonb_build_array(m.home_score, m.away_score),
      'winner', m.winner_team_id
    )
    from public.matches m
    where m.id = '10000000-0000-0000-0000-000000000401'
  ),
  '{"state":"confirmed","method":"regulation","score":[1,1],"winner":null}'::jsonb,
  'a confirmed group draw has no winner and preserves the 90-minute score'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000402',
      'regulation',
      1::smallint,
      1::smallint
    )
  $sql$),
  '23514',
  'a knockout regulation result cannot be tied'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000402',
      'extra_time',
      1::smallint,
      0::smallint,
      2::smallint,
      1::smallint
    )
  $sql$),
  '23514',
  'extra time requires a tied 90-minute score'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000402',
      'penalties',
      1::smallint,
      1::smallint,
      2::smallint,
      1::smallint,
      5::smallint,
      4::smallint
    )
  $sql$),
  '23514',
  'penalties require a tied 120-minute score'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000404',
      'regulation',
      1::smallint,
      0::smallint
    )
  $sql$),
  '23514',
  'a result cannot confirm participants from another tournament'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000402',
      'penalties',
      1::smallint,
      1::smallint,
      1::smallint,
      1::smallint,
      5::smallint,
      4::smallint,
      'initial final result'
    )
  $sql$),
  null::text,
  'a penalty-decided final confirms successfully'
);

select is(
  (
    select jsonb_build_object(
      'state', m.result_state,
      'method', m.result_method,
      'score90', jsonb_build_array(m.home_score_90, m.away_score_90),
      'score120', jsonb_build_array(m.home_score_120, m.away_score_120),
      'publicScore', jsonb_build_array(m.home_score, m.away_score),
      'penalties', jsonb_build_array(m.home_penalties, m.away_penalties),
      'winner', m.winner_team_id,
      'version', m.result_version
    )
    from public.matches m
    where m.id = '10000000-0000-0000-0000-000000000402'
  ),
  '{"state":"confirmed","method":"penalties","score90":[1,1],"score120":[1,1],"publicScore":[1,1],"penalties":[5,4],"winner":"10000000-0000-0000-0000-000000000301","version":1}'::jsonb,
  'the final keeps tied football scores and derives the shootout winner'
);

select is(
  (
    select count(*)::integer
    from public.match_result_revisions r
    where r.match_id = '10000000-0000-0000-0000-000000000402'
  ),
  1,
  'initial confirmation creates one immutable revision'
);

select is(
  (
    select se.points
    from public.score_events se
    where se.entry_id = '10000000-0000-0000-0000-000000000501'
      and se.category = 'knockout'
      and se.team_id = '10000000-0000-0000-0000-000000000301'
  ),
  110,
  'a predicted penalty winner receives champion progression points'
);

select is(
  (
    select se.points
    from public.score_events se
    where se.entry_id = '10000000-0000-0000-0000-000000000502'
      and se.category = 'knockout'
      and se.team_id = '10000000-0000-0000-0000-000000000302'
  ),
  70,
  'the losing finalist receives finalist progression points'
);

select is(
  (
    select rh.total_points
    from public.rank_history rh
    where rh.user_id = '10000000-0000-0000-0000-000000000001'
      and rh.tournament_id = '10000000-0000-0000-0000-000000000101'
      and rh.matchday_key = 'FINAL'
  ),
  110,
  'final rank history captures the penalty winner after authoritative scoring'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.correct_match_result(
      '10000000-0000-0000-0000-000000000402',
      'penalties',
      1::smallint,
      1::smallint,
      1::smallint,
      1::smallint,
      4::smallint,
      5::smallint,
      null
    )
  $sql$),
  '22023',
  'a correction requires a reason'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.correct_match_result(
      '10000000-0000-0000-0000-000000000402',
      'penalties',
      1::smallint,
      1::smallint,
      1::smallint,
      1::smallint,
      4::smallint,
      5::smallint,
      'shootout teams were reversed'
    )
  $sql$),
  null::text,
  'a reasoned correction succeeds'
);

select is(
  (
    select jsonb_build_object(
      'state', m.result_state,
      'winner', m.winner_team_id,
      'version', m.result_version,
      'hasCorrectedAt', m.corrected_at is not null
    )
    from public.matches m
    where m.id = '10000000-0000-0000-0000-000000000402'
  ),
  '{"state":"corrected","winner":"10000000-0000-0000-0000-000000000302","version":2,"hasCorrectedAt":true}'::jsonb,
  'the corrected result changes winner and advances the version'
);

select is(
  (
    select jsonb_agg(r.action order by r.revision)
    from public.match_result_revisions r
    where r.match_id = '10000000-0000-0000-0000-000000000402'
  ),
  '["confirm","correct"]'::jsonb,
  'the revision log preserves confirmation then correction'
);

select is(
  (
    select se.points
    from public.score_events se
    where se.entry_id = '10000000-0000-0000-0000-000000000501'
      and se.category = 'knockout'
      and se.team_id = '10000000-0000-0000-0000-000000000301'
  ),
  70,
  'correcting the winner removes champion points from the former winner'
);

select is(
  (
    select se.points
    from public.score_events se
    where se.entry_id = '10000000-0000-0000-0000-000000000502'
      and se.category = 'knockout'
      and se.team_id = '10000000-0000-0000-0000-000000000302'
  ),
  110,
  'correcting the winner awards champion points to the corrected winner'
);

select is(
  pg_temp.capture_sqlstate($sql$
    update public.matches
      set home_team_id = '10000000-0000-0000-0000-000000000303'
      where id = '10000000-0000-0000-0000-000000000402'
  $sql$),
  '23514',
  'participants cannot be replaced underneath a confirmed result'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.clear_match_result(
      '10000000-0000-0000-0000-000000000402',
      null
    )
  $sql$),
  '22023',
  'clearing a result requires a reason'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.clear_match_result(
      '10000000-0000-0000-0000-000000000402',
      'result entered against the wrong fixture'
    )
  $sql$),
  null::text,
  'a reasoned clear succeeds'
);

select is(
  (
    select jsonb_build_object(
      'state', m.result_state,
      'method', m.result_method,
      'score', jsonb_build_array(m.home_score, m.away_score),
      'winner', m.winner_team_id,
      'version', m.result_version
    )
    from public.matches m
    where m.id = '10000000-0000-0000-0000-000000000402'
  ),
  '{"state":"scheduled","method":null,"score":[null,null],"winner":null,"version":3}'::jsonb,
  'clearing removes the authoritative result but preserves revision sequence'
);

select is(
  (
    select count(*)::integer
    from public.match_result_revisions r
    where r.match_id = '10000000-0000-0000-0000-000000000402'
  ),
  3,
  'clearing appends rather than deleting revision history'
);

select is(
  (
    select jsonb_agg(se.points order by se.entry_id)
    from public.score_events se
    where se.category = 'knockout'
      and se.team_id in (
        '10000000-0000-0000-0000-000000000301',
        '10000000-0000-0000-0000-000000000302'
      )
      and se.entry_id in (
        '10000000-0000-0000-0000-000000000501',
        '10000000-0000-0000-0000-000000000502'
      )
  ),
  '[70,70]'::jsonb,
  'clearing the final removes champion status while retaining finalist points'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000402',
      'regulation',
      2::smallint,
      1::smallint,
      null,
      null,
      null,
      null,
      'fixture now verified'
    )
  $sql$),
  null::text,
  'a cleared match can be confirmed again'
);

select is(
  (
    select jsonb_build_object(
      'state', m.result_state,
      'winner', m.winner_team_id,
      'version', m.result_version,
      'correctedAt', m.corrected_at
    )
    from public.matches m
    where m.id = '10000000-0000-0000-0000-000000000402'
  ),
  '{"state":"confirmed","winner":"10000000-0000-0000-0000-000000000301","version":4,"correctedAt":null}'::jsonb,
  're-confirmation creates a clean confirmed state with the next version'
);

select is(
  (
    select jsonb_agg(r.action order by r.revision)
    from public.match_result_revisions r
    where r.match_id = '10000000-0000-0000-0000-000000000402'
  ),
  '["confirm","correct","clear","confirm"]'::jsonb,
  'the complete result lifecycle is preserved in order'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000403',
      null,
      1::smallint,
      1::smallint
    )
  $sql$),
  '22023',
  'a result method is mandatory'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000403',
      'extra_time',
      1::smallint,
      1::smallint,
      2::smallint,
      1::smallint,
      null,
      null,
      'quarter-final verified'
    )
  $sql$),
  null::text,
  'a valid extra-time result confirms successfully'
);

select is(
  (
    select jsonb_build_object(
      'method', m.result_method,
      'score90', jsonb_build_array(m.home_score_90, m.away_score_90),
      'score120', jsonb_build_array(m.home_score_120, m.away_score_120),
      'publicScore', jsonb_build_array(m.home_score, m.away_score),
      'winner', m.winner_team_id
    )
    from public.matches m
    where m.id = '10000000-0000-0000-0000-000000000403'
  ),
  '{"method":"extra_time","score90":[1,1],"score120":[2,1],"publicScore":[2,1],"winner":"10000000-0000-0000-0000-000000000303"}'::jsonb,
  'extra time preserves both score checkpoints and derives the winner'
);

select is(
  pg_temp.capture_sqlstate($sql$
    select public.confirm_match_result(
      '10000000-0000-0000-0000-000000000404',
      'regulation',
      (-1)::smallint,
      0::smallint
    )
  $sql$),
  '23514',
  'negative result scores are rejected'
);

select * from finish();
rollback;
