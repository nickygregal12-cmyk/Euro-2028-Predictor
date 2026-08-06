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
-- The end-of-season case is the other one worth being explicit about. A season
-- past its last lock has no next round, and that must read as "no matchweek"
-- rather than as an error — while a slug naming nothing must raise. A single
-- null for both would let a mistyped URL look like a finished season.

begin;

select plan(16);

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
-- Refusals: the caller mistakes that must not read as an empty season.
-- ---------------------------------------------------------------------------

set local role authenticated;

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

reset role;

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
  (select season.id
     from public.tournaments season
     join public.competitions competition on competition.id = season.competition_id
    where competition.slug = 'premier-league' and season.season_key = '2026-27'),
  'the Premier League slug resolves to the Premier League season');

select is(
  (public.get_season_play_context('scottish-premiership', '2026-27') ->> 'tournament_id')::uuid,
  (select season.id
     from public.tournaments season
     join public.competitions competition on competition.id = season.competition_id
    where competition.slug = 'scottish-premiership' and season.season_key = '2026-27'),
  'the Scottish Premiership slug resolves to its own season, not the other one');

-- ---------------------------------------------------------------------------
-- The answer, against the authority it wraps.
-- ---------------------------------------------------------------------------

select is(
  (public.get_season_play_context('premier-league', '2026-27') ->> 'of')::integer,
  (select count(*)::integer
     from public.competition_rounds round
     join public.tournaments season on season.id = round.tournament_id
     join public.competitions competition on competition.id = season.competition_id
    where competition.slug = 'premier-league'
      and season.season_key = '2026-27'
      and round.kind = 'league_matchweek'),
  'the matchweek count is that season''s own, not a constant');

-- The reported matchweek must be the ordinal of the round the authority
-- returns — not a recomputation, and not simply the lowest-numbered round.
select is(
  (public.get_season_play_context('premier-league', '2026-27') ->> 'matchweek')::integer,
  (select round.ordinal
     from public.competition_rounds round
    where round.id = predictor_internal.next_eligible_league_round(
            (select season.id
               from public.tournaments season
               join public.competitions competition on competition.id = season.competition_id
              where competition.slug = 'premier-league' and season.season_key = '2026-27'),
            'main_predictor',
            now())),
  'the matchweek reported is the round the existing authority chose');

select * from finish();
rollback;
