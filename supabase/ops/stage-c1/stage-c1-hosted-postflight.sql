-- Stage C1 hosted-development postflight (contract 65 after-state).
--
-- The assertions below are database-local and fail closed. The committed runner
-- then compares the emitted preservation snapshots with the canonical preflight
-- artifact captured immediately before migration.

do $stage_c1_postflight_assertions$
declare
  migration_count integer;
  latest_version text;
  public_trigger_count integer;
  season_scope_trigger_count integer;
  audit_row_id uuid;
begin
  select count(*), max(version)
    into migration_count, latest_version
  from supabase_migrations.schema_migrations;

  if migration_count <> 65 or latest_version is distinct from '20260730235602' then
    raise exception
      'Stage C1 postflight requires contract 65 through 20260730235602; found % through %',
      migration_count, latest_version;
  end if;

  if (
    select count(*)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in (
        'competitions', 'competition_rounds',
        'competition_lock_events', 'competition_awards'
      )
      and c.relrowsecurity
  ) <> 4 then
    raise exception 'All four Stage C1 relations must exist with RLS enabled';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'competitions', 'competition_rounds',
        'competition_lock_events', 'competition_awards'
      )
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'Stage C1 relations unexpectedly expose a direct browser grant';
  end if;

  if (select count(*) from public.competitions where slug = 'uefa-euro') <> 1 then
    raise exception 'Expected exactly one recurring UEFA European Championship parent';
  end if;

  if (
    select count(*)
    from public.tournaments t
    join public.competitions c on c.id = t.competition_id
    where t.name = 'UEFA Euro 2028'
      and t.year = 2028
      and c.slug = 'uefa-euro'
      and c.name = 'UEFA European Championship'
      and t.season_key = '2028'
      and t.kind = 'tournament'
      and t.display_timezone = 'Europe/London'
      and t.status in ('scheduled', 'active', 'complete', 'archived')
  ) <> 1 then
    raise exception 'Euro 2028 competition-season identity is not the expected Stage C1 shape';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'tournament_id'
      and data_type = 'uuid'
      and is_nullable = 'NO'
  ) <> 33 then
    raise exception 'Expected exactly 33 direct non-null UUID tournament_id columns';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    join pg_catalog.pg_class relation on relation.oid = constraint_row.conrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and constraint_row.contype = 'f'
      and not constraint_row.convalidated
  ) then
    raise exception 'A public foreign key remains unvalidated';
  end if;

  if exists (
    select 1
    from public.bonus_competition_audit audit_row
    left join public.bonus_competitions competition
      on competition.id = audit_row.competition_id
    where competition.id is null
      or audit_row.tournament_id is distinct from competition.tournament_id
  ) then
    raise exception 'Audit season scope is missing or differs from its competition parent';
  end if;

  select count(*)
    into public_trigger_count
  from pg_catalog.pg_trigger trigger_row
  join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public' and not trigger_row.tgisinternal;

  if public_trigger_count <> 68 then
    raise exception 'Expected 68 reviewed public-table triggers; found %', public_trigger_count;
  end if;

  select count(*)
    into season_scope_trigger_count
  from pg_catalog.pg_trigger trigger_row
  join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join pg_catalog.pg_proc function_row on function_row.oid = trigger_row.tgfoid
  join pg_catalog.pg_namespace function_namespace on function_namespace.oid = function_row.pronamespace
  where namespace.nspname = 'public'
    and not trigger_row.tgisinternal
    and function_namespace.nspname = 'predictor_internal'
    and function_row.proname = 'prepare_competition_season_scope'
    and trigger_row.tgenabled = 'A';

  if season_scope_trigger_count <> 18 then
    raise exception 'Expected 18 ENABLE ALWAYS season-scope triggers; found %', season_scope_trigger_count;
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled = 'D'
  ) then
    raise exception 'A public-table trigger is disabled';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public'
      and function_row.proname in (
        'enforce_entry_lock_generic',
        'enforce_entry_lock_scores',
        'enforce_joker_rules'
      )
      and function_row.pronargs = 0
      and not function_row.prosecdef
      and coalesce(function_row.proconfig, array[]::text[]) @> array['search_path=""']
      and pg_catalog.pg_get_functiondef(function_row.oid) not ilike '%session_user%'
  ) <> 3 then
    raise exception 'The three Stage C1 lock guards are not exact pinned-path security invokers';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'public'
      and function_row.proname = 'enforce_entry_lock_generic'
      and function_row.pronargs = 0
      and not function_row.prosecdef
      and coalesce(function_row.proconfig, array[]::text[]) @> array['search_path=""']
      and pg_catalog.pg_get_functiondef(function_row.oid) not ilike '%session_user%'
  ) then
    raise exception 'enforce_entry_lock_generic is not the trusted contract-65 invoker definition';
  end if;

  if (
    select count(*)
    from pg_catalog.pg_proc function_row
    join pg_catalog.pg_namespace namespace on namespace.oid = function_row.pronamespace
    where namespace.nspname = 'predictor_internal'
      and function_row.proname in (
        'prepare_tournament_season',
        'prevent_competition_identity_change',
        'prepare_match_season_scope',
        'validate_match_reference_scope',
        'prevent_lock_event_mutation',
        'record_tournament_lock_transition',
        'record_match_lock_transition',
        'validate_competition_award_scope',
        'prepare_competition_season_scope'
      )
      and function_row.prosecdef
      and coalesce(function_row.proconfig, array[]::text[]) @> array['search_path=""']
  ) <> 9 then
    raise exception 'A Stage C1 security-definer function lacks its exact empty search_path';
  end if;

  select id into audit_row_id
  from public.bonus_competition_audit
  order by id
  limit 1;
  if audit_row_id is null then
    raise exception 'Hosted transition evidence requires the populated audit table';
  end if;

  begin
    update public.bonus_competition_audit set action = action where id = audit_row_id;
    raise exception 'Audit UPDATE unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;

  begin
    delete from public.bonus_competition_audit where id = audit_row_id;
    raise exception 'Audit DELETE unexpectedly succeeded';
  exception
    when sqlstate '42501' then null;
  end;
end
$stage_c1_postflight_assertions$;

with
audit_canonical as (
  select
    count(*)::bigint as row_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'competition_id', competition_id,
          'action', action,
          'detail', detail,
          'actor_id', actor_id,
          'recorded_at_utc', to_char(
            recorded_at at time zone 'UTC',
            'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
          )
        ) order by id
      ),
      '[]'::jsonb
    ) as payload
  from public.bonus_competition_audit
),
preservation_counts(relation_name, row_count) as (
  values
    ('actual_third_place_resolution_revisions', (select count(*) from public.actual_third_place_resolution_revisions)),
    ('actual_third_place_resolutions', (select count(*) from public.actual_third_place_resolutions)),
    ('bonus_competition_audit', (select count(*) from public.bonus_competition_audit)),
    ('bonus_competition_entrants', (select count(*) from public.bonus_competition_entrants)),
    ('bonus_competition_windows', (select count(*) from public.bonus_competition_windows)),
    ('bonus_competitions', (select count(*) from public.bonus_competitions)),
    ('bonus_cup_fixtures', (select count(*) from public.bonus_cup_fixtures)),
    ('bonus_cup_groups', (select count(*) from public.bonus_cup_groups)),
    ('bonus_cup_members', (select count(*) from public.bonus_cup_members)),
    ('bonus_cup_penalty_numbers', (select count(*) from public.bonus_cup_penalty_numbers)),
    ('bonus_knockout_predictions', (select count(*) from public.bonus_knockout_predictions)),
    ('bonus_lms_selections', (select count(*) from public.bonus_lms_selections)),
    ('bonus_predictions', (select count(*) from public.bonus_predictions)),
    ('bonus_score_events', (select count(*) from public.bonus_score_events)),
    ('bonus_window_fixtures', (select count(*) from public.bonus_window_fixtures)),
    ('entries', (select count(*) from public.entries)),
    ('entry_automatic_submission_outcomes', (select count(*) from public.entry_automatic_submission_outcomes)),
    ('group_teams', (select count(*) from public.group_teams)),
    ('groups', (select count(*) from public.groups)),
    ('league_members', (select count(*) from public.league_members)),
    ('leagues', (select count(*) from public.leagues)),
    ('match_predictions', (select count(*) from public.match_predictions)),
    ('match_result_revisions', (select count(*) from public.match_result_revisions)),
    ('matches', (select count(*) from public.matches)),
    ('players', (select count(*) from public.players)),
    ('predicted_group_positions', (select count(*) from public.predicted_group_positions)),
    ('predicted_progression', (select count(*) from public.predicted_progression)),
    ('predicted_tie_resolutions', (select count(*) from public.predicted_tie_resolutions)),
    ('profiles', (select count(*) from public.profiles)),
    ('rank_history', (select count(*) from public.rank_history)),
    ('rate_limit_events', (select count(*) from public.rate_limit_events)),
    ('score_events', (select count(*) from public.score_events)),
    ('teams', (select count(*) from public.teams)),
    ('tournaments', (select count(*) from public.tournaments))
),
auth_foreign_keys as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', source_table.relname,
    'column', source_attribute.attname,
    'delete_action', case constraint_row.confdeltype
      when 'a' then 'restrict'
      when 'r' then 'restrict'
      when 'c' then 'cascade'
      when 'n' then 'set null'
      when 'd' then 'set default'
    end
  ) order by source_table.relname, source_attribute.attname), '[]'::jsonb) as payload
  from pg_catalog.pg_constraint constraint_row
  join pg_catalog.pg_class source_table on source_table.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace source_namespace on source_namespace.oid = source_table.relnamespace
  join pg_catalog.pg_class target_table on target_table.oid = constraint_row.confrelid
  join pg_catalog.pg_namespace target_namespace on target_namespace.oid = target_table.relnamespace
  join lateral unnest(constraint_row.conkey) with ordinality source_key(attnum, position) on true
  join pg_catalog.pg_attribute source_attribute
    on source_attribute.attrelid = source_table.oid and source_attribute.attnum = source_key.attnum
  where constraint_row.contype = 'f'
    and source_namespace.nspname = 'public'
    and target_namespace.nspname = 'auth'
    and target_table.relname = 'users'
),
ownership_policies as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'name', policyname,
    'command', cmd,
    'permissive', permissive,
    'roles', roles,
    'using', qual,
    'check', with_check
  ) order by tablename, policyname), '[]'::jsonb) as payload
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and (coalesce(qual, '') ilike '%auth.uid()%'
      or coalesce(with_check, '') ilike '%auth.uid()%')
),
browser_grants as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'grantee', grantee,
    'table', table_name,
    'privilege', privilege_type
  ) order by grantee, table_name, privilege_type), '[]'::jsonb) as payload
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon', 'authenticated')
),
rls_state as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'enabled', c.relrowsecurity,
    'forced', c.relforcerowsecurity
  ) order by c.relname), '[]'::jsonb) as payload
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
),
function_security as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text,
    'owner', owner_role.rolname,
    'security_definer', p.prosecdef,
    'configuration', coalesce(to_jsonb(p.proconfig), '[]'::jsonb)
  ) order by p.oid::regprocedure::text), '[]'::jsonb) as payload
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  join pg_catalog.pg_roles owner_role on owner_role.oid = p.proowner
  where n.nspname in ('public', 'predictor_internal')
),
trigger_bindings as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'table', c.relname,
    'trigger', t.tgname,
    'function', p.oid::regprocedure::text,
    'enabled', t.tgenabled
  ) order by c.relname, t.tgname), '[]'::jsonb) as payload
  from pg_catalog.pg_trigger t
  join pg_catalog.pg_class c on c.oid = t.tgrelid
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  join pg_catalog.pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public' and not t.tgisinternal
)
select jsonb_build_object(
  'contract', jsonb_build_object(
    'count', (select count(*) from supabase_migrations.schema_migrations),
    'latest_version', (select max(version) from supabase_migrations.schema_migrations),
    'latest_name', (
      select name from supabase_migrations.schema_migrations order by version desc limit 1
    )
  ),
  'audit', jsonb_build_object(
    'row_count', (select row_count from audit_canonical),
    'digest', (select encode(
      extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex'
    ) from audit_canonical)
  ),
  'preservation_counts', (
    select jsonb_object_agg(relation_name, row_count order by relation_name)
    from preservation_counts
  ),
  'euro_2028', (
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'year', year,
      'starts_on', starts_on,
      'ends_on', ends_on,
      'lock_at', lock_at
    ) order by id)
    from public.tournaments where name = 'UEFA Euro 2028' and year = 2028
  ),
  'auth_foreign_keys', (select payload from auth_foreign_keys),
  'ownership_policies', (select payload from ownership_policies),
  'browser_grants', (select payload from browser_grants),
  'rls_state', (select payload from rls_state),
  'function_security', (select payload from function_security),
  'trigger_bindings', (select payload from trigger_bindings),
  'stage_c1', jsonb_build_object(
    'direct_scope_columns', (
      select count(*) from information_schema.columns
      where table_schema = 'public'
        and column_name = 'tournament_id'
        and data_type = 'uuid'
        and is_nullable = 'NO'
    ),
    'public_trigger_bindings', (
      select count(*)
      from pg_catalog.pg_trigger trigger_row
      join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public' and not trigger_row.tgisinternal
    ),
    'disabled_public_triggers', (
      select count(*)
      from pg_catalog.pg_trigger trigger_row
      join pg_catalog.pg_class relation on relation.oid = trigger_row.tgrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and not trigger_row.tgisinternal
        and trigger_row.tgenabled = 'D'
    ),
    'unvalidated_public_foreign_keys', (
      select count(*)
      from pg_catalog.pg_constraint constraint_row
      join pg_catalog.pg_class relation on relation.oid = constraint_row.conrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and constraint_row.contype = 'f'
        and not constraint_row.convalidated
    ),
    'audit_scope_mismatches', (
      select count(*)
      from public.bonus_competition_audit audit_row
      left join public.bonus_competitions competition
        on competition.id = audit_row.competition_id
      where competition.id is null
        or audit_row.tournament_id is distinct from competition.tournament_id
    )
  )
) as stage_c1_postflight;
