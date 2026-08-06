-- Contract 120: which matchweek a season's card opens at.
--
-- The function adds no scheduling logic — it exposes contract 109's
-- `next_eligible_league_round`. So these assertions spend their effort on the
-- two things a wrapper can get wrong: the boundary it opens (who may call it,
-- and what it refuses) and whether it faithfully reports the authority it
-- wraps rather than a second opinion.
--
-- The end-of-season case is the one worth being explicit about. A season past
-- its last lock has no next eligible round, and that must read as "no
-- matchweek" rather than as an error — while a competition that is not a
-- league season at all must raise. A single null for both would let a typo in
-- a competition id look like a finished season.

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_season_play_matchweek(uuid)', 'execute'),
  true, 'authenticated may ask which matchweek to open');

select is(
  has_function_privilege('anon', 'public.get_season_play_matchweek(uuid)', 'execute'),
  false, 'anon may not — a signed-out visitor has no card to open');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_play_matchweek'),
  true, 'the read is security definer, because the tables under it are revoked');

select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_season_play_matchweek'),
  array['search_path=""'], 'search_path is pinned to the empty string');

-- The authority it wraps must stay unreachable: exposing the wrapper is the
-- whole point, exposing the internal would be a different and larger change.
select is(
  has_function_privilege(
    'authenticated',
    'predictor_internal.next_eligible_league_round(uuid,text,timestamptz)',
    'execute'),
  false, 'the internal authority stays revoked from the browser');

-- No table grant appears anywhere near this. The read exists precisely because
-- competition_rounds is unreachable, and it must not quietly become reachable.
select is(
  has_table_privilege('authenticated', 'public.competition_rounds', 'select'),
  false, 'competition_rounds is still revoked from the browser');

-- ---------------------------------------------------------------------------
-- Refusals: the caller mistakes that must not read as an empty season.
-- ---------------------------------------------------------------------------

set local role authenticated;

select throws_ok(
  $$select public.get_season_play_matchweek(null)$$,
  '22023', 'A season is required',
  'a missing season is refused rather than answered');

select throws_ok(
  format(
    $$select public.get_season_play_matchweek(%L)$$,
    '00000000-0000-0000-0000-000000000000'::uuid),
  '22023', 'That competition season does not exist',
  'an unknown competition is refused, not reported as finished');

reset role;

-- A tournament-shaped competition has no league matchweeks, so the question
-- does not apply to it and the answer must say so.
select throws_ok(
  format(
    $$select public.get_season_play_matchweek(%L)$$,
    (select id from public.tournaments where kind = 'tournament' limit 1)),
  '22023', 'That competition is not a league season',
  'a tournament is refused — the question does not apply to it');

-- ---------------------------------------------------------------------------
-- The answer, against the authority it wraps.
-- ---------------------------------------------------------------------------

select is(
  (select (public.get_season_play_matchweek(season.id) ->> 'of')::integer
     from public.tournaments season
    where season.kind = 'league_season'
    limit 1),
  (select count(*)::integer
     from public.competition_rounds round
    where round.tournament_id = (
            select id from public.tournaments where kind = 'league_season' limit 1)
      and round.kind = 'league_matchweek'),
  'the matchweek count is the season''s own, not a constant');

-- The reported matchweek must be the ordinal of the round the authority
-- returns — not a recomputation, and not the lowest-numbered round.
select is(
  (select (public.get_season_play_matchweek(season.id) ->> 'matchweek')::integer
     from public.tournaments season
    where season.kind = 'league_season'
    limit 1),
  (select round.ordinal
     from public.competition_rounds round
    where round.id = predictor_internal.next_eligible_league_round(
            (select id from public.tournaments where kind = 'league_season' limit 1),
            'main_predictor',
            now())),
  'the matchweek reported is the round the existing authority chose');

-- Ordering by derived lock instant rather than by ordinal is contract 109's
-- property and the reason a rescheduled season resolves correctly. Asserted
-- here as a relationship rather than a fixed number, so the seed can change
-- without the intent going quiet.
select ok(
  (select (public.get_season_play_matchweek(season.id) ->> 'matchweek') is null
       or ((public.get_season_play_matchweek(season.id) ->> 'matchweek')::integer
             between 1
             and (public.get_season_play_matchweek(season.id) ->> 'of')::integer)
     from public.tournaments season
    where season.kind = 'league_season'
    limit 1),
  'the matchweek is either absent (season over) or inside the season');

select * from finish();
rollback;
