-- Contract 136: a club has a code and colours.
--
-- THE ASSERTION THIS FILE EXISTS FOR is that the join actually resolves. The
-- defect being fixed was not a missing component or a missing column — it was
-- that `resolveClubIdentity` has always taken a three-letter code and a colour
-- string and has never been given either, so every club rendered in the neutral
-- fallback. The fix is only real if a club's stored name, written by whichever
-- provider supplied it, matches a reference row.
--
-- So the normaliser is checked against the three name forms the two hosted
-- providers actually produce, and the join is driven against seeded clubs
-- rather than asserted in the abstract.
--
-- WHAT IS DELIBERATELY NOT ASSERTED HERE. The rendered shirt. That is
-- `tests/design-system/` and the visual contracts; this file owns the data
-- reaching the browser, not what the browser draws with it.

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- Reference data, not competition truth, and not reachable.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'predictor_internal'
      and table_name = 'club_identity_reference'
      and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  'the club identity reference is not reachable by a browser or service role');

select is(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'predictor_internal' and c.relname = 'club_identity_reference'),
  true,
  'and has row level security enabled');

-- ---------------------------------------------------------------------------
-- The normaliser, which is the join key.
-- ---------------------------------------------------------------------------

select is(
  predictor_internal.normalised_club_name('Arsenal FC'),
  'arsenal',
  'football-data''s trailing FC is dropped');

select is(
  predictor_internal.normalised_club_name('AFC Bournemouth'),
  'bournemouth',
  'and a leading AFC is dropped too');

select is(
  predictor_internal.normalised_club_name('Heart of Midlothian'),
  'heartofmidlothian',
  'a multi-word name keeps its words and loses its spaces');

select is(
  predictor_internal.normalised_club_name('Celtic'),
  'celtic',
  'and a name a provider gives bare is already normal');

-- ---------------------------------------------------------------------------
-- The join, driven against clubs stored the way a provider stores them.
-- ---------------------------------------------------------------------------

insert into public.tournaments (name, year, competition_id, season_key, kind, display_timezone, status)
select 'C136 Identity Probe', 2032, t.competition_id, 'cir-probe', 'league_season',
       t.display_timezone, 'active'
  from public.tournaments t
 where t.kind = 'league_season'
 order by t.name
 limit 1;

select set_config('test.cir_season',
  (select id::text from public.tournaments where season_key = 'cir-probe'), true);

insert into public.teams (tournament_id, name) values
  (current_setting('test.cir_season')::uuid, 'Newcastle United FC'),
  (current_setting('test.cir_season')::uuid, 'Celtic'),
  (current_setting('test.cir_season')::uuid, 'Nowhere Athletic');

select is(
  (select reference.short_code || ' ' || reference.club_colours
     from public.teams team
     join predictor_internal.club_identity_reference reference
       on reference.normalised_name = predictor_internal.normalised_club_name(team.name)
    where team.tournament_id = current_setting('test.cir_season')::uuid
      and team.name = 'Newcastle United FC'),
  'NEW Black / White',
  'a club stored under its football-data name resolves to its code and colours');

select is(
  (select reference.short_code
     from public.teams team
     join predictor_internal.club_identity_reference reference
       on reference.normalised_name = predictor_internal.normalised_club_name(team.name)
    where team.tournament_id = current_setting('test.cir_season')::uuid
      and team.name = 'Celtic'),
  'CEL',
  'and one stored under its SportMonks name resolves too');

select is(
  (select count(*)::integer
     from public.teams team
     join predictor_internal.club_identity_reference reference
       on reference.normalised_name = predictor_internal.normalised_club_name(team.name)
    where team.tournament_id = current_setting('test.cir_season')::uuid
      and team.name = 'Nowhere Athletic'),
  0,
  'a club the reference does not name resolves to nothing, which renders as the '
  'neutral fallback exactly as every club did before this contract');

select finish();
rollback;
