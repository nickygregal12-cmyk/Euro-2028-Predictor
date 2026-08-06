-- Contract 120: a season's play context.
--
-- The function adds no scheduling logic — it resolves a season from a URL's
-- two slugs and exposes contract 109's `next_eligible_league_round`. So these
-- assertions spend their effort on the three things a resolver-plus-wrapper
-- can get wrong: the boundary it opens, whether it resolves the RIGHT season,
-- and whether it reports the authority it wraps rather than a second opinion.
--
-- Resolving the right season is the assertion that matters most and is easiest
-- to get wrong quietly. Two seasons share `season_key = '2026-27'` and are
-- told apart only by their competition, so a resolver that dropped the slug
-- from its predicate would still return a season, still return a plausible
-- matchweek, and route every Premier League player into the Scottish
-- Premiership. It is checked in both directions rather than once.
--
-- THE MATCHWEEK FIXTURES ARE DELIBERATELY OUT OF ORDER. The Premier League
-- probe's four matchweeks are seeded so that matchweek 3 kicks off first. A
-- read that returned the lowest ordinal, or the first row it found, would
-- answer 1 and look entirely reasonable; only a read that goes through the
-- authority — which orders by the DERIVED lock instant, the property contract
-- 119 made matter — answers 3. Asserting a literal rather than re-deriving the
-- expected value from the same function is what makes this a check instead of
-- a restatement.
--
-- The end-of-season case is the other one worth being explicit about. A season
-- past its last lock has no next round, and that must read as "no matchweek"
-- rather than as an error — while a slug naming nothing must raise. A single
-- null for both would let a mistyped URL look like a finished season. The
-- Scottish Premiership probe carries it: its matchweeks are all in the past, so
-- one season proves both that the slug resolves to its own competition and that
-- a finished season is reported rather than refused.
--
-- Both seasons get their rounds and fixtures here rather than relying on the
-- seed. The seeded domestic seasons have no `league_matchweek` rounds at all —
-- an earlier draft of this file assumed they did, and every answer assertion in
-- it would have failed on a refusal that was the seed's shape rather than the
-- function's behaviour.

begin;

select plan(21);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_season_play_context(text,text)', 'execute'),
  true, 'authenticated may resolve a season''s play context');

select is(
  has_function_privilege('anon', 'public.get_season_play_context(text,text)', 'execute'),
  false, 'anon may not — a signed-out visitor has no card to open');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_play_context'),
  true, 'the read is security definer, because every table under it is revoked');

select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_play_context'),
  array['search_path=""'], 'search_path is pinned to the empty string');

-- The tables it reads on the caller's behalf must stay unreachable directly,
-- and the authority it wraps must stay internal. Exposing the wrapper is the
-- whole point; exposing either of these would be a different, larger change.
select is(
  has_table_privilege('authenticated', 'public.competitions', 'select'),
  false, 'competitions is still revoked from the browser');

select is(
  has_table_privilege('authenticated', 'public.competition_rounds', 'select'),
  false, 'competition_rounds is still revoked from the browser');

select is(
  has_function_privilege(
    'authenticated',
    'predictor_internal.next_eligible_league_round(uuid,text,timestamptz)',
    'execute'),
  false, 'the scheduling authority stays revoked from the browser');

-- ---------------------------------------------------------------------------
-- Setup.
--
-- Premier League: four matchweeks, rescheduled so matchweek 3 locks first.
-- Scottish Premiership: two matchweeks, both already kicked off.
-- ---------------------------------------------------------------------------

select set_config('test.pc_pl',
  (select season.id::text
     from public.tournaments season
     join public.competitions competition on competition.id = season.competition_id
    where competition.slug = 'premier-league' and season.season_key = '2026-27'), true);

select set_config('test.pc_sp',
  (select season.id::text
     from public.tournaments season
     join public.competitions competition on competition.id = season.competition_id
    where competition.slug = 'scottish-premiership' and season.season_key = '2026-27'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.pc_pl')::uuid, 'C120 Home'),
  (current_setting('test.pc_pl')::uuid, 'C120 Away'),
  (current_setting('test.pc_sp')::uuid, 'C120 North'),
  (current_setting('test.pc_sp')::uuid, 'C120 South');

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.pc_pl')::uuid, format('c120-mw%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 4) as n;

insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label)
select current_setting('test.pc_sp')::uuid, format('c120-sp%s', n), n,
       'league_matchweek', format('Matchweek %s', n)
from generate_series(1, 2) as n;

-- One fixture per matchweek. The offsets are what make matchweek 3 the one
-- that locks next: 40, 30, 7 and 20 days out respectively.
insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select
  round.tournament_id,
  round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'C120 Home'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'C120 Away'),
  now() + (case round.ordinal
             when 1 then 40 when 2 then 30 when 3 then 7 else 20
           end * interval '1 day'),
  'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.pc_pl')::uuid
  and round.kind = 'league_matchweek';

insert into public.season_fixtures (
  tournament_id, competition_round_id, home_team_id, away_team_id, kickoff_at, status
)
select
  round.tournament_id,
  round.id,
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'C120 North'),
  (select team.id from public.teams team
    where team.tournament_id = round.tournament_id and team.name = 'C120 South'),
  now() - (round.ordinal * interval '14 days'),
  'scheduled'
from public.competition_rounds round
where round.tournament_id = current_setting('test.pc_sp')::uuid
  and round.kind = 'league_matchweek';

-- ---------------------------------------------------------------------------
-- Refusals: the caller mistakes that must not read as an empty season.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_season_play_context('premier-league', '2026-27')$$,
  '42501', 'Authentication is required',
  'a signed-out caller is refused — there is no card for them to open');

select set_config('request.jwt.claim.sub', md5('c120-player')::uuid::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select public.get_season_play_context(null, '2026-27')$$,
  '22023', 'A competition and season are required',
  'a missing slug is refused rather than answered');

select throws_ok(
  $$select public.get_season_play_context('premier-league', null)$$,
  '22023', 'A competition and season are required',
  'a missing season key is refused rather than answered');

select throws_ok(
  $$select public.get_season_play_context('no-such-competition', '2026-27')$$,
  '22023', 'That competition season does not exist',
  'an unknown competition is refused, not reported as finished');

select throws_ok(
  $$select public.get_season_play_context('premier-league', '1997-98')$$,
  '22023', 'That competition season does not exist',
  'a real competition in an unknown season is refused too');

-- A tournament-shaped competition has no league matchweeks, so the question
-- does not apply and the answer must say so rather than return an empty one.
select throws_ok(
  format(
    $$select public.get_season_play_context(%L, %L)$$,
    (select competition.slug
       from public.tournaments season
       join public.competitions competition on competition.id = season.competition_id
      where season.kind = 'tournament' limit 1),
    (select season.season_key
       from public.tournaments season
      where season.kind = 'tournament' limit 1)),
  '22023', 'That competition is not a league season',
  'a tournament is refused — the question does not apply to it');

-- ---------------------------------------------------------------------------
-- Resolving the RIGHT season. Both seeded seasons share a season key.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_play_context('premier-league', '2026-27') ->> 'tournament_id')::uuid,
  current_setting('test.pc_pl')::uuid,
  'the Premier League slug resolves to the Premier League season');

select is(
  (public.get_season_play_context('scottish-premiership', '2026-27') ->> 'tournament_id')::uuid,
  current_setting('test.pc_sp')::uuid,
  'the Scottish Premiership slug resolves to its own season, not the other one');

select is(
  public.get_season_play_context('premier-league', '2026-27') ->> 'competition_name',
  'Premier League', 'the competition name comes from the table the browser cannot read');

select is(
  public.get_season_play_context('premier-league', '2026-27') ->> 'time_zone',
  'Europe/London', 'the season''s own display timezone is returned, not the server''s');

-- ---------------------------------------------------------------------------
-- The answer, against the authority it wraps.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_play_context('premier-league', '2026-27') ->> 'of')::integer,
  4, 'the matchweek count is that season''s own, not a constant');

-- The one assertion the whole contract turns on. Matchweek 3 kicks off first,
-- so a read that ordered by `ordinal` — or took the first round it found —
-- would answer 1 here and be wrong in a way nobody would notice until a
-- rescheduled season sent every player to the wrong card.
select is(
  (public.get_season_play_context('premier-league', '2026-27') ->> 'matchweek')::integer,
  3, 'the matchweek reported is the one that locks next, not the lowest number');

select is(
  (public.get_season_play_context('premier-league', '2026-27') ->> 'locks_at')::timestamptz,
  (select min(fixture.kickoff_at) - make_interval(mins => definition.buffer_minutes)
     from public.season_fixtures fixture
     join public.competition_rounds round on round.id = fixture.competition_round_id
    cross join public.game_definitions definition
    where round.tournament_id = current_setting('test.pc_pl')::uuid
      and round.ordinal = 3
      and definition.game_key = 'main_predictor'
    group by definition.buffer_minutes),
  'the lock instant carries the Match Predictor buffer, not the raw kickoff');

-- ---------------------------------------------------------------------------
-- A season with nothing left to play. Not an error, and not a missing season.
-- ---------------------------------------------------------------------------

select is(
  public.get_season_play_context('scottish-premiership', '2026-27') ->> 'matchweek',
  null, 'a season past its last lock reports no matchweek rather than raising');

select is(
  (public.get_season_play_context('scottish-premiership', '2026-27') ->> 'of')::integer,
  2, 'and still reports how many matchweeks the season had');

select * from finish();
rollback;
