-- Euro 2028 Predictor — migrations 21–33 post-rollout verification
--
-- READ-ONLY. Run after a hosted rollout. Any unexpected false value is a stop
-- condition for lifting the deployment/write freeze.

with submitted as (
  select e.id, e.tournament_id, e.submitted_at
  from public.entries e
  where e.submitted_at is not null
  order by e.submitted_at
  limit 1
), privilege_checks as (
  select
    not has_schema_privilege('anon', 'predictor_internal', 'USAGE') as anon_private_schema_denied,
    not has_schema_privilege('authenticated', 'predictor_internal', 'USAGE') as auth_private_schema_denied,
    not has_table_privilege('authenticated', 'public.entries', 'UPDATE') as auth_entry_update_denied,
    not has_table_privilege('authenticated', 'public.predicted_group_positions', 'INSERT') as auth_position_insert_denied,
    not has_table_privilege('authenticated', 'public.predicted_group_positions', 'UPDATE') as auth_position_update_denied,
    not has_table_privilege('authenticated', 'public.predicted_progression', 'INSERT') as auth_progression_insert_denied,
    not has_table_privilege('authenticated', 'public.predicted_progression', 'UPDATE') as auth_progression_update_denied,
    not has_table_privilege('authenticated', 'public.predicted_progression', 'DELETE') as auth_progression_delete_denied,
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
      'authenticated',
      'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as auth_result_confirm_denied,
    has_function_privilege(
      'service_role',
      'public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)',
      'EXECUTE'
    ) as service_result_confirm_allowed,
    not has_table_privilege('service_role', 'public.match_result_revisions', 'SELECT') as service_revision_select_denied,
    not has_table_privilege('service_role', 'public.match_result_revisions', 'INSERT') as service_revision_insert_denied
), object_checks as (
  select
    exists(select 1 from pg_namespace where nspname = 'predictor_internal') as private_schema_exists,
    to_regprocedure('predictor_internal.resolve_predicted_group_order(jsonb,jsonb,jsonb)') is not null as resolver_exists,
    to_regprocedure('predictor_internal.validate_entry_submission_snapshot(uuid,boolean)') is not null as submission_validator_exists,
    to_regprocedure('predictor_internal.validate_predicted_bracket_tree(uuid)') is not null as bracket_validator_exists,
    to_regprocedure('public.replace_predicted_progression(uuid,jsonb,jsonb)') is not null as atomic_rpc_exists,
    to_regprocedure('public.confirm_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)') is not null as confirm_result_exists,
    to_regprocedure('public.correct_match_result(uuid,text,smallint,smallint,smallint,smallint,smallint,smallint,text)') is not null as correct_result_exists,
    to_regprocedure('public.clear_match_result(uuid,text)') is not null as clear_result_exists,
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
    (select count(*) from submitted) = 1 as submitted_entry_preserved,
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
  'data', to_jsonb(data_checks),
  'overall_pass',
    object_checks.private_schema_exists
    and object_checks.resolver_exists
    and object_checks.submission_validator_exists
    and object_checks.bracket_validator_exists
    and object_checks.atomic_rpc_exists
    and object_checks.confirm_result_exists
    and object_checks.correct_result_exists
    and object_checks.clear_result_exists
    and object_checks.result_columns_exist
    and privilege_checks.anon_private_schema_denied
    and privilege_checks.auth_private_schema_denied
    and privilege_checks.auth_entry_update_denied
    and privilege_checks.auth_position_insert_denied
    and privilege_checks.auth_position_update_denied
    and privilege_checks.auth_progression_insert_denied
    and privilege_checks.auth_progression_update_denied
    and privilege_checks.auth_progression_delete_denied
    and privilege_checks.auth_atomic_rpc_allowed
    and privilege_checks.anon_atomic_rpc_denied
    and privilege_checks.auth_result_confirm_denied
    and privilege_checks.service_result_confirm_allowed
    and privilege_checks.service_revision_select_denied
    and privilege_checks.service_revision_insert_denied
    and data_checks.submitted_entry_preserved
    and data_checks.derived_positions_complete
    and data_checks.progression_preserved
    and data_checks.no_result_invented
    and data_checks.submission_snapshot_valid
    and data_checks.bracket_tree_valid
    and data_checks.r16_resolves
) as post_rollout_verification
from object_checks, privilege_checks, data_checks;
