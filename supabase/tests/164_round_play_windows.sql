-- Contract 113: the round play window.
--
-- `fixtureReassignment.ts` resolves a moved fixture's destination by round
-- window, and `competition_rounds` had none — so the authority was unreachable
-- from the database. This adds the window, the guard that keeps windows
-- disjoint, and the resolver.
--
-- Every assertion below names a specific round it created. Nothing counts rows
-- across the season: the league seasons are empty in a database built from
-- migrations and seed alone, and full on a developer machine that ran the
-- league seed, so a total is a different number in the two places. Contract
-- 112's suite learned that the hard way.

begin;

select plan(22);

select set_config('test.rpw_season',
  (select t.id::text from public.tournaments t where t.name = 'Premier League 2026/27'), true);

select set_config('test.rpw_other',
  (select t.id::text from public.tournaments t where t.name = 'Scottish Premiership 2026/27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.rpw_season')::uuid, 'Window Rovers'),
  (current_setting('test.rpw_season')::uuid, 'Window United');

-- Three rounds. Two are played over a weekend each, a week apart, which leaves
-- a real midweek gap between them. The third has no fixtures at all — the
-- Scottish post-split case, where nobody yet knows who plays.
insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label) values
  (current_setting('test.rpw_season')::uuid, 'rpw-mw1', 951, 'league_matchweek', 'Window Matchweek 1'),
  (current_setting('test.rpw_season')::uuid, 'rpw-mw2', 952, 'league_matchweek', 'Window Matchweek 2'),
  (current_setting('test.rpw_season')::uuid, 'rpw-mw3', 953, 'league_matchweek', 'Window Matchweek 3 (no fixtures)'),
  (current_setting('test.rpw_other')::uuid, 'sp-window', 951, 'league_matchweek', 'Other Season Window');

select set_config('test.rpw_r1',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.rpw_season')::uuid and round_key = 'rpw-mw1'), true);
select set_config('test.rpw_r2',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.rpw_season')::uuid and round_key = 'rpw-mw2'), true);
select set_config('test.rpw_r3',
  (select id::text from public.competition_rounds
    where tournament_id = current_setting('test.rpw_season')::uuid and round_key = 'rpw-mw3'), true);

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select current_setting('test.rpw_season')::uuid, round_id, home.id, away.id, kickoff, 'scheduled'
from (values
  (current_setting('test.rpw_r1')::uuid, timestamptz '2030-03-02 15:00:00+00'),
  (current_setting('test.rpw_r2')::uuid, timestamptz '2030-03-09 15:00:00+00')
) as seed(round_id, kickoff)
cross join lateral (
  select id from public.teams
   where tournament_id = current_setting('test.rpw_season')::uuid and name = 'Window Rovers') home
cross join lateral (
  select id from public.teams
   where tournament_id = current_setting('test.rpw_season')::uuid and name = 'Window United') away;

-- ---------------------------------------------------------------------------
-- Reachability
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.routine_privileges
    where routine_schema = 'predictor_internal'
      and routine_name in ('derive_round_play_windows', 'resolve_round_for_kickoff',
                           'assert_round_window_disjoint')
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'no browser or service role may derive or resolve a round window'
);

select is(
  (select count(*)::integer from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
   where ns.nspname = 'predictor_internal'
     and proc.proname in ('derive_round_play_windows', 'resolve_round_for_kickoff',
                          'assert_round_window_disjoint')
     and proc.prosecdef
     and proc.proconfig @> array['search_path=""']),
  3,
  'and all three are security definer with a pinned search path'
);

-- Adding columns to a browser-readable table widens what a browser can see.
-- This one is granted to service_role only, which is why the columns are safe
-- to add at all.
select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'competition_rounds'
      and grantee in ('anon', 'authenticated')),
  0,
  'competition_rounds reaches no browser role, so the new window columns widen nothing'
);

-- ---------------------------------------------------------------------------
-- A window that cannot be evaluated is refused
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$update public.competition_rounds set window_opens_at = '2030-03-02 15:00:00+00'
           where id = %L::uuid$$, current_setting('test.rpw_r1')),
  '23514',
  null,
  'half a window is refused — a null close would read as "no destination" for a round that has one'
);

select throws_ok(
  format($$update public.competition_rounds
             set window_opens_at = '2030-03-05 15:00:00+00',
                 window_closes_at = '2030-03-02 15:00:00+00'
           where id = %L::uuid$$, current_setting('test.rpw_r1')),
  '23514',
  null,
  'and a window that closes before it opens is refused rather than stored as an empty span'
);

-- ---------------------------------------------------------------------------
-- Disjointness: what makes an ambiguous destination impossible
-- ---------------------------------------------------------------------------

update public.competition_rounds
   set window_opens_at = '2030-03-02 12:00:00+00',
       window_closes_at = '2030-03-02 20:00:00+00'
 where id = current_setting('test.rpw_r1')::uuid;

select throws_ok(
  format($$update public.competition_rounds
             set window_opens_at = '2030-03-02 18:00:00+00',
                 window_closes_at = '2030-03-03 20:00:00+00'
           where id = %L::uuid$$, current_setting('test.rpw_r2')),
  '23505',
  null,
  'two rounds in one season may not claim the same instant, which is what makes an ambiguous destination unreachable from stored data'
);

-- Touching counts as overlapping. Bounds are inclusive at both ends to match
-- the domain module's containment test, so a kickoff at the shared instant
-- would satisfy both rounds — exactly the ambiguity being excluded.
select throws_ok(
  format($$update public.competition_rounds
             set window_opens_at = '2030-03-02 20:00:00+00',
                 window_closes_at = '2030-03-03 20:00:00+00'
           where id = %L::uuid$$, current_setting('test.rpw_r2')),
  '23505',
  null,
  'windows that merely touch are refused too, because an instant on the shared boundary would fall in both'
);

select lives_ok(
  format($$update public.competition_rounds
             set window_opens_at = '2030-03-02 20:00:00.001+00',
                 window_closes_at = '2030-03-03 20:00:00+00'
           where id = %L::uuid$$, current_setting('test.rpw_r2')),
  'a window starting after the previous one closes is accepted'
);

-- A season is scoped: another competition season may claim the same instant.
select lives_ok(
  format($$update public.competition_rounds
             set window_opens_at = '2030-03-02 12:00:00+00',
                 window_closes_at = '2030-03-02 20:00:00+00'
           where round_key = 'sp-window' and tournament_id = %L::uuid$$,
         current_setting('test.rpw_other')),
  'and the disjointness rule is per competition season, not global — two leagues play on the same Saturday'
);

-- ---------------------------------------------------------------------------
-- Derivation
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.derive_round_play_windows(current_setting('test.rpw_season')::uuid),
  (select count(distinct fixture.competition_round_id)::integer
     from public.season_fixtures fixture
    where fixture.tournament_id = current_setting('test.rpw_season')::uuid
      and fixture.kickoff_at is not null),
  'derivation gives a window to exactly the rounds that have a fixture, and counts only those — a looser assertion let a mutant that walked every round survive'
);

select is(
  (select jsonb_build_object('opens', window_opens_at, 'closes', window_closes_at)
     from public.competition_rounds where id = current_setting('test.rpw_r1')::uuid),
  jsonb_build_object('opens', timestamptz '2030-03-02 15:00:00+00',
                     'closes', timestamptz '2030-03-02 15:00:00+00'),
  'a round is bounded by its own fixtures — one fixture makes an instantaneous window, which is honest rather than padded'
);

select is(
  (select window_opens_at is null and window_closes_at is null
     from public.competition_rounds where id = current_setting('test.rpw_r3')::uuid),
  true,
  'a round with no fixtures gets NO window — the post-split case, where a competition cannot say when a round is played before it knows who plays it'
);

select is(
  predictor_internal.resolve_round_for_kickoff(
    current_setting('test.rpw_season')::uuid, timestamptz '2030-03-02 15:00:00+00'),
  current_setting('test.rpw_r1')::uuid,
  'the derived window resolves its own kickoff'
);

-- Re-derivation must be safe. The clear-then-set order is what allows it: a
-- round keeping a stale window would block the round that legitimately took
-- that time.
select is(
  predictor_internal.derive_round_play_windows(current_setting('test.rpw_season')::uuid),
  (select count(distinct fixture.competition_round_id)::integer
     from public.season_fixtures fixture
    where fixture.tournament_id = current_setting('test.rpw_season')::uuid
      and fixture.kickoff_at is not null),
  'derivation re-runs without tripping its own disjointness guard, and reaches the same count'
);

update public.season_fixtures
   set competition_round_id = current_setting('test.rpw_r3')::uuid,
       kickoff_at = timestamptz '2030-03-16 15:00:00+00'
 where competition_round_id = current_setting('test.rpw_r1')::uuid;

select is(
  predictor_internal.derive_round_play_windows(current_setting('test.rpw_season')::uuid),
  (select count(distinct fixture.competition_round_id)::integer
     from public.season_fixtures fixture
    where fixture.tournament_id = current_setting('test.rpw_season')::uuid
      and fixture.kickoff_at is not null),
  'and after a fixture moves between rounds the count still names only rounds with fixtures'
);

select is(
  (select window_opens_at is null from public.competition_rounds
    where id = current_setting('test.rpw_r1')::uuid),
  true,
  'a round whose fixtures all left loses its window rather than keeping a span it no longer plays'
);

select is(
  (select window_opens_at from public.competition_rounds
    where id = current_setting('test.rpw_r3')::uuid),
  timestamptz '2030-03-16 15:00:00+00',
  'and the round that received them gains one'
);

-- ---------------------------------------------------------------------------
-- Resolution, including the refusal this contract deliberately accepts
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.resolve_round_for_kickoff(
    current_setting('test.rpw_season')::uuid, timestamptz '2030-03-12 19:45:00+00'),
  null,
  'a midweek date between two matchweeks resolves to NOTHING — rounds bound the time they are played, they do not tile the calendar, and the caller must refuse rather than guess a nearer round'
);

select is(
  predictor_internal.resolve_round_for_kickoff(
    current_setting('test.rpw_season')::uuid, null),
  null,
  'a null kickoff resolves to nothing rather than raising'
);

select is(
  predictor_internal.resolve_round_for_kickoff(
    md5('rpw-nowhere')::uuid, timestamptz '2030-03-16 15:00:00+00'),
  null,
  'and an unknown competition season resolves to nothing'
);

select is(
  predictor_internal.resolve_round_for_kickoff(
    current_setting('test.rpw_other')::uuid, timestamptz '2030-03-16 15:00:00+00'),
  null,
  'a window in one season never answers for another'
);

select throws_ok(
  format('select predictor_internal.derive_round_play_windows(%L::uuid)', md5('rpw-nowhere')::uuid),
  '23503',
  null,
  'deriving windows for a competition season that does not exist is refused rather than silently setting none'
);

select finish();

rollback;
