-- Contract 197 — one chronological calendar across the player's competitions.
--
-- ---------------------------------------------------------------------------
-- THE GAP, MEASURED ON THE INSTALLED CATALOGUE AT CONTRACT 196
-- ---------------------------------------------------------------------------
--
-- Every fixture read on the platform is scoped to ONE competition season or to
-- ONE fixture. Counted over `public`:
--
--     get_season_fixtures(p_tournament_id, p_from, p_to)   one season
--     get_season_fixture(p_season_fixture_id)              one fixture
--     get_season_matchweek_card(p_tournament_id, ...)      one matchweek
--
-- There is no read that answers "what football is on, across everything I am
-- in". `docs/product/vnext-ia-lab.md` § 7 records that the Matches system is
-- Stage 8's subject and describes the shape it settles on as "one chronological
-- calendar across the player's competitions" — and that sentence has no
-- backend. A surface building it today has exactly one option: call
-- `get_season_fixtures` once per season the player has entered and merge in the
-- browser.
--
-- That is the same browser loop contract 192 was written to prevent for the
-- season-long head-to-head, and it is worse here: the merge is a SORT across
-- competitions, so the client cannot page it, cannot bound it, and cannot know
-- it has the next fixture without fetching every season in full.
--
-- ---------------------------------------------------------------------------
-- IT IS THE SAME FIXTURE CARD, AND THAT IS TESTED RATHER THAN INTENDED
-- ---------------------------------------------------------------------------
--
-- The risk in adding a second fixture read is that the two drift: a field
-- appears in one and not the other, or the live-state block means something
-- slightly different, and a player sees two versions of the same match. The
-- projection here is contract 111's, taken field for field, including the two
-- decisions that are easy to get wrong and were argued there:
--
--   * `round` is a LABEL and not the grouping key, so a fixture moved to
--     November still says "Matchweek 5" and still sorts into November;
--   * `result` and `live` are DIFFERENT fields on purpose, because what settled
--     and what a provider currently says are different claims.
--
-- `245_my_football_calendar.sql` does not compare those two projections by eye.
-- It seeds one season, calls `get_season_fixtures` and this read over the same
-- window, and requires the per-fixture objects to be IDENTICAL. That is the
-- method contract 192 used for the ranking: running both authorities and
-- requiring agreement, rather than asserting that one was copied correctly.
--
-- `get_season_fixtures` is deliberately NOT rewritten to share this code.
-- It is the season fixture surface's hot read; the differential gives the same
-- protection against drift without operating on it, and a refactor whose only
-- justification is tidiness is not one this contract should perform.
--
-- ---------------------------------------------------------------------------
-- SCOPE: THE PLAYER'S OWN COMPETITIONS, AND NOTHING ELSE
-- ---------------------------------------------------------------------------
--
-- The seasons are those the caller holds an `entries` row in. That is the same
-- authority every season read already uses for "is this your competition", so
-- this adds no membership rule and cannot widen one. A season the player has
-- not entered is not in their calendar, and no other player's entry, prediction
-- or standing is anywhere in the payload — this is a FIXTURE read.
--
-- The tournament shape is deliberately excluded, exactly as
-- `get_season_fixtures` excludes it: `kind = 'league_season'` only. A tournament
-- has its own fixture surfaces, its own lock model and its own reveal model, and
-- quietly folding it into a league calendar would be a product decision this
-- contract has no authority to take. It is a filter here rather than a refusal,
-- because a player may hold both and asking for their calendar is not a mistake.
--
-- ---------------------------------------------------------------------------
-- BOUNDED THE SAME WAY, FOR THE SAME REASON
-- ---------------------------------------------------------------------------
--
-- Default window `now - 7 days` to `now + 14 days`, maximum 120 days, at most
-- 500 fixtures — contract 111's bounds, unchanged. They matter more here than
-- there: this read spans every season the player has entered, so an unbounded
-- version would be the one read on the platform whose payload grows with how
-- much the player plays.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It creates no table, writes nothing, moves no lock and reveals no prediction.
-- It is not the Match Centre — `get_season_fixture` has been the addressable
-- one since contract 148 and stays that way. It does not design the Stage 8
-- Matches system; it removes the reason that system would have to be built on a
-- browser loop.

begin;

-- ---------------------------------------------------------------------------
-- The read.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_football_calendar(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $calendar$
declare
  v_uid uuid := (select auth.uid());
  v_from timestamptz;
  v_to timestamptz;
  v_competitions jsonb;
  v_fixtures jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- Contract 111's window and bounds, unchanged. See the header for why they
  -- matter more on a read that spans every season the player has entered.
  v_from := coalesce(p_from, now() - interval '7 days');
  v_to := coalesce(p_to, now() + interval '14 days');

  if v_to <= v_from then
    raise exception 'The window must end after it starts' using errcode = '22023';
  end if;

  if v_to - v_from > interval '120 days' then
    raise exception 'A fixture window may not exceed 120 days' using errcode = '22023';
  end if;

  -- The seasons in scope: the ones this player has ENTERED. `public.entries` is
  -- the authority every season read already uses for that question, so no
  -- membership rule is added here and none can be widened.
  --
  -- `league_season` only, exactly as `get_season_fixtures` refuses anything
  -- else. A tournament has its own fixture surfaces and its own lock and reveal
  -- model; folding it in silently would be a product decision.
  with mine as (
    select season.id,
           competition.name as competition_name,
           competition.slug,
           season.season_key,
           season.display_timezone
      from public.entries entry
      join public.tournaments season on season.id = entry.tournament_id
      join public.competitions competition on competition.id = season.competition_id
     where entry.user_id = v_uid
       and season.kind = 'league_season'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', mine.id,
           'name', mine.competition_name,
           'slug', mine.slug,
           'season_key', mine.season_key,
           'time_zone', mine.display_timezone) order by mine.competition_name, mine.id),
         '[]'::jsonb)
    into v_competitions
    from mine;

  select coalesce(jsonb_agg(entry order by sort_kickoff, entry->>'id'), '[]'::jsonb)
    into v_fixtures
    from (
      select
        -- Ordered by when it is actually played, ACROSS competitions, which is
        -- the whole point. A fixture with no kickoff yet sorts last rather than
        -- first, because an unscheduled match is not the next thing to happen.
        coalesce(fixture.kickoff_at, 'infinity'::timestamptz) as sort_kickoff,
        jsonb_build_object(
          -- The one field the single-season read does not need, because there
          -- the competition is the whole payload's subject.
          'competition_id', fixture.tournament_id,

          'id', fixture.id,
          'kickoff_at', fixture.kickoff_at,
          'status', fixture.status,

          -- The round is a LABEL, not the grouping key: contract 111's
          -- projection, and the owner's amendment stated in the payload.
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
        join public.entries mine_entry
          on mine_entry.tournament_id = fixture.tournament_id
         and mine_entry.user_id = v_uid
        join public.tournaments season
          on season.id = fixture.tournament_id
         and season.kind = 'league_season'
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
       where fixture.kickoff_at >= v_from
         and fixture.kickoff_at < v_to
       order by coalesce(fixture.kickoff_at, 'infinity'::timestamptz), fixture.id
       limit 500) windowed;

  return jsonb_build_object(
    'window', jsonb_build_object('from', v_from, 'to', v_to),
    'server_now', now(),
    'competitions', v_competitions,
    'fixtures', v_fixtures);
end;
$calendar$;

comment on function public.get_my_football_calendar(timestamptz, timestamptz) is
  'Contract 197. One chronological fixture calendar across every league season '
  'the caller has entered, bounded by contract 111''s window, span and page '
  'limits. The per-fixture card is contract 111''s, and 245 proves that by '
  'running both reads over the same window and requiring identical objects. '
  'Reads only; reveals no prediction and adds no membership rule.';

revoke all on function public.get_my_football_calendar(timestamptz, timestamptz)
  from public, anon, service_role;
grant execute on function public.get_my_football_calendar(timestamptz, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_calendar text := pg_get_functiondef(
    'public.get_my_football_calendar(timestamptz, timestamptz)'::regprocedure);
  v_season text := pg_get_functiondef(
    'public.get_season_fixtures(uuid, timestamptz, timestamptz)'::regprocedure);
  v_code text := (
    select string_agg(source_line, chr(10))
      from regexp_split_to_table(pg_get_functiondef(
             'public.get_my_football_calendar(timestamptz, timestamptz)'::regprocedure),
           chr(10)) as source_line
     where btrim(source_line) not like '--%');
begin
  -- It cannot write. PostgreSQL refuses a write from a stable function, so this
  -- is enforced by the engine rather than by review -- the same guard contract
  -- 193 settled on after `check-migration-additive.mjs` objected to the literal
  -- `delete from` inside a hand-written one.
  if (select p.provolatile from pg_catalog.pg_proc p
       where p.oid = 'public.get_my_football_calendar(timestamptz, timestamptz)'::regprocedure) <> 's' then
    raise exception 'The calendar read must be stable, so that it cannot write';
  end if;

  -- Scoped to the caller's own entries, and to league seasons.
  if v_code !~ 'mine_entry\.user_id = v_uid' then
    raise exception 'The calendar must be scoped to the caller''s own entries';
  end if;
  if v_code !~ 'season\.kind = ''league_season''' then
    raise exception 'The calendar must exclude the tournament shape';
  end if;

  -- Contract 111's bounds, character for character, so the two reads cannot
  -- disagree about how much football a window may contain.
  if position('interval ''7 days''' in v_code) = 0
    or position('interval ''14 days''' in v_code) = 0
    or position('interval ''120 days''' in v_code) = 0
    or position('limit 500' in v_code) = 0 then
    raise exception 'The calendar must carry contract 111''s window and bounds';
  end if;
  if position('interval ''120 days''' in v_season) = 0
    or position('limit 500' in v_season) = 0 then
    raise exception 'The season fixture read no longer carries the bounds this one copied';
  end if;

  -- No prediction, no standing, no other player. This is a fixture read.
  if v_code ~ 'season_predictions|season_matchweek_scores|season_standings|display_name' then
    raise exception 'A fixture calendar must not carry predictions, scores or players';
  end if;

  -- Ordered across competitions by when the match is played, with unscheduled
  -- fixtures last. Grouping by competition would defeat the contract.
  if v_code !~ 'coalesce\(fixture\.kickoff_at, ''infinity''::timestamptz\)' then
    raise exception 'The calendar must be ordered chronologically across competitions';
  end if;
end;
$$;

commit;
