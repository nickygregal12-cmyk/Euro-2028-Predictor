-- Stage C1 hosted-development preflight (contract 64 before-state).
--
-- READ ONLY. The runner separately proves the linked project reference and the
-- exact repository/CLI provenance. This query fails closed unless the database
-- is the expected one-migration-behind state, then emits one canonical JSONB
-- payload for postflight comparison.

do $stage_c1_preflight_assertions$
declare
  migration_count integer;
  latest_version text;
begin
  select count(*), max(version)
    into migration_count, latest_version
  from supabase_migrations.schema_migrations;

  if migration_count <> 64 or latest_version is distinct from '20260730180000' then
    raise exception
      'Stage C1 preflight requires contract 64 through 20260730180000; found % through %',
      migration_count, latest_version;
  end if;

  if to_regclass('public.competitions') is not null
     or to_regclass('public.competition_rounds') is not null
     or to_regclass('public.competition_lock_events') is not null
     or to_regclass('public.competition_awards') is not null then
    raise exception 'Stage C1 relation already exists; refuse a contract-64 preflight';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'tournaments' and column_name = 'competition_id')
        or (table_name = 'bonus_competition_audit' and column_name = 'tournament_id')
      )
  ) then
    raise exception 'Stage C1 column already exists; refuse a partial or unknown state';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.bonus_competition_audit'::regclass
      and t.tgname = 'block_bonus_audit_mutation'
      and not t.tgisinternal
      and t.tgenabled in ('O', 'A')
  ) then
    raise exception 'block_bonus_audit_mutation is missing or disabled';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and t.tgenabled = 'D'
  ) then
    raise exception 'A public-table trigger is disabled';
  end if;

  if exists (
    select 1
    from public.tournaments
    where nullif(btrim(name), '') is null
      or year is null
      or (starts_on is not null and ends_on is not null and ends_on < starts_on)
  ) then
    raise exception 'Existing tournament identity/date data is not safe for Stage C1 backfill';
  end if;

  if (select count(*) from public.tournaments where name = 'UEFA Euro 2028' and year = 2028) <> 1 then
    raise exception 'Expected exactly one UEFA Euro 2028 season before migration';
  end if;

  if not exists (select 1 from public.bonus_competition_audit) then
    raise exception 'Hosted transition evidence requires the populated audit table';
  end if;
end
$stage_c1_preflight_assertions$;

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
  'trigger_bindings', (select payload from trigger_bindings)
) as stage_c1_preflight;
