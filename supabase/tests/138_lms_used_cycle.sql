-- Contract 87: the mandatory used-list reset, made storable.
--
-- ADR 0013 §25 makes the used-team reset MANDATORY and §87 records the
-- no-reset alternative as rejected. `bonus_lms_selections` could not store it:
-- `unique (competition_id, user_id, team_id)` allowed one club per entrant per
-- competition for all time, so the pick the rule authorised was the pick the
-- key refused. Re-keying to include a cycle is what this contract does.
--
-- TWO FAILURES ARE WORTH MORE THAN THE FEATURE ITSELF, and most of this file
-- is about them.
--
-- The first is a TOURNAMENT REGRESSION. The new key has a column the old one
-- did not, and every tournament row shares one value in it. If the reset ever
-- fired for a tournament entrant, or if cycle 0 stopped colliding, a delivered
-- game would quietly hand a player a second go at a club. Contract 63's rule
-- must survive untouched.
--
-- The second is a RESET THAT NEVER ENDS. If the used list fed to the rule were
-- the entrant's whole history rather than their current cycle, the pool would
-- be exhausted again the instant the reset fired, and every subsequent round
-- would reset for ever. The assertion that the used list SHRINKS after a reset
-- is the one that catches it.

begin;
select plan(21);

-- ---------------------------------------------------------------------------
-- The storage.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.columns
    where table_schema = 'public' and table_name = 'bonus_lms_selections'
      and column_name = 'used_cycle'
      and is_nullable = 'NO' and column_default = '0'),
  1,
  'used_cycle exists, is not null and defaults to 0 — every existing row is cycle 0'
);

select is(
  (select count(*)::integer from pg_constraint
    where conrelid = 'public.bonus_lms_selections'::regclass
      and conname = 'bonus_lms_selections_competition_id_user_id_team_id_key'),
  0,
  'the cycle-blind club key is gone'
);

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.bonus_lms_selections'::regclass
      and conname = 'bonus_lms_selections_club_once_per_cycle'),
  'UNIQUE (competition_id, user_id, team_id, used_cycle)',
  'and club uniqueness is now scoped to the cycle'
);

-- One pick per round is untouched. Re-keying the club constraint must not have
-- disturbed the other one.
select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.bonus_lms_selections'::regclass
      and conname = 'bonus_lms_selections_competition_id_user_id_window_id_key'),
  'UNIQUE (competition_id, user_id, window_id)',
  'one pick per round is unchanged'
);

-- ---------------------------------------------------------------------------
-- A league season with two clubs and three rounds, and a tournament beside it.
-- Two clubs is the smallest pool that can be exhausted, which is the whole
-- condition under test.
-- ---------------------------------------------------------------------------

create temporary table cycle_probe as
select
  (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
  (select id from public.tournaments where kind = 'tournament' order by name limit 1) as tournament_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'CY' || n, 700 + n, 'league_matchweek', 'Cycle probe ' || n
from cycle_probe, generate_series(1, 4) n;

insert into public.teams (tournament_id, name) select season_id, 'Cycle Club A' from cycle_probe;
insert into public.teams (tournament_id, name) select season_id, 'Cycle Club B' from cycle_probe;

insert into public.season_fixtures (
  id, tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at
)
select
  md5('cy-fix-' || n)::uuid, p.season_id,
  (select id from public.competition_rounds where tournament_id = p.season_id and round_key = 'CY' || n),
  (select id from public.teams where tournament_id = p.season_id and name = 'Cycle Club A'),
  (select id from public.teams where tournament_id = p.season_id and name = 'Cycle Club B'),
  now() + (n || ' hours')::interval
from cycle_probe p, generate_series(1, 4) n;

select set_config('test.c87_season_a',
  (select t.id::text from public.teams t join cycle_probe p on p.season_id = t.tournament_id
    where t.name = 'Cycle Club A'), true);
select set_config('test.c87_season_b',
  (select t.id::text from public.teams t join cycle_probe p on p.season_id = t.tournament_id
    where t.name = 'Cycle Club B'), true);

select set_config('test.c87_comp',
  (select c.id::text from public.bonus_competitions c
     join cycle_probe p on p.season_id = c.tournament_id
    where c.game_key = 'last_man_standing'), true);

update public.bonus_competitions
set published = true, registration_opens_at = now() - interval '3 hours'
where id = current_setting('test.c87_comp')::uuid;

insert into public.bonus_competitions (id, tournament_id, game_key, published, registration_opens_at)
select md5('c87-tourn-comp')::uuid, tournament_id, 'last_man_standing', true, now() - interval '3 hours'
from cycle_probe;

-- A tournament club and TWO of its matches. A real fixture may sit in only one
-- window per competition, so the two tournament rounds need different matches
-- while sharing the club whose reuse is under test.
select set_config('test.c87_tourn_club',
  (select m.home_team_id::text from public.matches m
     join cycle_probe p on p.tournament_id = m.tournament_id
    where m.round = 'group' and m.matchday = 1
    order by m.match_ref limit 1), true);
select set_config('test.c87_match_one',
  (select m.id::text from public.matches m
    where m.home_team_id = current_setting('test.c87_tourn_club')::uuid
       or m.away_team_id = current_setting('test.c87_tourn_club')::uuid
    order by m.match_ref limit 1), true);
select set_config('test.c87_match_two',
  (select m.id::text from public.matches m
    where m.home_team_id = current_setting('test.c87_tourn_club')::uuid
       or m.away_team_id = current_setting('test.c87_tourn_club')::uuid
    order by m.match_ref offset 1 limit 1), true);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (md5('c87-player')::uuid, 'c87-player@example.test',
   'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  (md5('c87-fresh')::uuid, 'c87-fresh@example.test',
   'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());
set local session_replication_role = origin;

insert into public.bonus_competition_entrants (competition_id, user_id, joined_at) values
  (current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, now() - interval '2 hours'),
  (current_setting('test.c87_comp')::uuid, md5('c87-fresh')::uuid, now() - interval '2 hours'),
  (md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, now() - interval '2 hours');

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
select md5('c87-w' || n)::uuid, current_setting('test.c87_comp')::uuid, 700 + n,
       'Cycle probe ' || n, now() - interval '2 hours', now() + interval '1 hour'
from generate_series(1, 4) n;

-- A season round with NO fixtures linked: the empty round that must not
-- reset however exhausted the entrant is.
insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at)
values (md5('c87-w-empty')::uuid, current_setting('test.c87_comp')::uuid, 799,
        'Cycle probe empty', now() - interval '2 hours', now() + interval '1 hour');

insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
select md5('c87-w' || n)::uuid, md5('cy-fix-' || n)::uuid from generate_series(1, 4) n;

insert into public.bonus_competition_windows (id, competition_id, sequence, label, opens_at, locks_at) values
  (md5('c87-tw1')::uuid, md5('c87-tourn-comp')::uuid, 701, 'T1',
    now() - interval '2 hours', now() + interval '1 hour'),
  (md5('c87-tw2')::uuid, md5('c87-tourn-comp')::uuid, 702, 'T2',
    now() - interval '2 hours', now() + interval '1 hour');

insert into public.bonus_window_fixtures (window_id, match_id) values
  (md5('c87-tw1')::uuid, current_setting('test.c87_match_one')::uuid),
  (md5('c87-tw2')::uuid, current_setting('test.c87_match_two')::uuid);

-- ---------------------------------------------------------------------------
-- An entrant who has picked nothing.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.lms_current_used_cycle(
    current_setting('test.c87_comp')::uuid, md5('c87-fresh')::uuid),
  0::smallint,
  'an entrant with no picks is in cycle 0'
);

select is(
  predictor_internal.lms_used_team_ids(
    current_setting('test.c87_comp')::uuid, md5('c87-fresh')::uuid),
  '[]'::jsonb,
  'and has consumed nothing'
);

select is(
  predictor_internal.lms_reset_due(
    current_setting('test.c87_comp')::uuid, md5('c87-fresh')::uuid, md5('c87-w1')::uuid),
  false,
  'the reset does not fire for an entrant with clubs still available'
);

-- ---------------------------------------------------------------------------
-- Exhaust the pool.
-- ---------------------------------------------------------------------------

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
values (current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w1')::uuid,
        current_setting('test.c87_season_a')::uuid, 0);
insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
values (current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w2')::uuid,
        current_setting('test.c87_season_b')::uuid, 0);

select is(
  predictor_internal.lms_reset_due(
    current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w3')::uuid),
  true,
  'every club playing once is used, so the mandatory reset is due'
);

select is(
  predictor_internal.lms_cycle_for_pick(
    current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w3')::uuid),
  1::smallint,
  'and the next pick belongs to a new cycle'
);

-- An empty round must not reset — the same distinction contract 84 makes, for
-- the same reason: a caller must fail closed rather than be handed a fresh pool
-- because nothing was on offer.
select is(
  predictor_internal.lms_reset_due(
    current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w-empty')::uuid),
  false,
  'a round with no fixtures does NOT reset, however exhausted the entrant'
);

select lives_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w3')::uuid,
            current_setting('test.c87_season_a')::uuid,
            predictor_internal.lms_cycle_for_pick(
              current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w3')::uuid))
  $$,
  'the club used in round one can be picked again after the reset — refused with 23505 before this contract'
);

-- THE ASSERTION THAT CATCHES A RESET THAT NEVER ENDS. If the used list were
-- the whole history rather than the current cycle, it would read two clubs here
-- and the pool would be exhausted again immediately.
select is(
  predictor_internal.lms_used_team_ids(
    current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid),
  jsonb_build_array(current_setting('test.c87_season_a')),
  'after the reset the used list holds only the new cycle — one club, not three picks'
);

select is(
  predictor_internal.lms_current_used_cycle(
    current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid),
  1::smallint,
  'and the entrant has advanced a cycle'
);

-- Within the new cycle the club is consumed again, so uniqueness still bites.
select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w4')::uuid,
            current_setting('test.c87_season_a')::uuid,
            predictor_internal.lms_cycle_for_pick(
              current_setting('test.c87_comp')::uuid, md5('c87-player')::uuid, md5('c87-w4')::uuid))
  $$,
  '23505',
  null,
  'and the same club twice WITHIN a cycle is still refused — by the key, in a round the club genuinely plays'
);

-- ---------------------------------------------------------------------------
-- The tournament, which must not have noticed any of this.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.lms_reset_due(
    md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, md5('c87-tw2')::uuid),
  false,
  'the reset never fires for a tournament competition — ADR 0013 is season authority'
);

-- The assertion above passes with the competition-kind check DELETED, and so
-- does this file with a season fixture deliberately mislinked to the tournament
-- round. Mutation testing established that, and the honest conclusion is that
-- the kind check is redundant today: what actually keeps the reset away from a
-- tournament entrant is structural. A selection's club is keyed to the
-- selection's competition, and a club row belongs to exactly one competition,
-- so a tournament entrant's used clubs and a season round's clubs cannot
-- intersect — and "every club playing once is already used" cannot be
-- satisfied. That is the load-bearing fact, so that is what is asserted.
insert into public.season_cup_window_fixtures (window_id, season_fixture_id)
values (md5('c87-tw2')::uuid, md5('cy-fix-1')::uuid);

select is(
  predictor_internal.lms_reset_due(
    md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, md5('c87-tw2')::uuid),
  false,
  'and still does not fire when a season fixture is mislinked to a tournament round'
);

-- With the mislink still in place the season club genuinely plays in this
-- tournament round, so the participation trigger is satisfied and the FOREIGN
-- KEY is what refuses. That is the structural fact the paragraph above rests
-- on: a tournament entrant cannot hold a season club, so their used list and a
-- season round's clubs can never intersect.
select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, md5('c87-tw2')::uuid,
            current_setting('test.c87_season_a')::uuid, 0)
  $$,
  '23503',
  null,
  'a tournament entrant cannot hold a season club at all — the key, not the flag, is what protects the tournament'
);

delete from public.season_cup_window_fixtures
where window_id = md5('c87-tw2')::uuid and season_fixture_id = md5('cy-fix-1')::uuid;

insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
values (md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, md5('c87-tw1')::uuid,
        current_setting('test.c87_tourn_club')::uuid, 0);

select throws_ok(
  $$
    insert into public.bonus_lms_selections (competition_id, user_id, window_id, team_id, used_cycle)
    values (md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, md5('c87-tw2')::uuid,
            current_setting('test.c87_tourn_club')::uuid,
            predictor_internal.lms_cycle_for_pick(
              md5('c87-tourn-comp')::uuid, md5('c87-player')::uuid, md5('c87-tw2')::uuid))
  $$,
  '23505',
  null,
  'a tournament entrant still cannot reuse a club — contract 63 behaviour, preserved'
);

-- ---------------------------------------------------------------------------
-- The player path, driven as PostgREST drives it.
--
-- An AMENDMENT is judged against the cycle its round was recorded in, not
-- against a freshly computed one. The first version of this contract recomputed
-- it, and both assertions below caught the consequence: a player who amends an
-- early round after their reset has fired was refused a club that is free, and
-- would have been admitted one that is taken — reaching the unique key as a raw
-- 23505 instead of the sentence the RPC exists to give.
--
-- `c87-player` holds Club A at cycle 0 (round one), Club B at cycle 0 (round
-- two) and Club A again at cycle 1 (round three, post-reset).
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', md5('c87-player'), true);
set local role authenticated;

select lives_ok(
  $$
    select public.save_lms_selection(
      md5('c87-w1')::uuid, current_setting('test.c87_season_a')::uuid, 0)
  $$,
  'amending round one back to its own club is accepted — free at cycle 0, whatever the current cycle is'
);

select throws_ok(
  $$
    select public.save_lms_selection(
      md5('c87-w1')::uuid, current_setting('test.c87_season_b')::uuid, 1)
  $$,
  '23505',
  'Each team can only be used once in Last Man Standing',
  'and amending it to a club round two holds at cycle 0 gives the sentence, not a raw key violation'
);

reset role;

-- ---------------------------------------------------------------------------
-- The new functions stay server-side.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'predictor_internal'
      and p.proname in ('lms_current_used_cycle', 'lms_used_team_ids',
                        'lms_reset_due', 'lms_cycle_for_pick')
      and (has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))),
  0,
  'no browser role can execute any of the four cycle functions'
);

select * from finish();
rollback;
