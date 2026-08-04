-- ---------------------------------------------------------------------------
-- Contract 102 — a competition can happen more than once.
--
-- ADR 0025 decision 1, the prerequisite the decision names as the larger half
-- of the work: "The current `unique (tournament_id, game_key)` constraint cannot
-- support repeating LMS competitions. It should eventually be replaced by
-- lifecycle-aware uniqueness … `bonus_competitions` is currently carrying both
-- 'game availability' and 'competition instance' responsibilities, so this
-- change should explicitly separate or reconcile those concepts rather than
-- merely dropping the unique constraint."
--
-- ---------------------------------------------------------------------------
-- THE CONFLATION, NAMED
-- ---------------------------------------------------------------------------
--
-- One `bonus_competitions` row currently answers two different questions:
--
--   AVAILABILITY — does this competition season offer this game?
--     `tournament_id`, `game_key`, `availability_status`, `published`
--
--   INSTANCE — this particular running of it
--     `id`, `registration_opens_at`, `registration_closes_at`, `draw_required`,
--     `draw_completed_at`, `completed_at`
--
-- and `unique (tournament_id, game_key)` is an AVAILABILITY key doing an
-- INSTANCE row's job. That is exactly why a restart is unrepresentable: the
-- season offers Last Man Standing once, so the season may only ever run it once.
--
-- This contract RECONCILES the two rather than splitting the table, which is
-- the second option ADR 0025 allows and the far smaller change. The row stays
-- the instance; the availability pair stops being unique across all of history
-- and becomes unique across the *live* instance only. Availability then reads
-- as "this season offers this game, and here is the instance currently
-- running", which is what every existing caller already assumes it means.
--
-- Splitting availability into its own relation was considered and rejected for
-- now: it would move `availability_status` and `published` out from under 27
-- functions that read them alongside instance columns, for no behaviour anyone
-- has asked for. The conflation is resolved by making the KEY honest, not by
-- moving columns.
--
-- ---------------------------------------------------------------------------
-- WHY THIS IS SAFE TO LAND ALONE
-- ---------------------------------------------------------------------------
--
-- Roughly twenty functions do a single-row lookup on
-- `(tournament_id, game_key)` and expect exactly one row. Relaxing the
-- constraint makes that assumption false — but only once a second instance
-- exists, and **nothing in this contract can create one**. The restart
-- lifecycle is contract 104, and contract 103 teaches those readers to resolve
-- the live instance first.
--
-- Until then the partial index is strictly equivalent to the constraint it
-- replaces: with no completed competitions there is nothing for it to permit
-- that the old one forbade. That equivalence is asserted rather than assumed in
-- `153_competition_instance_lineage.sql`.
--
-- The ordering matters and is deliberate: shape, then callers, then the driver.
-- Landing the driver before the callers would make every one of those twenty
-- lookups an arbitrary-row read at the exact moment the first competition
-- restarted — the failure this session has already found three times
-- (`get_my_cup` at 98, the bonus rederive functions at 100, and the membership
-- key contract 101 declined to widen).
-- ---------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- Lineage. A series is the chain of instances of one game in one season.
-- ---------------------------------------------------------------------------

alter table public.bonus_competitions
  add column if not exists series_id uuid,
  add column if not exists series_sequence integer not null default 1,
  add column if not exists predecessor_competition_id uuid;

-- Every existing competition is the first, and only, instance of its own
-- series. Backfilling `series_id = id` means no row needs a new identifier and
-- the series of a never-restarted competition is itself.
update public.bonus_competitions set series_id = id where series_id is null;

alter table public.bonus_competitions
  alter column series_id set not null;

alter table public.bonus_competitions
  add constraint bonus_competitions_series_sequence_positive
  check (series_sequence > 0);

-- The first instance of a series has no predecessor; every later one has one.
-- Stated as an equivalence so neither direction can drift.
alter table public.bonus_competitions
  add constraint bonus_competitions_predecessor_matches_sequence
  check ((series_sequence > 1) = (predecessor_competition_id is not null));

alter table public.bonus_competitions
  add constraint bonus_competitions_predecessor_not_self
  check (predecessor_competition_id is null or predecessor_competition_id <> id);

alter table public.bonus_competitions
  add constraint bonus_competitions_series_sequence_key
  unique (series_id, series_sequence);

-- The target key the predecessor reference below needs. Declared first,
-- because a composite foreign key requires a matching unique key to already
-- exist on the referenced columns.
alter table public.bonus_competitions
  add constraint bonus_competitions_series_member_key
  unique (series_id, id);

-- A predecessor must be a real competition. The composite reference also pins
-- it to the SAME series, so a chain cannot wander between series or games.
alter table public.bonus_competitions
  add constraint bonus_competitions_predecessor_fkey
  foreign key (series_id, predecessor_competition_id)
  references public.bonus_competitions (series_id, id)
  on delete restrict;

create index if not exists bonus_competitions_series_idx
  on public.bonus_competitions (series_id, series_sequence);

-- ---------------------------------------------------------------------------
-- The terminal state a restart leaves behind.
-- ---------------------------------------------------------------------------
--
-- ADR 0025: "complete the old row with a terminal outcome such as
-- `no_winner_restarted`". `completed_at` already records THAT a competition
-- finished; nothing recorded WHY, so a restarted competition and a won one were
-- indistinguishable after the fact.
alter table public.bonus_competitions
  add column if not exists completion_reason text;

alter table public.bonus_competitions
  add constraint bonus_competitions_completion_reason_allowed
  check (completion_reason is null
         or completion_reason in ('won', 'no_winner_restarted', 'abandoned'));

-- A reason without a completion is a contradiction; a completion without a
-- reason is the state every existing row is in, so it stays legal.
alter table public.bonus_competitions
  add constraint bonus_competitions_completion_reason_needs_completion
  check (completion_reason is null or completed_at is not null);

-- ---------------------------------------------------------------------------
-- Lifecycle-aware uniqueness.
-- ---------------------------------------------------------------------------
--
-- The replacement invariant, in ADR 0025's words: "one active public LMS
-- competition per season/series, while allowing completed predecessors and
-- private competitions to coexist."
--
-- Expressed generally rather than for Last Man Standing alone: at most one
-- LIVE instance per (tournament, game). A completed predecessor no longer
-- occupies the slot, which is the whole point; two live instances of one game
-- in one season remain impossible, which is what every caller relies on.
alter table public.bonus_competitions
  drop constraint bonus_competitions_tournament_id_game_key_key;

create unique index bonus_competitions_live_instance_key
  on public.bonus_competitions (tournament_id, game_key)
  where completed_at is null;

-- ---------------------------------------------------------------------------
-- One named resolver, so twenty callers do not each invent the same filter.
-- ---------------------------------------------------------------------------
--
-- Contract 103 moves the single-row lookups onto this. Adding it here means the
-- definition of "the live instance" exists in exactly one place before anything
-- depends on it, rather than being spelled out twenty times and drifting.
create or replace function predictor_internal.live_competition_id(
  p_tournament_id uuid,
  p_game_key text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select competition.id
    from public.bonus_competitions competition
   where competition.tournament_id = p_tournament_id
     and competition.game_key = p_game_key
     and competition.completed_at is null
$$;

revoke all on function predictor_internal.live_competition_id(uuid, text)
  from public, anon, authenticated, service_role;

commit;
