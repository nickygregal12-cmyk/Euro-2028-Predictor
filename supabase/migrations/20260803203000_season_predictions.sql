-- Contract 69: the season card — scoreline predictions and matchweek Jokers.
--
-- WHY NOT REUSE `match_predictions`. It references `matches`, the tournament
-- fixture table, and carries `is_joker` as a per-fixture flag. Both are wrong
-- here. The season fixture lives in `season_fixtures`, and ADR 0012 is explicit
-- that a season Joker "doubles the WHOLE matchweek's points, never one
-- fixture". `src/domain/season/scoring.ts` encodes exactly that:
--
--     scoreMatchweek(fixtures, jokerApplied) -> basePoints * 2
--     SEASON_JOKERS_PER_SEASON = 10, SEASON_JOKERS_PER_HALF = 5
--
-- A per-fixture flag cannot express "this matchweek is doubled", so the Joker
-- gets its own relation keyed by (entry, matchweek). Storing it as a flag on a
-- prediction row would also lose the Joker when a fixture is postponed out of
-- the matchweek, which the authority says must never happen.
--
-- WHAT IS REUSED. `entries` already means "one prediction entry per user per
-- competition season" — unique (user_id, tournament_id), linked to the C1b
-- membership by `game_membership_id`. Only one game per competition sets
-- `requires_prediction_entry`, so a season's Main Predictor entry is an
-- `entries` row and no parallel entry store is created.

-- ---------------------------------------------------------------------------
-- Composite key on entries, so a prediction cannot borrow an entry from a
-- different season. Same reasoning as contract 68's keys on teams and rounds:
-- the season becomes part of the key, and the database refuses the mismatch
-- rather than trusting a trigger to notice it.
-- ---------------------------------------------------------------------------

alter table public.entries
  add constraint entries_tournament_scope_key unique (tournament_id, id);

alter table public.season_fixtures
  add constraint season_fixtures_tournament_scope_key unique (tournament_id, id);

-- ---------------------------------------------------------------------------
-- season_predictions
-- ---------------------------------------------------------------------------

create table public.season_predictions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  entry_id uuid not null,
  season_fixture_id uuid not null,
  home_score smallint not null check (home_score >= 0 and home_score <= 99),
  away_score smallint not null check (away_score >= 0 and away_score <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint season_predictions_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade,

  constraint season_predictions_fixture_fkey
    foreign key (tournament_id, season_fixture_id)
    references public.season_fixtures(tournament_id, id)
    on delete cascade,

  constraint season_predictions_one_per_fixture
    unique (entry_id, season_fixture_id)
);

create index season_predictions_entry_idx
  on public.season_predictions (entry_id);
create index season_predictions_fixture_idx
  on public.season_predictions (season_fixture_id);

alter table public.season_predictions enable row level security;
revoke all on table public.season_predictions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- season_matchweek_jokers
--
-- One row means "this entry played its Joker on this matchweek". Absence means
-- it did not. There is no per-fixture Joker in a season.
-- ---------------------------------------------------------------------------

create table public.season_matchweek_jokers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  entry_id uuid not null,
  competition_round_id uuid not null,
  created_at timestamptz not null default now(),

  constraint season_matchweek_jokers_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_jokers_round_fkey
    foreign key (tournament_id, competition_round_id)
    references public.competition_rounds(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_jokers_one_per_matchweek
    unique (entry_id, competition_round_id)
);

create index season_matchweek_jokers_entry_idx
  on public.season_matchweek_jokers (entry_id);

alter table public.season_matchweek_jokers enable row level security;
revoke all on table public.season_matchweek_jokers from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Joker allowance: ten per season, five per half, no carry-over.
--
-- `seasonJokerAllowance()` in src/domain/season/scoring.ts is the TypeScript
-- authority; this is its PostgreSQL counterpart, and the two are held in step
-- by tests/database-parity/seasonJokerParity.test.ts.
--
-- "No carry-over" is why each half is capped separately rather than only
-- capping the season total: an unused first-half Joker must not become an
-- eleventh chance in the second.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_season_joker_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matchweeks integer;
  v_ordinal integer;
  v_round_kind text;
  v_half_size integer;
  v_used_in_half integer;
  v_used_in_season integer;
begin
  select kind, ordinal into v_round_kind, v_ordinal
    from public.competition_rounds
   where id = new.competition_round_id;

  if v_round_kind is distinct from 'league_matchweek' then
    raise exception 'A season Joker attaches to a league matchweek, not a % round', coalesce(v_round_kind, 'missing')
      using errcode = '23514';
  end if;

  select count(*)::integer into v_matchweeks
    from public.competition_rounds
   where tournament_id = new.tournament_id
     and kind = 'league_matchweek';

  -- `seasonJokerAllowance` returns null below two matchweeks and otherwise
  -- takes floor(count / 2) as the half boundary. An odd count is valid — the
  -- authority names "16 for a 33-round known calendar" — so refusing odd
  -- seasons here would make a post-split calendar impossible. Integer division
  -- in PostgreSQL truncates toward zero, which equals floor for a positive
  -- count, so the two derivations agree by construction.
  if v_matchweeks < 2 then
    raise exception 'Season Joker allowance is undefined for a % matchweek season', v_matchweeks
      using errcode = '23514';
  end if;

  v_half_size := v_matchweeks / 2;

  select count(*)::integer into v_used_in_season
    from public.season_matchweek_jokers joker
   where joker.entry_id = new.entry_id
     and joker.id is distinct from new.id;

  if v_used_in_season >= 10 then
    raise exception 'A season allows ten Jokers'
      using errcode = '23505';
  end if;

  select count(*)::integer into v_used_in_half
    from public.season_matchweek_jokers joker
    join public.competition_rounds round on round.id = joker.competition_round_id
   where joker.entry_id = new.entry_id
     and joker.id is distinct from new.id
     and round.kind = 'league_matchweek'
     and (round.ordinal > v_half_size) = (v_ordinal > v_half_size);

  if v_used_in_half >= 5 then
    raise exception 'A season half allows five Jokers, and unused Jokers do not carry over'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.assert_season_joker_allowance() from public, anon, authenticated;

create trigger assert_season_joker_allowance
before insert or update of entry_id, competition_round_id
on public.season_matchweek_jokers
for each row
execute function predictor_internal.assert_season_joker_allowance();

-- ---------------------------------------------------------------------------
-- Matchweek locks.
--
-- A season does not have the tournament's single `tournaments.lock_at`. Each
-- matchweek locks at its own earliest kickoff, minus the game's buffer, which
-- `game_definitions` holds (zero for the Main Predictor).
--
-- Missing kickoff data locks rather than opens. That mirrors
-- `resolveLockState`, which returns `missing_fixture_data -> locked`: if the
-- kickoff is unknown, the matchweek cannot be *proven* still open, and a wrong
-- "open" accepts a prediction after the match has started.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.enforce_season_matchweek_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round uuid;
  v_tournament uuid;
  v_buffer integer;
  v_earliest timestamptz;
  v_missing integer;
begin
  if tg_table_name = 'season_predictions' then
    select fixture.competition_round_id, fixture.tournament_id
      into v_round, v_tournament
      from public.season_fixtures fixture
     where fixture.id = new.season_fixture_id;
  else
    v_round := new.competition_round_id;
    v_tournament := new.tournament_id;
  end if;

  select definition.buffer_minutes into v_buffer
    from public.bonus_competitions availability
    join public.game_definitions definition on definition.game_key = availability.game_key
   where availability.tournament_id = v_tournament
     and availability.game_key = 'main_predictor';

  if v_buffer is null then
    raise exception 'No Main Predictor availability for this season, so its lock cannot be resolved'
      using errcode = '23514';
  end if;

  select min(fixture.kickoff_at), count(*) filter (where fixture.kickoff_at is null)
    into v_earliest, v_missing
    from public.season_fixtures fixture
   where fixture.competition_round_id = v_round;

  if v_earliest is null or v_missing > 0 then
    raise exception 'This matchweek has unconfirmed kickoff times, so it is locked'
      using errcode = '55000';
  end if;

  if now() >= v_earliest - make_interval(mins => v_buffer) then
    raise exception 'This matchweek is locked'
      using errcode = '55000';
  end if;

  if tg_table_name = 'season_predictions' then
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function predictor_internal.enforce_season_matchweek_lock() from public, anon, authenticated;

create trigger enforce_season_matchweek_lock
before insert or update of home_score, away_score
on public.season_predictions
for each row
execute function predictor_internal.enforce_season_matchweek_lock();

create trigger enforce_season_matchweek_lock
before insert or update of competition_round_id
on public.season_matchweek_jokers
for each row
execute function predictor_internal.enforce_season_matchweek_lock();

-- ---------------------------------------------------------------------------
-- Prove the containers start empty and closed.
-- ---------------------------------------------------------------------------

do $$
begin
  if (select count(*) from public.season_predictions) <> 0
     or (select count(*) from public.season_matchweek_jokers) <> 0 then
    raise exception 'the season card tables must start empty';
  end if;

  if not exists (
    select 1 from pg_class
     where relname in ('season_predictions', 'season_matchweek_jokers')
       and relnamespace = 'public'::regnamespace
       and relrowsecurity
    having count(*) = 2
  ) then
    raise exception 'both season card tables must have row level security enabled';
  end if;
end;
$$;
