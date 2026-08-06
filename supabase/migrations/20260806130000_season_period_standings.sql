-- Contract 122: the monthly and form season tables, in SQL.
--
-- Counterparts to `monthlyStandings` and `rollingFormPoints` in
-- `src/domain/season/standings.ts`, authority ADR 0012, held in step by
-- `tests/database-parity/seasonPeriodStandingsParity.test.ts`.
--
-- Contract 94 gave a season its cumulative table and contract 95 gave that
-- table a browser read. The two retention views ADR 0012 also names — the
-- monthly table and rolling form — have existed in TypeScript since that
-- contract and have never been reachable: `monthlyStandings` and
-- `rollingFormPoints` are exported, tested, and called by nothing. This makes
-- them answerable, which is the same "an authority with no caller" pattern the
-- roadmap keeps finding.
--
-- ---------------------------------------------------------------------------
-- THESE ARE DERIVED VIEWS AND NEVER FEED THE CANONICAL TOTAL
-- ---------------------------------------------------------------------------
--
-- ADR 0012 is explicit that the cumulative total is the only ranking that
-- decides the season, and the TypeScript header says the same in its first
-- paragraph. Nothing below writes a score, a standing or a settlement. Each
-- function reads `season_matchweek_scores` — already settled, already
-- Joker-doubled — and ranks a subset of it.
--
-- ---------------------------------------------------------------------------
-- A MATCHWEEK BELONGS TO EXACTLY ONE MONTH, WHICH IS FORCED RATHER THAN CHOSEN
-- ---------------------------------------------------------------------------
--
-- `season_matchweek_scores` is keyed `(entry_id, competition_round_id)`: points
-- exist per matchweek and never per fixture. Combined with ADR 0012's pairing
-- of points with matchweeks played — "two players on 84 points from 22 and 23
-- matchweeks are not tied in meaning" — a monthly table cannot split one
-- matchweek across two months. There is no half-matchweek to put in January.
--
-- So the only question is which instant NAMES the month, and the owner's answer
-- is the round's `window_opens_at`: the first kickoff of the matchweek, in the
-- competition's own `display_timezone`.
--
--   FIRST KICKOFF, because it is the one instant every played round has, it is
--   stable when a fixture is added later in the week, and it matches how a
--   matchweek is labelled everywhere else in football.
--
--   THE COMPETITION'S TIMEZONE, because a month boundary is not a UTC fact. A
--   20:00 UTC kickoff on 31 January is January in London and February in
--   Auckland, and `tournaments.display_timezone` is NOT NULL and validated
--   against `pg_timezone_names` precisely so this kind of question has one
--   answer. Deriving the month in UTC would misfile exactly the fixtures at
--   the boundaries that matter, and would do it silently.
--
-- The window itself is contract 113's, derived from the round's own fixtures.
-- Nothing here re-derives it: this reads a stored fact, which is the whole
-- reason contract 113 stored one.
--
-- ---------------------------------------------------------------------------
-- AN UNPLACEABLE MATCHWEEK REFUSES THE WHOLE TABLE
-- ---------------------------------------------------------------------------
--
-- `monthlyStandings` returns `null` when a settled matchweek is not in the
-- supplied calendar, and says why: "a table that silently drops a matchweek
-- misranks the month". The SQL mirrors that exactly — if any entry holds a
-- settled score for a round with no window, the function returns NULL rather
-- than a table computed from the rounds it could place.
--
-- This is reachable, not theoretical. Contract 113 derives a window only for a
-- round that HAS fixtures with kickoffs, so a round whose fixtures have not
-- been scheduled has none. That round also cannot have been settled, so the
-- ordinary case never trips the guard; what trips it is a season whose windows
-- were never derived at all, which is a real state and one an operator must be
-- told about rather than shown a plausible half-table.
--
-- ---------------------------------------------------------------------------
-- THE BACKFILL, AND THE DRIVER THIS DELIBERATELY DOES NOT ADD
-- ---------------------------------------------------------------------------
--
-- Contract 113 shipped `derive_round_play_windows` and nothing has ever called
-- it, so every round's window is NULL and the month calendar would be empty on
-- every season. This migration therefore calls it once per league season, which
-- is the backfill that makes the read answerable at all.
--
-- KEEPING IT FRESH IS LEFT OPEN, and the reason is a finding rather than a
-- preference. Exactly one function moves a season kickoff: contract 117's
-- provider revision import. Re-deriving automatically after it — by trigger or
-- by calling the deriver at the end of that function — is the obvious driver
-- and carries a consequence nobody has approved: a fixture postponed into the
-- following week EXTENDS its round's play span, and contract 113's disjointness
-- trigger refuses two rounds claiming the same instant. Automatic re-derivation
-- could therefore make an ordinary provider import start failing, which is a
-- behaviour change to the ingestion path, not to a standings view.
--
-- So the refresh stays a deliberate act, as contract 113's header intended
-- ("re-deriving afterwards is a separate, deliberate act"), and the owner
-- decision it needs is recorded in the roadmap rather than taken here. The
-- exposure while it is open is bounded and worth stating plainly: only a move
-- of a round's FIRST fixture across a month boundary can change that round's
-- month, because the month reads `window_opens_at` alone.

begin;

-- ---------------------------------------------------------------------------
-- The matchweek -> month calendar.
--
-- Returns `{"<ordinal>": "YYYY-MM"}` over the rounds that have a window, which
-- is the shape `monthlyStandings` takes as `matchweekMonth`. Rounds without a
-- window are absent rather than guessed at; the caller decides what that means,
-- and `season_monthly_standings` below decides it refuses.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_matchweek_months(
  p_tournament_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_object_agg(
        round.ordinal::text,
        -- `at time zone` twice is not a typo: the first reads the timestamptz
        -- as local wall-clock time in the competition's zone, the second is the
        -- formatting of that local time. This is what makes 31 January 20:00Z
        -- January in Europe/London rather than whatever UTC would call it.
        to_char(round.window_opens_at at time zone season.display_timezone, 'YYYY-MM')
      )
      from public.competition_rounds round
      join public.tournaments season on season.id = round.tournament_id
      where round.tournament_id = p_tournament_id
        and round.kind = 'league_matchweek'
        and round.window_opens_at is not null
    ),
    '{}'::jsonb
  );
$$;

revoke all on function predictor_internal.season_matchweek_months(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The monthly tables.
--
-- One ranked table per calendar month, over each entry's settled matchweeks in
-- that month. Unlike `season_standings`, this reads FROM the scores rather than
-- from `entries`: an entry with nothing settled in a month is absent from that
-- month, not on zero in it — which is the TypeScript's behaviour and the right
-- one, because "played no games this month" and "scored nothing this month"
-- are different claims and a month nobody played has no table at all.
--
-- Ranking is `rank()` over points descending with the entry-id tie-break, the
-- same standard-competition ranking and the same collation reasoning contract
-- 94 records at length.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_monthly_standings(
  p_tournament_id uuid
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_kind text;
  v_unplaceable integer;
begin
  select season.kind into v_kind
    from public.tournaments season
   where season.id = p_tournament_id;

  -- NULL for anything that is not a league season, matching contract 94's
  -- answer so a caller can tell "not a season" from "a season with no months".
  if v_kind is distinct from 'league_season' then
    return null;
  end if;

  -- The fail-closed guard, before any table is built. A settled score whose
  -- round has no window cannot be placed in a month, and a table computed
  -- without it is wrong rather than incomplete.
  select count(*) into v_unplaceable
    from public.season_matchweek_scores score
    join public.competition_rounds round
      on round.id = score.competition_round_id
   where score.tournament_id = p_tournament_id
     and round.window_opens_at is null;

  if v_unplaceable > 0 then
    return null;
  end if;

  return coalesce(
    (
      with placed as (
        select
          to_char(
            round.window_opens_at at time zone season.display_timezone,
            'YYYY-MM'
          ) as month,
          score.entry_id,
          score.points
        from public.season_matchweek_scores score
        join public.competition_rounds round
          on round.id = score.competition_round_id
        join public.tournaments season
          on season.id = score.tournament_id
        where score.tournament_id = p_tournament_id
          and round.kind = 'league_matchweek'
      ),
      totals as (
        select
          placed.month,
          placed.entry_id,
          sum(placed.points)::integer as points,
          count(*)::integer as matchweeks_played
        from placed
        group by placed.month, placed.entry_id
      ),
      ranked as (
        select
          totals.*,
          rank() over (
            partition by totals.month
            order by totals.points desc
          )::integer as standing_rank
        from totals
      )
      select jsonb_agg(month_table order by month_table ->> 'month')
        from (
          select jsonb_build_object(
            'month', ranked.month,
            'rows', jsonb_agg(
              jsonb_build_object(
                'entry_id', ranked.entry_id,
                'rank', ranked.standing_rank,
                'points', ranked.points,
                'matchweeks_played', ranked.matchweeks_played
              )
              -- Points first, then entry id: the same order the TypeScript
              -- produces, so the parity sweep can compare arrays including
              -- their order rather than as sets.
              order by ranked.points desc, ranked.entry_id
            )
          ) as month_table
          from ranked
          group by ranked.month
        ) months
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function predictor_internal.season_monthly_standings(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The form table.
--
-- Each entry's last `p_window` settled matchweeks by round ordinal, summed and
-- ranked. Needs no calendar and no timezone: "the last five matchweeks I
-- played" is a statement about order, and `competition_rounds.ordinal` already
-- carries it. That is why form is reachable on a season whose windows have
-- never been derived, while the monthly table is not.
--
-- MOST RECENT MEANS MOST RECENT TO THAT ENTRY. `rollingFormPoints` sorts one
-- entry's own settled matchweeks and takes the last N, so a player who missed
-- matchweek 12 has their previous settled one counted instead. The window is a
-- count of an entry's own rows, not a range of the season's rounds.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.season_form_standings(
  p_tournament_id uuid,
  p_window integer default 5
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_kind text;
begin
  if p_window is null or p_window < 1 then
    raise exception 'Form window must be at least 1' using errcode = '22023';
  end if;

  select season.kind into v_kind
    from public.tournaments season
   where season.id = p_tournament_id;

  if v_kind is distinct from 'league_season' then
    return null;
  end if;

  return coalesce(
    (
      with recent as (
        select
          score.entry_id,
          score.points,
          row_number() over (
            partition by score.entry_id
            order by round.ordinal desc
          ) as recency
        from public.season_matchweek_scores score
        join public.competition_rounds round
          on round.id = score.competition_round_id
        where score.tournament_id = p_tournament_id
          and round.kind = 'league_matchweek'
      ),
      totals as (
        select
          recent.entry_id,
          sum(recent.points)::integer as points,
          count(*)::integer as matchweeks_played
        from recent
        where recent.recency <= p_window
        group by recent.entry_id
      ),
      ranked as (
        select
          totals.*,
          rank() over (order by totals.points desc)::integer as standing_rank
        from totals
      )
      select jsonb_agg(
        jsonb_build_object(
          'entry_id', ranked.entry_id,
          'rank', ranked.standing_rank,
          'points', ranked.points,
          'matchweeks_played', ranked.matchweeks_played
        )
        order by ranked.points desc, ranked.entry_id
      )
      from ranked
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function predictor_internal.season_form_standings(uuid, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The backfill.
--
-- Contract 113's deriver, run once per league season, because nothing has ever
-- run it. Behaviour-neutral to everything except the reads above: the windows
-- it writes are read by `resolve_round_for_kickoff` (contract 113) and by the
-- month calendar, and by nothing else. A season whose fixtures have no kickoffs
-- gets no windows and is left exactly as it was.
-- ---------------------------------------------------------------------------

do $backfill$
declare
  v_season record;
  v_set integer;
  v_total integer := 0;
begin
  for v_season in
    select season.id, season.name
      from public.tournaments season
     where season.kind = 'league_season'
     order by season.name
  loop
    v_set := predictor_internal.derive_round_play_windows(v_season.id);
    v_total := v_total + v_set;
    raise notice 'Contract 122: % round play windows derived for %', v_set, v_season.name;
  end loop;

  raise notice 'Contract 122: % round play windows derived in total', v_total;
end;
$backfill$;

-- ---------------------------------------------------------------------------
-- The browser read.
--
-- One function for both views, because they answer the same question at two
-- period scopes and splitting them would duplicate the access boundary. The
-- boundary is contract 95's, unchanged and for its reason: a season is not the
-- one competition everybody is in, so the caller must hold an entry in the
-- season they are asking about, and a caller with no entry is refused rather
-- than shown an empty table.
--
-- It returns no display name. Contract 95 joins profiles and re-sorts ties by
-- name; this does not, because a retention view showing the same names in a
-- different order is a presentation decision and the surface consuming this can
-- take the names from the read it already makes. Keeping profile data out also
-- keeps this function's boundary to one rule.
-- ---------------------------------------------------------------------------

create or replace function public.get_season_period_standings(
  p_tournament_id uuid,
  p_period text,
  p_window integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_period text;
  v_payload jsonb;
begin
  if p_tournament_id is null then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  v_period := lower(btrim(coalesce(p_period, '')));
  if v_period not in ('month', 'form') then
    raise exception 'Unknown standings period' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.tournaments season
     where season.id = p_tournament_id
       and season.kind = 'league_season'
  ) then
    raise exception 'Season is required' using errcode = '22023';
  end if;

  -- Checked after the season is known to exist, so a non-member and a
  -- nonexistent season are not distinguishable by error code, and before any
  -- score is read.
  if not exists (
    select 1
      from public.entries entry
     where entry.tournament_id = p_tournament_id
       and entry.user_id = v_uid
  ) then
    raise exception 'This season is not yours to read' using errcode = '42501';
  end if;

  if v_period = 'form' then
    return jsonb_build_object(
      'period', 'form',
      'window', p_window,
      'months', null,
      'rows', predictor_internal.season_form_standings(p_tournament_id, p_window)
    );
  end if;

  v_payload := predictor_internal.season_monthly_standings(p_tournament_id);

  -- NULL here is the unplaceable-matchweek refusal, not an empty season. It
  -- raises rather than returning an empty array, because the whole point of
  -- the guard is that a plausible-looking table would be wrong — and because
  -- an operator can act on "the calendar is not derived" and cannot act on a
  -- month that quietly went missing.
  if v_payload is null then
    raise exception
      'This season has a settled matchweek with no play window, so its monthly table cannot be built'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'period', 'month',
    'window', null,
    'months', v_payload,
    'rows', null
  );
end;
$$;

revoke all on function public.get_season_period_standings(uuid, text, integer)
  from public, anon;
grant execute on function public.get_season_period_standings(uuid, text, integer)
  to authenticated;

commit;
