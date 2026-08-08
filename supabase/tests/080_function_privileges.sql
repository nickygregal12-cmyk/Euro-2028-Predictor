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
  -- Contract 96: provider custody is callable only by server-side service-role
  -- code after the named Edge Function caller key has been validated.
  ('archive_provider_response(text,text,text,integer,jsonb,text,uuid)'),
  ('record_provider_response_processing(uuid,text,boolean,integer,jsonb,text,text)'),
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
  -- Contract 125. The season counterparts of the three tournament result
  -- RPCs above. Granted to `authenticated` on the same reasoning: the grant
  -- lets a signed-in caller reach the function, and require_result_admin()
  -- inside decides whether they may act.
  ('admin_confirm_season_fixture_result(uuid,smallint,smallint,text)'),
  ('admin_correct_season_fixture_result(uuid,smallint,smallint,text)'),
  ('admin_clear_season_fixture_result(uuid,text)'),
  -- Contract 127. Opening a season competition for play. Same grant shape and
  -- a DIFFERENT gate: require_competition_admin() rather than
  -- require_result_admin(), because fixing a season's draw is not correcting a
  -- scoreline.
  ('admin_open_season_competition(uuid)'),
  -- Contract 132. Initial provider calendars are browser-reachable only for
  -- authenticated competition administrators; each function enforces
  -- require_competition_admin() internally and service_role is revoked.
  ('admin_approve_initial_provider_fixtures(uuid,text,text)'),
  ('admin_reject_initial_provider_fixtures(uuid,text,text)'),
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
  ('get_my_game_leagues(uuid)'),
  -- Contract 95: the bounded season leaderboard. Deliberately NOT added to
  -- expected_service_functions below, unlike every other browser read here.
  -- The function decides who may see a season's table from `auth.uid()`, and
  -- `service_role` has none — a service_role call would refuse with
  -- 'Authentication is required' every time, so the grant would be a privilege
  -- that grants nothing while reading as though the boundary were optional.
  ('get_season_leaderboard(uuid,integer,text)'),
  -- Contract 113: the season matchweek card's bounded path. Same auth.uid()
  -- boundary as contract 95's read, so the same reasoning keeps all four out
  -- of expected_service_functions: a service_role call refuses every time.
  ('get_season_matchweek_card(uuid,integer)'),
  ('save_season_prediction(uuid,uuid,smallint,smallint,integer)'),
  ('set_season_matchweek_joker(uuid,integer,boolean)'),
  ('confirm_season_matchweek_card(uuid,integer)'),
  -- Contract 116: the season Last Man Standing round read. Same auth.uid()
  -- boundary again, so it stays out of expected_service_functions for the
  -- reason contract 95 established — service_role has no auth.uid() and the
  -- call would refuse every time.
  ('get_season_lms_round(uuid)'),
  -- Contract 120. The caller's own Championship phase and their own
  -- group's table. Browser-reachable and authenticated-only for the same
  -- reason as the LMS round read above: it is scoped to the caller's own
  -- membership, and a non-entrant is told so rather than shown anything.
  ('get_season_cup_phase(uuid)'),
  -- Contract 133: caller-owned Championship discovery and explicit selected-instance
  -- player view. Both resolve auth.uid() and therefore remain authenticated-only,
  -- matching the Contract 120 phase read rather than gaining a service-role grant.
  ('get_my_season_cup_instances(uuid)'),
  ('get_season_cup_player_view(uuid)'),
  -- Contract 121: which matchweek a season's card opens at. It carries the
  -- same auth.uid() boundary as every season read above, so it stays out of
  -- expected_service_functions for contract 95's reason — service_role has no
  -- auth.uid() and the call refuses every time.
  ('get_season_play_context(text,text)'),
  -- Contract 122: the monthly and form tables. Same entry boundary as contract
  -- 95's cumulative read, and the same reason it is authenticated-only: a
  -- season is not the one competition everybody is in.
  -- Contract 131 replaces this read's reachable signature with a four-argument
  -- one carrying the required display-name flag. The three-argument form is
  -- left in the catalogue — dropping it would make the migration destructive —
  -- and REVOKED, so it appears in no allow-list here.
  ('get_season_period_standings(uuid,text,integer,boolean)'),
  -- Contract 129: the caller and one opponent over one locked matchweek.
  -- Contract 130: what everybody predicted for that matchweek, once its cohort
  -- is large enough. Both carry the same auth.uid() boundary as every season
  -- read above, so both stay out of expected_service_functions.
  ('get_season_head_to_head(uuid,uuid,integer)'),
  ('get_season_prediction_consensus(uuid,integer)'),
  -- Contract 128: a season league's own table. The boundary is league
  -- membership read from auth.uid(), so it stays out of
  -- expected_service_functions for contract 95's reason — service_role has no
  -- auth.uid() and the call refuses every time.
  ('get_season_league_standings(uuid,integer,text)');

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
