-- Contract 107: the Last Man Standing restart, as a lifecycle transition.
--
-- ADR 0025 decision 1. What makes this correct is mostly what it does NOT do —
-- the predecessor survives intact, and the successor starts clean — so most of
-- these assertions check for absence, which is the easy thing to get wrong by
-- writing a test that would pass against a function doing nothing at all. The
-- guard against that is the pairing: every "the successor has none of X"
-- assertion sits beside one proving X still exists on the predecessor.

begin;

select plan(20);

-- ---------------------------------------------------------------------------
-- A Last Man Standing competition mid-wipeout: three entrants, one window, a
-- selection each, a used cycle, an audit row and an entrant-state projection.
-- Everything the ADR says must not carry forward is present before the
-- restart, so "not copied" is a real observation rather than a vacuous one.
-- ---------------------------------------------------------------------------

select set_config('test.rs_tournament',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'), true);

select set_config('test.rs_team',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.rs_tournament')::uuid
    order by team.name limit 1), true);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('rs-user-' || n)::uuid, format('rs-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('rs-user-' || n)::uuid, format('Rs Player %s', n), now()
from generate_series(1, 3) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('rs-old')::uuid, current_setting('test.rs_tournament')::uuid,
  'last_man_standing', true, 'active', false, 'public', now() - interval '5 days'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at, outcome)
select md5('rs-old')::uuid, md5('rs-user-' || n)::uuid, now() - interval '4 days', 'eliminated'
from generate_series(1, 3) as n;

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values (md5('rs-w1')::uuid, md5('rs-old')::uuid, 1, 'LMS Round 1',
        now() - interval '4 days', now() - interval '3 days');

-- Selections are seeded with triggers suspended, as the other Bonus Games
-- suites seed theirs. Writing them through the real path would mean opening the
-- round, linking a fixture the picked club actually plays in, and closing the
-- round again — reconstructing a played round to test a lifecycle transition
-- that never reads a selection's contents, only whether rows exist and which
-- competition they belong to. What matters here is that they are PRESENT before
-- the restart, so "not copied" is an observation rather than a vacuous pass.
set local session_replication_role = replica;
insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
select md5('rs-old')::uuid, md5('rs-user-' || n)::uuid, md5('rs-w1')::uuid,
       current_setting('test.rs_team')::uuid, 1
from generate_series(1, 3) as n;
set local session_replication_role = origin;

insert into public.bonus_competition_audit (competition_id, action, detail)
values (md5('rs-old')::uuid, 'lms_resolved', jsonb_build_object('outcomes_changed', 3));

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_function(
  'predictor_internal', 'restart_lms_competition', array['uuid'],
  'the restart driver exists as its own lifecycle function'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'predictor_internal'
     and routine_name = 'restart_lms_competition'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and no browser or service role may drive a lifecycle transition directly'
);

-- ---------------------------------------------------------------------------
-- Refusals: a restart is not a way to overwrite any competition
-- ---------------------------------------------------------------------------

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status, registration_opens_at
) values (
  md5('rs-ko')::uuid, current_setting('test.rs_tournament')::uuid,
  'ko_predictor', true, 'active', now() - interval '5 days'
);

select throws_ok(
  format('select predictor_internal.restart_lms_competition(%L::uuid)', md5('rs-ko')::uuid),
  '23514',
  null,
  'a competition that is not Last Man Standing is refused'
);

select throws_ok(
  format('select predictor_internal.restart_lms_competition(%L::uuid)',
         md5('rs-missing')::uuid),
  '23503',
  null,
  'and an unknown competition is refused rather than silently returning null'
);

-- ---------------------------------------------------------------------------
-- THE TRANSITION
-- ---------------------------------------------------------------------------

select set_config('test.rs_new',
  (select predictor_internal.restart_lms_competition(md5('rs-old')::uuid)::text), true);

select isnt(
  current_setting('test.rs_new')::uuid,
  md5('rs-old')::uuid,
  'the restart creates a NEW row rather than wiping and reusing the old one'
);

-- The predecessor survives, which is the reason the decision rejected reuse.

select is(
  (select completion_reason from public.bonus_competitions where id = md5('rs-old')::uuid),
  'no_winner_restarted',
  'the predecessor completes with the terminal reason the ADR names'
);

select is(
  (select count(*)::integer from public.bonus_lms_selections
    where competition_id = md5('rs-old')::uuid),
  3,
  'its selections survive — the record of the competition that produced the wipeout'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('rs-old')::uuid),
  1,
  'as do its windows'
);

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = md5('rs-old')::uuid and outcome = 'eliminated'),
  3,
  'and its elimination history, unaltered'
);

-- The successor is linked, and clean.

select is(
  (select series_id from public.bonus_competitions where id = current_setting('test.rs_new')::uuid),
  (select series_id from public.bonus_competitions where id = md5('rs-old')::uuid),
  'the successor continues the predecessor''s series rather than starting its own'
);

select is(
  (select series_sequence from public.bonus_competitions
    where id = current_setting('test.rs_new')::uuid),
  2,
  'at the next sequence'
);

select is(
  (select predecessor_competition_id from public.bonus_competitions
    where id = current_setting('test.rs_new')::uuid),
  md5('rs-old')::uuid,
  'naming the competition it replaces'
);

select is(
  (select jsonb_build_object(
     'visibility', visibility_kind, 'published', published,
     'availability', availability_status, 'draw', draw_required)
   from public.bonus_competitions where id = current_setting('test.rs_new')::uuid),
  jsonb_build_object(
    'visibility', 'public', 'published', true,
    'availability', 'active', 'draw', false),
  'the immutable setup is carried across — scope, publication, availability and the draw rule'
);

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = current_setting('test.rs_new')::uuid),
  3,
  'every previous entrant is re-entered, which is the endgame''s whole point'
);

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = current_setting('test.rs_new')::uuid and outcome = 'eliminated'),
  0,
  'and none of them carries an elimination across'
);

-- Not copied. Each of these is only meaningful because the paired assertion
-- above proved the predecessor still holds them.

select is(
  (select count(*)::integer from public.bonus_lms_selections
    where competition_id = current_setting('test.rs_new')::uuid),
  0,
  'the successor has no selections'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = current_setting('test.rs_new')::uuid),
  0,
  'and no windows — window generation is a separate contract, so the successor is inert until it lands'
);

select is(
  (select count(*)::integer from public.bonus_competition_audit
    where competition_id = current_setting('test.rs_new')::uuid),
  0,
  'and none of the predecessor''s audit history'
);

-- The lifecycle event.

select is(
  (select detail->>'successorCompetitionId' from public.bonus_competition_audit
    where competition_id = md5('rs-old')::uuid and action = 'public_wipeout_restart'),
  current_setting('test.rs_new'),
  'the restart is recorded on the predecessor''s immutable trail, naming the successor'
);

-- ---------------------------------------------------------------------------
-- Idempotency, which the decision requires by name
-- ---------------------------------------------------------------------------

select is(
  (select predictor_internal.restart_lms_competition(md5('rs-old')::uuid)),
  current_setting('test.rs_new')::uuid,
  'restarting again returns the existing successor rather than forking the series'
);

select is(
  (select count(*)::integer from public.bonus_competitions
    where predecessor_competition_id = md5('rs-old')::uuid),
  1,
  'so a retrying job leaves one successor, not two'
);

-- ---------------------------------------------------------------------------
-- A won competition is not restartable
-- ---------------------------------------------------------------------------

update public.bonus_competitions
set completed_at = now(), completion_reason = 'won'
where id = current_setting('test.rs_new')::uuid;

select throws_ok(
  format('select predictor_internal.restart_lms_competition(%L::uuid)',
         current_setting('test.rs_new')),
  '23514',
  null,
  'a competition that finished with a champion is refused — a restart is not an overwrite'
);

select finish();

rollback;
