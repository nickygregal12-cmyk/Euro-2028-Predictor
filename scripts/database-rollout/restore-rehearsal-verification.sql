-- Euro 2028 Predictor — restore-rehearsal verification (counts only)
--
-- READ-ONLY. Run against the DISPOSABLE restored copy of a production logical
-- backup, never against production or development. Output contains migration
-- history identity and row counts only — never emails, display names or any
-- row contents — so it is safe for CI logs and job summaries.
--
-- Required psql variables:
--   -v expected_migration_count=<count>
--   -v expected_latest_version=<14-digit migration timestamp>
--   -v expected_latest_name=<migration name>
--
-- Do not copy literal values into a caller. Derive them from committed
-- authority with `node scripts/deployment-contract-expectations.mjs`, as
-- .github/workflows/production-backup.yml does; a hand-maintained expectation
-- drifts behind config/deployment-contract.json and fails this check.

\o /dev/null
select set_config('rehearsal.expected_migration_count', :'expected_migration_count', false);
select set_config('rehearsal.expected_latest_version', :'expected_latest_version', false);
select set_config('rehearsal.expected_latest_name', :'expected_latest_name', false);
\o

do $verify_restored_migration_history$
declare
  expected_count integer := current_setting('rehearsal.expected_migration_count')::integer;
  expected_version text := current_setting('rehearsal.expected_latest_version');
  expected_name text := current_setting('rehearsal.expected_latest_name');
  actual_count integer;
  actual_version text;
  actual_name text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception
      'Restored copy has no supabase_migrations.schema_migrations table';
  end if;

  select count(*) into actual_count
  from supabase_migrations.schema_migrations;

  select version, name
    into actual_version, actual_name
  from supabase_migrations.schema_migrations
  order by version desc
  limit 1;

  if actual_count <> expected_count then
    raise exception
      'Restored migration history has % versions; expected %',
      actual_count, expected_count;
  end if;

  if actual_version is distinct from expected_version
     or actual_name is distinct from expected_name then
    raise exception
      'Restored latest migration is % / %; expected % / %',
      actual_version, actual_name, expected_version, expected_name;
  end if;
end
$verify_restored_migration_history$;

select jsonb_pretty(jsonb_build_object(
  'restored_migration_history', jsonb_build_object(
    'count', (select count(*) from supabase_migrations.schema_migrations),
    'latest_version', (select max(version) from supabase_migrations.schema_migrations),
    'latest_name', (
      select name
      from supabase_migrations.schema_migrations
      order by version desc
      limit 1
    )
  ),
  'counts', jsonb_build_object(
    'auth_users', (select count(*) from auth.users),
    'profiles', (select count(*) from public.profiles),
    'entries', (select count(*) from public.entries),
    'submitted_entries', (select count(*) from public.entries where submitted_at is not null),
    'match_predictions', (select count(*) from public.match_predictions),
    'tie_resolutions', (select count(*) from public.predicted_tie_resolutions),
    'progression_rows', (select count(*) from public.predicted_progression),
    'matches_with_scores', (
      select count(*)
      from public.matches
      where home_score is not null or away_score is not null
    ),
    'storage_buckets', case
      when to_regclass('storage.buckets') is null then null
      else (select count(*) from storage.buckets)
    end,
    'storage_objects', case
      when to_regclass('storage.objects') is null then null
      else (select count(*) from storage.objects)
    end
  )
)) as restore_rehearsal_verification;
