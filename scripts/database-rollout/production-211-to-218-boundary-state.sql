-- Contract 211 to 218 boundary: what each of the six contracts must have DONE.
--
-- Valid only at contract 217. It is read once, after the apply, on the rehearsal
-- copy and again on Production. Everything that must be readable at 211 as well
-- lives in `production-211-to-218-preserved-state.sql`.
--
-- Each key names one contract's claim, and the claim is driven rather than
-- asserted from the ledger: the ledger only proves a file ran.
select jsonb_build_object(
  -- Contract 212 — the matchweek card publishes the lock it is enforced against.
  'card_calls_lock_authority',(
    select strpos(p.prosrc, 'season_prediction_lock_at') > 0
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_matchweek_card' and p.pronargs = 2),
  'card_publishes_lock_fields',(
    select strpos(p.prosrc, '''lock_at''') > 0 and strpos(p.prosrc, '''locked''') > 0
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_matchweek_card' and p.pronargs = 2),
  'buffer_authority_present',(
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'season_prediction_buffer_minutes'),

  -- Contract 213 — the unmeasured SportMonks tokens fail closed.
  'dropped_tokens_remaining',(
    select count(*) from predictor_internal.provider_status_kinds
    where provider = 'sportmonks' and provider_status in ('14','15','16','17','18','20','21')),
  'dropped_tokens_not_unknown',(
    select count(*) from unnest(array['14','15','16','17','18','20','21']) token
    where predictor_internal.provider_status_kind('sportmonks', token) <> 'unknown'),
  'measured_postponed_kind',predictor_internal.provider_status_kind('sportmonks','10'),
  'cancelled_or_abandoned_mappings',(
    select count(*) from predictor_internal.provider_status_kinds
    where provider = 'sportmonks' and kind in ('cancelled','abandoned')),

  -- Contract 214 — confirmation tracks the current card.
  'confirmation_reference_present',(
    select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal' and p.proname = 'season_card_confirmation_reference'),
  'confirm_calls_confirmation_reference',(
    select bool_or(strpos(p.prosrc, 'season_card_confirmation_reference') > 0)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'confirm_season_matchweek_card'),

  -- Contract 215 — a current value follows the canonical forecast.
  'canonical_view_uses_canonical',(
    select strpos(pg_get_viewdef('ai.current_fixture_recommendations'::regclass), 'canonical_fixture_predictions') > 0),

  -- Contract 216 — the reminder sender has a caller, and a gate that can refuse.
  'dispatch_runs_rls',(
    select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal' and c.relname = 'reminder_dispatch_runs'),
  'dispatch_job_schedule',(select job.schedule from cron.job job where job.jobname = 'player-reminder-dispatch'),
  'dispatch_job_active',(select job.active from cron.job job where job.jobname = 'player-reminder-dispatch'),
  -- APPLYING IT MUST NOT SEND ANYTHING. The job is scheduled and the gate is
  -- shut: no dispatch URL and no caller key in the vault, so every firing
  -- records a `not-configured` refusal and posts nothing. `configured` false
  -- with `job_active` true is the required arrival state, not a fault.
  'sender_configuration',predictor_internal.reminder_sender_configuration(),

  -- Contract 217 — push as a second delivery channel.
  'push_subscriptions_rls',(
    select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'push_subscriptions'),
  'push_subscriptions_rows',(select count(*) from public.push_subscriptions),
  'push_subscriptions_policies',(
    select count(*) from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions'),
  'push_subscriptions_anon_grants',(
    select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'push_subscriptions' and grantee in ('anon','PUBLIC')),
  'push_subscriptions_authenticated_grants',(
    select coalesce(string_agg(distinct lower(privilege_type), ',' order by lower(privilege_type)), '')
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'push_subscriptions' and grantee = 'authenticated'),
  'reminder_deliveries_channel_default',(
    select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'reminder_deliveries' and column_name = 'channel'),
  'reminder_deliveries_non_email',(select count(*) from public.reminder_deliveries where channel <> 'email'),
  'claim_returns_channel',(
    select coalesce(bool_or('channel' = any(p.proargnames)), false)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'claim_due_reminders'),

  -- THE GRANTS ON THE RECREATED FUNCTION. A dropped function takes its grants
  -- with it, so this is the exact risk contract 217's `drop function` introduces
  -- and the one thing the ledger cannot answer. The sender must still be able to
  -- claim, and no browser role may have gained the ability to.
  'claim_service_role_execute',has_function_privilege('service_role','public.claim_due_reminders(integer, boolean)','execute'),
  'claim_authenticated_execute',has_function_privilege('authenticated','public.claim_due_reminders(integer, boolean)','execute'),
  'claim_anon_execute',has_function_privilege('anon','public.claim_due_reminders(integer, boolean)','execute'),
  'save_push_authenticated_execute',has_function_privilege('authenticated','public.save_push_subscription(text, text, text)','execute'),
  'save_push_anon_execute',has_function_privilege('anon','public.save_push_subscription(text, text, text)','execute'),

  -- Contract 218 — public.matches publishes on the realtime channel.
  'matches_published',(
    select exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches')),
  -- Listed rather than counted, so a publication that grew a second table names
  -- the table it grew. ADR 0008 rejected broad user-owned or scoring tables.
  'realtime_published_tables',(
    select coalesce(string_agg(t.schemaname || '.' || t.tablename, ',' order by t.schemaname, t.tablename), '')
    from pg_publication_tables t where t.pubname = 'supabase_realtime'),
  'matches_replica_identity',(
    select c.relreplident from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'matches'),

  -- Untouched on purpose: a player with both channels available is still told
  -- ONCE. Contract 217 widens the channel, never the key.
  'once_per_action_key',(
    select pg_get_constraintdef(c.oid) from pg_constraint c
    where c.conrelid = 'public.reminder_deliveries'::regclass
      and c.conname = 'reminder_deliveries_once_per_action'));
