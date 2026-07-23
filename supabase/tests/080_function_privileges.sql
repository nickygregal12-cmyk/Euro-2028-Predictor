begin;

select plan(18);

create temporary table expected_authenticated_functions (
  signature text primary key
) on commit drop;

insert into expected_authenticated_functions (signature) values
  ('create_league(uuid,text)'),
  ('delete_league(uuid)'),
  ('get_leaderboard(uuid)'),
  ('get_league(uuid)'),
  ('get_league_match_picks(uuid,uuid)'),
  ('get_league_members(uuid)'),
  ('get_league_preview(text)'),
  ('get_match_prediction_distribution(uuid)'),
  ('get_my_leagues(uuid)'),
  ('get_rival_entry(uuid,uuid)'),
  ('join_league(text)'),
  ('leave_league(uuid)'),
  ('replace_predicted_progression(uuid,jsonb,jsonb)'),
  ('submit_entry(uuid)'),
  ('transfer_ownership(uuid,uuid)');

create temporary table expected_service_functions (
  signature text primary key
) on commit drop;

insert into expected_service_functions (signature)
select signature from expected_authenticated_functions;

insert into expected_service_functions (signature) values
  ('capture_rank_history(uuid)'),
  ('clear_match_result(uuid,text)'),
  ('confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
  ('correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
  ('recompute_all_scores()'),
  ('recompute_tournament_scores(uuid)');

create temporary view public_function_privileges as
select
  p.oid::regprocedure::text as signature,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'execute') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') as authenticated_exec,
  has_function_privilege('service_role', p.oid, 'execute') as service_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

select is(
  (select count(*)::integer from public_function_privileges where anon_exec),
  0,
  'anon cannot execute any public application function'
);

select is(
  (
    select count(*)::integer
    from expected_authenticated_functions e
    left join public_function_privileges f using (signature)
    where not coalesce(f.authenticated_exec, false)
  ),
  0,
  'the authenticated RPC allowlist has no missing function'
);

select is(
  (
    select count(*)::integer
    from public_function_privileges f
    left join expected_authenticated_functions e using (signature)
    where f.authenticated_exec and e.signature is null
  ),
  0,
  'authenticated users cannot execute any function outside the RPC allowlist'
);

select is(
  (
    select count(*)::integer
    from expected_service_functions e
    left join public_function_privileges f using (signature)
    where not coalesce(f.service_exec, false)
  ),
  0,
  'the service-role allowlist has no missing function'
);

select is(
  (
    select count(*)::integer
    from public_function_privileges f
    left join expected_service_functions e using (signature)
    where f.service_exec and e.signature is null
  ),
  0,
  'service_role cannot execute any function outside its explicit allowlist'
);

select is(
  (select proconfig::text from public_function_privileges where signature = 'gen_invite_code()'),
  '{"search_path=\"\""}',
  'invite-code generation has an immutable empty search path'
);

select is(
  (select proconfig::text from public_function_privileges where signature = '_stage_ord(text)'),
  '{"search_path=\"\""}',
  'stage ordinal calculation has an immutable empty search path'
);

select is(
  (select proconfig::text from public_function_privileges where signature = 'enforce_write_version()'),
  '{"search_path=\"\""}',
  'write-version enforcement has an immutable empty search path'
);

select is(
  (
    select defaclacl::text
    from pg_default_acl
    where defaclrole = 'postgres'::regrole
      and defaclnamespace = 'public'::regnamespace
      and defaclobjtype = 'f'
  ),
  '{postgres=X/postgres}',
  'future public functions default to owner-only execution'
);

select ok(
  has_function_privilege('authenticated', 'public.submit_entry(uuid)', 'execute'),
  'authenticated users retain the protected submission RPC'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.replace_predicted_progression(uuid,jsonb,jsonb)',
    'execute'
  ),
  'authenticated users retain the atomic bracket RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.create_league(uuid,text)', 'execute'),
  'authenticated users retain league creation'
);

select ok(
  not has_function_privilege('anon', 'public.get_leaderboard(uuid)', 'execute'),
  'anonymous users cannot call the leaderboard RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.recompute_all_scores()', 'execute'),
  'authenticated users cannot call score recomputation directly'
);

select ok(
  has_function_privilege('service_role', 'public.recompute_all_scores()', 'execute'),
  'service_role retains score recomputation'
);

select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'the signup trigger function is not a browser RPC'
);

select ok(
  not has_function_privilege('service_role', 'public.handle_new_user()', 'execute'),
  'the signup trigger function is not directly callable by service_role'
);

select lives_ok(
  $sql$
    do $block$
    declare
      v_user uuid := '88888888-8888-8888-8888-888888888888';
    begin
      insert into auth.users (
        id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) values (
        v_user,
        'function-privilege-trigger@example.test',
        'authenticated',
        'authenticated',
        '{}'::jsonb,
        '{"display_name":"Privilege Trigger Test"}'::jsonb,
        now(),
        now()
      );

      if not exists (
        select 1
        from public.profiles p
        where p.id = v_user and p.display_name = 'Privilege Trigger Test'
      ) then
        raise exception 'signup trigger did not create the profile';
      end if;

      delete from auth.users where id = v_user;
    end
    $block$
  $sql$,
  'revoking direct execution does not break signup trigger execution'
);

select * from finish();
rollback;
