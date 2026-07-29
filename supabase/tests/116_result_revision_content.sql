begin;

select plan(17);

insert into auth.users (
  id,
  email,
  aud,
  role,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '92000000-0000-0000-0000-000000000001',
  'revision-actor@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

select set_config(
  'request.jwt.claim.sub',
  '92000000-0000-0000-0000-000000000001',
  true
);

insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values (
  '92000000-0000-0000-0000-000000000101',
  'Result Revision Content Test',
  2099,
  '2099-06-01',
  '2099-07-01',
  '2099-05-31 12:00:00+00'
);

insert into public.teams (id, tournament_id, name) values
  (
    '92000000-0000-0000-0000-000000000201',
    '92000000-0000-0000-0000-000000000101',
    'Revision Home'
  ),
  (
    '92000000-0000-0000-0000-000000000202',
    '92000000-0000-0000-0000-000000000101',
    'Revision Away'
  );

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
) values (
  '92000000-0000-0000-0000-000000000301',
  '92000000-0000-0000-0000-000000000101',
  'FINAL-REVISION',
  'final',
  null,
  null,
  'W-SF-1',
  'W-SF-2',
  '92000000-0000-0000-0000-000000000201',
  '92000000-0000-0000-0000-000000000202',
  '2099-07-01',
  '2099-07-01 20:00:00+00',
  'Revision Stadium'
);

select lives_ok(
  $$
    select public.confirm_match_result(
      '92000000-0000-0000-0000-000000000301'::uuid,
      'regulation'::text,
      2::smallint,
      0::smallint,
      null::smallint,
      null::smallint,
      null::smallint,
      null::smallint,
      'initial official result'::text
    )
  $$,
  'a regulation final result can be confirmed'
);

select lives_ok(
  $$
    select public.correct_match_result(
      '92000000-0000-0000-0000-000000000301'::uuid,
      'penalties'::text,
      1::smallint,
      1::smallint,
      2::smallint,
      2::smallint,
      5::smallint,
      4::smallint,
      'official correction to shootout'::text
    )
  $$,
  'the confirmed result can be corrected to a penalty shootout'
);

select lives_ok(
  $$
    select public.clear_match_result(
      '92000000-0000-0000-0000-000000000301'::uuid,
      'official result withdrawn'::text
    )
  $$,
  'the corrected result can be cleared'
);

select is(
  (
    select count(*)::integer
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
  ),
  3,
  'confirm, correct and clear append exactly three revision rows'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object(
        'revision', revision,
        'action', action
      )
      order by revision
    )
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
  ),
  '[
    {"revision":1,"action":"confirm"},
    {"revision":2,"action":"correct"},
    {"revision":3,"action":"clear"}
  ]'::jsonb,
  'revision numbers and actions are ordered and immutable'
);

select is(
  (
    select previous_result
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and revision = 1
  ),
  jsonb_build_object(
    'state', 'scheduled',
    'method', null,
    'homeScore', null,
    'awayScore', null,
    'home90', null,
    'away90', null,
    'home120', null,
    'away120', null,
    'homePenalties', null,
    'awayPenalties', null,
    'winnerTeamId', null,
    'version', 0,
    'confirmedAt', null,
    'correctedAt', null,
    'reason', null
  ),
  'confirm records the complete scheduled-state snapshot'
);

select ok(
  (
    select new_result @> jsonb_build_object(
      'state', 'confirmed',
      'method', 'regulation',
      'homeScore', 2,
      'awayScore', 0,
      'home90', 2,
      'away90', 0,
      'home120', null,
      'away120', null,
      'homePenalties', null,
      'awayPenalties', null,
      'winnerTeamId', '92000000-0000-0000-0000-000000000201',
      'version', 1,
      'correctedAt', null,
      'reason', 'initial official result'
    )
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and revision = 1
  ),
  'confirm stores the complete regulation score, winner, version and reason'
);

select ok(
  (
    select new_result -> 'confirmedAt' <> 'null'::jsonb
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and revision = 1
  ),
  'confirm stores a confirmation timestamp'
);

select is(
  (
    select correction.previous_result
    from public.match_result_revisions correction
    where correction.match_id = '92000000-0000-0000-0000-000000000301'
      and correction.revision = 2
  ),
  (
    select confirmation.new_result
    from public.match_result_revisions confirmation
    where confirmation.match_id = '92000000-0000-0000-0000-000000000301'
      and confirmation.revision = 1
  ),
  'correction previous_result exactly chains from confirmation new_result'
);

select ok(
  (
    select new_result @> jsonb_build_object(
      'state', 'corrected',
      'method', 'penalties',
      'homeScore', 2,
      'awayScore', 2,
      'home90', 1,
      'away90', 1,
      'home120', 2,
      'away120', 2,
      'homePenalties', 5,
      'awayPenalties', 4,
      'winnerTeamId', '92000000-0000-0000-0000-000000000201',
      'version', 2,
      'reason', 'official correction to shootout'
    )
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and revision = 2
  ),
  'correction stores every regulation, extra-time and shootout score field'
);

select is(
  (
    select correction.new_result -> 'confirmedAt'
    from public.match_result_revisions correction
    where correction.match_id = '92000000-0000-0000-0000-000000000301'
      and correction.revision = 2
  ),
  (
    select confirmation.new_result -> 'confirmedAt'
    from public.match_result_revisions confirmation
    where confirmation.match_id = '92000000-0000-0000-0000-000000000301'
      and confirmation.revision = 1
  ),
  'correction preserves the original confirmation timestamp'
);

select ok(
  (
    select new_result -> 'correctedAt' <> 'null'::jsonb
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and revision = 2
  ),
  'correction stores a correction timestamp'
);

select is(
  (
    select clearing.previous_result
    from public.match_result_revisions clearing
    where clearing.match_id = '92000000-0000-0000-0000-000000000301'
      and clearing.revision = 3
  ),
  (
    select correction.new_result
    from public.match_result_revisions correction
    where correction.match_id = '92000000-0000-0000-0000-000000000301'
      and correction.revision = 2
  ),
  'clear previous_result exactly chains from correction new_result'
);

select is(
  (
    select new_result
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and revision = 3
  ),
  jsonb_build_object(
    'state', 'scheduled',
    'method', null,
    'homeScore', null,
    'awayScore', null,
    'home90', null,
    'away90', null,
    'home120', null,
    'away120', null,
    'homePenalties', null,
    'awayPenalties', null,
    'winnerTeamId', null,
    'version', 3,
    'confirmedAt', null,
    'correctedAt', null,
    'reason', 'official result withdrawn'
  ),
  'clear stores the complete reset state while retaining the new version and reason'
);

select is(
  (
    select jsonb_agg(reason order by revision)
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
  ),
  '[
    "initial official result",
    "official correction to shootout",
    "official result withdrawn"
  ]'::jsonb,
  'revision rows retain the operation reasons in order'
);

select is(
  (
    select count(*)::integer
    from public.match_result_revisions
    where match_id = '92000000-0000-0000-0000-000000000301'
      and tournament_id = '92000000-0000-0000-0000-000000000101'
      and actor_id = '92000000-0000-0000-0000-000000000001'
  ),
  3,
  'every revision records the correct tournament and authenticated actor'
);

select ok(
  exists (
    select 1
    from public.matches
    where id = '92000000-0000-0000-0000-000000000301'
      and result_state = 'scheduled'
      and result_version = 3
      and last_result_reason = 'official result withdrawn'
      and result_method is null
      and home_score is null
      and away_score is null
      and winner_team_id is null
      and confirmed_at is null
      and corrected_at is null
  ),
  'the authoritative match row matches the final clear snapshot'
);

select * from finish();
rollback;
