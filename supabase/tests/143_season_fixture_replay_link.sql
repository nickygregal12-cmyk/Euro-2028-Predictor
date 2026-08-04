-- Contract 92: which fixture a replay is.
--
-- WHAT IS BEING PROTECTED is the matches-played denominator, one level below
-- where contract 91 protects it. The resolver drops a `carried_to_replay`
-- fixture because its slot belongs to the replay; these constraints are what
-- make "its slot belongs to the replay" true of the data rather than merely
-- asserted by whoever built the card.
--
-- Every assertion below is an attempt to set the link so that the denominator
-- becomes wrong while each fixture row still looks perfectly reasonable read on
-- its own. The cycle is the worst of them and the reason a trigger exists at
-- all: `A abandoned → B` with `B abandoned → A` passes every CHECK here, and
-- then BOTH fixtures leave the denominator while NEITHER slot is ever filled.
-- The matchweek still settles. Nothing looks stuck, every total is defensible,
-- and the table is quietly two matches short for the rest of the season.

begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- Structure: the link is optional, because almost no fixture has one.
-- ---------------------------------------------------------------------------

select has_column('public', 'season_fixtures', 'replay_fixture_id',
  'season_fixtures records which fixture a replay is');

select is(
  (select attnotnull from pg_attribute
    where attrelid = 'public.season_fixtures'::regclass
      and attname = 'replay_fixture_id'),
  false,
  'and the link is optional — the unlinked fixture is the overwhelming majority'
);

-- Restrict, not set null. A null-out would return the abandoned fixture to the
-- denominator with no replay holding its slot, changing a settled historic
-- total with no statement anywhere that anything changed.
select is(
  (select confdeltype from pg_constraint
    where conrelid = 'public.season_fixtures'::regclass
      and conname = 'season_fixtures_replay_fkey'),
  'r'::"char",
  'deleting a fixture that is somebody''s replay is REFUSED, not silently unlinked'
);

-- Composite, so a replay cannot be borrowed from another tournament's season.
select is(
  (select cardinality(conkey)::text from pg_constraint
    where conrelid = 'public.season_fixtures'::regclass
      and conname = 'season_fixtures_replay_fkey'),
  '2',
  'and the reference is tournament-scoped, so a replay cannot come from another season'
);

-- Partial, so the unlinked majority is untouched by the uniqueness rule.
-- `to_regclass`, not a cast: a missing index must fail THIS assertion, not
-- abort the transaction and take every later assertion with it.
select is(
  (select indisunique and indpred is not null
     from pg_index
    where indexrelid = to_regclass('public.season_fixtures_replay_target_unique')),
  true,
  'at most one abandoned match may claim a given replay, enforced by a PARTIAL unique index'
);

-- ---------------------------------------------------------------------------
-- Fixtures. Two matchweeks and four clubs, created up front: a row created
-- inside a `throws_ok` body is rolled back with the throw that assertion
-- expects, so a later assertion referencing it would fail on a missing row
-- rather than on its own subject.
-- ---------------------------------------------------------------------------

create temporary table replay_probe as
select (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'RP' || n, 449 + n, 'league_matchweek', 'Replay probe ' || n
from replay_probe, generate_series(1, 2) n;

insert into public.teams (tournament_id, name)
select season_id, 'Replay Probe FC ' || n from replay_probe, generate_series(1, 6) n;

select set_config('test.c92_season', (select season_id::text from replay_probe), true);
select set_config('test.c92_r1',
  (select r.id::text from public.competition_rounds r join replay_probe p on p.season_id = r.tournament_id
    where r.round_key = 'RP1'), true);
select set_config('test.c92_r2',
  (select r.id::text from public.competition_rounds r join replay_probe p on p.season_id = r.tournament_id
    where r.round_key = 'RP2'), true);

-- Six clubs, addressed by name so the ids never have to be guessed.
select set_config('test.c92_club' || n,
  (select t.id::text from public.teams t join replay_probe p on p.season_id = t.tournament_id
    where t.name = 'Replay Probe FC ' || n), true)
from generate_series(1, 6) n;

-- Two abandoned fixtures in matchweek 1, and two scheduled ones in matchweek 2:
-- the replay itself, and a SPARE that nothing points at. The spare exists so
-- the "only an abandoned fixture may name a replay" case can be attempted
-- against a target that closes no cycle — pointed at anything already in the
-- chain, the chain walk refuses it first and the CHECK is never reached, which
-- is exactly how an earlier version of this file let that mutant survive.
insert into public.season_fixtures (tournament_id, competition_round_id, home_team_id, away_team_id, status)
values
  (current_setting('test.c92_season')::uuid, current_setting('test.c92_r1')::uuid,
   current_setting('test.c92_club1')::uuid, current_setting('test.c92_club2')::uuid, 'abandoned'),
  (current_setting('test.c92_season')::uuid, current_setting('test.c92_r1')::uuid,
   current_setting('test.c92_club3')::uuid, current_setting('test.c92_club4')::uuid, 'abandoned'),
  (current_setting('test.c92_season')::uuid, current_setting('test.c92_r2')::uuid,
   current_setting('test.c92_club1')::uuid, current_setting('test.c92_club2')::uuid, 'scheduled'),
  (current_setting('test.c92_season')::uuid, current_setting('test.c92_r2')::uuid,
   current_setting('test.c92_club3')::uuid, current_setting('test.c92_club4')::uuid, 'scheduled'),
  (current_setting('test.c92_season')::uuid, current_setting('test.c92_r1')::uuid,
   current_setting('test.c92_club5')::uuid, current_setting('test.c92_club6')::uuid, 'abandoned');

select set_config('test.c92_original',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c92_r1')::uuid
      and f.home_team_id = current_setting('test.c92_club1')::uuid), true);
select set_config('test.c92_other',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c92_r1')::uuid
      and f.home_team_id = current_setting('test.c92_club3')::uuid), true);
select set_config('test.c92_replay',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c92_r2')::uuid
      and f.home_team_id = current_setting('test.c92_club1')::uuid), true);
select set_config('test.c92_spare',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c92_r2')::uuid
      and f.home_team_id = current_setting('test.c92_club3')::uuid), true);
select set_config('test.c92_third',
  (select f.id::text from public.season_fixtures f
    where f.competition_round_id = current_setting('test.c92_r1')::uuid
      and f.home_team_id = current_setting('test.c92_club5')::uuid), true);

-- ---------------------------------------------------------------------------
-- The link works at all — without this the refusals below could all be
-- passing for the wrong reason.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = current_setting('test.c92_replay')::uuid
     where id = current_setting('test.c92_original')::uuid
  $$,
  'an abandoned fixture may name the fixture that took its slot'
);

select is(
  (select replay_fixture_id from public.season_fixtures
    where id = current_setting('test.c92_original')::uuid),
  current_setting('test.c92_replay')::uuid,
  'and the link is what was written — carried_to_replay is now reachable from stored data'
);

-- ---------------------------------------------------------------------------
-- The ways the denominator could be corrupted.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = current_setting('test.c92_replay')::uuid
     where id = current_setting('test.c92_other')::uuid
  $$,
  '23505',
  null,
  'a second abandoned match cannot claim the same replay — two slots would vacate and only one match would take their place'
);

-- Pointed at the SPARE, which closes no cycle, so the chain walk has nothing to
-- say and only the CHECK can refuse this. Aimed at a fixture already in the
-- chain it would be refused by the walk instead, and dropping the CHECK would
-- change nothing — which is how this mutant survived a first draft of the file.
select throws_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = current_setting('test.c92_spare')::uuid
     where id = current_setting('test.c92_replay')::uuid
  $$,
  '23514',
  null,
  'a fixture that was not abandoned may not name a replay — contract 91 refuses the same card as replay_on_non_abandoned_fixture'
);

-- WITH TRIGGERS DISABLED, which is the only condition under which the not-self
-- CHECK is not redundant. In ordinary operation the chain walk catches a
-- self-reference on its first step, so removing the CHECK changes nothing an
-- origin-mode test can see. Replica mode — used by restore, by logical
-- replication, and by this very suite to seed `auth.users` — suspends every
-- trigger while leaving CHECK constraints in force. That is the layer the
-- declarative constraint buys, so it is the layer the assertion tests.
set local session_replication_role = replica;

select throws_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = id
     where id = current_setting('test.c92_other')::uuid
  $$,
  '23514',
  null,
  'a fixture may not be its own replay even with triggers suspended — the CHECK holds where the chain walk cannot run'
);

set local session_replication_role = origin;

-- The cycle. `other` is abandoned and unlinked, `original` is abandoned and
-- points at `replay`. Linking `replay`... is blocked by status, so the cycle
-- has to be built between two abandoned fixtures: point `other` at `original`,
-- which is legal, then close it.
select lives_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = current_setting('test.c92_other')::uuid
     where id = current_setting('test.c92_original')::uuid
  $$,
  'an abandoned fixture may be replayed by another abandoned fixture — a replay can itself be abandoned, so chains are legitimate'
);

select throws_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = current_setting('test.c92_original')::uuid
     where id = current_setting('test.c92_other')::uuid
  $$,
  '23514',
  'A replay chain cannot return to the fixture it started from',
  'but closing the chain into a cycle is refused — both slots would vacate and neither would ever be filled, while the matchweek still settled'
);

-- ---------------------------------------------------------------------------
-- The bound on the walk, which is not decoration.
--
-- A cycle that does NOT contain the row being written is invisible to the
-- `= new.id` test, so without the step limit the walk goes round it forever:
-- not an error, a transaction that never returns while holding its locks, on a
-- path an hourly job would retry into. And the cycle is reachable — replica
-- mode suspends the trigger, so a restore or a logical-replication stream can
-- land one that origin-mode writes could never have created.
-- ---------------------------------------------------------------------------

set local session_replication_role = replica;
update public.season_fixtures
   set replay_fixture_id = current_setting('test.c92_original')::uuid
 where id = current_setting('test.c92_other')::uuid;
set local session_replication_role = origin;

select is(
  (select count(*)::text from public.season_fixtures
    where id in (current_setting('test.c92_original')::uuid, current_setting('test.c92_other')::uuid)
      and replay_fixture_id is not null),
  '2',
  'replica mode really can land a cycle the trigger would have refused — the setup for the next assertion is not vacuous'
);

select throws_ok(
  $$
    update public.season_fixtures
       set replay_fixture_id = current_setting('test.c92_original')::uuid
     where id = current_setting('test.c92_third')::uuid
  $$,
  '23514',
  'A replay chain may not exceed 10 links',
  'and a write that walks INTO an existing cycle is bounded rather than spinning — the `= new.id` test cannot see a loop the new row is not part of'
);

-- ---------------------------------------------------------------------------
-- The link is not a browser concern.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::text from information_schema.role_table_grants
    where table_name = 'season_fixtures' and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE')),
  '0',
  'no browser role may write a fixture, so the link cannot be set from a client'
);

select is(
  has_function_privilege('authenticated',
    'predictor_internal.assert_season_fixture_replay_acyclic()', 'execute'),
  false,
  'and the chain walk is not callable from a browser role'
);

select * from finish();
rollback;
