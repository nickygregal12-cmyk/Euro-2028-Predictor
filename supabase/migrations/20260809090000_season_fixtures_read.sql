-- Contract 139: a season's fixtures, in the order they are played and under the
-- matchweek they belong to.
--
-- ---------------------------------------------------------------------------
-- THE ITEM THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- `MASTER-TODO.md` Stage D has carried this since the owner's 5 August
-- amendment: "Order fixture lists by kickoff while labelling by round, so a
-- rescheduled match shows in true chronological position under its original
-- matchweek. Grouping strictly by round is the easy misreading and produces a
-- list where a November match sits under a September heading."
--
-- Nothing could implement it, because a season had no fixtures read at all. Of
-- the contracted browser RPCs, `get_season_matchweek_card` is the only one that
-- returns a season fixture, and it returns one round's worth to one entrant —
-- it needs an entry, it carries that entrant's predictions, and it cannot span
-- rounds, which is precisely what a rescheduled match requires.
--
-- ---------------------------------------------------------------------------
-- WHY A DATE WINDOW AND NOT A MATCHWEEK
-- ---------------------------------------------------------------------------
--
-- Taking a matchweek would reintroduce the defect. A fixture postponed out of
-- matchweek 5 into November keeps `competition_round_id = 5` — that is the
-- owner's amendment, and it is deliberate — so a by-round query returns it
-- under a September heading no matter how the results are sorted afterwards.
--
-- The window is what a person actually asks for ("what is on this weekend"),
-- and the round travels with each fixture as a LABEL rather than as the
-- grouping key. A caller wanting one matchweek filters on the label it is
-- given; a caller wanting a weekend gets the postponed match in its real place.
--
-- ---------------------------------------------------------------------------
-- WHAT IT IS AND IS NOT
-- ---------------------------------------------------------------------------
--
-- It is football, not entry: no prediction, no Joker, no entrant, no points. It
-- discloses nothing about any player, which is why it needs no membership check
-- beyond being signed in — a fixture list is the same for everybody.
--
-- It carries the confirmed result and, separately, contract 135's provisional
-- live block. Those are two different kinds of truth and the read keeps them in
-- two different fields on purpose: `result` is what settled, `live` is what a
-- provider currently says. A surface that merges them has thrown away the
-- distinction the whole ingestion boundary exists to preserve.

begin;

create or replace function public.get_season_fixtures(
  p_tournament_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fixtures$
declare
  v_uid uuid := (select auth.uid());
  v_season record;
  v_from timestamptz;
  v_to timestamptz;
  v_fixtures jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null then
    raise exception 'A competition season is required' using errcode = '22023';
  end if;

  select season.id, competition.name as competition_name, competition.slug,
         season.season_key, season.display_timezone, season.kind
    into v_season
    from public.tournaments season
    join public.competitions competition on competition.id = season.competition_id
   where season.id = p_tournament_id;

  if not found then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  -- The tournament shape has its own fixture surfaces and a different lock and
  -- reveal model. Refusing names the mistake; returning an empty array would
  -- read as "no fixtures", which is the sixth instance of a defect this
  -- repository has now fixed five times.
  if v_season.kind <> 'league_season' then
    raise exception 'That competition is not a league season; use the tournament fixture reads'
      using errcode = '22023';
  end if;

  -- A default window rather than the whole season: 380 fixtures is a real
  -- answer to a question nobody asked, and it is the payload every list surface
  -- would then have to trim on the client.
  v_from := coalesce(p_from, now() - interval '7 days');
  v_to := coalesce(p_to, now() + interval '14 days');

  if v_to <= v_from then
    raise exception 'The window must end after it starts' using errcode = '22023';
  end if;

  if v_to - v_from > interval '120 days' then
    raise exception 'A fixture window may not exceed 120 days' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(entry order by sort_kickoff, entry->>'id'), '[]'::jsonb)
    into v_fixtures
    from (
      select
        -- Ordered by when it is actually played. A fixture with no kickoff yet
        -- sorts last rather than first, because an unscheduled match is not the
        -- next thing to happen.
        coalesce(fixture.kickoff_at, 'infinity'::timestamptz) as sort_kickoff,
        jsonb_build_object(
          'id', fixture.id,
          'kickoff_at', fixture.kickoff_at,
          'status', fixture.status,

          -- The round is a LABEL, not the grouping key. This is the owner's
          -- amendment stated in the payload: a fixture moved to November still
          -- says "Matchweek 5", and still sorts into November.
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

          -- What settled. Null until it did.
          'result', case when fixture.status = 'played' then jsonb_build_object(
            'home', fixture.home_score,
            'away', fixture.away_score) end,

          -- What a provider currently says, which is a different thing and is
          -- kept in a different field on purpose.
          'live', case when live.season_fixture_id is not null then jsonb_build_object(
            'kind', live.kind,
            'home', live.home_score,
            'away', live.away_score,
            'observed_at', live.observed_at) end
        ) as entry
        from public.season_fixtures fixture
        join public.competition_rounds round on round.id = fixture.competition_round_id
        join public.teams home on home.id = fixture.home_team_id
        join public.teams away on away.id = fixture.away_team_id
        left join predictor_internal.club_identity_reference home_identity
          on home_identity.normalised_name
           = predictor_internal.normalised_club_name(home.name)
        left join predictor_internal.club_identity_reference away_identity
          on away_identity.normalised_name
           = predictor_internal.normalised_club_name(away.name)
        left join predictor_internal.season_fixture_live_state live
          on live.season_fixture_id = fixture.id
       where fixture.tournament_id = p_tournament_id
         and fixture.kickoff_at >= v_from
         and fixture.kickoff_at < v_to
       order by coalesce(fixture.kickoff_at, 'infinity'::timestamptz), fixture.id
       limit 500) windowed;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.competition_name,
      'slug', v_season.slug,
      'season_key', v_season.season_key,
      'time_zone', v_season.display_timezone),
    'window', jsonb_build_object('from', v_from, 'to', v_to),
    'server_now', now(),
    'fixtures', v_fixtures);
end;
$fixtures$;

revoke all on function public.get_season_fixtures(uuid, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.get_season_fixtures(uuid, timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'season_fixtures'
       and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'season_fixtures must stay behind a bounded read, not a table grant';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'get_season_fixtures'
       and pg_catalog.pg_get_functiondef(p.oid) not like '%season_predictions%'
  ) then
    raise exception 'the fixtures read must disclose no prediction';
  end if;
end;
$$;

commit;
