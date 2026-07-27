begin;

select plan(5);

select set_config(
  'test.summary_tournament',
  (select id::text from public.tournaments order by created_at, id limit 1),
  true
);

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '46000000-0000-0000-0000-000000000001',
    'summary-owner@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Summary Owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '46000000-0000-0000-0000-000000000002',
    'summary-member@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{"display_name":"Summary Member"}'::jsonb,
    now(),
    now()
  );

insert into public.leagues (
  id, tournament_id, owner_id, name, invite_code, created_at
) values (
  '46000000-0000-0000-0000-000000000101',
  current_setting('test.summary_tournament')::uuid,
  '46000000-0000-0000-0000-000000000001',
  'Summary Activity League',
  'SUMM46',
  '2026-07-20T10:00:00Z'
);

insert into public.league_members (league_id, user_id, role, joined_at) values
  (
    '46000000-0000-0000-0000-000000000101',
    '46000000-0000-0000-0000-000000000001',
    'owner',
    '2026-07-20T10:00:00Z'
  ),
  (
    '46000000-0000-0000-0000-000000000101',
    '46000000-0000-0000-0000-000000000002',
    'member',
    '2026-07-25T15:30:00Z'
  );

select set_config(
  'request.jwt.claim.sub',
  '46000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.get_my_leagues(current_setting('test.summary_tournament')::uuid)),
  1::bigint,
  'the caller receives the expected league summary'
);

select is(
  (
    select summary.last_activity_at
    from public.get_my_leagues(current_setting('test.summary_tournament')::uuid) summary
  ),
  '2026-07-25T15:30:00Z'::timestamptz,
  'league summary activity is the latest membership join timestamp'
);

select is(
  (
    select summary.member_count
    from public.get_my_leagues(current_setting('test.summary_tournament')::uuid) summary
  ),
  2,
  'the lightweight summary retains the truthful member count'
);

select is(
  (
    select summary.owner_name
    from public.get_my_leagues(current_setting('test.summary_tournament')::uuid) summary
  ),
  'Summary Owner',
  'the lightweight summary retains the owner display name'
);

select ok(
  has_function_privilege('authenticated', 'public.get_my_leagues(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_leagues(uuid)', 'execute'),
  'league summaries remain authenticated-only'
);

select * from finish();
rollback;
