-- Contract 134 / EURO-002: one server-owned Euro publication lifecycle.

begin;

select plan(29);

select ok(
  to_regclass('predictor_internal.euro_publication_state') is not null,
  'Euro publication current state has one internal authority table');

select ok(
  to_regclass('predictor_internal.euro_publication_transitions') is not null,
  'Euro publication transitions have a dedicated internal history table');

select is(
  (select state::text from predictor_internal.euro_publication_state where singleton),
  'hidden',
  'Euro 2028 defaults to hidden');

select is(
  (select count(*)::integer from predictor_internal.euro_publication_state),
  1,
  'the current-state authority starts with exactly one row');

select is(
  (select count(*)::integer
     from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name in ('euro_publication_state', 'euro_publication_transitions')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'browser and service roles have no direct table privileges');

select is(
  (select count(*)::integer
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal'
      and c.relname in ('euro_publication_state', 'euro_publication_transitions')
      and c.relrowsecurity),
  2,
  'both publication tables have RLS enabled');

select is(
  (select count(*)::integer
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('euro_publication_state', 'admin_transition_euro_publication_state')
      and p.prosecdef
      and p.proconfig @> array['search_path=""']),
  2,
  'both exposed RPCs are security definer with an empty search path');

select ok(
  has_function_privilege('anon', 'public.euro_publication_state()', 'EXECUTE'),
  'anonymous callers can read the bounded publication state');

select ok(
  has_function_privilege('authenticated', 'public.euro_publication_state()', 'EXECUTE'),
  'signed-in callers can read the bounded publication state');

select ok(
  not has_function_privilege('anon', 'public.admin_transition_euro_publication_state(text,text,text)', 'EXECUTE'),
  'anonymous callers cannot reach the transition RPC');

select ok(
  has_function_privilege('authenticated', 'public.admin_transition_euro_publication_state(text,text,text)', 'EXECUTE'),
  'authenticated callers may reach the RPC while owner metadata decides who may act');

set local role anon;
select is(
  (select state from public.euro_publication_state()),
  'hidden',
  'the anonymous bounded read sees hidden without table access');
reset role;

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('c134-owner')::uuid,
  'c134-owner@example.test',
  'authenticated',
  'authenticated',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);
set local session_replication_role = origin;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('c134-owner')::uuid,
    'role', 'authenticated',
    'app_metadata', json_build_object(
      'admin_capabilities', json_build_array('competitions')
    )
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.admin_transition_euro_publication_state('hidden', 'prelaunch', 'Not an owner')$$,
  '42501',
  'Euro publication administration is not authorised',
  'a delegated competition administrator cannot publish Euro 2028');
reset role;

select is(
  (select state::text from predictor_internal.euro_publication_state where singleton),
  'hidden',
  'a rejected delegated-admin transition changes no state');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', md5('c134-owner')::uuid,
    'role', 'authenticated',
    'app_metadata', json_build_object('admin_role', 'super_admin')
  )::text,
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.admin_transition_euro_publication_state('hidden', 'live', 'Skip the launch states')$$,
  '22023',
  'Invalid Euro publication transition: hidden -> live',
  'the owner cannot skip lifecycle states');

select throws_ok(
  $$select * from public.admin_transition_euro_publication_state('hidden', 'prelaunch', '   ')$$,
  '22023',
  'A publication-state transition requires a reason',
  'every publication transition requires an operator reason');

select is(
  (select state from public.admin_transition_euro_publication_state(
    'hidden', 'prelaunch', 'Begin approved prelaunch publication'
  )),
  'prelaunch',
  'the owner can advance hidden to prelaunch');

select throws_ok(
  $$select * from public.admin_transition_euro_publication_state('hidden', 'prelaunch', 'Stale retry')$$,
  '40001',
  'Euro publication state changed concurrently: expected hidden, found prelaunch',
  'expected-state checking rejects a stale operator retry');

select is(
  (select state from public.admin_transition_euro_publication_state(
    'prelaunch', 'registration-open', 'Open registration after launch approval'
  )),
  'registration-open',
  'the owner can advance prelaunch to registration-open');

select is(
  (select state from public.admin_transition_euro_publication_state(
    'registration-open', 'live', 'Tournament has started'
  )),
  'live',
  'the owner can advance registration-open to live');

select is(
  (select state from public.admin_transition_euro_publication_state(
    'live', 'completed', 'Tournament has completed'
  )),
  'completed',
  'the owner can advance live to completed');

select is(
  (select state from public.admin_transition_euro_publication_state(
    'completed', 'archived', 'Archive the completed tournament experience'
  )),
  'archived',
  'the owner can advance completed to archived');

select throws_ok(
  $$select * from public.admin_transition_euro_publication_state('archived', 'hidden', 'Reopen it')$$,
  '22023',
  'Invalid Euro publication transition: archived -> hidden',
  'archived is terminal rather than silently reopening the tournament');

reset role;

select is(
  (select count(*)::integer from predictor_internal.euro_publication_transitions),
  5,
  'exactly the five successful lifecycle transitions were recorded');

select is(
  (select count(*)::integer
     from predictor_internal.euro_publication_transitions
    where actor_id = md5('c134-owner')::uuid
      and char_length(btrim(reason)) > 0),
  5,
  'every transition records the owner and a non-blank reason');

select is(
  (select string_agg(from_state::text || '>' || to_state::text, ',' order by id)
     from predictor_internal.euro_publication_transitions),
  'hidden>prelaunch,prelaunch>registration-open,registration-open>live,live>completed,completed>archived',
  'transition history preserves the complete ordered lifecycle');

select throws_ok(
  $$update predictor_internal.euro_publication_transitions set reason = 'rewritten' where id = 1$$,
  '42501',
  'Euro publication transition history is append-only',
  'transition history cannot be rewritten');

select throws_ok(
  $$delete from predictor_internal.euro_publication_transitions where id = 1$$,
  '42501',
  'Euro publication transition history is append-only',
  'transition history cannot be deleted');

select is(
  (select state::text from predictor_internal.euro_publication_state where singleton),
  'archived',
  'the current-state row reflects the last valid transition');

select * from finish();
rollback;
