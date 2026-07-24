-- Euro 2028 Predictor — production logical-backup inventory
--
-- READ-ONLY. Run through psql against the explicitly verified production
-- database before creating a logical backup. The single JSON value is retained
-- in the backup bundle as source-state evidence.

select jsonb_pretty(jsonb_build_object(
  'captured_at_utc', timezone('utc', clock_timestamp()),
  'database', jsonb_build_object(
    'name', current_database(),
    'server_version', current_setting('server_version'),
    'size_bytes', pg_database_size(current_database()),
    'size_pretty', pg_size_pretty(pg_database_size(current_database()))
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
  ),
  'required_client_functions', jsonb_build_object(
    'replace_predicted_progression',
      to_regprocedure('public.replace_predicted_progression(uuid,jsonb,jsonb)') is not null,
    'delete_match_prediction',
      to_regprocedure('public.delete_match_prediction(uuid,uuid,integer)') is not null
  ),
  'migration_history', jsonb_build_object(
    'schema_migrations_table_exists',
      to_regclass('supabase_migrations.schema_migrations') is not null
  ),
  'extensions', (
    select coalesce(jsonb_agg(
      jsonb_build_object('name', extname, 'version', extversion)
      order by extname
    ), '[]'::jsonb)
    from pg_extension
  ),
  'publications', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', p.pubname,
        'all_tables', p.puballtables,
        'insert', p.pubinsert,
        'update', p.pubupdate,
        'delete', p.pubdelete,
        'truncate', p.pubtruncate,
        'tables', coalesce((
          select jsonb_agg(
            format('%I.%I', pt.schemaname, pt.tablename)
            order by pt.schemaname, pt.tablename
          )
          from pg_publication_tables pt
          where pt.pubname = p.pubname
        ), '[]'::jsonb)
      )
      order by p.pubname
    ), '[]'::jsonb)
    from pg_publication p
  ),
  'custom_auth_storage_triggers', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'trigger', t.tgname,
        'function', p.oid::regprocedure::text,
        'enabled', t.tgenabled
      )
      order by n.nspname, c.relname, t.tgname
    ), '[]'::jsonb)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and n.nspname in ('auth', 'storage')
  )
)) as production_backup_inventory;
