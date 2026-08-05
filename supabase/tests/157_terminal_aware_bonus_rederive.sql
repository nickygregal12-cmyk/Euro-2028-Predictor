-- Contract 106: a corrected result still rederives after a competition ends.
--
-- DATA-009. Contract 104 gave the two Bonus Games rederive functions the LIVE
-- resolver, which filters `completed_at is null`, and each guards
-- `if v_competition_id is null then return; end if;`. So once a competition
-- completed, a corrected result resolved nothing and the rederive did nothing —
-- silently, which is the worst shape for a scoring defect.
--
-- The assertion that matters here is the one after the competition is
-- completed: correcting the result must MOVE the stored scores. A structural
-- check that the function names the right resolver would pass against a body
-- that still returned early, so the proof is behavioural.

begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- One R16 tie, two KO Predictor entrants whose scores react differently to a
-- correction. alpha predicts 2-1, beta predicts 1-0.
--
--   result 2-1 → alpha exact (5) + through (2) = 7
--                beta  correct result (3) + through (2) = 5
--   result 0-2 → alpha nothing = 0 ; beta nothing = 0
--
-- Both predicted a home win, so both also earn the advancing team while the
-- home side goes through. A correction from 2-1 to 0-2 reverses that too, and
-- must take both to zero. Under the defect they stay at 7 and 5 for ever.
-- ---------------------------------------------------------------------------

select set_config('test.tr_tournament',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'), true);

select set_config('test.tr_match',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.tr_tournament')::uuid
      and m.round = 'r16'
    order by m.match_ref limit 1), true);

select set_config('test.tr_home',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.tr_tournament')::uuid
    order by team.name limit 1), true);

select set_config('test.tr_away',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.tr_tournament')::uuid
    order by team.name offset 1 limit 1), true);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('tr-user-' || n)::uuid, format('tr-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (values ('alpha'), ('beta')) as f(n);

update public.matches
set kickoff_at = now() + interval '1 hour',
    home_team_id = current_setting('test.tr_home')::uuid,
    away_team_id = current_setting('test.tr_away')::uuid
where id = current_setting('test.tr_match')::uuid;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('tr-user-' || n)::uuid, format('Tr %s', initcap(n)), now()
from (values ('alpha'), ('beta')) as f(n);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at
) values (
  md5('tr-ko')::uuid, current_setting('test.tr_tournament')::uuid,
  'ko_predictor', true, now() - interval '3 hours'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at) values
  (md5('tr-ko')::uuid, md5('tr-user-alpha')::uuid, now() - interval '2 hours'),
  (md5('tr-ko')::uuid, md5('tr-user-beta')::uuid, now() - interval '2 hours');

insert into public.bonus_knockout_predictions (
  user_id, match_id, home_score, away_score, advancing_team_id
) values
  (md5('tr-user-alpha')::uuid, current_setting('test.tr_match')::uuid, 2, 1, null),
  (md5('tr-user-beta')::uuid, current_setting('test.tr_match')::uuid, 1, 0, null);

set local session_replication_role = replica;
update public.matches set kickoff_at = now() - interval '30 minutes'
where id = current_setting('test.tr_match')::uuid;
set local session_replication_role = origin;

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'predictor_internal'
     and p.proname in ('recompute_ko_predictor_for_match', 'recompute_lms_for_tournament')
     and pg_get_functiondef(p.oid) like '%current_public_competition_id(%'),
  2,
  'both rederive functions resolve through the terminal-aware reader'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'predictor_internal'
     and routine_name in ('recompute_ko_predictor_for_match', 'recompute_lms_for_tournament')
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and neither is reachable by a browser or service role'
);

-- ---------------------------------------------------------------------------
-- While the competition is live, nothing about scoring changes
-- ---------------------------------------------------------------------------

select public.confirm_match_result(
  current_setting('test.tr_match')::uuid, 'regulation', 2::smallint, 1::smallint
);

select is(
  (select coalesce(sum(e.points), 0)::integer from public.bonus_score_events e
    where e.competition_id = md5('tr-ko')::uuid and e.user_id = md5('tr-user-alpha')::uuid),
  7,
  'a live competition still scores the exact scoreline and the advancing team'
);

select is(
  (select coalesce(sum(e.points), 0)::integer from public.bonus_score_events e
    where e.competition_id = md5('tr-ko')::uuid and e.user_id = md5('tr-user-beta')::uuid),
  5,
  'and still scores a correct result plus the advancing team'
);

-- ---------------------------------------------------------------------------
-- THE COMPETITION ENDS
-- ---------------------------------------------------------------------------

update public.bonus_competitions
set completed_at = now(), completion_reason = 'won'
where id = md5('tr-ko')::uuid;

select is(
  (select predictor_internal.live_competition_id(
     current_setting('test.tr_tournament')::uuid, 'ko_predictor')),
  null,
  'the live reader now finds nothing, which is exactly what silenced the rederive'
);

select is(
  (select predictor_internal.current_public_competition_id(
     current_setting('test.tr_tournament')::uuid, 'ko_predictor')),
  md5('tr-ko')::uuid,
  'while the terminal-aware reader still resolves the competition the scores belong to'
);

-- ---------------------------------------------------------------------------
-- THE ASSERTION THIS CONTRACT EXISTS FOR
-- ---------------------------------------------------------------------------
--
-- Under the defect both of these stay at 7 and 5: the correction resolves no
-- competition, returns immediately, and the stored scores keep describing a
-- result that was withdrawn.

select public.correct_match_result(
  current_setting('test.tr_match')::uuid, 'regulation', 0::smallint, 2::smallint,
  p_reason => 'Contract 106 test: result restated after the competition completed'
);

select is(
  (select coalesce(sum(e.points), 0)::integer from public.bonus_score_events e
    where e.competition_id = md5('tr-ko')::uuid and e.user_id = md5('tr-user-alpha')::uuid),
  0,
  'a correction after completion rederives — alpha loses the exact scoreline and the advancing team'
);

select is(
  (select coalesce(sum(e.points), 0)::integer from public.bonus_score_events e
    where e.competition_id = md5('tr-ko')::uuid and e.user_id = md5('tr-user-beta')::uuid),
  0,
  'and beta loses both the correct result and the advancing team, so no entrant keeps points from a withdrawn scoreline'
);

select is(
  (select count(*)::integer from public.bonus_score_events e
    where e.competition_id = md5('tr-ko')::uuid and e.match_id = current_setting('test.tr_match')::uuid),
  0,
  'the delete-and-rederive replaced history rather than leaving the old rows beside the new'
);

-- ---------------------------------------------------------------------------
-- Scope: rederiving scores is not reopening a competition
-- ---------------------------------------------------------------------------
--
-- Contract 89 reopens a SEASON competition on a correction because it owns that
-- competition's lifecycle. These two functions own no lifecycle, so they must
-- leave the terminal state alone — whether a restart-completed competition also
-- reopens belongs to the restart driver.

select is(
  (select completed_at is not null from public.bonus_competitions
    where id = md5('tr-ko')::uuid),
  true,
  'the competition stays completed — a score rederive does not resurrect it'
);

select is(
  (select completion_reason from public.bonus_competitions where id = md5('tr-ko')::uuid),
  'won',
  'and its recorded reason is untouched'
);

-- ---------------------------------------------------------------------------
-- The Last Man Standing leg, behaviourally rather than by inspection
-- ---------------------------------------------------------------------------
--
-- `recompute_lms_for_tournament` guarded the same early return. Proving it by
-- looking for its audit row does NOT work — that write is itself guarded by
-- `if v_changed > 0`, so an absent row means "nothing needed changing" just as
-- readily as "the guard stopped me". The probe therefore gives it something
-- that genuinely needs correcting: an entrant stored as `eliminated` in a
-- competition with no settled rounds, whose derived outcome is `active`.

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at, completed_at, completion_reason
) values (
  md5('tr-lms')::uuid, current_setting('test.tr_tournament')::uuid,
  'last_man_standing', true, now() - interval '3 hours', now(), 'won'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at, outcome) values
  (md5('tr-lms')::uuid, md5('tr-user-alpha')::uuid, now() - interval '2 hours', 'eliminated');

select lives_ok(
  format('select predictor_internal.recompute_lms_for_tournament(%L::uuid)',
         current_setting('test.tr_tournament')),
  'the Last Man Standing rederive runs against a completed competition'
);

select is(
  (select outcome from public.bonus_competition_entrants
    where competition_id = md5('tr-lms')::uuid and user_id = md5('tr-user-alpha')::uuid),
  'active',
  'and corrects a wrongly stored elimination, which the early return had made unreachable'
);

select is(
  (select count(*)::integer > 0 from public.bonus_competition_audit
    where competition_id = md5('tr-lms')::uuid and action = 'lms_resolved'),
  true,
  'recording the correction in the audit trail as it goes'
);

select finish();

rollback;
