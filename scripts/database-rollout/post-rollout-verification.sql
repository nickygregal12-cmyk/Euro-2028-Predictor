-- Euro 2028 Predictor — migrations 21–35 post-rollout verification
--
-- READ-ONLY. Run after a hosted rollout. Any unexpected false value is a stop
-- condition for lifting the deployment/write freeze.

with submitted_all as (
  select e.id, e.tournament_id, e.submitted_at
  from public.entries e
  where e.submitted_at is not null
), submitted as (
  select * from submitted_all order by submitted_at limit 1
), prediction_rows as (
  select m.match_ref, mp.home_score, mp.away_score, mp.joker
  from submitted s
  join public.match_predictions mp on mp.entry_id = s.id
  join public.matches m on m.id = mp.match_id
), progression_rows as (
  select tm.name, pp.stage
  from submitted s
  join public.predicted_progression pp on pp.entry_id = s.id
  join public.teams tm on tm.id = pp.team_id
), tie_rows as (
  select
    ptr.scope,
    array_to_string(array(
      select coalesce(g.letter, '?') || ':' || tm.name
      from unnest(ptr.ordered_team_ids) with ordinality u(team_id, ord)
      join public.teams tm on tm.id = u.team_id
      left join public.group_teams gt on gt.team_id = tm.id
      left join public.groups g on g.id = gt.group_id
      order by u.ord
    ), ',') as ordered_names
  from submitted s
  join public.predicted_tie_resolutions ptr on ptr.entry_id = s.id
), fingerprints as (
  select
    (
      select md5(coalesce(string_agg(
        match_ref || ':' || home_score || ':' || away_score || ':' || joker,
        '|' order by match_ref
      ), ''))
      from prediction_rows
    ) as predictions,
    (
      select md5(coalesce(string_agg(
        scope || ':' || ordered_names,
        '|' order by scope, ordered_names
      ), ''))
      from tie_rows
    ) as ties,
    (
      select md5(coalesce(string_agg(
        name || ':' || stage,
        '|' order by name
      ), ''))
      from progression_rows
    ) as progression
), public_functions as (
  select
    p.oid::regprocedure::text as signature,
    p.proconfig,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec,
    has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
), expected_authenticated_functions(signature) as (
  values
    ('create_league(uuid,text)'),
    ('delete_league(uuid)'),
    ('delete_match_prediction(uuid,uuid,integer)'),
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
    ('transfer_ownership(uuid,uuid)')
), expected_service_functions(signature) as (
  select signature from expected_authenticated_functions
  union all values
    ('capture_rank_history(uuid)'),
    ('clear_match_result(uuid,text)'),
    ('confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
    ('correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)'),
    ('recompute_all_scores()'),
    ('recompute_tournament_scores(uuid)')
), function_acl_checks as (
  select
    (select count(*) = 0 from public_functions where anon_exec)
      as anon_function_execution_denied,
    (
      select count(*) = 0
      from expected_authenticated_functions e
      left join public_functions f using (signature)
      where not coalesce(f.authenticated_exec, false)
    ) as authenticated_allowlist_complete,
    (
      select count(*) = 0
      from public_functions f
      left join expected_authenticated_functions e using (signature)
      where f.authenticated_exec and e.signature is null
    ) as authenticated_allowlist_exact,
    (
      select count(*) = 0
      from expected_service_functions e
      left join public_functions f using (signature)
      where not coalesce(f.service_exec, false)
    ) as service_allowlist_complete,
    (
      select count(*) = 0
      from public_functions f
      left join expected_service_functions e using (signature)
      where f.service_exec and e.signature is null
    ) as service_allowlist_exact,
    (
      select proconfig::text = '{"search_path=\"\""}'
      from public_functions where signature = 'gen_invite_code()'
    ) as invite_code_search_path_fixed,
    (
      select proconfig::text = '{"search_path=\"\""}'
      from public_functions where signature = '_stage_ord(text)'
    ) as stage_ord_search_path_fixed,
    (
      select proconfig::text = '{"search_path=\"\""}'
      from public_functions where signature = 'enforce_write_version()'
    ) as write_version_search_path_fixed,
    (
      select defaclacl::text = '{postgres=X/postgres}'
      from pg_default_acl
      where defaclrole = 'postgres'::regrole
        and defaclnamespace = 'public'::regnamespace
        and defaclobjtype = 'f'
    ) as future_functions_owner_only
), privilege_checks as (
  select
    not has_schema_privilege('anon', 'predictor_internal', 'USAGE')
      as anon_private_schema_denied,
    not has_schema_privilege('authenticated', 'predictor_internal', 'USAGE')
      as auth_private_schema_denied,
    not has_table_privilege('authenticated', 'public.entries', 'UPDATE')
      as auth_entry_update_denied,
    not has_table_privilege('authenticated', 'public.entries', 'DELETE')
      as auth_entry_delete_denied,
    not has_table_privilege('authenticated', 'public.match_predictions', 'DELETE')
      as auth_match_prediction_delete_denied,
    not has_table_privilege('service_role', 'public.match_predictions', 'DELETE')
      as service_match_prediction_delete_denied,
    not has_table_privilege('authenticated', 'public.predicted_group_positions', 'INSERT')
      as auth_position_insert_denied,
    not has_table_privilege('authenticated', 'public.predicted_group_positions', 'UPDATE')
      as auth_position_update_denied,
    not has_table_privilege('authenticated', 'public.predicted_group_positions', 'DELETE')
      as auth_position_delete_denied,
    not has_table_privilege('authenticated', 'public.predicted_progression', 'INSERT')
      as auth_progression_insert_denied,
    not has_table_privilege('authenticated', 'public.predicted_progression', 'UPDATE')
      as auth_progression_update_denied,
    not has_table_privilege('authenticated', 'public.predicted_progression', 'DELETE')
      as auth_progression_delete_denied,
    has_function_privilege(
      'authenticated',
      'public.delete_match_prediction(uuid,uuid,integer)',
      'EXECUTE'
    ) as auth_match_prediction_delete_rpc_allowed,
    not has_function_privilege(
      'anon',
      'public.delete_match_prediction(uuid,uuid,integer)',
      'EXECUTE'
    ) as anon_match_prediction_delete_rpc_denied,
    has_function_privilege(
      'authenticated',
      'public.replace_predicted_progression(uuid,jsonb,jsonb)',
      'EXECUTE'
    ) as auth_atomic_rpc_allowed,
    not has_function_privilege(
      'anon',
      'public.replace_predicted_progression(uuid,jsonb,jsonb)',
      'EXECUTE'
    ) as anon_atomic_rpc_denied,
    not has_function_privilege(
      'anon',
      'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as anon_result_confirm_denied,
    not has_function_privilege(
      'anon',
      'public.correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as anon_result_correct_denied,
    not has_function_privilege(
      'anon',
      'public.clear_match_result(uuid,text)',
      'EXECUTE'
    ) as anon_result_clear_denied,
    not has_function_privilege(
      'authenticated',
      'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as auth_result_confirm_denied,
    not has_function_privilege(
      'authenticated',
      'public.correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as auth_result_correct_denied,
    not has_function_privilege(
      'authenticated',
      'public.clear_match_result(uuid,text)',
      'EXECUTE'
    ) as auth_result_clear_denied,
    has_function_privilege(
      'service_role',
      'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as service_result_confirm_allowed,
    has_function_privilege(
      'service_role',
      'public.correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as service_result_correct_allowed,
    has_function_privilege(
      'service_role',
      'public.clear_match_result(uuid,text)',
      'EXECUTE'
    ) as service_result_clear_allowed,
    not has_table_privilege('anon', 'public.match_result_revisions', 'SELECT')
      and not has_table_privilege('anon', 'public.match_result_revisions', 'INSERT')
      and not has_table_privilege('anon', 'public.match_result_revisions', 'UPDATE')
      and not has_table_privilege('anon', 'public.match_result_revisions', 'DELETE')
      as anon_revision_all_denied,
    not has_table_privilege('authenticated', 'public.match_result_revisions', 'SELECT')
      and not has_table_privilege('authenticated', 'public.match_result_revisions', 'INSERT')
      and not has_table_privilege('authenticated', 'public.match_result_revisions', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.match_result_revisions', 'DELETE')
      as auth_revision_all_denied,
    not has_table_privilege('service_role', 'public.match_result_revisions', 'SELECT')
      and not has_table_privilege('service_role', 'public.match_result_revisions', 'INSERT')
      and not has_table_privilege('service_role', 'public.match_result_revisions', 'UPDATE')
      and not has_table_privilege('service_role', 'public.match_result_revisions', 'DELETE')
      as service_revision_all_denied
), object_checks as (
  select
    exists(select 1 from pg_namespace where nspname = 'predictor_internal')
      as private_schema_exists,
    to_regprocedure('predictor_internal.resolve_predicted_group_order(jsonb,jsonb,jsonb)') is not null
      as resolver_exists,
    to_regprocedure('predictor_internal.validate_entry_submission_snapshot(uuid,boolean)') is not null
      as submission_validator_exists,
    to_regprocedure('predictor_internal.validate_predicted_bracket_tree(uuid)') is not null
      as bracket_validator_exists,
    to_regprocedure('public.delete_match_prediction(uuid,uuid,integer)') is not null
      as match_prediction_delete_rpc_exists,
    to_regprocedure('public.replace_predicted_progression(uuid,jsonb,jsonb)') is not null
      as atomic_rpc_exists,
    to_regprocedure('public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)') is not null
      as confirm_result_exists,
    to_regprocedure('public.correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)') is not null
      as correct_result_exists,
    to_regprocedure('public.clear_match_result(uuid,text)') is not null
      as clear_result_exists,
    (
      select count(*) = 13
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'matches'
        and column_name in (
          'result_state', 'result_method',
          'home_score_90', 'away_score_90',
          'home_score_120', 'away_score_120',
          'home_penalties', 'away_penalties',
          'winner_team_id', 'result_version',
          'confirmed_at', 'corrected_at', 'last_result_reason'
        )
    ) as result_columns_exist
), data_checks as (
  select
    (select count(*) = 1 from submitted_all)
      as exactly_one_submitted_entry_preserved,
    (
      select submitted_at = '2026-07-21 21:51:49.639442+00'::timestamptz
      from submitted
    ) as submitted_timestamp_preserved,
    (
      select predictions = '8d76619fe4b44fdac17de1cc2afe5aaa'
         and ties = 'a4dcf183f5c48e3ba11ff75c59622598'
         and progression = '0d7bc491daa9b24013204d061a2d38f1'
      from fingerprints
    ) as rehearsed_payload_preserved,
    (
      select count(*) = 24
      from submitted s
      join public.predicted_group_positions pgp on pgp.entry_id = s.id
    ) as derived_positions_complete,
    (
      select count(*) = 8
         and count(*) filter (where pp.stage = 'qf') = 4
         and count(*) filter (where pp.stage = 'sf') = 2
         and count(*) filter (where pp.stage = 'final') = 1
         and count(*) filter (where pp.stage = 'champion') = 1
      from submitted s
      join public.predicted_progression pp on pp.entry_id = s.id
    ) as progression_preserved,
    (
      select count(*) = 0
      from submitted s
      join public.matches m on m.tournament_id = s.tournament_id
      where m.result_state <> 'scheduled'
         or m.home_score is not null
         or m.away_score is not null
    ) as no_result_invented,
    (select count(*) = 0 from public.match_result_revisions)
      as no_revision_invented,
    (select count(*) = 0 from public.score_events)
      as score_events_preserved,
    (select count(*) = 0 from public.rank_history)
      as rank_history_preserved,
    (
      select predictor_internal.validate_entry_submission_snapshot(s.id, false)
             = s.tournament_id
      from submitted s
    ) as submission_snapshot_valid,
    (
      select predictor_internal.validate_predicted_bracket_tree(s.id)
      from submitted s
    ) as bracket_tree_valid,
    (
      select count(*) = 8
      from submitted s,
      lateral predictor_internal.predicted_round_of_16(s.id)
    ) as r16_resolves
)
select jsonb_build_object(
  'objects', to_jsonb(object_checks),
  'privileges', to_jsonb(privilege_checks),
  'function_acl', to_jsonb(function_acl_checks),
  'data', to_jsonb(data_checks),
  'rollout_guard_fingerprints', (select to_jsonb(fingerprints) from fingerprints),
  'overall_pass',
    object_checks.private_schema_exists
    and object_checks.resolver_exists
    and object_checks.submission_validator_exists
    and object_checks.bracket_validator_exists
    and object_checks.match_prediction_delete_rpc_exists
    and object_checks.atomic_rpc_exists
    and object_checks.confirm_result_exists
    and object_checks.correct_result_exists
    and object_checks.clear_result_exists
    and object_checks.result_columns_exist
    and privilege_checks.anon_private_schema_denied
    and privilege_checks.auth_private_schema_denied
    and privilege_checks.auth_entry_update_denied
    and privilege_checks.auth_entry_delete_denied
    and privilege_checks.auth_match_prediction_delete_denied
    and privilege_checks.service_match_prediction_delete_denied
    and privilege_checks.auth_position_insert_denied
    and privilege_checks.auth_position_update_denied
    and privilege_checks.auth_position_delete_denied
    and privilege_checks.auth_progression_insert_denied
    and privilege_checks.auth_progression_update_denied
    and privilege_checks.auth_progression_delete_denied
    and privilege_checks.auth_match_prediction_delete_rpc_allowed
    and privilege_checks.anon_match_prediction_delete_rpc_denied
    and privilege_checks.auth_atomic_rpc_allowed
    and privilege_checks.anon_atomic_rpc_denied
    and privilege_checks.anon_result_confirm_denied
    and privilege_checks.anon_result_correct_denied
    and privilege_checks.anon_result_clear_denied
    and privilege_checks.auth_result_confirm_denied
    and privilege_checks.auth_result_correct_denied
    and privilege_checks.auth_result_clear_denied
    and privilege_checks.service_result_confirm_allowed
    and privilege_checks.service_result_correct_allowed
    and privilege_checks.service_result_clear_allowed
    and privilege_checks.anon_revision_all_denied
    and privilege_checks.auth_revision_all_denied
    and privilege_checks.service_revision_all_denied
    and function_acl_checks.anon_function_execution_denied
    and function_acl_checks.authenticated_allowlist_complete
    and function_acl_checks.authenticated_allowlist_exact
    and function_acl_checks.service_allowlist_complete
    and function_acl_checks.service_allowlist_exact
    and function_acl_checks.invite_code_search_path_fixed
    and function_acl_checks.stage_ord_search_path_fixed
    and function_acl_checks.write_version_search_path_fixed
    and function_acl_checks.future_functions_owner_only
    and data_checks.exactly_one_submitted_entry_preserved
    and data_checks.submitted_timestamp_preserved
    and data_checks.rehearsed_payload_preserved
    and data_checks.derived_positions_complete
    and data_checks.progression_preserved
    and data_checks.no_result_invented
    and data_checks.no_revision_invented
    and data_checks.score_events_preserved
    and data_checks.rank_history_preserved
    and data_checks.submission_snapshot_valid
    and data_checks.bracket_tree_valid
    and data_checks.r16_resolves
) as post_rollout_verification
from object_checks, privilege_checks, function_acl_checks, data_checks;
