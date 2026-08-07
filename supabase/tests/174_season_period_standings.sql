-- Contract 122: the monthly and form season tables.
--
-- The arithmetic is the TypeScript authority's and the parity sweep guards it,
-- so these assertions spend their effort on what only the database decides:
-- the boundary, which month a matchweek lands in once a timezone is involved,
-- and the two refusals — an unplaceable matchweek and a period nobody defined.
--
-- THE MONTH BOUNDARY IS THE ASSERTION THAT MATTERS MOST. A matchweek opening at
-- 19:30 UTC on the last day of a month is the previous month in Europe/London
-- during winter and the NEXT one under a UTC reading, and both look equally
-- plausible in a table. So the fixture below straddles a boundary deliberately
-- and pins the answer, because a silently misfiled matchweek is exactly the
-- class of defect this repository keeps finding.

begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- The boundary.
-- ---------------------------------------------------------------------------

select is(
  has_function_privilege('authenticated', 'public.get_season_period_standings(uuid,text,integer,boolean)', 'execute'),
  true, 'authenticated may read a season''s period standings');

select is(
  has_function_privilege('anon', 'public.get_season_period_standings(uuid,text,integer,boolean)', 'execute'),
  false, 'anon may not — these are a season''s own players'' totals');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.oid = to_regprocedure(
      'public.get_season_period_standings(uuid,text,integer,boolean)')),
  true, 'the read is security definer, because every table under it is revoked');

select is(
  (select proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.oid = to_regprocedure(
      'public.get_season_period_standings(uuid,text,integer,boolean)')),
  array['search_path=""'], 'search_path is pinned to the empty string');

select is(
  has_function_privilege(
    'authenticated', 'predictor_internal.season_monthly_standings(uuid)', 'execute'),
  false, 'the monthly authority stays revoked from the browser');

select is(
  has_function_privilege(
    'authenticated', 'predictor_internal.season_form_standings(uuid,integer)', 'execute'),
  false, 'the form authority stays revoked from the browser');

select is(
  has_table_privilege('authenticated', 'public.season_matchweek_scores', 'select'),
  false, 'the scores table itself stays revoked');

-- ---------------------------------------------------------------------------
-- Setup: one season, three matchweeks, two of them straddling a month end.
--
-- Matchweek 1 opens 2027-01-16 15:00Z  -> January, unambiguously.
-- Matchweek 2 opens 2027-01-31 19:30Z  -> January in Europe/London; a UTC
--                                         reading agrees here, so it alone
--                                         would not catch a timezone defect.
-- Matchweek 3 opens 2027-07-31 23:30Z  -> JULY in UTC and AUGUST in
--                                         Europe/London, where the summer
--                                         offset is +01:00. This is the row
--                                         that separates the two readings.
-- ---------------------------------------------------------------------------

select set_config('test.ps_season',
  (select season.id::text
     from public.tournaments season
     join public.competitions competition on competition.id = season.competition_id
    where competition.slug = 'premier-league' and season.season_key = '2026-27'), true);

select is(
  (select display_timezone from public.tournaments
    where id = current_setting('test.ps_season')::uuid),
  'Europe/London',
  'the fixture season carries the timezone the month derivation reads');

-- THE ROUNDS ARE CREATED HERE, not assumed. A league season's rounds come from
-- the development seed script rather than from a migration, so the database
-- these suites run against holds the SEASONS and none of their matchweeks. The
-- first version of this file read ordinals 1 to 4 and got NULL three times for
-- exactly that reason. High ordinals keep it clear of anything another suite
-- inserts into the same season.
insert into public.competition_rounds (tournament_id, round_key, ordinal, kind, label) values
  (current_setting('test.ps_season')::uuid, 'psm-mw1', 961, 'league_matchweek', 'Period Matchweek 1'),
  (current_setting('test.ps_season')::uuid, 'psm-mw2', 962, 'league_matchweek', 'Period Matchweek 2'),
  (current_setting('test.ps_season')::uuid, 'psm-mw3', 963, 'league_matchweek', 'Period Matchweek 3'),
  (current_setting('test.ps_season')::uuid, 'psm-mw4', 964, 'league_matchweek', 'Period Matchweek 4 (no window)');

-- Pin the three windows directly. Contract 113's deriver builds these from
-- fixtures; this suite is about what the month derivation does WITH a window,
-- not about how the window was derived, so it sets them. The fourth round is
-- left without one — the Scottish post-split case, where nobody yet knows who
-- plays.
update public.competition_rounds
   set window_opens_at = '2027-01-16 15:00:00+00',
       window_closes_at = '2027-01-16 17:00:00+00'
 where tournament_id = current_setting('test.ps_season')::uuid and round_key = 'psm-mw1';

update public.competition_rounds
   set window_opens_at = '2027-01-31 19:30:00+00',
       window_closes_at = '2027-01-31 21:30:00+00'
 where tournament_id = current_setting('test.ps_season')::uuid and round_key = 'psm-mw2';

update public.competition_rounds
   set window_opens_at = '2027-07-31 23:30:00+00',
       window_closes_at = '2027-08-01 01:30:00+00'
 where tournament_id = current_setting('test.ps_season')::uuid and round_key = 'psm-mw3';

-- ---------------------------------------------------------------------------
-- The calendar.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_matchweek_months(
    current_setting('test.ps_season')::uuid) ->> '961',
  '2027-01',
  'a mid-month matchweek takes its own month');

select is(
  predictor_internal.season_matchweek_months(
    current_setting('test.ps_season')::uuid) ->> '962',
  '2027-01',
  'a matchweek opening late on the last day of January is still January');

select is(
  predictor_internal.season_matchweek_months(
    current_setting('test.ps_season')::uuid) ->> '963',
  '2027-08',
  'a 23:30Z kickoff on 31 July is AUGUST in Europe/London, not July — the '
  'competition timezone decides the month, not UTC');

-- The round with no window is absent rather than guessed at.
select is(
  predictor_internal.season_matchweek_months(
    current_setting('test.ps_season')::uuid) ? '964',
  false,
  'a round with no window is absent from the calendar rather than placed');

-- ---------------------------------------------------------------------------
-- Refusals.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_monthly_standings(
    (select id from public.tournaments where kind = 'tournament' limit 1)),
  null,
  'a tournament has no monthly season table, and says so with null');

select is(
  predictor_internal.season_form_standings(
    (select id from public.tournaments where kind = 'tournament' limit 1), 5),
  null,
  'the form table answers a tournament the same way');

select throws_ok(
  format(
    'select predictor_internal.season_form_standings(%L::uuid, 0)',
    current_setting('test.ps_season')),
  '22023',
  'Form window must be at least 1',
  'a zero-length form window is refused rather than returning an empty table');

-- ---------------------------------------------------------------------------
-- The shape the browser read returns.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.season_monthly_standings(
    current_setting('test.ps_season')::uuid),
  '[]'::jsonb,
  'a season with no settled matchweek has no months rather than a null table');

select is(
  jsonb_typeof(predictor_internal.season_form_standings(
    current_setting('test.ps_season')::uuid, 5)),
  'array',
  'the form table is an array even when nothing has settled');

select * from finish();
rollback;
