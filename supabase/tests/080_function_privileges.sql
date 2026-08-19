begin;

select plan(19);

create temporary table expected_anon_functions (
  signature text primary key
) on commit drop;

insert into expected_anon_functions (signature) values
  ('get_public_capacity()'),
  -- Contract 143: publication visibility is intentionally readable before auth
  -- so the public-site/route guard can fail closed from server truth.
  ('euro_publication_state()');

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
  -- Contract 152: owner-only invite-code rotation. The function refuses anyone
  -- but the league owner internally; the grant is the ordinary browser one.
  ('rotate_league_invite_code(uuid)'),
  ('search_league_transfer_candidates(uuid,text,integer)'),
  ('submit_entry(uuid)'),
  ('transfer_ownership(uuid,uuid)');

create temporary table expected_service_functions (
  signature text primary key
) on commit drop;

insert into expected_service_functions (signature)
select signature
from expected_authenticated_functions
where signature not in (
  'get_entry_submission_status(uuid)',
  -- Contract 143 mutation remains browser-owner only; service_role needs only
  -- the bounded state read for server-side publication guards.
  'admin_transition_euro_publication_state(text,text,text)'
);

insert into expected_service_functions (signature) values
  -- Contract 143: service-side route/site guards may consume the same bounded
  -- publication-state read as the browser; mutation remains authenticated owner-only.
  ('euro_publication_state()'),
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
  -- Contract 143: the bounded read is public/authenticated; the mutation grant
  -- only makes the owner RPC reachable. Its internal super_admin guard decides
  -- whether a signed-in caller may actually advance publication.
  ('euro_publication_state()'),
  ('admin_transition_euro_publication_state(text,text,text)'),
  ('admin_resolve_actual_third_place_tie(uuid,uuid[],text)');

-- Contract 50: the Bonus Games hub read plus voluntary entry and withdrawal.
-- Contract 51: the shared knockout prediction store.
-- Contract 52: the bounded KO Predictor standings read.
-- Contract 53: Last Man Standing picks and the bounded LMS read.
-- Contract 54: the Predictor Cup foundation (the draw stays service-only).
-- Contract 56: the Cup Penalty Number submission (the qualification gate
-- and round settle stay service-only).
-- Contract 57: the pre-lock own-entry clear.
-- Contract 138: the administrator's provider review queues and their
-- acknowledgement. Both are granted to `authenticated` exactly as every other
-- admin RPC here is, and both refuse inside on require_competition_admin() --
-- the grant reaches the function, the gate decides whether it acts.
-- Contract 139: the season fixtures read, which any signed-in caller may make
-- because a fixture list is the same for everybody and discloses no entry.
insert into expected_authenticated_functions (signature) values
  ('get_provider_review_queues(uuid,integer)'),
  ('acknowledge_provider_review_items(text,uuid[],text)'),
  ('get_season_fixtures(uuid,timestamp with time zone,timestamp with time zone)'),
  ('get_my_football_calendar(timestamp with time zone,timestamp with time zone)'),
  -- Contract 147 and 148: the published weekly catalogue and one addressed
  -- fixture. Both are player reads, granted to authenticated and to nobody else.
  ('get_published_weekly_seasons()'),
  ('get_season_fixture(uuid)'),
  -- Contract 149: what a private league predicted, once the matchweek locked.
  ('get_season_league_matchweek_predictions(uuid,uuid)'),
  -- Contract 150: how a league table moved over one settled matchweek.
  ('get_season_league_rank_movement(uuid,uuid)'),
  -- Contract 151: the legacy UUID-addressed profile remains gated on self/shared private league.
  ('get_season_player_profile(uuid,uuid)'),
  -- Contract 206 / PROF-001: same-season profile navigation uses the season-scoped entry ref.
  ('get_season_player_profile_by_ref(uuid,uuid)'),
  -- Contract 152-157: the private containers, the one code entry point, the
  -- permanent archive and the preference authority.
  ('create_private_season_lms(uuid,text,smallint,smallint,text,text)'),
  ('join_private_competition(text)'),
  ('create_private_season_cup(uuid,text)'),
  ('launch_private_season_cup(uuid)'),
  ('resolve_invite_code(text)'),
  ('get_season_wrapped(uuid)'),
  ('set_competition_follow(uuid,boolean,uuid)'),
  ('set_onboarding_progress(text,boolean)'),
  ('set_pinned_rival(uuid,uuid,boolean)'),
  ('get_my_preferences()');

-- Contract 140: the caller's own leave eligibility. Contract 141: club form and
-- club head-to-head, which are football about clubs and disclose no player.
insert into expected_authenticated_functions (signature) values
  ('get_game_leave_eligibility(uuid)'),
  ('get_season_club_form(uuid,integer)'),
  ('get_season_club_head_to_head(uuid,uuid,uuid)');

-- Contract 160: the competition's own league table, and the three competition
-- administration writes that configure it.
--
-- All four are `authenticated` rather than `anon`, including the READ. A league
-- table is public football and could defensibly be anonymous, but making a
-- function anonymously executable is a publication decision — the one contracts
-- 147 and 148 also declined to take — and this is not where it gets taken.
--
-- The three writers are `authenticated` and gate INSIDE on
-- `require_competition_admin`, which is the same shape as every other
-- administrator write here: the grant admits a signed-in caller and the function
-- decides. `080` asserts the grant; `209` asserts the refusal.
-- Contract 161: the caller's own season history. Contract 162's two browser
-- commands and its read. Contract 164's Last Man Standing field.
--
-- Every one is `authenticated` and answers only for `auth.uid()`. None takes a
-- player argument, which is what stops any of them becoming a directory — the
-- boundary contract 151 set and this batch keeps.
insert into expected_authenticated_functions (signature) values
  ('get_my_season_history(integer,integer)'),
  ('get_my_actions(integer,boolean)'),
  ('mark_actions_seen(text[])'),
  ('dismiss_action(text)'),
  ('get_season_lms_field(uuid,integer)');

-- Contract 162's driver and all four of contract 163's delivery jobs are
-- SERVICE-ROLE ONLY and deliberately not listed above. An action item carries a
-- deadline and a completion verdict, and a reminder job sends mail: a browser
-- role that could run either could manufacture a deadline or a send.
insert into expected_service_functions (signature) values
  ('process_player_action_items()'),
  ('process_reminder_schedule(interval,boolean)'),
  ('claim_due_reminders(integer,boolean)'),
  ('record_reminder_result(uuid,boolean,text,text,text)'),
  ('reclaim_stalled_reminders(interval)');

-- Contract 165: an organiser's own private container. Contract 166: the
-- multi-group Championship draw. Contract 167: its group stage. Contract 168:
-- the two inspection reads the administrator commands assume.
--
-- All six are `authenticated` and gate INSIDE — on ownership (165), on
-- competition administration (166, 168), or on the caller's own entry (167).
-- That is the established shape here: the grant admits a signed-in caller and
-- the function decides. `080` asserts the grant; `214` to `217` assert the
-- refusals.
insert into expected_authenticated_functions (signature) values
  ('get_my_organised_competition(uuid)'),
  ('get_my_organised_competitions(integer,integer)'),
  ('admin_launch_cup_group_stage(uuid)'),
  ('get_season_cup_group_stage(uuid,integer)'),
  ('admin_provider_proposal_detail(uuid,text,integer,integer)'),
  ('admin_competition_entrants(uuid,integer,integer)');

-- Contract 187 / `CUP-002`. The season Championship qualification caller, in the
-- same shape: `authenticated` admits a signed-in caller and
-- `require_competition_admin` decides inside.
--
-- The driver it reaches, `admin_finalise_predictor_cup_groups`, deliberately
-- stays out of this list and in `expected_service_functions`. It is now
-- competition-neutral, so granting it to `authenticated` would put the
-- TOURNAMENT Championship's qualification behind the same door as the season's,
-- and the tournament's is an operational path with its own evidence. `235`
-- asserts the caller refuses a tournament competition by name.
insert into expected_authenticated_functions (signature) values
  ('admin_finalise_season_cup_groups(uuid)');

-- Contract 172. Granted to `authenticated` and refusing inside on
-- `require_competition_admin()`, on the same terms as the four rows above: the
-- grant is the reachable surface and the function decides. It reports counts,
-- instants and the three jobs — no user id, action key, display name, address
-- or provider error text — so an ordinary caller reaching it and being refused
-- discloses nothing either way.
insert into expected_authenticated_functions (signature) values
  ('admin_reminder_delivery_health()');

-- Contract 174. Both are granted to `authenticated` and both refuse inside on
-- `require_competition_admin()`, on the same terms as contract 132's approval
-- pair: the grant is the reachable surface and the function decides. The read
-- returns the decoded proposal and never the raw provider response; the writer
-- is the only function in that contract that may change a fixture.
insert into expected_authenticated_functions (signature) values
  ('admin_provider_change_proposals(uuid,text,integer,integer)'),
  ('admin_decide_provider_change_proposal(uuid,text,text)');

-- Contracts 175 to 178, the Innovation Lab backend foundations (ADR 0027).
--
-- Three player reads and one administrator read. The projection and the DNA
-- read are `authenticated` because both answer about the caller or about
-- somebody the caller shares a private league with, and both resolve that
-- boundary internally. The batch is a WRITE and is granted on exactly the
-- terms `save_season_prediction` is, because it IS that function: it adds no
-- rule and reaches no table the single call does not.
insert into expected_authenticated_functions (signature) values
  ('get_season_matchweek_projection(uuid,integer,uuid)'),
  ('get_season_prediction_dna(uuid,uuid)'),
  ('save_season_predictions_batch(uuid,jsonb)'),
  -- Contract 178's report, granted to `authenticated` and refusing inside on
  -- `require_competition_admin()`, on the same terms as every admin row above.
  -- It names entries and never people: who the player is adds nothing to
  -- "is the scoring right", so no display name or address appears in it.
  ('admin_shadow_scoring_report(uuid,integer)');

-- Contract 183. A season's clubs and the leaderboard neighbourhood.
--
-- Both are `authenticated` and neither is anonymous. The clubs read discloses
-- no player, entry or prediction -- it is football about clubs, the same reason
-- contract 141's form reads are open to any signed-in caller -- and the
-- neighbourhood reuses contract 95's own membership boundary, refusing a
-- non-entrant identically to a season that does not exist.
insert into expected_authenticated_functions (signature) values
  ('get_season_clubs(uuid)'),
  ('get_season_leaderboard_neighbourhood(uuid,integer)');

-- Contract 179. Private container discovery and the workspace that opens one.
--
-- Both are `authenticated` and both answer only for `auth.uid()`. The list
-- takes no competition, game, season or player argument at all, which is what
-- stops it becoming a directory — the boundary contract 151 set and contracts
-- 161 to 165 kept. The workspace takes the container's own id and refuses a
-- non-member exactly as it refuses an unknown id, so it is not a probe either.
insert into expected_authenticated_functions (signature) values
  ('get_my_private_competitions(integer,integer)'),
  ('get_private_competition_workspace(uuid)');

-- Contract 181's setter is service_role and nothing else, on exactly contract
-- 44's terms for the two ceilings beside it: an operating limit is an
-- operations action and no browser session has cause to change one. The cap
-- ITSELF is a trigger on `public.league_members` and so has no signature here.
insert into expected_service_functions (signature) values
  ('set_league_member_limit(integer)');

-- Contract 178's RUN is service_role and nothing else: it is a job rather than
-- an action, it writes evidence, and no browser session has cause to start one.
insert into expected_service_functions (signature) values
  ('run_shadow_scoring_verification(uuid,integer)');

-- Contract 185. The private AI Lab exposes bounded competition-admin reads
-- and one promotion command to authenticated callers; every function applies
-- require_competition_admin() internally and no table grant is added.
insert into expected_authenticated_functions (signature) values
  ('admin_ai_dashboard(text)'),
  ('admin_ai_upcoming_predictions(text,integer)'),
  ('admin_ai_recent_results(text,integer)'),
  ('admin_ai_promote_model(uuid,text)'),
  ('admin_ai_performance_breakdown(text)'),
  ('admin_ai_betting_dashboard(text)'),
  ('admin_ai_betting_gate_status()'),
  ('admin_ai_evidence_by_market()'),
  ('admin_ai_odds_api_status()');

-- Contract 188. The decision log, the private Bet Builder's two reads and the
-- extreme-probability audit that must run after every regeneration. All four
-- are competition-admin definer functions over schema `ai`, which stays
-- revoked from every browser role; the Bet Builder returns only
-- `ai.recommendations` rows the value gate already decided BET, joined through
-- `ai.valid_predictions`, so no browser path can reach a refused or
-- quarantined forecast.
insert into expected_authenticated_functions (signature) values
  ('admin_ai_recommendation_log(text,integer)'),
  ('admin_ai_bet_builder_books()'),
  ('admin_ai_bet_builder_candidates(text,text[],timestamp with time zone,timestamp with time zone,integer)'),
  ('admin_ai_prediction_audit(text,integer)');

-- Contract 201. Three read-only competition-admin views of the private AI Lab:
-- coverage of every scheduled fixture with the recorded BET/PASS and each
-- refusal explained, pipeline health, and a fixture-level results review. Like
-- every read above they are definer functions over schema `ai`, which stays
-- revoked from every browser role, and they REPORT the decisions the value gate
-- already recorded rather than making one.
insert into expected_authenticated_functions (signature) values
  ('admin_ai_fixture_coverage(timestamp with time zone,timestamp with time zone,text[])'),
  ('admin_ai_operational_health()'),
  ('admin_ai_results_review(timestamp with time zone,timestamp with time zone,text[])');

-- The Odds API budget preflight and custody writer are Edge jobs. The outbound
-- dispatcher is owner/pg_cron-only and therefore belongs to neither execution
-- allowlist. A browser session can neither spend credits nor fabricate evidence.
insert into expected_service_functions (signature) values
  ('ai_odds_budget_check(integer)'),
  ('record_ai_odds_snapshot(text,integer,jsonb,text,jsonb,integer,integer,integer,integer,text,text)');

insert into expected_authenticated_functions (signature) values
  ('get_competition_table(uuid)'),
  ('admin_set_competition_table_rules(uuid,smallint,smallint,smallint,text[],smallint,smallint,smallint)'),
  ('admin_record_table_adjustment(uuid,uuid,integer,text,timestamp with time zone)'),
  ('admin_award_fixture_outcome(uuid,smallint,smallint,text)');

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

-- Contract 191: one season-scoped player reference in, the permitted
-- destination or an explicit refusal out. It carries contract 95's boundary and
-- reads auth.uid(), so like every season read above it stays out of
-- expected_service_functions — service_role has no auth.uid() and the call
-- refuses every time.
insert into expected_authenticated_functions (signature) values
  ('resolve_season_player(uuid,uuid)');

-- Contract 192: position over time, and one season-long rivalry. Both carry
-- contract 95's entry boundary and read auth.uid(), so both stay out of
-- expected_service_functions for the same reason every season read above does.
insert into expected_authenticated_functions (signature) values
  ('get_season_rank_history(uuid,uuid)'),
  ('get_season_rivalry(uuid,uuid,integer)');

-- Contract 193 / CUP-003: one season Championship entrant's own knockout tie.
-- It reads auth.uid() and refuses a non-entrant, so it stays out of
-- expected_service_functions like every other season player read.
insert into expected_authenticated_functions (signature) values
  ('get_season_cup_bracket(uuid)');

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
