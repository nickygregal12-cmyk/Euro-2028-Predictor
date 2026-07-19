-- Euro 2028 Predictor — initial schema (v0.1 / Tier 2)
--
-- Covers ONLY the tables needed for v0.1: profiles, tournament reference data
-- (tournaments, teams, groups, group_teams, matches) and a user's entry with
-- their predictions (entries, match_predictions, predicted_group_positions,
-- predicted_progression).
--
-- Deliberately NOT here (later tiers): leagues, score_events, admin/audit
-- tables, bonus predictions (golden boot / total goals).
--
-- Row-level security is enabled on every table at the bottom of this file.
-- v0.1 policy summary:
--   * reference data (tournaments/teams/groups/group_teams/matches): readable
--     by any authenticated user, writable by no one (results are entered
--     directly via Supabase Studio in v0.1);
--   * profiles/entries/predictions: each user can read & write only their own.

begin;

create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- profiles: one per auth user
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 40),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create table tournaments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  year       smallint not null,
  starts_on  date,
  ends_on    date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- teams (tournament-scoped; placeholder names until the qualifying draw)
-- ---------------------------------------------------------------------------
create table teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now(),
  unique (tournament_id, name)
);
create index teams_tournament_idx on teams (tournament_id);

-- ---------------------------------------------------------------------------
-- groups (A–F)
-- ---------------------------------------------------------------------------
create table groups (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  letter        text not null check (letter in ('A','B','C','D','E','F')),
  created_at    timestamptz not null default now(),
  unique (tournament_id, letter)
);
create index groups_tournament_idx on groups (tournament_id);

-- ---------------------------------------------------------------------------
-- group_teams: which team sits in which slot (A1–F4). slot 1..4 within a group.
-- ---------------------------------------------------------------------------
create table group_teams (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups (id) on delete cascade,
  team_id  uuid not null references teams (id) on delete cascade,
  slot     smallint not null check (slot between 1 and 4),
  unique (group_id, slot),   -- one team per slot
  unique (group_id, team_id),-- a team appears once in its group
  unique (team_id)           -- a team belongs to exactly one group
);
create index group_teams_group_idx on group_teams (group_id);
create index group_teams_team_idx on group_teams (team_id);

-- ---------------------------------------------------------------------------
-- matches: group + knockout fixtures.
--
-- home_source / away_source are slot references describing where each side
-- comes from, so knockout fixtures exist before the teams are known:
--   * group stage:  'A1'..'F4'  (the group_teams slot)
--   * group winner:  'W-A'..'W-F'
--   * group runner-up:'RU-A'..'RU-F'
--   * qualifying third:'3RD-WB' / '3RD-WC' / '3RD-WE' / '3RD-WF'
--       (the allocation slot from the tournament-structure doc §7)
--   * knockout winner:'W-R16-3', 'W-QF-1', 'W-SF-1', ... (winner of that match)
--
-- home_team_id / away_team_id are the resolved teams. Group-stage rows are
-- seeded with the placeholder teams already in their slots; knockout rows stay
-- null until results resolve them. match_date is authoritative (real dates);
-- kickoff_at is null until UEFA confirms per-match times (post-2027 draw).
-- ---------------------------------------------------------------------------
create table matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  match_ref     text not null,  -- 'GA-1'..'GF-6', 'R16-1'..'R16-8', 'QF-1'..'QF-4', 'SF-1','SF-2','FINAL'
  round         text not null check (round in ('group','r16','qf','sf','final')),
  group_id      uuid references groups (id) on delete cascade,
  matchday      smallint check (matchday between 1 and 3),
  home_source   text not null,
  away_source   text not null,
  home_team_id  uuid references teams (id) on delete set null,
  away_team_id  uuid references teams (id) on delete set null,
  match_date    date not null,
  kickoff_at    timestamptz,
  venue         text not null,
  home_score    smallint check (home_score >= 0),
  away_score    smallint check (away_score >= 0),
  created_at    timestamptz not null default now(),
  unique (tournament_id, match_ref),
  -- group matches belong to a group and a matchday; knockout matches do neither
  constraint matches_group_shape check (
    (round = 'group' and group_id is not null and matchday is not null)
    or (round <> 'group' and group_id is null and matchday is null)
  ),
  -- a result is both scores or neither
  constraint matches_score_pair check ((home_score is null) = (away_score is null))
);
create index matches_tournament_idx on matches (tournament_id);
create index matches_group_idx on matches (group_id);
create index matches_round_idx on matches (round);
create index matches_date_idx on matches (match_date);

-- ---------------------------------------------------------------------------
-- entries: one user's set of predictions for a tournament
-- ---------------------------------------------------------------------------
create table entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  tournament_id uuid not null references tournaments (id) on delete cascade,
  submitted_at  timestamptz,  -- null while still editable; set on final submit
  created_at    timestamptz not null default now(),
  unique (user_id, tournament_id)
);
create index entries_user_idx on entries (user_id);
create index entries_tournament_idx on entries (tournament_id);

-- ---------------------------------------------------------------------------
-- match_predictions: predicted score for a (group) match.
-- (The joker flag is added in the follow-up migration
--  20260719130000_add_match_prediction_joker.sql.)
-- ---------------------------------------------------------------------------
create table match_predictions (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references entries (id) on delete cascade,
  match_id   uuid not null references matches (id) on delete cascade,
  home_score smallint not null check (home_score >= 0),
  away_score smallint not null check (away_score >= 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (entry_id, match_id)
);
create index match_predictions_entry_idx on match_predictions (entry_id);
create index match_predictions_match_idx on match_predictions (match_id);

-- ---------------------------------------------------------------------------
-- predicted_group_positions: predicted final order of a group (1st–4th)
-- ---------------------------------------------------------------------------
create table predicted_group_positions (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references entries (id) on delete cascade,
  group_id   uuid not null references groups (id) on delete cascade,
  team_id    uuid not null references teams (id) on delete cascade,
  position   smallint not null check (position between 1 and 4),
  updated_at timestamptz not null default now(),
  unique (entry_id, group_id, position), -- one team per position
  unique (entry_id, group_id, team_id)   -- a team gets one position
);
create index predicted_group_positions_entry_idx on predicted_group_positions (entry_id);
create index predicted_group_positions_group_idx on predicted_group_positions (group_id);

-- ---------------------------------------------------------------------------
-- predicted_progression: furthest knockout stage a user predicts for a team
-- (winner-only mode; 'champion' is a stage). Feeds calculateScore §3.
-- ---------------------------------------------------------------------------
create table predicted_progression (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references entries (id) on delete cascade,
  team_id    uuid not null references teams (id) on delete cascade,
  stage      text not null check (stage in ('r16','qf','sf','final','champion')),
  updated_at timestamptz not null default now(),
  unique (entry_id, team_id)
);
create index predicted_progression_entry_idx on predicted_progression (entry_id);
create index predicted_progression_team_idx on predicted_progression (team_id);

-- ===========================================================================
-- Row-level security
-- ===========================================================================
alter table profiles                  enable row level security;
alter table tournaments               enable row level security;
alter table teams                     enable row level security;
alter table groups                    enable row level security;
alter table group_teams               enable row level security;
alter table matches                   enable row level security;
alter table entries                   enable row level security;
alter table match_predictions         enable row level security;
alter table predicted_group_positions enable row level security;
alter table predicted_progression     enable row level security;

-- --- Reference data: read-only to any authenticated user, no writes ---
-- (No insert/update/delete policies => those are denied while RLS is on.
--  Results are entered via Supabase Studio, which bypasses RLS.)
create policy "tournaments readable" on tournaments
  for select to authenticated using (true);
create policy "teams readable" on teams
  for select to authenticated using (true);
create policy "groups readable" on groups
  for select to authenticated using (true);
create policy "group_teams readable" on group_teams
  for select to authenticated using (true);
create policy "matches readable" on matches
  for select to authenticated using (true);

-- --- profiles: own row only ---
create policy "own profile" on profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- --- entries: own rows only ---
create policy "own entries" on entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --- predictions: own only, via the parent entry ---
create policy "own match_predictions" on match_predictions
  for all to authenticated
  using (exists (
    select 1 from entries e
    where e.id = match_predictions.entry_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from entries e
    where e.id = match_predictions.entry_id and e.user_id = (select auth.uid())
  ));

create policy "own predicted_group_positions" on predicted_group_positions
  for all to authenticated
  using (exists (
    select 1 from entries e
    where e.id = predicted_group_positions.entry_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from entries e
    where e.id = predicted_group_positions.entry_id and e.user_id = (select auth.uid())
  ));

create policy "own predicted_progression" on predicted_progression
  for all to authenticated
  using (exists (
    select 1 from entries e
    where e.id = predicted_progression.entry_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from entries e
    where e.id = predicted_progression.entry_id and e.user_id = (select auth.uid())
  ));

commit;
