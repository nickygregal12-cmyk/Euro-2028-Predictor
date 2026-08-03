-- Contract 77: the season Cup's own sources, plugged into the shared machinery.
--
-- Contracts 75 and 76 made the shared Cup functions competition-agnostic. This
-- is the payoff: a season supplies the two things those functions ask for, and
-- nothing in the shared half changes shape to accommodate it.
--
-- WHY A SEPARATE LINK TABLE. A Cup window binds to its fixtures through
-- `bonus_window_fixtures`, which is `match_id uuid not null references
-- public.matches(id)` with `primary key (window_id, match_id)`. Serving a
-- season from it would mean dropping a NOT NULL and changing a primary key on a
-- production-hosted tournament table — destructive work on the Euro baseline,
-- for a convenience.
--
-- The project already answered this question at contract 68, when season
-- fixtures became `season_fixtures` rather than a widening of `matches`. Same
-- question, same answer: `season_cup_window_fixtures` is the season's link, and
-- the tournament table is untouched.
--
-- WHY UNION RATHER THAN A BRANCH. The shared functions consume BOTH sources and
-- combine them. For a tournament window the season source returns no rows
-- (there is no `season_cup_window_fixtures` row to drive its cross join) and
-- vice versa, so each window is scored by exactly one source and union with an
-- empty relation is the identity. That keeps `cup_window_scores` and
-- `cup_window_settled` as ONE implementation serving both competitions, which
-- is what ADR 0022 asked for — rather than a dispatch that branches on
-- competition kind and quietly becomes two implementations sharing a name.
--
-- THE VOCABULARY DIFFERENCE this exists to absorb: a tournament fixture has
-- finished when `result_state in ('confirmed', 'corrected')`, its administrative
-- result lifecycle. A season fixture has finished when `status = 'played'`,
-- which contract 68 constrains to mean both scores are present. Neither
-- competition needs to know the other's word for it.
--
-- The raw scale is deliberately identical — 5 exact, 3 result, 0 otherwise, the
-- neutral contract `settleCupTie` enforces. A season Joker never reaches here:
-- Jokers multiply Main Predictor matchweek totals, and this reads
-- `season_predictions` directly rather than any scored total.

-- ---------------------------------------------------------------------------
-- The season's window/fixture link.
-- ---------------------------------------------------------------------------

create table if not exists public.season_cup_window_fixtures (
  window_id uuid not null
    references public.bonus_competition_windows(id) on delete cascade,
  -- RESTRICT, matching `bonus_window_fixtures`: deleting a fixture must not
  -- silently empty a window that has already been scored on it.
  season_fixture_id uuid not null
    references public.season_fixtures(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (window_id, season_fixture_id)
);

create index if not exists season_cup_window_fixtures_fixture_idx
  on public.season_cup_window_fixtures (season_fixture_id);

alter table public.season_cup_window_fixtures enable row level security;

revoke all on table public.season_cup_window_fixtures from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The season points source. Same eight derived facts as the tournament source,
-- so the shared arithmetic cannot tell them apart.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_season_fixture_points(
  p_competition_id uuid,
  p_window_id uuid
)
returns table (
  user_id uuid,
  match_id uuid,
  confirmed boolean,
  has_prediction boolean,
  points integer,
  is_exact boolean,
  is_correct boolean,
  scoreline_error integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with fixtures as (
    select
      sf.id as match_id,
      sf.tournament_id,
      sf.home_score as actual_home,
      sf.away_score as actual_away,
      sf.status = 'played' as confirmed
    from public.season_cup_window_fixtures link
    join public.season_fixtures sf on sf.id = link.season_fixture_id
    where link.window_id = p_window_id
  ),
  member_predictions as (
    select
      member.user_id,
      fixture.match_id,
      fixture.confirmed,
      fixture.actual_home,
      fixture.actual_away,
      prediction.home_score as predicted_home,
      prediction.away_score as predicted_away
    from public.bonus_cup_members member
    cross join fixtures fixture
    left join public.entries entry
      on entry.user_id = member.user_id
      and entry.tournament_id = fixture.tournament_id
    left join public.season_predictions prediction
      on prediction.entry_id = entry.id
      and prediction.season_fixture_id = fixture.match_id
    where member.competition_id = p_competition_id
  )
  select
    mp.user_id,
    mp.match_id,
    mp.confirmed,
    mp.predicted_home is not null as has_prediction,
    (case
      when not mp.confirmed or mp.predicted_home is null then 0
      when mp.predicted_home = mp.actual_home
        and mp.predicted_away = mp.actual_away then 5
      when sign(mp.predicted_home - mp.predicted_away)
        = sign(mp.actual_home - mp.actual_away) then 3
      else 0
    end)::integer as points,
    coalesce(
      mp.confirmed
        and mp.predicted_home = mp.actual_home
        and mp.predicted_away = mp.actual_away, false) as is_exact,
    (case
      when not mp.confirmed or mp.predicted_home is null then false
      when mp.predicted_home = mp.actual_home
        and mp.predicted_away = mp.actual_away then false
      when sign(mp.predicted_home - mp.predicted_away)
        = sign(mp.actual_home - mp.actual_away) then true
      else false
    end) as is_correct,
    (case
      when not mp.confirmed then 0
      when mp.predicted_home is null then 999
      else abs(mp.predicted_home - mp.actual_home)
        + abs(mp.predicted_away - mp.actual_away)
    end)::integer as scoreline_error
  from member_predictions mp
$$;

revoke all on function predictor_internal.cup_season_fixture_points(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The season's answer to "is anything in this window still outstanding?".
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_season_window_unsettled(
  p_window_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.season_cup_window_fixtures link
    join public.season_fixtures sf on sf.id = link.season_fixture_id
    where link.window_id = p_window_id
      and sf.status <> 'played'
  )
$$;

revoke all on function predictor_internal.cup_season_window_unsettled(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The shared machinery, now consuming both sources.
--
-- Union with an empty relation is the identity, so every existing tournament
-- window scores exactly as before and all sixteen callers are untouched.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_window_scores(
  p_competition_id uuid,
  p_window_id uuid
)
returns table (
  user_id uuid,
  points integer,
  exacts integer,
  corrects integer,
  scoreline_error integer,
  submitted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    source.user_id,
    coalesce(sum(source.points), 0)::integer as points,
    coalesce(sum(case when source.is_exact then 1 else 0 end), 0)::integer as exacts,
    coalesce(sum(case when source.is_correct then 1 else 0 end), 0)::integer as corrects,
    coalesce(sum(source.scoreline_error), 0)::integer as scoreline_error,
    bool_or(source.has_prediction) as submitted
  from (
    select * from predictor_internal.cup_tournament_fixture_points(p_competition_id, p_window_id)
    union all
    select * from predictor_internal.cup_season_fixture_points(p_competition_id, p_window_id)
  ) source
  group by source.user_id
$$;

revoke all on function predictor_internal.cup_window_scores(uuid, uuid)
  from public, anon, authenticated;

create or replace function predictor_internal.cup_window_settled(
  p_window_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    win.locks_at is not null and now() >= win.locks_at
    and (win.settles_at is null or now() >= win.settles_at)
    and (
      exists (select 1 from public.bonus_window_fixtures f where f.window_id = win.id)
      or exists (
        select 1 from public.season_cup_window_fixtures link where link.window_id = win.id)
    )
    and not predictor_internal.cup_tournament_window_unsettled(win.id)
    and not predictor_internal.cup_season_window_unsettled(win.id)
  from public.bonus_competition_windows win
  where win.id = p_window_id
$$;

revoke all on function predictor_internal.cup_window_settled(uuid)
  from public, anon, authenticated;
