begin;

select plan(27);

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

create or replace function pg_temp.seed_complete_entry(p_entry_id uuid)
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
    (scores.value)[1],
    (scores.value)[2],
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

  insert into public.predicted_progression (entry_id, team_id, stage)
  select p_entry_id, team.id, fixture.stage
  from (values
    ('Team B1', 'champion'),
    ('Team E1', 'final'),
    ('Team F1', 'sf'),
    ('Team C1', 'sf'),
    ('Team A1', 'qf'),
    ('Team D2', 'qf'),
    ('Team A2', 'qf'),
    ('Team D1', 'qf')
  ) as fixture(team_name, stage)
  join public.teams team
    on team.name = fixture.team_name
   and team.tournament_id = (
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
    '23000000-0000-0000-0000-000000000001',
    'auto-valid@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '23000000-0000-0000-0000-000000000002',
    'auto-invalid@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '23000000-0000-0000-0000-000000000003',
    'manual-valid@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '23000000-0000-0000-0000-000000000004',
    'submission-outsider@example.test',
    'authenticated',
    'authenticated',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, display_name, welcomed_at) values
  ('23000000-0000-0000-0000-000000000001', 'Auto Valid', now()),
  ('23000000-0000-0000-0000-000000000002', 'Auto Invalid', now()),
  ('23000000-0000-0000-0000-000000000003', 'Manual Valid', now()),
  ('23000000-0000-0000-0000-000000000004', 'Submission Outsider', now())
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
  ('23000000-0000-0000-0000-000000000101'::uuid, '23000000-0000-0000-0000-000000000001'::uuid),
  ('23000000-0000-0000-0000-000000000102'::uuid, '23000000-0000-0000-0000-000000000002'::uuid),
  ('23000000-0000-0000-0000-000000000103'::uuid, '23000000-0000-0000-0000-000000000003'::uuid)
) as fixture(entry_id, user_id)
where tournament.name = 'UEFA Euro 2028';

select pg_temp.seed_complete_entry('23000000-0000-0000-0000-000000000101');
select pg_temp.seed_complete_entry('23000000-0000-0000-0000-000000000103');

select is(
  (
    select count(*)
    from public.predicted_group_positions
    where entry_id = '23000000-0000-0000-0000-000000000101'
  ),
  24::bigint,
  'normal pre-lock writes maintain all derived group positions'
);

-- Remove only the derived rows while editing is still open. The automatic
-- processor must rebuild them after lock through its narrow server capability.
delete from public.predicted_group_positions
where entry_id = '23000000-0000-0000-0000-000000000101';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000003',
  true
);
select lives_ok(
  $$select public.submit_entry('23000000-0000-0000-0000-000000000103')$$,
  'manual owner submission remains unchanged before lock'
);
reset role;

create temporary table auto_submission_clock (
  lock_at timestamptz not null,
  process_at timestamptz not null
) on commit drop;

insert into auto_submission_clock values (
  date_trunc('second', now()) - interval '1 minute',
  date_trunc('second', now())
);

grant select on auto_submission_clock to authenticated;

update public.tournaments
  set lock_at = (select lock_at from auto_submission_clock)
  where name = 'UEFA Euro 2028';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000001',
  true
);
select is(
  (
    public.get_entry_submission_status(
      '23000000-0000-0000-0000-000000000101'
    ) ->> 'state'
  ),
  'automatic_submission_pending',
  'a locked unprocessed entry exposes a pending automatic check'
);
select is(
  pg_temp.capture_sqlstate(
    format(
      'select public.process_due_entry_submissions(%L::timestamptz)',
      (select process_at from auto_submission_clock)
    )
  ),
  '42501',
  'authenticated users cannot execute the server processor'
);
reset role;

select is(
  (
    public.process_due_entry_submissions(
      (select process_at from auto_submission_clock)
    ) ->> 'attempted'
  )::integer,
  2,
  'the processor attempts the two unsubmitted entries'
);

select is(
  (
    select submitted_at
    from public.entries
    where id = '23000000-0000-0000-0000-000000000101'
  ),
  (select process_at from auto_submission_clock),
  'the complete valid entry is submitted at the real processing time'
);

select is(
  (
    select submitted_at
    from public.entries
    where id = '23000000-0000-0000-0000-000000000102'
  ),
  null::timestamptz,
  'the incomplete entry remains unsubmitted'
);

select is(
  (
    select submitted_at is not null
    from public.entries
    where id = '23000000-0000-0000-0000-000000000103'
  ),
  true,
  'the manually submitted entry remains submitted'
);

select is(
  (
    select count(*)
    from public.predicted_group_positions
    where entry_id = '23000000-0000-0000-0000-000000000101'
  ),
  24::bigint,
  'the server processor refreshes derived positions after lock'
);

select is(
  (
    select outcome
    from public.entry_automatic_submission_outcomes
    where entry_id = '23000000-0000-0000-0000-000000000101'
  ),
  'submitted',
  'the complete entry receives a submitted audit outcome'
);

select is(
  (
    select outcome
    from public.entry_automatic_submission_outcomes
    where entry_id = '23000000-0000-0000-0000-000000000102'
  ),
  'invalid',
  'the incomplete entry receives an invalid audit outcome'
);

select like(
  (
    select failure_message
    from public.entry_automatic_submission_outcomes
    where entry_id = '23000000-0000-0000-0000-000000000102'
  ),
  'Group %',
  'the invalid outcome records the authoritative validation reason'
);

select is(
  (
    select count(*)
    from public.entry_automatic_submission_outcomes
    where entry_id = '23000000-0000-0000-0000-000000000103'
  ),
  0::bigint,
  'manual submission is not mislabelled as an automatic attempt'
);

select is(
  (
    public.process_due_entry_submissions(
      (select process_at + interval '1 minute' from auto_submission_clock)
    ) ->> 'attempted'
  )::integer,
  0,
  'repeated scheduler runs are idempotent for the same lock'
);

select is(
  (
    select count(*)
    from public.entry_automatic_submission_outcomes
    where entry_id in (
      '23000000-0000-0000-0000-000000000101',
      '23000000-0000-0000-0000-000000000102'
    )
  ),
  2::bigint,
  'idempotent replay creates no duplicate outcomes'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000001',
  true
);
select is(
  (
    public.get_entry_submission_status(
      '23000000-0000-0000-0000-000000000101'
    ) ->> 'state'
  ),
  'automatically_submitted',
  'the owner sees the automatic submission outcome'
);
select is(
  (
    public.get_entry_submission_status(
      '23000000-0000-0000-0000-000000000101'
    ) ->> 'submittedAt'
  )::timestamptz,
  (select process_at from auto_submission_clock),
  'the owner-visible outcome includes the truthful submission timestamp'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000002',
  true
);
select is(
  (
    public.get_entry_submission_status(
      '23000000-0000-0000-0000-000000000102'
    ) ->> 'state'
  ),
  'automatic_submission_failed',
  'the incomplete entry owner sees the failed automatic outcome'
);
select like(
  public.get_entry_submission_status(
    '23000000-0000-0000-0000-000000000102'
  ) ->> 'failureMessage',
  'Group %',
  'the owner sees the safe validator explanation'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000003',
  true
);
select is(
  (
    public.get_entry_submission_status(
      '23000000-0000-0000-0000-000000000103'
    ) ->> 'state'
  ),
  'manually_submitted',
  'manual submissions retain their distinct owner-visible state'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000004',
  true
);
select is(
  pg_temp.capture_sqlstate(
    $$select public.get_entry_submission_status('23000000-0000-0000-0000-000000000101')$$
  ),
  '42501',
  'another authenticated user cannot read the entry outcome'
);
reset role;

select is(
  pg_temp.capture_sqlstate(
    $$update public.entry_automatic_submission_outcomes set failure_message = 'Changed'$$
  ),
  '42501',
  'automatic submission outcomes are immutable'
);

select ok(
  exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ),
  'the pg_cron extension is installed'
);

select is(
  (
    select schedule
    from cron.job
    where jobname = 'euro28-auto-submit-due-entries'
  ),
  '* * * * *',
  'the automatic submission processor is scheduled every minute'
);

select like(
  (
    select command
    from cron.job
    where jobname = 'euro28-auto-submit-due-entries'
  ),
  '%process_due_entry_submissions%',
  'the cron job calls the server-owned processor'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.process_due_entry_submissions(timestamp with time zone)',
    'execute'
  ),
  'service_role retains an operational recovery call'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.process_due_entry_submissions(timestamp with time zone)',
    'execute'
  ),
  'authenticated users cannot execute the processor'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_entry_submission_status(uuid)',
    'execute'
  ),
  'authenticated owners can call the status RPC'
);

select * from finish();
rollback;
