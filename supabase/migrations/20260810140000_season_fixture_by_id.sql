-- ---------------------------------------------------------------------------
-- Contract 148 — MIG-UI-11: one season fixture, addressed by its own id.
--
-- Contract 139 gave a season a fixture list, windowed by date and capped at 120
-- days. That is the right shape for a calendar and the wrong shape for a link.
-- The Match Centre is addressable at `/competitions/:c/:s/matches/:fixtureId`,
-- so with only a windowed read it has to carry the fixture's DAY in the URL as
-- well, load the window around it, and report honestly when the fixture turns
-- out to fall outside the window it guessed. A URL that needs a hint about
-- where to look is not really an address.
--
-- This is deliberately a sibling of contract 139 rather than a widening of it.
-- A windowed list and a single addressed row have different arguments, one
-- returns a season header and the other does not need to, and folding them
-- together would give one function two jobs and a null-window special case.
--
-- The payload is contract 139's own entry shape, field for field, so a fixture
-- looks the same whether it arrived from the calendar or from a link. That is
-- the point: two vocabularies for one fixture is how a provisional score ends
-- up rendered as a result on one surface and not the other. In particular
-- `result` stays null until the fixture is `played`, and what a provider
-- currently says stays in `live`, a different field, as contract 139 established
-- and contract 142 fixed the vocabulary of.
--
-- It adds no rule. Anything a caller may see here they may already see through
-- contract 139 by asking for the right window, so this narrows the question
-- rather than widening the answer.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_fixture(p_season_fixture_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fixture$
declare
  v_uid uuid := (select auth.uid());
  v_season record;
  v_fixture jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_season_fixture_id is null then
    raise exception 'A fixture is required' using errcode = '22023';
  end if;

  select season.id, competition.name as competition_name, competition.slug,
         season.season_key, season.display_timezone, season.kind
    into v_season
    from public.season_fixtures fixture
    join public.tournaments season on season.id = fixture.tournament_id
    join public.competitions competition on competition.id = season.competition_id
   where fixture.id = p_season_fixture_id;

  if not found then
    raise exception 'That fixture does not exist' using errcode = '22023';
  end if;

  -- The same refusal contract 139 makes, for the same reason: the tournament
  -- shape has its own fixture surfaces and a different lock and reveal model,
  -- and returning nothing would read as "no such fixture".
  if v_season.kind <> 'league_season' then
    raise exception 'That fixture is not in a league season; use the tournament fixture reads'
      using errcode = '22023';
  end if;

  select jsonb_build_object(
           'id', fixture.id,
           'kickoff_at', fixture.kickoff_at,
           'status', fixture.status,

           -- A label, not the grouping key: a fixture moved to November still
           -- says "Matchweek 5". Contract 139's amendment, restated here
           -- because this payload has to agree with it exactly.
           'round', jsonb_build_object(
             'id', round.id,
             'ordinal', round.ordinal,
             'label', round.label),

           'home', jsonb_build_object(
             'name', home.name,
             'short_code', home_identity.short_code,
             'club_colours', home_identity.club_colours),
           'away', jsonb_build_object(
             'name', away.name,
             'short_code', away_identity.short_code,
             'club_colours', away_identity.club_colours),

           'result', case when fixture.status = 'played' then jsonb_build_object(
             'home', fixture.home_score,
             'away', fixture.away_score) end,

           'live', case when live.season_fixture_id is not null then jsonb_build_object(
             'kind', live.kind,
             'home', live.home_score,
             'away', live.away_score,
             'observed_at', live.observed_at) end)
    into v_fixture
    from public.season_fixtures fixture
    join public.competition_rounds round on round.id = fixture.competition_round_id
    join public.teams home on home.id = fixture.home_team_id
    join public.teams away on away.id = fixture.away_team_id
    left join predictor_internal.club_identity_reference home_identity
      on home_identity.normalised_name = predictor_internal.normalised_club_name(home.name)
    left join predictor_internal.club_identity_reference away_identity
      on away_identity.normalised_name = predictor_internal.normalised_club_name(away.name)
    left join predictor_internal.season_fixture_live_state live
      on live.season_fixture_id = fixture.id
   where fixture.id = p_season_fixture_id;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.competition_name,
      'slug', v_season.slug,
      'season_key', v_season.season_key,
      'time_zone', v_season.display_timezone),
    'server_now', now(),
    'fixture', v_fixture);
end;
$fixture$;

revoke all on function public.get_season_fixture(uuid) from public, anon;
grant execute on function public.get_season_fixture(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_one text := pg_get_functiondef('public.get_season_fixture(uuid)'::regprocedure);
  v_many text := pg_get_functiondef(
    'public.get_season_fixtures(uuid, timestamptz, timestamptz)'::regprocedure);
  v_field text;
begin
  if v_one !~ 'auth.uid\(\)' then
    raise exception 'The fixture read must require authentication';
  end if;

  if v_one !~ 'kind <> ''league_season''' then
    raise exception 'The fixture read must refuse the tournament shape by name';
  end if;

  -- Field-for-field agreement with contract 139. Checked rather than trusted,
  -- because the failure this prevents is silent: one surface rendering a
  -- provisional score where the other renders a result.
  foreach v_field in array array['''kickoff_at''', '''status''', '''round''', '''home''',
                                 '''away''', '''result''', '''live''', '''club_colours''']
  loop
    if v_one not like '%' || v_field || '%' then
      raise exception 'The addressed fixture is missing the % field contract 139 returns', v_field;
    end if;
    if v_many not like '%' || v_field || '%' then
      raise exception 'Contract 139 no longer returns %; the two payloads have diverged', v_field;
    end if;
  end loop;

  -- A result exists only once the fixture is played; a provider opinion never
  -- becomes one by arriving in the same object.
  if v_one !~ 'status = ''played''' then
    raise exception 'A result must be gated on the played status';
  end if;
end;
$$;
