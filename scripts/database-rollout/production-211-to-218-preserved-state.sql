-- Contract 211 to 218 boundary: the state the promotion must NOT move.
--
-- This file is deliberately run UNCHANGED before and after the apply, on the
-- rehearsal copy and on Production, so a difference between the two readings is
-- a difference in the database rather than a difference in the question. The
-- 211-to-213 pair inlined this block four times in two workflows; four copies of
-- one question is four places for it to drift.
--
-- Every expression here must therefore be valid at contract 211 AND at contract
-- 217. Anything that only exists above 211 belongs in the boundary file, not
-- here.
--
-- The function fingerprint excludes, by name, every routine contracts 212 to 218
-- create or redefine. Excluding them is the point: what the fingerprint proves is
-- that NOTHING ELSE in `public` or `predictor_internal` moved while six contracts
-- were applied.
with protected_functions as (
  select md5(coalesce(string_agg(
    n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')=' || pg_get_functiondef(p.oid),
    E'\n' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  ), '')) as fingerprint
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'predictor_internal')
    and (n.nspname || '.' || p.proname) not in (
      -- Contract 212
      'predictor_internal.season_prediction_buffer_minutes',
      'public.get_season_matchweek_card',
      -- Contract 214
      'predictor_internal.season_card_confirmation_reference',
      'public.save_season_prediction',
      'public.set_season_matchweek_joker',
      'public.confirm_season_matchweek_card',
      -- Contract 216
      'predictor_internal.reminder_dispatch_endpoint',
      'predictor_internal.post_reminder_dispatch',
      'predictor_internal.reminder_job_status',
      'predictor_internal.reminder_dispatch_status',
      'predictor_internal.reminder_sender_configuration',
      'public.dispatch_due_reminders',
      'public.record_reminder_dispatch_run',
      -- Contracts 216 and 217 both
      'public.claim_due_reminders',
      'public.admin_reminder_delivery_health',
      -- Contract 217
      'public.save_push_subscription',
      'public.prune_push_subscription',
      'public.process_reminder_schedule'
    )
)
select jsonb_build_object(
  'migration_count',(select count(*) from supabase_migrations.schema_migrations),
  'latest_version',(select version from supabase_migrations.schema_migrations order by version desc limit 1),
  'latest_name',(select name from supabase_migrations.schema_migrations order by version desc limit 1),
  'auth_users',(select count(*) from auth.users),
  'profiles',(select count(*) from public.profiles),
  'entries',(select count(*) from public.entries),
  'season_predictions',(select count(*) from public.season_predictions),
  'match_predictions',(select count(*) from public.match_predictions),
  'league_members',(select count(*) from public.league_members),
  'season_fixtures',(select count(*) from public.season_fixtures),
  'reminder_deliveries',(select count(*) from public.reminder_deliveries),
  'ai_bets',(select count(*) from ai.bets),
  'cron_jobs',(select count(*) from cron.job),
  'public_enabled',(select public_enabled from ai.publication_gate limit 1),
  'betting_public_enabled',(select betting_public_enabled from ai.publication_gate limit 1),
  -- Compared WHOLE rather than by total: a migration that invented a
  -- postponement would leave `season_fixtures` unchanged while moving a fixture
  -- between statuses, and a total would not notice.
  'fixture_status_histogram',(
    select coalesce(jsonb_object_agg(status, tally), '{}'::jsonb)
    from (select status, count(*) as tally from public.season_fixtures group by status) s),
  'lifecycle_transition_count',(select count(*) from predictor_internal.season_fixture_lifecycle_transitions),
  'provider_status_observation_count',(select count(*) from predictor_internal.provider_status_observations),
  -- All five tiers contract 211 settled on. None of contracts 212 to 218 touches
  -- provider polling, so any movement here is the boundary reaching somewhere it
  -- was not supposed to.
  'poll_dials',(
    select coalesce(jsonb_object_agg(target.id::text,
             jsonb_build_array(target.cadence_minutes, target.live_cadence_minutes,
                               target.live_lead_minutes, target.deadline_cadence_minutes,
                               target.deadline_lead_minutes)),
           '{}'::jsonb)
    from public.provider_poll_targets target),
  'protected_function_fingerprint',(select fingerprint from protected_functions));
