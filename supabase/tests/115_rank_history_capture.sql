begin;

select plan(17);

insert into public.tournaments (
  id,
  name,
  year,
  starts_on,
  ends_on,
  lock_at
) values (
  '91000000-0000-0000-0000-000000000001',
  'Rank History Behaviour Test',
  2099,
  '2099-06-01',
  '2099-07-01',
  '2099-05-31 12:00:00+00'
);

insert into public.groups (id, tournament_id, letter) values (
  '91000000-0000-0000-0000-000000000002',
  '91000000-0000-0000-0000-000000000001',
  'A'
);

insert into public.teams (id, tournament_id, name) values
  (
    '91000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000001',
    'Rank Test A1'
  ),
  (
    '91000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000001',
    'Rank Test A2'
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
) values
  (
    '91000000-0000-0000-0000-000000000005',
    '91000000-0000-0000-0000-000000000001',
    'RANK-MD1',
    'group',
    '91000000-0000-0000-0000-000000000002',
    1,
    'A1',
    'A2',
    '91000000-0000-0000-0000-000000000003',
    '91000000-0000-0000-0000-000000000004',
    '2099-06-01',
    '2099-06-01 12:00:00+00',
    'Rank Test Stadium'
  ),
  (
    '91000000-0000-0000-0000-000000000006',
    '91000000-0000-0000-0000-000000000001',
    'RANK-MD2',
    'group',
    '91000000-0000-0000-0000-000000000002',
    2,
    'A2',
    'A1',
    '91000000-0000-0000-0000-000000000004',
    '91000000-0000-0000-0000-000000000003',
    '2099-06-02',
    '2099-06-02 12:00:00+00',
    'Rank Test Stadium'
  );

select lives_ok(
  $$
    select public.confirm_match_result(
      '91000000-0000-0000-0000-000000000005'::uuid,
      'regulation'::text,
      1::smallint,
      0::smallint,
      null::smallint,
      null::smallint,
      null::smallint,
      null::smallint,
      'rank-history behavioural test MD1'::text
    )
  $$,
  'the first matchday completes through the authoritative result writer'
);

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
    '91000000-0000-0000-0000-000000000011',
    'rank-one@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Rank One"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000012',
    'rank-two@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Rank Two"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000013',
    'rank-three@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Rank Three"}'::jsonb,
    now(),
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000014',
    'rank-unsubmitted@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Rank Unsubmitted"}'::jsonb,
    now(),
    now()
  );

insert into public.entries (id, user_id, tournament_id, submitted_at) values
  (
    '91000000-0000-0000-0000-000000000021',
    '91000000-0000-0000-0000-000000000011',
    '91000000-0000-0000-0000-000000000001',
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000022',
    '91000000-0000-0000-0000-000000000012',
    '91000000-0000-0000-0000-000000000001',
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000023',
    '91000000-0000-0000-0000-000000000013',
    '91000000-0000-0000-0000-000000000001',
    now()
  ),
  (
    '91000000-0000-0000-0000-000000000024',
    '91000000-0000-0000-0000-000000000014',
    '91000000-0000-0000-0000-000000000001',
    null
  );

insert into public.score_events (entry_id, category, points, explanation) values
  (
    '91000000-0000-0000-0000-000000000021',
    'awards',
    12,
    'rank-history initial total'
  ),
  (
    '91000000-0000-0000-0000-000000000022',
    'awards',
    8,
    'rank-history initial total'
  ),
  (
    '91000000-0000-0000-0000-000000000023',
    'awards',
    8,
    'rank-history initial total'
  ),
  (
    '91000000-0000-0000-0000-000000000024',
    'awards',
    99,
    'unsubmitted entry must be omitted'
  );

select lives_ok(
  $$
    select public.capture_rank_history(
      '91000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'rank history capture succeeds when MD1 is complete'
);

select is(
  (
    select count(*)::integer
    from public.rank_history
    where tournament_id = '91000000-0000-0000-0000-000000000001'
  ),
  3,
  'only the three submitted entries receive the MD1 checkpoint'
);

select is(
  (
    select count(*)::integer
    from public.rank_history
    where tournament_id = '91000000-0000-0000-0000-000000000001'
      and matchday_key = 'MD2'
  ),
  0,
  'an incomplete MD2 does not create a checkpoint'
);

select ok(
  exists (
    select 1
    from public.rank_history
    where user_id = '91000000-0000-0000-0000-000000000011'
      and tournament_id = '91000000-0000-0000-0000-000000000001'
      and matchday_key = 'MD1'
      and matchday_ord = 1
      and rank = 1
      and total_points = 12
  ),
  'MD1 stores the leading canonical total and rank'
);

select is(
  (
    select count(*)::integer
    from public.rank_history
    where tournament_id = '91000000-0000-0000-0000-000000000001'
      and matchday_key = 'MD1'
      and rank = 2
      and total_points = 8
  ),
  2,
  'equal MD1 totals receive a shared rank'
);

select ok(
  not exists (
    select 1
    from public.rank_history
    where user_id = '91000000-0000-0000-0000-000000000014'
      and tournament_id = '91000000-0000-0000-0000-000000000001'
  ),
  'an unsubmitted entry is omitted from rank history'
);

create temporary table first_rank_capture as
select user_id, matchday_key, captured_at
from public.rank_history
where tournament_id = '91000000-0000-0000-0000-000000000001';

delete from public.score_events
where entry_id in (
  '91000000-0000-0000-0000-000000000021',
  '91000000-0000-0000-0000-000000000022',
  '91000000-0000-0000-0000-000000000023'
);

insert into public.score_events (entry_id, category, points, explanation) values
  (
    '91000000-0000-0000-0000-000000000021',
    'awards',
    3,
    'rank-history revised total'
  ),
  (
    '91000000-0000-0000-0000-000000000022',
    'awards',
    20,
    'rank-history revised total'
  ),
  (
    '91000000-0000-0000-0000-000000000023',
    'awards',
    10,
    'rank-history revised total'
  );

select lives_ok(
  $$
    select public.capture_rank_history(
      '91000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'recapturing the same completed checkpoint is safe'
);

select is(
  (
    select count(*)::integer
    from public.rank_history history
    where history.tournament_id = '91000000-0000-0000-0000-000000000001'
      and history.matchday_key = 'MD1'
      and (
        (
          history.user_id = '91000000-0000-0000-0000-000000000011'
          and history.total_points <> 12
        )
        or (
          history.user_id = '91000000-0000-0000-0000-000000000012'
          and history.total_points <> 8
        )
        or (
          history.user_id = '91000000-0000-0000-0000-000000000013'
          and history.total_points <> 8
        )
      )
  ),
  0,
  'an existing checkpoint is not overwritten by later totals'
);

select is(
  (
    select count(*)::integer
    from public.rank_history history
    join first_rank_capture first
      using (user_id, matchday_key)
    where history.tournament_id = '91000000-0000-0000-0000-000000000001'
      and history.captured_at <> first.captured_at
  ),
  0,
  'recapture preserves the original checkpoint timestamp'
);

select lives_ok(
  $$
    select public.confirm_match_result(
      '91000000-0000-0000-0000-000000000006'::uuid,
      'regulation'::text,
      0::smallint,
      2::smallint,
      null::smallint,
      null::smallint,
      null::smallint,
      null::smallint,
      'rank-history behavioural test MD2'::text
    )
  $$,
  'the second matchday completes through the authoritative result writer'
);

-- Result confirmation captures rank history automatically after score
-- recomputation. Remove that MD2 fixture snapshot so the function can be
-- exercised below against controlled totals; the preserved MD1 rows stay in
-- place and continue to prove idempotency.
delete from public.rank_history
where tournament_id = '91000000-0000-0000-0000-000000000001'
  and matchday_key = 'MD2';

delete from public.score_events
where entry_id in (
  '91000000-0000-0000-0000-000000000021',
  '91000000-0000-0000-0000-000000000022',
  '91000000-0000-0000-0000-000000000023'
);

insert into public.score_events (entry_id, category, points, explanation) values
  (
    '91000000-0000-0000-0000-000000000021',
    'awards',
    3,
    'rank-history MD2 total'
  ),
  (
    '91000000-0000-0000-0000-000000000022',
    'awards',
    20,
    'rank-history MD2 total'
  ),
  (
    '91000000-0000-0000-0000-000000000023',
    'awards',
    10,
    'rank-history MD2 total'
  );

select lives_ok(
  $$
    select public.capture_rank_history(
      '91000000-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'a newly completed MD2 creates its own checkpoint'
);

select is(
  (
    select count(*)::integer
    from public.rank_history
    where tournament_id = '91000000-0000-0000-0000-000000000001'
  ),
  6,
  'MD1 and MD2 retain three submitted-entry rows each'
);

select ok(
  exists (
    select 1
    from public.rank_history
    where user_id = '91000000-0000-0000-0000-000000000012'
      and tournament_id = '91000000-0000-0000-0000-000000000001'
      and matchday_key = 'MD2'
      and matchday_ord = 2
      and rank = 1
      and total_points = 20
  ),
  'MD2 captures the revised leader total and rank'
);

select ok(
  exists (
    select 1
    from public.rank_history
    where user_id = '91000000-0000-0000-0000-000000000013'
      and tournament_id = '91000000-0000-0000-0000-000000000001'
      and matchday_key = 'MD2'
      and rank = 2
      and total_points = 10
  ),
  'MD2 captures the revised second-place total and rank'
);

select ok(
  exists (
    select 1
    from public.rank_history
    where user_id = '91000000-0000-0000-0000-000000000011'
      and tournament_id = '91000000-0000-0000-0000-000000000001'
      and matchday_key = 'MD2'
      and rank = 3
      and total_points = 3
  ),
  'MD2 captures the revised third-place total and rank'
);

select is(
  (
    select count(distinct matchday_key)::integer
    from public.rank_history
    where tournament_id = '91000000-0000-0000-0000-000000000001'
  ),
  2,
  'only completed checkpoints are present'
);

select * from finish();
rollback;
