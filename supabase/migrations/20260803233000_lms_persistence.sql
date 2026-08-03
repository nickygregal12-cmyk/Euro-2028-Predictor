-- Contract 72: Last Man Standing setup and entrant state.
--
-- Contract 71 added `resolve_lms_pick` as a pure rule taking lives and saves as
-- arguments, because nothing stored them. This stores them.
--
-- Two relations, both hanging off the existing per-season game availability
-- root so no parallel competition store appears:
--
--   season_lms_setups        — the rules one LMS competition runs under
--   season_lms_entrant_state — what one entrant has left to spend
--
-- `bonus_lms_selections` already holds the picks, including the constraint that
-- makes LMS bite (`unique (competition_id, user_id, team_id)` — each team once
-- per competition). It is not duplicated here.
--
-- THE RULE MOST WORTH ENCODING. `publicLmsSetup()` pins a public competition to
-- Classic: no lives, no saves, draws eliminate. A public game has no creator to
-- choose its rules, so "public with two lives" is not a variant — it is an
-- unreviewed rule reaching real entrants. The check constraint below refuses it
-- outright rather than trusting whichever caller creates the competition.
--
-- Custom private setups ARE permitted (ADR 0013) but only inside the recorded
-- bounds: `validateLmsSetup` rejects more than LMS_MAX_LIVES = 3 or
-- LMS_MAX_SAVES = 2, and so does the schema.

-- ---------------------------------------------------------------------------
-- season_lms_setups
-- ---------------------------------------------------------------------------

create table public.season_lms_setups (
  competition_id uuid primary key
    references public.bonus_competitions(id) on delete cascade,
  lives smallint not null,
  saves smallint not null,
  draws_rule text not null,
  endgame_scope text not null,
  -- Null exactly when the competition is public: a public endgame has no
  -- wipeout choice to record.
  endgame_on_wipeout text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint season_lms_setups_lives_range
    check (lives between 0 and 3),
  constraint season_lms_setups_saves_range
    check (saves between 0 and 2),
  constraint season_lms_setups_draws_rule_allowed
    check (draws_rule in ('eliminate', 'survive')),
  constraint season_lms_setups_endgame_scope_allowed
    check (endgame_scope in ('public', 'private')),
  constraint season_lms_setups_wipeout_allowed
    check (
      endgame_on_wipeout is null
      or endgame_on_wipeout in ('play_on', 'shared_win', 'reset')
    ),
  -- A private endgame must say what happens on a wipeout; a public one must
  -- not pretend to.
  constraint season_lms_setups_wipeout_matches_scope
    check ((endgame_scope = 'private') = (endgame_on_wipeout is not null)),
  -- Public is Classic, and only Classic.
  constraint season_lms_setups_public_is_classic
    check (
      endgame_scope <> 'public'
      or (lives = 0 and saves = 0 and draws_rule = 'eliminate')
    )
);

alter table public.season_lms_setups enable row level security;
revoke all on table public.season_lms_setups from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- season_lms_entrant_state
--
-- Keyed to the canonical entrant row, so state cannot exist for someone who
-- never entered.
-- ---------------------------------------------------------------------------

create table public.season_lms_entrant_state (
  competition_id uuid not null,
  user_id uuid not null,
  lives_remaining smallint not null,
  saves_remaining smallint not null,
  updated_at timestamptz not null default now(),

  primary key (competition_id, user_id),

  constraint season_lms_entrant_state_entrant_fkey
    foreign key (competition_id, user_id)
    references public.bonus_competition_entrants(competition_id, user_id)
    on delete cascade,

  constraint season_lms_entrant_state_counts_non_negative
    check (lives_remaining >= 0 and saves_remaining >= 0)
);

create index season_lms_entrant_state_competition_idx
  on public.season_lms_entrant_state (competition_id);

alter table public.season_lms_entrant_state enable row level security;
revoke all on table public.season_lms_entrant_state from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cross-table invariants.
--
--   1. a setup belongs to a Last Man Standing competition, not some other game;
--   2. an entrant never holds more than the setup granted.
--
-- The second is the one that matters at settlement: `resolve_lms_pick` spends
-- what it is handed, so an entrant carrying four lives under a one-life setup
-- would simply survive three extra defeats and nothing would look wrong.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_lms_setup_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_key text;
begin
  select game_key into v_game_key
    from public.bonus_competitions
   where id = new.competition_id;

  if v_game_key is distinct from 'last_man_standing' then
    raise exception 'A Last Man Standing setup belongs to a last_man_standing competition, not %', coalesce(v_game_key, 'a missing competition')
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function predictor_internal.assert_lms_setup_game() from public, anon, authenticated;

create trigger assert_lms_setup_game
before insert or update of competition_id
on public.season_lms_setups
for each row
execute function predictor_internal.assert_lms_setup_game();

create or replace function predictor_internal.assert_lms_entrant_allowance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lives smallint;
  v_saves smallint;
begin
  select setup.lives, setup.saves
    into v_lives, v_saves
    from public.season_lms_setups setup
   where setup.competition_id = new.competition_id;

  if v_lives is null then
    raise exception 'This competition has no Last Man Standing setup, so an entrant allowance cannot be checked'
      using errcode = '23514';
  end if;

  if new.lives_remaining > v_lives then
    raise exception 'An entrant cannot hold % lives under a % life setup', new.lives_remaining, v_lives
      using errcode = '23514';
  end if;

  if new.saves_remaining > v_saves then
    raise exception 'An entrant cannot hold % saves under a % save setup', new.saves_remaining, v_saves
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function predictor_internal.assert_lms_entrant_allowance() from public, anon, authenticated;

create trigger assert_lms_entrant_allowance
before insert or update of lives_remaining, saves_remaining, competition_id
on public.season_lms_entrant_state
for each row
execute function predictor_internal.assert_lms_entrant_allowance();

-- ---------------------------------------------------------------------------
-- Prove the containers start empty and closed.
-- ---------------------------------------------------------------------------

do $$
begin
  if (select count(*) from public.season_lms_setups) <> 0
     or (select count(*) from public.season_lms_entrant_state) <> 0 then
    raise exception 'the Last Man Standing tables must start empty';
  end if;

  if (
    select count(*) from pg_class
     where relname in ('season_lms_setups', 'season_lms_entrant_state')
       and relnamespace = 'public'::regnamespace
       and relrowsecurity
  ) <> 2 then
    raise exception 'both Last Man Standing tables must have row level security enabled';
  end if;
end;
$$;
