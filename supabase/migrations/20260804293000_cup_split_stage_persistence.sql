-- ---------------------------------------------------------------------------
-- Contract 101 — the Cup split becomes a distinct persisted stage.
--
-- ADR 0025 decision 2. Contract 79 widened two format constraints on the shared
-- Cup stores and deliberately did NOT widen `bonus_cup_fixtures.stage`, because
-- a split stage would immediately violate `bonus_cup_fixtures_group_shape`:
-- that constraint requires a non-group stage to carry neither `group_id` nor
-- `matchday`, while split rounds need both. Contract 79 was right to stop
-- there — the answer is a decision, not a widening.
--
-- The decision: `stage = 'split'`. The split is a genuine phase transition, not
-- a group stage under another label. The field divides into halves, points
-- carry forward, nobody is eliminated, and new round-robin fixtures are played
-- within each half. Recording that as `stage = 'group'` would make the stored
-- model less expressive than the competition it records, and every read would
-- have to reconstruct by inference what the schema could simply have said.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS CONTRACT DOES
-- ---------------------------------------------------------------------------
--
--   1. `bonus_cup_fixtures.stage` accepts 'split', and its three shape
--      constraints are re-expressed so 'split' behaves like 'group' where it
--      genuinely is like a group (it has a group and a matchday, it carries no
--      bracket slot, it never settles a winner) rather than by being called
--      one.
--
--   2. `bonus_cup_groups` gains `phase_kind` and `parent_group_id`, so each
--      half points back at the single group it came from and the two phases are
--      distinguishable without inference.
--
--   3. Split membership is persisted in a NEW relation rather than by widening
--      the existing membership key. Why, at length, below — it is the one place
--      this migration departs from the shape ADR 0025 lists first, and the ADR
--      explicitly permits the alternative.
--
-- What it deliberately does NOT do: derive standings across both phases. ADR
-- 0025 requires continuing standings to be DERIVED from initial and split
-- fixtures rather than copied into a starting total, and that is a change to
-- the ranking functions, not to storage. It lands separately so the shape
-- carries its own behaviour-equivalence evidence for the tournament path.
--
-- Nothing drives a split yet. This is storage, in the same order contracts 68
-- through 79 used: shape first, then the rules that write it.
--
-- ---------------------------------------------------------------------------
-- MEMBERSHIP: A SEPARATE RELATION, NOT A WIDER KEY
-- ---------------------------------------------------------------------------
--
-- ADR 0025: "The present `(competition_id, user_id)` membership key forbids
-- phase-specific duplicate memberships, so it must become phase-aware or be
-- supplemented by a dedicated phase-membership relation."
--
-- This takes the supplement, and the reason is a failure mode rather than a
-- preference. `bonus_cup_members` has a primary key of
-- `(competition_id, user_id)`, and the Cup machinery reads it in sixteen places
-- with `where competition_id = … and user_id = …`, several of them through
-- `select … into`, all of them expecting exactly one row.
--
-- Adding `phase_kind` to that table and widening the key to include it would
-- leave every one of those reads working **today**, because every existing row
-- is initial-phase — and would silently turn all of them into arbitrary-row
-- reads the moment the first split row is written. No test would fail at the
-- point the hazard was introduced. That is the same defect shape found in
-- `get_my_cup` at contract 98 and in the two bonus rederive functions at
-- contract 100, and introducing a third instance knowingly, in the migration
-- that had the choice, would be indefensible.
--
-- A separate relation cannot express the ambiguity at all. It also satisfies
-- "preserve the original membership rows permanently" by construction rather
-- than by discipline: nothing in this contract writes to `bonus_cup_members`.
--
-- ---------------------------------------------------------------------------
-- MATCHDAY KEEPS COUNTING
-- ---------------------------------------------------------------------------
--
-- ADR 0025: "Keep `matchday` as the competition's overall Cup round number
-- rather than resetting it at the split." So a split matchday continues from
-- the league phase — round 8 follows round 7 — and `matchday > 0` is the only
-- bound the schema imposes, exactly as contract 79 left it. The competition,
-- not the column, owns how many rounds there are.
--
-- This matters for more than presentation: a reset would make
-- `(group_id, matchday)` ambiguous across phases, and any ordering by matchday
-- would interleave the two phases.
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 1. Groups gain a phase and a parent.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_groups
  add column if not exists phase_kind text not null default 'initial',
  add column if not exists parent_group_id uuid;

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_phase_kind_allowed
  check (phase_kind in ('initial', 'split'));

-- An initial group has no parent; a split half must have one. Stated as an
-- equivalence rather than two implications so neither direction can drift.
alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_parent_matches_phase
  check ((phase_kind = 'split') = (parent_group_id is not null));

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_parent_not_self
  check (parent_group_id is null or parent_group_id <> id);

-- The parent must itself be an INITIAL group in the SAME competition, so the
-- structure is exactly two levels deep and cannot chain.
--
-- Done declaratively rather than with a trigger. `parent_phase_kind` is a
-- generated column that can only ever hold 'initial' or NULL, and the composite
-- foreign key below then makes "parent is an initial group in this competition"
-- a key lookup. A composite FK with any NULL column is not enforced, which is
-- exactly the behaviour wanted for an initial group with no parent.
--
-- A chain is therefore unrepresentable rather than merely refused: a split
-- group cannot be a parent, because its `phase_kind` is not 'initial'.
alter table public.bonus_cup_groups
  add column if not exists parent_phase_kind text
  generated always as (case when parent_group_id is null then null else 'initial' end) stored;

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_competition_id_phase_key
  unique (competition_id, id, phase_kind);

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_parent_is_initial_fkey
  foreign key (competition_id, parent_group_id, parent_phase_kind)
  references public.bonus_cup_groups (competition_id, id, phase_kind)
  on delete restrict;

-- Ordinals are per phase. A competition with three initial groups and two split
-- halves has ordinals 1..3 and 1..2, not 1..3 and 4..5 — the halves are a fresh
-- sequence within their own phase, and `(competition_id, ordinal)` alone would
-- force them to share one.
alter table public.bonus_cup_groups
  drop constraint bonus_cup_groups_competition_id_ordinal_key;

alter table public.bonus_cup_groups
  add constraint bonus_cup_groups_competition_phase_ordinal_key
  unique (competition_id, phase_kind, ordinal);

create index if not exists bonus_cup_groups_parent_idx
  on public.bonus_cup_groups (parent_group_id)
  where parent_group_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Fixtures accept the split stage.
-- ---------------------------------------------------------------------------

alter table public.bonus_cup_fixtures
  drop constraint bonus_cup_fixtures_stage_check;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_stage_allowed
  check (stage in ('group', 'split', 'playoff', 'knockout'));

-- The shape ADR 0025 specifies. Written with explicit stage lists on both sides
-- rather than `stage <> 'group'`, so adding a fifth stage later fails closed
-- instead of silently landing in the bracket branch.
alter table public.bonus_cup_fixtures
  drop constraint bonus_cup_fixtures_group_shape;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_group_shape
  check (
    (stage in ('group', 'split') and group_id is not null and matchday is not null)
    or
    (stage in ('playoff', 'knockout') and group_id is null and matchday is null)
  );

-- A split round is round-robin within a half: no bracket slot, no round size.
alter table public.bonus_cup_fixtures
  drop constraint bonus_cup_fixtures_stage_bracket_shape;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_stage_bracket_shape
  check (
    (stage in ('group', 'split') and round_size is null and bracket_slot is null)
    or (stage = 'playoff' and round_size is null and bracket_slot is not null)
    or (stage = 'knockout' and round_size is not null and bracket_slot is not null)
  );

-- Nobody is eliminated at the split, so a split fixture never carries a winner,
-- a decision method or a settlement instant — the same rule the league phase
-- already has, for the same reason.
alter table public.bonus_cup_fixtures
  drop constraint bonus_cup_fixtures_group_never_settles;

alter table public.bonus_cup_fixtures
  add constraint bonus_cup_fixtures_league_phase_never_settles
  check (
    stage not in ('group', 'split')
    or (winner_user_id is null and decided_by is null and settled_at is null)
  );

-- ---------------------------------------------------------------------------
-- 3. Split membership, in its own relation.
-- ---------------------------------------------------------------------------

create table if not exists public.bonus_cup_split_members (
  competition_id uuid not null,
  user_id uuid not null,
  group_id uuid not null,
  tournament_id uuid not null,
  -- Position within the half at the moment of the split, for audit and
  -- presentation. It is NOT a starting total: ADR 0025 rejects copying carried
  -- points into a new figure, because the fixtures already determine them.
  seeded_position smallint,
  created_at timestamptz not null default now(),

  primary key (competition_id, user_id),

  -- An entrant may only hold a split membership if they are an entrant, and
  -- RESTRICT rather than CASCADE so removing an entrant cannot quietly empty a
  -- half that fixtures already reference.
  constraint bonus_cup_split_members_entrant_fkey
    foreign key (competition_id, user_id)
    references public.bonus_competition_entrants (competition_id, user_id)
    on delete restrict,

  constraint bonus_cup_split_members_tournament_competition_fkey
    foreign key (tournament_id, competition_id)
    references public.bonus_competitions (tournament_id, id) on delete cascade,

  constraint bonus_cup_split_members_group_fkey
    foreign key (tournament_id, competition_id, group_id)
    references public.bonus_cup_groups (tournament_id, competition_id, id)
    on delete cascade,

  constraint bonus_cup_split_members_position_positive
    check (seeded_position is null or seeded_position > 0)
);

-- The half an entrant is placed in must be a SPLIT-phase group. Same generated
-- column trick as the parent link: a plain FK cannot express "and its
-- phase_kind is 'split'", and a trigger would be a second opinion about a fact
-- the key already knows.
alter table public.bonus_cup_split_members
  add column if not exists group_phase_kind text
  generated always as ('split') stored;

alter table public.bonus_cup_split_members
  add constraint bonus_cup_split_members_group_is_split_fkey
  foreign key (competition_id, group_id, group_phase_kind)
  references public.bonus_cup_groups (competition_id, id, phase_kind)
  on delete cascade;

create index if not exists bonus_cup_split_members_group_idx
  on public.bonus_cup_split_members (group_id);

alter table public.bonus_cup_split_members enable row level security;

-- Same posture as `bonus_cup_members`, which is revoked from every browser role
-- and read only through the bounded `get_my_cup` RPC.
revoke all on table public.bonus_cup_split_members
  from public, anon, authenticated, service_role;

commit;
