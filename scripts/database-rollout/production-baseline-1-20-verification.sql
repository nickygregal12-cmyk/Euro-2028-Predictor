-- Euro 2028 Predictor — production baseline verification for migrations 1–20
--
-- READ-ONLY. Run before repairing production migration-history metadata.
-- This proves surviving/superseding structural effects; it does not alter history.
-- Required result: all_structural_effects_present = true and every check true.
-- ACL drift is reported separately and belongs to SECURITY-003.

with
fn as (
  select p.proname,
         pg_get_function_identity_arguments(p.oid) as args,
         pg_get_functiondef(p.oid) as def,
         p.prosecdef,
         p.proconfig,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
), trg as (
  select ns.nspname as schema_name,
         c.relname as table_name,
         t.tgname,
         p.proname as function_name,
         pg_get_triggerdef(t.oid) as def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace ns on ns.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and ns.nspname in ('public', 'auth')
), pol as (
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
), con as (
  select c.relname as table_name,
         co.conname,
         co.contype,
         co.confdeltype,
         pg_get_constraintdef(co.oid) as def
  from pg_constraint co
  join pg_class c on c.oid = co.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
), checks as (
  select *
  from (values
    (1, '20260719120000_init_v0_1',
      to_regclass('public.profiles') is not null
      and to_regclass('public.tournaments') is not null
      and to_regclass('public.teams') is not null
      and to_regclass('public.groups') is not null
      and to_regclass('public.group_teams') is not null
      and to_regclass('public.matches') is not null
      and to_regclass('public.entries') is not null
      and to_regclass('public.match_predictions') is not null
      and to_regclass('public.predicted_group_positions') is not null
      and to_regclass('public.predicted_progression') is not null
      and (
        select count(*) = 10
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in (
            'profiles', 'tournaments', 'teams', 'groups', 'group_teams',
            'matches', 'entries', 'match_predictions',
            'predicted_group_positions', 'predicted_progression'
          )
          and c.relrowsecurity
      )
      and exists(select 1 from pol where tablename = 'entries' and policyname = 'own entries')
      and exists(select 1 from con where table_name = 'matches' and conname = 'matches_group_shape')
      and exists(select 1 from con where table_name = 'matches' and conname = 'matches_score_pair'),
      'Initial tables, RLS, owner/reference policies and match-shape constraints'),

    (2, '20260719130000_add_match_prediction_joker',
      exists(
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'match_predictions'
          and column_name = 'joker'
          and is_nullable = 'NO'
          and column_default = 'false'
      ),
      'match_predictions.joker boolean NOT NULL DEFAULT false'),

    (3, '20260719140000_add_predicted_tie_resolutions',
      to_regclass('public.predicted_tie_resolutions') is not null
      and exists(select 1 from pol where tablename = 'predicted_tie_resolutions' and policyname = 'own predicted_tie_resolutions')
      and exists(select 1 from con where table_name = 'predicted_tie_resolutions' and contype = 'c' and def like '%scope%group%third%')
      and to_regclass('public.predicted_tie_resolutions_entry_idx') is not null,
      'Tie-resolution table, scope check, owner policy and entry index'),

    (4, '20260719150000_enforce_joker_rules',
      exists(select 1 from fn where proname = 'enforce_joker_rules' and args = '')
      and exists(select 1 from trg where table_name = 'match_predictions' and tgname = 'enforce_joker_rules_trg' and function_name = 'enforce_joker_rules')
      and exists(select 1 from fn where proname = 'enforce_joker_rules' and def like '%maximum of 5 jokers%' and def like '%locked at kickoff%'),
      'Joker limit/kickoff function and trigger'),

    (5, '20260719160000_add_bonus_and_submit',
      to_regclass('public.players') is not null
      and to_regclass('public.bonus_predictions') is not null
      and exists(select 1 from pol where tablename = 'players' and policyname = 'players readable')
      and exists(select 1 from pol where tablename = 'bonus_predictions' and policyname = 'own bonus_predictions')
      and exists(select 1 from fn where proname = 'submit_entry' and args = 'p_entry_id uuid')
      and exists(select 1 from con where table_name = 'bonus_predictions' and contype = 'u' and def like '%entry_id%'),
      'Players, bonus predictions, RLS and submit RPC'),

    (6, '20260719170000_lock_and_leaderboard',
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tournaments' and column_name = 'lock_at')
      and exists(select 1 from fn where proname = 'enforce_entry_lock_scores')
      and exists(select 1 from fn where proname = 'enforce_entry_lock_generic')
      and exists(select 1 from trg where tgname = 'enforce_lock_scores' and table_name = 'match_predictions')
      and exists(select 1 from trg where tgname = 'enforce_lock_tie_resolutions' and table_name = 'predicted_tie_resolutions')
      and exists(select 1 from trg where tgname = 'enforce_lock_progression' and table_name = 'predicted_progression')
      and exists(select 1 from trg where tgname = 'enforce_lock_bonus' and table_name = 'bonus_predictions')
      and exists(select 1 from fn where proname = 'get_leaderboard' and args = 'p_tournament_id uuid'),
      'Tournament lock, lock triggers and leaderboard RPC'),

    (7, '20260719180000_add_leagues',
      to_regclass('public.leagues') is not null
      and to_regclass('public.league_members') is not null
      and exists(select 1 from pol where tablename = 'leagues' and policyname = 'member leagues readable')
      and exists(select 1 from pol where tablename = 'league_members' and policyname = 'own memberships readable')
      and (
        select count(*) = 9
        from fn
        where (proname, args) in (
          ('create_league', 'p_tournament_id uuid, p_name text'),
          ('get_league_preview', 'p_code text'),
          ('join_league', 'p_code text'),
          ('get_my_leagues', 'p_tournament_id uuid'),
          ('get_league', 'p_league_id uuid'),
          ('get_league_members', 'p_league_id uuid'),
          ('leave_league', 'p_league_id uuid'),
          ('transfer_ownership', 'p_league_id uuid, p_new_owner uuid'),
          ('delete_league', 'p_league_id uuid')
        )
      ),
      'League tables, member policies and nine league RPCs'),

    (8, '20260720120000_league_fk_semantics',
      exists(select 1 from con where table_name = 'league_members' and conname = 'league_members_user_id_fkey' and confdeltype = 'c')
      and exists(select 1 from con where table_name = 'leagues' and conname = 'leagues_owner_id_fkey' and confdeltype = 'r'),
      'Member account deletion CASCADE; owner deletion RESTRICT'),

    (9, '20260720130000_add_scoring',
      to_regclass('public.score_events') is not null
      and to_regclass('public.entry_totals') is not null
      and exists(select 1 from pol where tablename = 'score_events' and policyname = 'own score_events readable')
      and exists(select 1 from fn where proname = 'recompute_tournament_scores' and args = 'p_tournament_id uuid')
      and exists(select 1 from fn where proname = 'recompute_all_scores' and args = '')
      and exists(select 1 from trg where tgname = 'recompute_scores_on_result' and table_name = 'matches'),
      'Score-event table, aggregate view, scorer functions and result trigger'),

    (10, '20260720140000_fix_recompute_trigger',
      exists(
        select 1
        from fn
        where proname = 'trg_recompute_on_result'
          and def like '%perform recompute_tournament_scores(new.tournament_id)%'
          and def not like '%not distinct from old.home_score%'
      )
      and exists(select 1 from fn where proname = 'recompute_tournament_scores' and service_exec)
      and exists(select 1 from fn where proname = 'recompute_all_scores' and service_exec),
      'Always-recompute trigger body and service-role execution'),

    (11, '20260720150000_add_last_seen',
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_seen_at')
      and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'last_seen_points'),
      'Profile last-seen timestamp and points snapshot'),

    (12, '20260720160000_add_profile_welcomed_at',
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'welcomed_at'),
      'Profile welcome-gate timestamp'),

    (13, '20260720170000_reveal_after_lock',
      exists(
        select 1
        from fn
        where proname = 'get_rival_entry'
          and args = 'p_rival_id uuid, p_tournament_id uuid'
          and prosecdef
          and def like '%now() < v_lock%'
          and def like '%league_members%'
      ),
      'Post-lock/co-membership rival-entry RPC'),

    (14, '20260720180000_add_rank_history',
      to_regclass('public.rank_history') is not null
      and exists(select 1 from pol where tablename = 'rank_history' and policyname = 'own rank_history readable')
      and exists(select 1 from fn where proname = 'capture_rank_history' and args = 'p_tournament_id uuid')
      and exists(select 1 from fn where proname = 'recompute_tournament_scores' and def like '%capture_rank_history(p_tournament_id)%'),
      'Rank-history table/policy/capture integrated into scorer'),

    (15, '20260720190000_profile_on_signup',
      exists(
        select 1
        from fn
        where proname = 'handle_new_user'
          and args = ''
          and prosecdef
          and def like '%raw_user_meta_data%display_name%'
      )
      and exists(
        select 1
        from trg
        where schema_name = 'auth'
          and table_name = 'users'
          and tgname = 'on_auth_user_created'
          and function_name = 'handle_new_user'
      ),
      'Auth-user insert trigger creates profile from display-name metadata'),

    (16, '20260720200000_display_name_moderation',
      exists(select 1 from fn where proname = 'enforce_display_name_policy' and args = '' and def like '%display name not allowed%')
      and exists(select 1 from trg where table_name = 'profiles' and tgname = 'enforce_display_name' and function_name = 'enforce_display_name_policy'),
      'Server-side display-name moderation function and trigger'),

    (17, '20260720210000_rate_limits',
      to_regclass('public.rate_limit_events') is not null
      and exists(select 1 from fn where proname = 'enforce_rate_limit' and args = 'p_action text, p_max_per_min integer')
      and exists(select 1 from trg where table_name = 'match_predictions' and tgname = 'rate_limit_prediction_save')
      and exists(select 1 from trg where table_name = 'league_members' and tgname = 'rate_limit_league_membership'),
      'Rate-limit event log, function and both action triggers'),

    (18, '20260721120000_scoring_positions_knockout_awards',
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tournaments' and column_name = 'golden_boot_player_id')
      and (
        select count(*) = 3
        from fn
        where (proname, args) in (
          ('_group_h2h_stats', 'p_group_id uuid, p_team_ids uuid[]'),
          ('_resolve_group_cluster', 'p_group_id uuid, p_team_ids uuid[]'),
          ('_actual_group_order', 'p_group_id uuid')
        )
      )
      and exists(
        select 1
        from fn
        where proname = 'recompute_tournament_scores'
          and def like '%group_positions%'
          and def like '%when 4 then 110%'
          and def like '%golden boot%'
          and def like '%when g.diff = 0 then 40%'
      )
      and exists(
        select 1
        from trg
        where table_name = 'matches'
          and tgname = 'recompute_scores_on_result'
          and def like '%home_team_id%'
          and def like '%away_team_id%'
      )
      and exists(select 1 from trg where table_name = 'tournaments' and tgname = 'recompute_scores_on_golden_boot'),
      'Complete position/knockout/award scorer and broadened triggers'),

    (19, '20260721130000_match_centre',
      exists(select 1 from fn where proname = '_stage_ord' and args = 'p_stage text')
      and exists(select 1 from fn where proname = 'get_league_match_picks' and args = 'p_league_id uuid, p_match_id uuid' and def like '%v_locked%')
      and exists(select 1 from fn where proname = 'get_match_prediction_distribution' and args = 'p_match_id uuid' and def like '%v_locked%'),
      'Stage ordinal plus league and aggregate match-centre RPCs'),

    (20, '20260722120000_write_integrity',
      exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'match_predictions' and column_name = 'version' and column_default = '0')
      and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'predicted_progression' and column_name = 'version' and column_default = '0')
      and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bonus_predictions' and column_name = 'version' and column_default = '0')
      and exists(select 1 from fn where proname = 'enforce_write_version' and args = '' and def like '%PT409%')
      and (
        select count(*) = 3
        from trg
        where tgname in (
          'enforce_version_match_predictions',
          'enforce_version_predicted_progression',
          'enforce_version_bonus_predictions'
        )
      )
      and exists(
        select 1
        from fn
        where proname = 'submit_entry'
          and args = 'p_entry_id uuid'
          and def like '%v_prog_total%'
          and def like '%v_r16%'
          and def like '%v_foreign%'
      ),
      'Version columns/PT409 triggers and safe-partial bracket submission checks')
  ) as v(migration_no, migration_name, structural_effect_present, evidence)
)
select jsonb_build_object(
  'all_structural_effects_present', bool_and(structural_effect_present),
  'checks', jsonb_agg(to_jsonb(checks) order by migration_no),
  'acl_drift', jsonb_build_object(
    'security_definer_or_internal_functions_executable_by_anon', (
      select jsonb_agg(proname || '(' || args || ')' order by proname, args)
      from fn
      where anon_exec
        and proname in (
          'submit_entry', 'get_leaderboard', 'create_league',
          'get_league_preview', 'join_league', 'get_my_leagues',
          'get_league', 'get_league_members', 'leave_league',
          'transfer_ownership', 'delete_league',
          'recompute_tournament_scores', 'recompute_all_scores',
          'capture_rank_history', 'get_rival_entry',
          'get_league_match_picks', 'get_match_prediction_distribution',
          '_group_h2h_stats', '_resolve_group_cluster',
          '_actual_group_order', 'enforce_rate_limit'
        )
    )
  )
) as migration_1_20_proof
from checks;