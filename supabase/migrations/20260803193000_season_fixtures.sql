-- Contract 68: league-season fixtures.
--
-- The domestic Main Predictor needs a fixture per matchweek. Two things already
-- exist and are reused rather than duplicated:
--
--   - a season is a `tournaments` row with `kind = 'league_season'`, seeded by
--     contract 66 for Premier League and Scottish Premiership 2026/27;
--   - a matchweek is a `competition_rounds` row, whose `kind` check has
--     permitted 'league_matchweek' since Stage C1. Matchweeks therefore need no
--     new table, only rows.
--
-- What does not exist is a fixture that a league season can hold.
--
-- WHY NOT WIDEN `matches`. The tournament fixture table is shaped for a
-- tournament and defends that shape:
--
--     round    text not null check (round in ('group','r16','qf','sf','final'))
--     matchday smallint check (matchday between 1 and 3)
--     home_source text not null, away_source text not null, venue text not null
--
-- Carrying a league fixture there would mean relaxing every one of those: a new
-- `round` value, a `matchday` range up to 38, and three not-null columns made
-- nullable because a league fixture has no progression source and may have no
-- confirmed venue. Each relaxation weakens a constraint that currently protects
-- the Euro 2028 baseline, to serve a competition Euro 2028 knows nothing about.
-- ADR 0011 forbids exactly that trade: tournament and season implementations
-- may not import each other.
--
-- So the season gets its own fixture relation, scoped by the same
-- `tournament_id` every other competition-season object uses. No tournament
-- table is altered.
--
-- No fixtures or dates are invented here. Contract 66 seeded the season roots
-- "without inventing fixtures or dates" and this migration keeps that promise:
-- it creates the container, not its contents.

-- ---------------------------------------------------------------------------
-- Composite keys, so a fixture cannot borrow a round or a club from a
-- different season.
--
-- A plain `references teams(id)` would let a Premier League fixture name a
-- Scottish Premiership club: the row would be valid, the foreign key satisfied,
-- and the season boundary broken. Referencing `(tournament_id, id)` makes the
-- season part of the key, so the database refuses it. This is the pattern
-- contract 66 used for `game_memberships`.
-- ---------------------------------------------------------------------------

alter table public.teams
  add constraint teams_tournament_scope_key unique (tournament_id, id);

alter table public.competition_rounds
  add constraint competition_rounds_tournament_scope_key unique (tournament_id, id);

-- ---------------------------------------------------------------------------
-- season_fixtures
-- ---------------------------------------------------------------------------

create table public.season_fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  competition_round_id uuid not null,
  home_team_id uuid not null,
  away_team_id uuid not null,
  -- Null while the fixture is scheduled but unconfirmed. The lock engine
  -- already treats missing fixture data as a reason to stay locked, so a null
  -- kickoff fails closed rather than opening a matchweek early.
  kickoff_at timestamptz,
  status text not null default 'scheduled',
  home_score smallint,
  away_score smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint season_fixtures_round_fkey
    foreign key (tournament_id, competition_round_id)
    references public.competition_rounds(tournament_id, id)
    on delete cascade,

  -- restrict, not cascade: deleting a club must not silently erase the
  -- fixtures that decided points.
  constraint season_fixtures_home_team_fkey
    foreign key (tournament_id, home_team_id)
    references public.teams(tournament_id, id)
    on delete restrict,
  constraint season_fixtures_away_team_fkey
    foreign key (tournament_id, away_team_id)
    references public.teams(tournament_id, id)
    on delete restrict,

  constraint season_fixtures_distinct_clubs
    check (home_team_id <> away_team_id),

  constraint season_fixtures_status_allowed
    check (status in ('scheduled', 'played', 'postponed', 'abandoned', 'void')),

  constraint season_fixtures_scores_non_negative
    check (
      (home_score is null or home_score >= 0)
      and (away_score is null or away_score >= 0)
    ),

  -- A score exists exactly when the fixture was played. `matchweekSettlement`
  -- is explicit that an abandoned fixture's partial score never stands, so the
  -- schema refuses to store one: there is no state in which a half-played
  -- scoreline is a result.
  constraint season_fixtures_scores_match_status
    check (
      (status = 'played') = (home_score is not null and away_score is not null)
    )
);

create index season_fixtures_round_idx
  on public.season_fixtures (competition_round_id);
create index season_fixtures_tournament_kickoff_idx
  on public.season_fixtures (tournament_id, kickoff_at);

alter table public.season_fixtures enable row level security;

-- No browser role reaches this table directly. Reads arrive through a bounded
-- RPC when the season surfaces land; until then nothing may select it. This
-- keeps the direct Data API surface pinned by `dataApiExposure.test.ts`
-- unchanged.
revoke all on table public.season_fixtures from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cross-table invariants a CHECK cannot express.
--
-- Three things must hold and none of them can be written as a column check,
-- because each reads another table:
--
--   1. the season is actually a league season — a tournament has no matchweeks;
--   2. the round is a matchweek, not a group matchday or a knockout round;
--   3. a club plays at most once in a matchweek.
--
-- The third is the one worth stating plainly: without it a club could appear
-- twice in the same matchweek, which the Main Predictor would score twice and
-- the standings would then disagree with the league's own table.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_season_fixture_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_round_kind text;
begin
  select kind into v_kind
    from public.tournaments
   where id = new.tournament_id;

  if v_kind is distinct from 'league_season' then
    raise exception 'Season fixtures belong to a league season, not a % competition', coalesce(v_kind, 'missing')
      using errcode = '23514';
  end if;

  select kind into v_round_kind
    from public.competition_rounds
   where id = new.competition_round_id;

  if v_round_kind is distinct from 'league_matchweek' then
    raise exception 'Season fixtures attach to a league matchweek, not a % round', coalesce(v_round_kind, 'missing')
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.season_fixtures existing
     where existing.competition_round_id = new.competition_round_id
       and existing.id is distinct from new.id
       and (
         existing.home_team_id in (new.home_team_id, new.away_team_id)
         or existing.away_team_id in (new.home_team_id, new.away_team_id)
       )
  ) then
    raise exception 'A club plays at most once per matchweek'
      using errcode = '23505';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function predictor_internal.assert_season_fixture_shape() from public, anon, authenticated;

create trigger assert_season_fixture_shape
before insert or update of tournament_id, competition_round_id, home_team_id, away_team_id
on public.season_fixtures
for each row
execute function predictor_internal.assert_season_fixture_shape();

-- ---------------------------------------------------------------------------
-- Prove the container is empty and correctly shaped, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if (select count(*) from public.season_fixtures) <> 0 then
    raise exception 'season_fixtures must start empty; this migration invents no fixtures';
  end if;

  if not exists (
    select 1 from pg_class
     where relname = 'season_fixtures'
       and relnamespace = 'public'::regnamespace
       and relrowsecurity
  ) then
    raise exception 'season_fixtures must have row level security enabled';
  end if;
end;
$$;
