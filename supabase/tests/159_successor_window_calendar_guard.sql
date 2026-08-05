-- Contract 108: a restarted competition cannot inherit its predecessor's past.
--
-- This suite is in two halves, and the first one is unusual: it PROVES THE
-- FAILURE rather than the fix.
--
-- The guard refuses to let a successor hold a round that locked before its
-- predecessor finished. On its own, an assertion that such an insert is refused
-- says nothing about why anybody should care — a guard against an impossible
-- state passes just as cleanly as a guard against a catastrophic one. So the
-- first half builds the catastrophic state on a competition the guard does not
-- cover (a first instance, which is the shape the Euro catalogue has), and shows
-- what `recompute_lms_for_tournament` does with it: it crowns every entrant
-- champion without a single selection existing.
--
-- The second half then shows that the same rows cannot reach a successor.
--
-- Nothing in the first half is a defect in the rederive. Its whole-round
-- wipeout rule is ADR 0013 as written: when a round eliminates the entire
-- field, the round is void and everybody carries. What it cannot do is tell
-- "nobody survived" from "nobody played", and it should not have to — a
-- competition with no picks should not have settled rounds in the first place.

begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- Two Euro group fixtures, played and confirmed, and a Last Man Standing
-- competition whose three entrants have never picked anything.
-- ---------------------------------------------------------------------------

select set_config('test.wg_tournament',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'), true);

select set_config('test.wg_home',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.wg_tournament')::uuid
    order by team.name limit 1), true);

select set_config('test.wg_away',
  (select team.id::text from public.teams team
    where team.tournament_id = current_setting('test.wg_tournament')::uuid
    order by team.name offset 1 limit 1), true);

select set_config('test.wg_match_1',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.wg_tournament')::uuid
      and m.round = 'group'
    order by m.match_ref limit 1), true);

select set_config('test.wg_match_2',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.wg_tournament')::uuid
      and m.round = 'group'
    order by m.match_ref offset 1 limit 1), true);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select md5('wg-user-' || n)::uuid, format('wg-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 3) as n;

-- Both fixtures are given the same two clubs and a kickoff in the past, so a
-- confirmed result is a real one rather than a shape the guards would refuse.
update public.matches
set home_team_id = current_setting('test.wg_home')::uuid,
    away_team_id = current_setting('test.wg_away')::uuid,
    kickoff_at = now() - interval '2 hours'
where id in (
  current_setting('test.wg_match_1')::uuid,
  current_setting('test.wg_match_2')::uuid
);

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('wg-user-' || n)::uuid, format('Wg Player %s', n), now()
from generate_series(1, 3) as n;

select public.confirm_match_result(
  current_setting('test.wg_match_1')::uuid, 'regulation', 2::smallint, 0::smallint
);

select public.confirm_match_result(
  current_setting('test.wg_match_2')::uuid, 'regulation', 3::smallint, 1::smallint
);

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('wg-old')::uuid, current_setting('test.wg_tournament')::uuid,
  'last_man_standing', true, 'active', false, 'public', now() - interval '5 days'
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('wg-old')::uuid, md5('wg-user-' || n)::uuid, now() - interval '4 days'
from generate_series(1, 3) as n;

-- ---------------------------------------------------------------------------
-- PART ONE — the failure, on a first instance
--
-- Two settled rounds, no selections anywhere. This is precisely the state a
-- catalogue rerun would produce on a restarted competition.
-- ---------------------------------------------------------------------------

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values
  (md5('wg-w1')::uuid, md5('wg-old')::uuid, 1, 'Round 1',
   now() - interval '4 days', now() - interval '3 days'),
  (md5('wg-w2')::uuid, md5('wg-old')::uuid, 2, 'Round 2',
   now() - interval '3 days', now() - interval '2 days');

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('wg-w1')::uuid, current_setting('test.wg_match_1')::uuid),
  (md5('wg-w2')::uuid, current_setting('test.wg_match_2')::uuid);

select is(
  (select count(*)::integer from public.bonus_lms_selections
    where competition_id = md5('wg-old')::uuid),
  0,
  'not one entrant has selected a club'
);

select lives_ok(
  format('select predictor_internal.recompute_lms_for_tournament(%L::uuid)',
         current_setting('test.wg_tournament')),
  'the rederive runs over the settled rounds'
);

select is(
  (select count(*)::integer from public.bonus_competition_entrants
    where competition_id = md5('wg-old')::uuid and outcome = 'champion'),
  3,
  'and crowns EVERY entrant champion — the whole-round wipeout rule cannot tell "nobody survived" from "nobody played"'
);

-- That is the outcome a catalogue rerun would manufacture on a fresh
-- competition. The rest of this suite is about making those rows unreachable.

-- ---------------------------------------------------------------------------
-- PART TWO — the guard
-- ---------------------------------------------------------------------------

select is(
  (select jsonb_build_object(
     'definer', p.prosecdef,
     'searchPath', array_to_string(p.proconfig, ','))
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'predictor_internal'
     and p.proname = 'assert_successor_window_after_predecessor'),
  jsonb_build_object('definer', true, 'searchPath', 'search_path=""'),
  'the guard exists as its own function, security definer with search_path pinned to the empty string'
);

select is(
  (select count(*)::integer from information_schema.routine_privileges
   where routine_schema = 'predictor_internal'
     and routine_name = 'assert_successor_window_after_predecessor'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and no browser or service role may execute it directly'
);

select is(
  (select count(*)::integer from pg_trigger trig
    join pg_class rel on rel.oid = trig.tgrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
   where ns.nspname = 'public'
     and rel.relname = 'bonus_competition_windows'
     and trig.tgname = 'assert_successor_window_after_predecessor'
     and not trig.tgisinternal),
  1,
  'bound to the windows table, so it protects every writer rather than one script'
);

-- The predecessor is completed and restarted, exactly as contract 107 leaves it.

select set_config('test.wg_new',
  (select predictor_internal.restart_lms_competition(md5('wg-old')::uuid)::text), true);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = current_setting('test.wg_new')::uuid),
  0,
  'the successor starts with no rounds, as contract 107 leaves it'
);

select throws_ok(
  format($sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (%L::uuid, 1, 'Round 1', %L::timestamptz, %L::timestamptz)
  $sql$,
    current_setting('test.wg_new'),
    (now() - interval '4 days')::text,
    (now() - interval '3 days')::text),
  '23514',
  null,
  'and the original round-1 calendar is refused — the round locked before the predecessor finished'
);

select throws_ok(
  format($sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (%L::uuid, 1, 'Round 1', %L::timestamptz, %L::timestamptz)
  $sql$,
    current_setting('test.wg_new'),
    (now() - interval '4 days')::text,
    (now() + interval '2 days')::text),
  '23514',
  null,
  'a round that merely OPENED too early is refused as well, not only one that locked'
);

-- The two instants are checked independently, and this is the case that proves
-- it. With no opening instant at all, only the lock is left to judge — and a
-- guard that checked opens_at alone would wave this straight through, which is
-- exactly what the first version of it did.
select throws_ok(
  format($sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (%L::uuid, 1, 'Round 1', null, %L::timestamptz)
  $sql$,
    current_setting('test.wg_new'),
    (now() - interval '3 days')::text),
  '23514',
  null,
  'and a round with no opening instant that nonetheless locked too early is refused on the lock alone'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = current_setting('test.wg_new')::uuid),
  0,
  'so nothing from the original calendar reached the successor'
);

-- ---------------------------------------------------------------------------
-- The guard is narrow. Each of these would be a false refusal.
-- ---------------------------------------------------------------------------

select lives_ok(
  format($sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (%L::uuid, 1, 'Round 1', %L::timestamptz, %L::timestamptz)
  $sql$,
    current_setting('test.wg_new'),
    (now() + interval '1 day')::text,
    (now() + interval '2 days')::text),
  'a successor round scheduled after the restart is accepted — this guard schedules nothing, it only refuses the past'
);

select lives_ok(
  format($sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (%L::uuid, 2, 'Round 2', null, null)
  $sql$, current_setting('test.wg_new')),
  'and a round with no instants yet is accepted, because an unscheduled round asserts nothing about when it happened'
);

select is(
  (select count(*)::integer from public.bonus_competition_windows
    where competition_id = md5('wg-old')::uuid),
  2,
  'the predecessor keeps both of its rounds throughout — the guard never reaches backwards'
);

-- A first instance is not covered at all, which is why the Euro catalogue and
-- part one of this suite were never obstructed.

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, availability_status,
  draw_required, visibility_kind, registration_opens_at
) values (
  md5('wg-first')::uuid, current_setting('test.wg_tournament')::uuid,
  'last_man_standing', true, 'active', false, 'private', now() - interval '5 days'
);

select lives_ok(
  $sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (md5('wg-first')::uuid, 1, 'Round 1',
            now() - interval '9 days', now() - interval '8 days')
  $sql$,
  'a first instance may hold rounds entirely in the past, so the Euro catalogue is untouched'
);

-- A predecessor that never completed supplies no boundary to compare against.
-- Reaching that state is harder than it looks, which is worth recording: while
-- the successor is live, contract 103's one-live-row-per-series key refuses to
-- reopen the predecessor at all. The guard's null branch is defensive rather
-- than a hole somebody can walk through by reopening a finished competition.

select throws_ok(
  format('update public.bonus_competitions set completed_at = null, completion_reason = null where id = %L::uuid',
         md5('wg-old')::uuid),
  '23505',
  null,
  'contract 103 refuses to reopen the predecessor while its successor is live, so the two cannot both be running'
);

-- It is reachable the other way round — a successor that itself ended, over a
-- predecessor since reopened — and that is the case the null branch exists for.

update public.bonus_competitions
set completed_at = now(), completion_reason = 'abandoned'
where id = current_setting('test.wg_new')::uuid;

update public.bonus_competitions
set completed_at = null, completion_reason = null
where id = md5('wg-old')::uuid;

select lives_ok(
  format($sql$
    insert into public.bonus_competition_windows (competition_id, sequence, label, opens_at, locks_at)
    values (%L::uuid, 3, 'Round 3', %L::timestamptz, %L::timestamptz)
  $sql$,
    current_setting('test.wg_new'),
    (now() - interval '4 days')::text,
    (now() - interval '3 days')::text),
  'and an uncompleted predecessor supplies no boundary, so the guard defers rather than inventing one'
);

select finish();

rollback;
