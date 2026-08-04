begin;

select plan(19);

create temporary table expected_anon_functions (
  signature text primary key
) on commit drop;

insert into expected_anon_functions (signature) values
  ('get_public_capacity()');

create temporary table expected_authenticated_functions (
  signature text primary key
) on commit drop;

insert into expected_authenticated_functions (signature) values
  ('create_league(uuid,text)'),
  ('delete_league(uuid)'),
  ('delete_match_prediction(uuid,uuid,integer)'),
  ('get_entry_submission_status(uuid)'),
  ('get_h2h_rank_history(uuid,uuid)'),
  ('get_leaderboard(uuid,integer,text)'),
  ('get_league(uuid)'),
  ('get_league_match_picks(uuid,uuid)'),
  ('get_league_members(uuid,integer,text)'),
  ('get_league_preview(text)'),
  ('get_match_prediction_distribution(uuid)'),
  ('get_my_leagues(uuid)'),
  ('get_player_profile(uuid,uuid)'),
  ('get_public_capacity()'),
  ('get_rival_entry(uuid,uuid)'),
  ('join_league(text)'),
  ('leave_league(uuid)'),
  ('replace_predicted_progression(uuid,jsonb,jsonb)'),
  ('search_league_transfer_candidates(uuid,text,integer)'),
  ('submit_entry(uuid)'),
  ('transfer_ownership(uuid,uuid)');

create temporary table expected_service_functions (
  signature text primary key
) on commit drop;

insert into expected_service_functions (signature)
select signature
from expected_authenticated_functions
where signature <> 'get_entry_submission_status(uuid)';

insert into expected_service_functions (signature) values
  ('capture_rank_history(uuid)'),
  ('clear_match_result(uuid,text)'),
  ('confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
  ('correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
  ('process_due_entry_submissions(timestamp with time zone)'),
  -- Contract 83. The season counterpart of the line above: the recurring
  -- matchweek lock. Server-only for the same reason — it submits on a player's
  -- behalf, so a browser session must never be able to trigger it.
  --
  -- The apostrophe in "player's" is KEPT ON PURPOSE. `rpcAllowlistParity`
  -- scans this values list for quoted literals, and before it stripped
  -- comments a lone apostrophe here re-paired every quote after it — silently
  -- dropping `set_operating_limits` from the service-role allow-list and
  -- failing against a function nobody had touched. This comment is the live
  -- regression case; removing the apostrophe would retire it.
  ('process_due_season_matchweek_submissions(timestamp with time zone)'),
  ('recompute_all_scores()'),
  ('recompute_tournament_scores(uuid)'),
  ('set_operating_limits(integer,integer)');

insert into expected_authenticated_functions (signature) values
  ('admin_actual_third_place_tie_revisions(uuid)'),
  ('admin_actual_third_place_tie_status(uuid)'),
  ('admin_clear_actual_third_place_tie(uuid,text)'),
  ('admin_clear_match_result(uuid,text)'),
  ('admin_confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
  ('admin_correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
  ('admin_match_result_revisions(uuid)'),
  ('admin_resolve_actual_third_place_tie(uuid,uuid[],text)');

-- Contract 50: the Bonus Games hub read plus voluntary entry and withdrawal.
-- Contract 51: the shared knockout prediction store.
-- Contract 52: the bounded KO Predictor standings read.
-- Contract 53: Last Man Standing picks and the bounded LMS read.
-- Contract 54: the Predictor Cup foundation (the draw stays service-only).
-- Contract 56: the Cup Penalty Number submission (the qualification gate
-- and round settle stay service-only).
-- Contract 57: the pre-lock own-entry clear.
-- Contract 59: the bounded post-lock Original Predictor consensus read.
-- Contract 66: generic game catalogue/membership and game-scoped leagues.
insert into expected_authenticated_functions (signature) values
  ('get_bonus_games(uuid)'),
  ('register_bonus_competition(uuid)'),
  ('withdraw_bonus_competition(uuid)'),
  ('save_knockout_prediction(uuid,smallint,smallint,uuid,integer)'),
  ('delete_knockout_prediction(uuid,integer)'),
  ('get_my_knockout_predictions(uuid)'),
  ('get_ko_predictor_standings(uuid,integer,text)'),
  ('save_lms_selection(uuid,uuid,integer)'),
  ('get_my_lms(uuid)'),
  ('get_my_cup(uuid)'),
  ('submit_cup_penalty_number(uuid,uuid,smallint,integer)'),
  ('clear_my_predictions(uuid)'),
  ('get_prediction_consensus(uuid)'),
  ('get_competition_games(uuid)'),
  ('join_competition_game(uuid)'),
  ('leave_competition_game(uuid)'),
  ('create_game_league(uuid,text)'),
  ('get_my_game_leagues(uuid)');

insert into expected_service_functions (signature) values
  ('get_bonus_games(uuid)'),
  ('register_bonus_competition(uuid)'),
  ('withdraw_bonus_competition(uuid)'),
  ('save_knockout_prediction(uuid,smallint,smallint,uuid,integer)'),
  ('delete_knockout_prediction(uuid,integer)'),
  ('get_my_knockout_predictions(uuid)'),
  ('get_ko_predictor_standings(uuid,integer,text)'),
  ('save_lms_selection(uuid,uuid,integer)'),
  ('get_my_lms(uuid)'),
  ('get_my_cup(uuid)'),
  ('submit_cup_penalty_number(uuid,uuid,smallint,integer)'),
  ('admin_draw_predictor_cup(uuid,text)'),
  ('admin_finalise_predictor_cup_groups(uuid)'),
  ('admin_settle_predictor_cup_round(uuid,uuid)'),
  ('clear_my_predictions(uuid)'),
  ('get_prediction_consensus(uuid)'),
  ('get_competition_games(uuid)'),
  ('join_competition_game(uuid)'),
  ('leave_competition_game(uuid)'),
  ('create_game_league(uuid,text)'),
  ('get_my_game_leagues(uuid)'),
  ('admin_disqualify_competition_game_entry(uuid,uuid,text)');

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
  (
    select count(*)::integer
    from expected_anon_functions expected
    left join public_function_privileges actual using (signature)
    where not coalesce(actual.anon_exec, false)
  ),
  0,
  'the anonymous RPC allowlist has no missing function'
);

select is(
  (
    select count(*)::integer
    from public_function_privileges actual
    left join expected_anon_functions expected using (signature)
    where actual.anon_exec and expected.signature is null
  ),
  0,
  'anonymous users cannot execute outside the aggregate capacity allowlist'
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
  not has_function_privilege(
    'anon',
    'public.get_league_members(uuid,integer,text)',
    'execute'
  ),
  'anonymous users cannot call private league standings pagination'
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
