-- Contract 90: the season Main Predictor score store.
--
-- Most of this table is relationships, which the keys enforce and which need
-- little proving. Four things are RULES wearing a constraint's clothing, and
-- those are what this file is about:
--
--   1. a row means a matchweek SETTLED — absence is not zero points, it is no
--      matchweek, and `standings.ts` counts rows as matchweeks played;
--   2. the Joker doubles, so a Joker matchweek's total cannot be odd;
--   3. points cannot come from nowhere — a total above zero with no
--      contributing fixture would inflate a leaderboard silently;
--   4. a season score cannot attach to a tournament round, which the composite
--      keys alone permit because a knockout round satisfies them perfectly.
--
-- The competition-separation cases matter most. ADR 0011 forbids a combined
-- cross-competition scoring path, and the failure would not look like a
-- failure: every total would be arithmetically right and attached to the wrong
-- competition.

begin;
select plan(16);

-- ---------------------------------------------------------------------------
-- Structure.
-- ---------------------------------------------------------------------------

select has_table('public', 'season_matchweek_scores', 'the season score store exists');

select is(
  (select relrowsecurity from pg_class
    where relname = 'season_matchweek_scores' and relnamespace = 'public'::regnamespace),
  true,
  'row level security is enabled'
);

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_name = 'season_matchweek_scores' and grantee in ('anon', 'authenticated')),
  0,
  'no browser role holds a direct grant — totals arrive through a bounded read'
);

select is(
  (select count(*)::integer from public.season_matchweek_scores),
  0,
  'the migration invents no scores'
);

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.season_matchweek_scores'::regclass
      and contype = 'p'),
  'PRIMARY KEY (entry_id, competition_round_id)',
  'one settled total per entry per matchweek'
);

-- ---------------------------------------------------------------------------
-- Fixtures: one league season, one tournament, an entry in each.
-- ---------------------------------------------------------------------------

create temporary table score_probe as
select
  (select id from public.tournaments where kind = 'league_season' order by name limit 1) as season_id,
  (select id from public.tournaments where kind = 'tournament' order by name limit 1) as tournament_id;

-- All three rounds up front. A round created inside a `throws_ok` body is
-- rolled back with the throw that assertion expects, so a later assertion that
-- referenced it would fail on a missing round rather than on its own subject.
insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select season_id, 'SC' || n, 399 + n, 'league_matchweek', 'Score probe ' || n
from score_probe, generate_series(1, 4) n;

select set_config('test.c90_round',
  (select r.id::text from public.competition_rounds r join score_probe p on p.season_id = r.tournament_id
    where r.round_key = 'SC1'), true);

-- A knockout round in the TOURNAMENT, which satisfies the composite keys just
-- as well as a matchweek does.
select set_config('test.c90_tourn_round',
  (select r.id::text from public.competition_rounds r join score_probe p on p.tournament_id = r.tournament_id
    where r.kind = 'knockout_round' order by r.ordinal limit 1), true);

set local session_replication_role = replica;
insert into auth.users (
  id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  md5('c90-player')::uuid, 'c90-player@example.test',
  'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
);
set local session_replication_role = origin;

insert into public.entries (tournament_id, user_id)
select season_id, md5('c90-player')::uuid from score_probe;
insert into public.entries (tournament_id, user_id)
select tournament_id, md5('c90-player')::uuid from score_probe;

select set_config('test.c90_entry',
  (select e.id::text from public.entries e join score_probe p on p.season_id = e.tournament_id
    where e.user_id = md5('c90-player')::uuid), true);
select set_config('test.c90_tourn_entry',
  (select e.id::text from public.entries e join score_probe p on p.tournament_id = e.tournament_id
    where e.user_id = md5('c90-player')::uuid), true);
select set_config('test.c90_season',
  (select season_id::text from score_probe), true);
select set_config('test.c90_tournament',
  (select tournament_id::text from score_probe), true);

-- ---------------------------------------------------------------------------
-- A well-formed settled total is accepted.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      current_setting('test.c90_round')::uuid,
      13, false, 5
    )
  $$,
  'a settled matchweek total is accepted'
);

select throws_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      current_setting('test.c90_round')::uuid,
      20, false, 5
    )
  $$,
  '23505',
  null,
  'and the same entry cannot hold two totals for one matchweek'
);

-- ---------------------------------------------------------------------------
-- The Joker doubles. An odd total on a Joker matchweek is impossible.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      -- SC4, which holds no row yet. Pointed at a round that already had one,
      -- this assertion would be refused by the primary key even with the Joker
      -- check removed, and would be proving someone else's constraint.
      (select id from public.competition_rounds
        where tournament_id = current_setting('test.c90_season')::uuid and round_key = 'SC4'),
      7, true, 3
    )
  $$,
  '23514',
  null,
  'an odd total on a Joker matchweek is refused — doubling an integer cannot produce one'
);

select lives_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      (select id from public.competition_rounds
        where tournament_id = current_setting('test.c90_season')::uuid and round_key = 'SC2'),
      14, true, 4
    )
  $$,
  'while an even one is accepted, so the rule is a rule and not a wall'
);

-- ---------------------------------------------------------------------------
-- Points cannot come from nowhere.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      (select id from public.competition_rounds
        where tournament_id = current_setting('test.c90_season')::uuid and round_key = 'SC3'),
      5, false, 0
    )
  $$,
  '23514',
  null,
  'a total above zero with no contributing fixture is refused'
);

select lives_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      (select id from public.competition_rounds
        where tournament_id = current_setting('test.c90_season')::uuid and round_key = 'SC3'),
      0, false, 0
    )
  $$,
  'but a settled matchweek that scored nothing is a legitimate zero'
);

-- ---------------------------------------------------------------------------
-- COMPETITION SEPARATION, which is what ADR 0011 is for and what a wrong
-- answer here would look like: arithmetically perfect, attached to the wrong
-- competition.
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_tournament')::uuid,
      current_setting('test.c90_tourn_entry')::uuid,
      current_setting('test.c90_tourn_round')::uuid,
      9, false, 3
    )
  $$,
  '23514',
  'Season matchweek scores belong to a league season, not a tournament competition',
  'a tournament entry cannot hold a season matchweek score, though both composite keys are satisfied'
);

select throws_ok(
  $$
    insert into public.season_matchweek_scores (
      tournament_id, entry_id, competition_round_id, points, joker_applied, fixtures_scored
    ) values (
      current_setting('test.c90_season')::uuid,
      current_setting('test.c90_entry')::uuid,
      current_setting('test.c90_tourn_round')::uuid,
      9, false, 3
    )
  $$,
  '23514',
  'Season matchweek scores attach to a league matchweek, not a knockout_round round',
  'and a season entry cannot score against a tournament round — the shape trigger speaks before the key, as it runs BEFORE insert'
);

-- The mixed case the SINGLE-column form would have allowed: this season's
-- entry, another competition's round, both individually valid.
select is(
  (select count(*)::integer from pg_constraint
    where conrelid = 'public.season_matchweek_scores'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%(tournament_id, entry_id)%'),
  1,
  'the entry key is composite, so an entry cannot be paired across competitions'
);

select is(
  (select count(*)::integer from pg_constraint
    where conrelid = 'public.season_matchweek_scores'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) like '%(tournament_id, competition_round_id)%'),
  1,
  'and so is the round key'
);

-- ---------------------------------------------------------------------------
-- The shape trigger is bound. `create or replace` on the function would leave
-- this intact, but a later contract that drops and recreates it would take the
-- binding with it and every assertion above would pass on the keys alone.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_trigger t
     join pg_class c on c.oid = t.tgrelid
    where c.relname = 'season_matchweek_scores'
      and not t.tgisinternal
      and t.tgfoid = 'predictor_internal.assert_season_matchweek_score_shape()'::regprocedure),
  1,
  'the store is bound to its shape trigger'
);

select * from finish();
rollback;
