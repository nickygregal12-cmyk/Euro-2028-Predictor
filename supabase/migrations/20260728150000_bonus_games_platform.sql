begin;

-- ---------------------------------------------------------------------------
-- Bonus Games platform schema (ADR-0010, stage B2).
--
-- Stored competitions, windows, window fixtures, entrants, score events and
-- audit shared by the three bonus games (KO Predictor, Last Man Standing,
-- Predictor Cup). The separation law (docs/competition-structure.md §1) is a
-- schema fact here: nothing references entries, league_members, score_events
-- or rank_history. Shared user accounts (auth.users) and shared real fixtures
-- (matches) are the only common ground with the Original Predictor.
--
-- Deny-all posture: RLS enabled with no policies and every table revoked from
-- the client roles. No browser surface can reach these tables until the B3
-- read/registration RPCs exist; mutation is owner/security-definer only.
-- ---------------------------------------------------------------------------

create table public.bonus_competitions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  game_key text not null check (
    game_key in ('ko_predictor', 'last_man_standing', 'predictor_cup')
  ),
  published boolean not null default false,
  -- Null while the opening date is still to be confirmed (provisional state).
  registration_opens_at timestamptz,
  -- Null means rolling entry — the KO Predictor's decided behaviour.
  registration_closes_at timestamptz,
  draw_required boolean not null default false,
  draw_completed_at timestamptz,
  -- Set only once every window has settled and the winner is confirmed.
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, game_key),
  constraint bonus_competitions_registration_order check (
    registration_opens_at is null
    or registration_closes_at is null
    or registration_closes_at > registration_opens_at
  ),
  constraint bonus_competitions_draw_shape check (
    draw_required or draw_completed_at is null
  )
);

create index bonus_competitions_tournament_idx
  on public.bonus_competitions (tournament_id);

-- A round of a competition as stored data (§7): when it opens, locks and may
-- settle, and whether it needs a tie-break input (the Cup's Penalty Number).
-- locks_at is the window-level display fallback; where a game locks per
-- kickoff, the per-match lock is authoritative and arrives with B4.
create table public.bonus_competition_windows (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null
    references public.bonus_competitions(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  opens_at timestamptz,
  locks_at timestamptz,
  settles_at timestamptz,
  requires_tie_break_input boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id, sequence),
  constraint bonus_windows_lock_after_open check (
    opens_at is null or locks_at is null or locks_at > opens_at
  ),
  constraint bonus_windows_settle_after_lock check (
    locks_at is null or settles_at is null or settles_at >= locks_at
  ),
  constraint bonus_windows_settle_after_open check (
    opens_at is null or settles_at is null or settles_at >= opens_at
  )
);

create index bonus_competition_windows_competition_idx
  on public.bonus_competition_windows (competition_id);

-- Which real fixtures belong to a round. Restrict rather than cascade on the
-- match side: a real fixture disappearing under a scheduled window is an
-- anomaly that must fail closed, not silently shrink the round.
create table public.bonus_window_fixtures (
  window_id uuid not null
    references public.bonus_competition_windows(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (window_id, match_id)
);

create index bonus_window_fixtures_match_idx
  on public.bonus_window_fixtures (match_id);

-- A real fixture may appear in only one window per competition, and only in a
-- window of its own tournament. Cross-competition reuse is expected: the KO
-- Predictor and the Predictor Cup schedule the same real knockout matches.
create or replace function predictor_internal.assert_bonus_window_fixture_shape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competition_id uuid;
  v_competition_tournament uuid;
  v_match_tournament uuid;
begin
  select w.competition_id, c.tournament_id
    into v_competition_id, v_competition_tournament
    from public.bonus_competition_windows w
    join public.bonus_competitions c on c.id = w.competition_id
    where w.id = new.window_id;

  select m.tournament_id
    into v_match_tournament
    from public.matches m
    where m.id = new.match_id;

  if v_match_tournament is distinct from v_competition_tournament then
    raise exception 'Window fixtures must belong to the competition tournament'
      using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.bonus_window_fixtures f
      join public.bonus_competition_windows w on w.id = f.window_id
      where w.competition_id = v_competition_id
        and f.match_id = new.match_id
        and f.window_id <> new.window_id
  ) then
    raise exception 'A real fixture may appear in only one window per competition'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create trigger assert_bonus_window_fixture_shape
before insert or update on public.bonus_window_fixtures
for each row
execute function predictor_internal.assert_bonus_window_fixture_shape();

-- Voluntary, per-competition entry (competition-structure §1): joining an
-- Original Predictor league never creates one of these, and entering one game
-- never creates one for another. Dedicated table per ADR-0010 decision 1;
-- the previously planned entries.entry_type mechanism is abandoned.
create table public.bonus_competition_entrants (
  competition_id uuid not null
    references public.bonus_competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  outcome text not null default 'active' check (
    outcome in ('active', 'qualified', 'survived', 'eliminated', 'champion')
  ),
  updated_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);

create index bonus_competition_entrants_user_idx
  on public.bonus_competition_entrants (user_id);

-- Per-competition score events, always attributed to an entrant row so a
-- score can never exist for someone who has not entered. Each game writes its
-- own categories under its own rules in B5–B7; bonus points never touch
-- Original Predictor score_events.
create table public.bonus_score_events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null,
  user_id uuid not null,
  window_id uuid references public.bonus_competition_windows(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 40),
  points integer not null,
  explanation text not null check (
    char_length(btrim(explanation)) between 1 and 300
  ),
  calculation_version integer not null default 1 check (calculation_version > 0),
  created_at timestamptz not null default now(),
  foreign key (competition_id, user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete cascade
);

create index bonus_score_events_entrant_idx
  on public.bonus_score_events (competition_id, user_id);
create index bonus_score_events_match_idx
  on public.bonus_score_events (match_id);

-- Append-only platform audit: publication, window changes, draw events,
-- settlement, corrections. Mutation of history is blocked below.
create table public.bonus_competition_audit (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null
    references public.bonus_competitions(id) on delete cascade,
  action text not null check (char_length(btrim(action)) between 3 and 60),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now()
);

create index bonus_competition_audit_competition_idx
  on public.bonus_competition_audit (competition_id, recorded_at);

create or replace function predictor_internal.block_bonus_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Bonus competition audit entries are immutable'
    using errcode = '42501';
end;
$$;

create trigger block_bonus_audit_mutation
before update or delete on public.bonus_competition_audit
for each row
execute function predictor_internal.block_bonus_audit_mutation();

alter table public.bonus_competitions enable row level security;
alter table public.bonus_competition_windows enable row level security;
alter table public.bonus_window_fixtures enable row level security;
alter table public.bonus_competition_entrants enable row level security;
alter table public.bonus_score_events enable row level security;
alter table public.bonus_competition_audit enable row level security;

revoke all on table public.bonus_competitions
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_competition_windows
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_window_fixtures
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_competition_entrants
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_score_events
  from public, anon, authenticated, service_role;
revoke all on table public.bonus_competition_audit
  from public, anon, authenticated, service_role;

revoke all on function predictor_internal.assert_bonus_window_fixture_shape()
  from public, anon, authenticated, service_role;
revoke all on function predictor_internal.block_bonus_audit_mutation()
  from public, anon, authenticated, service_role;

commit;
