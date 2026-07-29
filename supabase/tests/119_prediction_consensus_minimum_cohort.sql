begin;

select plan(9);

insert into public.tournaments (id, name, year, starts_on, ends_on, lock_at) values
  ('63000000-0000-0000-0000-000000000001', 'Consensus below threshold', 2097, '2097-06-01', '2097-07-01', now() - interval '1 day'),
  ('63000000-0000-0000-0000-000000000002', 'Consensus at threshold', 2098, '2098-06-01', '2098-07-01', now() - interval '1 day'),
  ('63000000-0000-0000-0000-000000000003', 'Consensus above threshold', 2099, '2099-06-01', '2099-07-01', now() - interval '1 day');

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  ('63000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  format('consensus-threshold-%s@example.test', index),
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  jsonb_build_object('display_name', format('Threshold Player %s', index)),
  now(),
  now()
from generate_series(1, 11) as index;

insert into public.profiles (id, display_name, welcomed_at)
select
  ('63000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  format('Threshold Player %s', index),
  now()
from generate_series(1, 11) as index
on conflict (id) do update set display_name = excluded.display_name;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  ('63000000-0000-0000-0002-' || lpad(index::text, 12, '0'))::uuid,
  ('63000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  '63000000-0000-0000-0000-000000000001'::uuid,
  now()
from generate_series(1, 9) as index;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  ('63000000-0000-0000-0003-' || lpad(index::text, 12, '0'))::uuid,
  ('63000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  '63000000-0000-0000-0000-000000000002'::uuid,
  now()
from generate_series(1, 10) as index;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select
  ('63000000-0000-0000-0004-' || lpad(index::text, 12, '0'))::uuid,
  ('63000000-0000-0000-0001-' || lpad(index::text, 12, '0'))::uuid,
  '63000000-0000-0000-0000-000000000003'::uuid,
  now()
from generate_series(1, 11) as index;

select set_config('request.jwt.claim.sub', '63000000-0000-0000-0001-000000000001', true);
set local role authenticated;

create temporary table threshold_payloads (
  cohort text primary key,
  payload jsonb not null
) on commit drop;

insert into threshold_payloads values
  ('below', public.get_prediction_consensus('63000000-0000-0000-0000-000000000001')),
  ('at', public.get_prediction_consensus('63000000-0000-0000-0000-000000000002')),
  ('above', public.get_prediction_consensus('63000000-0000-0000-0000-000000000003'));

select is((select payload ->> 'suppressed' from threshold_payloads where cohort = 'below'), 'true', 'below threshold returns a successful suppression state');
select is((select payload ->> 'reason' from threshold_payloads where cohort = 'below'), 'not_enough_entries', 'suppression explains that the cohort is too small');
select is((select (payload ->> 'minimum_entries')::integer from threshold_payloads where cohort = 'below'), 10, 'suppression declares the fixed minimum of ten');
select is((select (payload ->> 'submitted_entries')::integer from threshold_payloads where cohort = 'below'), 9, 'below-threshold response reports the truthful cohort size');
select is((select payload ->> 'suppressed' from threshold_payloads where cohort = 'at'), 'false', 'at threshold returns the aggregate');
select is((select (payload ->> 'submitted_entries')::integer from threshold_payloads where cohort = 'at'), 10, 'the caller counts toward the threshold alongside nine peers');
select is((select payload ->> 'suppressed' from threshold_payloads where cohort = 'above'), 'false', 'above threshold returns the aggregate');
select is((select (payload ->> 'submitted_entries')::integer from threshold_payloads where cohort = 'above'), 11, 'above-threshold response reports all submitted entries');

reset role;

select ok(
  not has_function_privilege(
    'authenticated',
    'predictor_internal.get_prediction_consensus_unsuppressed(uuid)',
    'execute'
  ),
  'browser roles cannot bypass the public cohort gate'
);

select * from finish();
rollback;
