-- Contract 104: the continuing split table, derived rather than copied.
--
-- ADR 0025 decision 2 is explicit about the mechanism, not only the outcome:
-- "Derive the continuing standings from both initial and split fixtures so
-- points genuinely carry forward rather than being copied into a new starting
-- total", and it rejects the alternative because "duplicated arithmetic
-- drifts".
--
-- A test that only checked the arriving totals could not tell the two designs
-- apart — on the day of the split they agree exactly. What separates them is
-- what happens when a league-phase result is CORRECTED afterwards: a derived
-- table moves, a copied starting total does not. That assertion is the point of
-- this file, and the rest establishes the conditions that make it meaningful.

begin;

select plan(15);

-- ---------------------------------------------------------------------------
-- Six entrants, two initial groups of three, drawn by the real admin path.
-- Matchday 1 is played in the league phase. The split then cuts ACROSS the
-- initial groups — split group A takes two entrants who already met each other
-- and one who did not — so the carry-forward has something to bite on.
--
-- NOT covered here: the head-to-head tiebreak counting league-phase meetings.
-- Reaching that key needs two entrants level on table points, window points,
-- exacts AND corrects while their mutual results differ, which takes a third
-- entrant and several more settled windows to construct. The scope is enforced
-- structurally instead — `results` carries no group of its own, so the only
-- restriction is the `per_user tied` join — and a mutant that attributed by the
-- fixture's group rather than the entrant's, silently dropping league-phase
-- meetings, is now unwritable rather than merely untested. A behavioural
-- assertion for that key is worth adding when the split acquires a driver.
-- ---------------------------------------------------------------------------

select set_config(
  'test.c5_tournament_id',
  (select t.id::text from public.tournaments t where t.name = 'UEFA Euro 2028'),
  true
);

update public.tournaments
set lock_at = now() + interval '1 day'
where id = current_setting('test.c5_tournament_id')::uuid;

select set_config('test.c5_m1',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.c5_tournament_id')::uuid
      and m.round = 'group' and m.matchday = 1
    order by m.match_ref limit 1), true);

select set_config('test.c5_m2',
  (select m.id::text from public.matches m
    where m.tournament_id = current_setting('test.c5_tournament_id')::uuid
      and m.round = 'group' and m.matchday = 1
    order by m.match_ref offset 1 limit 1), true);

set local session_replication_role = replica;

insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  md5('c5-user-' || n)::uuid,
  format('c5-%s@example.test', n),
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from generate_series(1, 6) as n;

set local session_replication_role = origin;

insert into public.profiles (id, display_name, welcomed_at)
select md5('c5-user-' || n)::uuid, format('C5 Player %s', n), now()
from generate_series(1, 6) as n;

insert into public.entries (id, user_id, tournament_id, submitted_at)
select md5('c5-entry-' || n)::uuid, md5('c5-user-' || n)::uuid,
  current_setting('test.c5_tournament_id')::uuid, now()
from generate_series(1, 6) as n;

insert into public.bonus_competitions (
  id, tournament_id, game_key, published, registration_opens_at,
  registration_closes_at, draw_required
) values (
  md5('c5-comp')::uuid,
  current_setting('test.c5_tournament_id')::uuid,
  'predictor_cup', true,
  now() - interval '3 hours', now() - interval '1 hour', true
);

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at)
select md5('c5-comp')::uuid, md5('c5-user-' || n)::uuid, now() - interval '2 hours'
from generate_series(1, 6) as n;

-- Windows 1-3 are the league phase; window 4 is the first split round. The
-- matchday numbering follows ADR 0025: "Keep matchday as the competition's
-- overall Cup round number rather than resetting it at the split", so the
-- split opens at matchday 4, not matchday 1.
--
-- Both used windows lock in the PAST, because `cup_window_settled` requires the
-- lock to have passed before a window can settle at all. Windows 2 and 3 carry
-- no real fixture and so never settle, which is what an unplayed league round
-- should look like. A real match may belong to only one window per competition,
-- so the league phase takes m1 and the split round takes m2.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values
  (md5('c5-w1')::uuid, md5('c5-comp')::uuid, 1, 'Cup Matchday 1', now() - interval '4 hours', now() - interval '3 hours'),
  (md5('c5-w2')::uuid, md5('c5-comp')::uuid, 2, 'Cup Matchday 2', now() + interval '1 day', now() + interval '2 days'),
  (md5('c5-w3')::uuid, md5('c5-comp')::uuid, 3, 'Cup Matchday 3', now() + interval '3 days', now() + interval '4 days'),
  (md5('c5-w4')::uuid, md5('c5-comp')::uuid, 4, 'Cup Split Round 1', now() - interval '2 hours', now() - interval '1 hour');

select public.admin_draw_predictor_cup(md5('c5-comp')::uuid, 'EURO2028-C5-SEED');

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('c5-w1')::uuid, current_setting('test.c5_m1')::uuid);

-- The matchday-1 pairing in each initial group, plus each group's bye.
select set_config('test.c5_x',
  (select f.home_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('c5-comp')::uuid and g.ordinal = 1 and f.matchday = 1), true);
select set_config('test.c5_y',
  (select f.away_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('c5-comp')::uuid and g.ordinal = 1 and f.matchday = 1), true);
select set_config('test.c5_z',
  (select member.user_id::text from public.bonus_cup_members member
    join public.bonus_cup_groups g on g.id = member.group_id
    where g.ordinal = 1 and member.competition_id = md5('c5-comp')::uuid
      and member.phase_kind = 'initial'
      and member.user_id not in (
        current_setting('test.c5_x')::uuid, current_setting('test.c5_y')::uuid
      )), true);
select set_config('test.c5_p',
  (select f.home_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('c5-comp')::uuid and g.ordinal = 2 and f.matchday = 1), true);
select set_config('test.c5_q',
  (select f.away_user_id::text from public.bonus_cup_fixtures f
    join public.bonus_cup_groups g on g.id = f.group_id
    where f.competition_id = md5('c5-comp')::uuid and g.ordinal = 2 and f.matchday = 1), true);
select set_config('test.c5_r',
  (select member.user_id::text from public.bonus_cup_members member
    join public.bonus_cup_groups g on g.id = member.group_id
    where g.ordinal = 2 and member.competition_id = md5('c5-comp')::uuid
      and member.phase_kind = 'initial'
      and member.user_id not in (
        current_setting('test.c5_p')::uuid, current_setting('test.c5_q')::uuid
      )), true);

create or replace function pg_temp.entry_of(p_user text)
returns uuid
language sql
as $$
  select entry.id from public.entries entry
  where entry.user_id = p_user::uuid
    and entry.tournament_id = current_setting('test.c5_tournament_id')::uuid
$$;

-- League phase, matchday 1. X predicts m1 exactly; Y gets the result only, so
-- X beats Y and carries a clear points lead into the split.
insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  (pg_temp.entry_of(current_setting('test.c5_x')), current_setting('test.c5_m1')::uuid, 2, 0),
  (pg_temp.entry_of(current_setting('test.c5_y')), current_setting('test.c5_m1')::uuid, 1, 0),
  (pg_temp.entry_of(current_setting('test.c5_p')), current_setting('test.c5_m1')::uuid, 1, 0);

select public.confirm_match_result(
  current_setting('test.c5_m1')::uuid, 'regulation', 2::smallint, 0::smallint
);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_function('predictor_internal', 'cup_split_group_tables', array['uuid'],
  'the continuing split table has its own authority, separate from the tournament group table');

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name = 'cup_split_group_tables'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'and no browser or service role may call it directly'
);

-- ---------------------------------------------------------------------------
-- The split. Group A cuts across the initial draw: X and Y already met in the
-- league phase, P did not meet either.
-- ---------------------------------------------------------------------------

insert into public.bonus_cup_groups (id, competition_id, tournament_id, ordinal, size, phase_kind, parent_group_id)
values
  (md5('c5-split-a')::uuid, md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 3, 3, 'split',
    (select g.id from public.bonus_cup_groups g where g.competition_id = md5('c5-comp')::uuid and g.ordinal = 1)),
  (md5('c5-split-b')::uuid, md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 4, 3, 'split',
    (select g.id from public.bonus_cup_groups g where g.competition_id = md5('c5-comp')::uuid and g.ordinal = 2));

insert into public.bonus_cup_members (competition_id, user_id, group_id, phase_kind, draw_number) values
  (md5('c5-comp')::uuid, current_setting('test.c5_x')::uuid, md5('c5-split-a')::uuid, 'split', 1),
  (md5('c5-comp')::uuid, current_setting('test.c5_y')::uuid, md5('c5-split-a')::uuid, 'split', 2),
  (md5('c5-comp')::uuid, current_setting('test.c5_p')::uuid, md5('c5-split-a')::uuid, 'split', 3),
  (md5('c5-comp')::uuid, current_setting('test.c5_z')::uuid, md5('c5-split-b')::uuid, 'split', 4),
  (md5('c5-comp')::uuid, current_setting('test.c5_q')::uuid, md5('c5-split-b')::uuid, 'split', 5),
  (md5('c5-comp')::uuid, current_setting('test.c5_r')::uuid, md5('c5-split-b')::uuid, 'split', 6);

-- ---------------------------------------------------------------------------
-- Carry-forward, before a single split fixture has been played
-- ---------------------------------------------------------------------------

select is(
  (select t.table_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  3,
  'X arrives in the split already holding the three points won in the league phase — carried, with no split fixture yet played'
);

select is(
  (select t.table_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  (select t.table_points from predictor_internal.cup_final_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  'and the carried total equals the league table exactly, because it is the same fixtures read again rather than a number copied across'
);

select is(
  (select t.parent_group_id from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  (select g.id from public.bonus_cup_groups g
    where g.competition_id = md5('c5-comp')::uuid and g.ordinal = 1),
  'the continuing table still names the initial group the entrant came from'
);

-- ---------------------------------------------------------------------------
-- A split fixture adds to the carried total rather than replacing it
-- ---------------------------------------------------------------------------

insert into public.bonus_cup_fixtures (
  competition_id, tournament_id, stage, group_id, window_id, matchday, home_user_id, away_user_id
) values (
  md5('c5-comp')::uuid, current_setting('test.c5_tournament_id')::uuid, 'split',
  md5('c5-split-a')::uuid, md5('c5-w4')::uuid, 4,
  current_setting('test.c5_x')::uuid, current_setting('test.c5_p')::uuid
);

insert into public.bonus_window_fixtures (window_id, match_id)
values (md5('c5-w4')::uuid, current_setting('test.c5_m2')::uuid);

insert into public.match_predictions (entry_id, match_id, home_score, away_score) values
  (pg_temp.entry_of(current_setting('test.c5_x')), current_setting('test.c5_m2')::uuid, 1, 1);

-- The split window has locked and its fixture is scheduled, but the match
-- carries no confirmed result yet, so the round has not settled.
select is(
  (select t.table_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  3,
  'an unsettled split round contributes nothing, so the table never ranks on a result that has not been confirmed'
);

select public.confirm_match_result(
  current_setting('test.c5_m2')::uuid, 'regulation', 1::smallint, 1::smallint
);

select is(
  (select t.table_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  6,
  'winning the first split round ADDS to the carried three rather than starting again from zero'
);

-- ---------------------------------------------------------------------------
-- THE ASSERTION THAT SEPARATES DERIVED FROM COPIED
-- ---------------------------------------------------------------------------
--
-- Both designs agree on every number above. They disagree here: revising a
-- LEAGUE-PHASE result after the split has begun moves a derived table and
-- leaves a copied starting total untouched.

select public.correct_match_result(
  current_setting('test.c5_m1')::uuid, 'regulation', 1::smallint, 0::smallint,
  p_reason => 'Contract 104 test: league-phase correction after the split began'
);

select is(
  (select t.table_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_y')::uuid),
  3,
  'correcting a league-phase result AFTER the split moves the continuing table — Y now holds the exact score and takes the league-phase win'
);

select is(
  (select t.table_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  3,
  'and X loses the carried points in the same read, which a stored starting total could not have done'
);

select is(
  (select t.table_points from predictor_internal.cup_final_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_y')::uuid),
  3,
  'the league table agrees, because both tables read the one set of fixtures rather than two copies of it'
);

-- ---------------------------------------------------------------------------
-- The initial table is untouched by the split existing
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from predictor_internal.cup_final_group_tables(md5('c5-comp')::uuid)),
  6,
  'the league table still returns the initial roster only, so qualification and knockout seeding are unaffected by split membership'
);

select is(
  (select t.table_points from predictor_internal.cup_final_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_x')::uuid),
  0,
  'and the split round X won is invisible to it, because that table filters stage = group'
);

-- ---------------------------------------------------------------------------
-- Ranking is within the split group
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid)),
  6,
  'every split entrant appears exactly once'
);

select is(
  (select count(distinct t.group_rank)::integer
    from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.group_id = md5('c5-split-a')::uuid),
  3,
  'ranks run 1..n inside each split group rather than across the whole competition'
);

select is(
  (select t.group_rank from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_z')::uuid),
  1,
  'and an entrant in the other split group is ranked against that group alone, never against group A'
);

select is(
  (select t.window_points from predictor_internal.cup_split_group_tables(md5('c5-comp')::uuid) t
    where t.user_id = current_setting('test.c5_r')::uuid),
  0,
  'an entrant who played no settled fixture in either phase carries nothing — window points come from settled rounds only'
);

select finish();

rollback;
