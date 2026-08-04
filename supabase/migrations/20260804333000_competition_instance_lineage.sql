-- ---------------------------------------------------------------------------
-- Contract 103 — a competition can happen more than once.
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
-- lifecycle is contract 105, and contract 104 teaches those readers to resolve
-- the live instance first.
--
-- Until then the partial index is strictly equivalent to the constraint it
-- replaces: with no completed competitions there is nothing for it to permit
-- that the old one forbade. That equivalence is asserted rather than assumed in
-- `154_competition_instance_lineage.sql`.
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

-- A first instance's series is itself — for EVERY row, not only the backfilled
-- ones. `series_id` cannot carry a column default that references `id`, and a
-- random default would break the identity the backfill establishes, so the
-- default is a BEFORE INSERT trigger: an insert that says nothing about
-- lineage becomes instance 1 of its own new series, and an insert that states
-- its lineage (the restart driver) is left untouched.
--
-- Without this, every existing inserter — `ensure_original_predictor_availability`
-- fired from the tournaments trigger, the C1b game-catalogue seeding, the seed
-- itself — would violate the NOT NULL the moment this contract landed. The
-- first draft shipped without it and CI seeding failed on exactly that.
create or replace function predictor_internal.prepare_competition_lineage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $lineage$
begin
  new.series_id := coalesce(new.series_id, new.id);
  return new;
end;
$lineage$;

drop trigger if exists prepare_competition_lineage on public.bonus_competitions;
create trigger prepare_competition_lineage
before insert on public.bonus_competitions
for each row
execute function predictor_internal.prepare_competition_lineage();

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
-- Contract 104 moves the single-row lookups onto this. Adding it here means the
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


-- ---------------------------------------------------------------------------
-- The one WRITER on the replaced key.
-- ---------------------------------------------------------------------------
--
-- The reader audit was done for contract 104 — but readers were not the only
-- dependents of the dropped constraint. `pg_proc` shows exactly one live
-- function whose body UPSERTS on the pair:
-- `predictor_internal.ensure_original_predictor_availability()`, fired by a
-- trigger on `tournaments`, so it runs for every seeded or created season.
--
-- A bare `on conflict (tournament_id, game_key)` infers a non-partial unique
-- arbiter, and after the drop none exists: every tournament insert fails with
-- 42P10. The first draft of this contract shipped without this section and CI
-- could not even seed — recorded here so the next constraint-to-partial-index
-- swap checks writers as well as readers.
--
-- The body is otherwise the live definition verbatim; only the conflict target
-- gains the index predicate. Contending with the LIVE instance is also the
-- only correct semantics once completed predecessors exist: an availability
-- refresh must never resurrect or edit a completed run.
--
-- The other `on conflict (tournament_id, game_key)` sites in the migration
-- history are top-level statements that replay BEFORE this contract, while the
-- old constraint still exists, so they are correct as written and untouched
-- (migrations are append-only after hosted application).

CREATE OR REPLACE FUNCTION predictor_internal.ensure_original_predictor_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.kind = 'tournament' then
    insert into public.bonus_competitions (
      tournament_id,
      game_key,
      published,
      availability_status,
      registration_opens_at,
      registration_closes_at,
      draw_required
    ) values (
      new.id,
      'original_predictor',
      false,
      'active',
      case
        when new.lock_at is not null and new.lock_at <= new.created_at
          then new.lock_at - interval '1 second'
        else new.created_at
      end,
      new.lock_at,
      false
    )
    -- Contract 103: the uniqueness this upsert infers is now the PARTIAL
    -- live-instance index, and a bare column-list conflict target cannot infer
    -- a partial index — every tournament insert would fail with 42P10, which is
    -- exactly how the first draft of this contract stopped CI seeding. Naming
    -- the index predicate keeps the inference exact: the upsert contends with
    -- the LIVE Original Predictor instance, which is also the only correct
    -- behaviour once completed predecessors can exist.
    on conflict (tournament_id, game_key) where completed_at is null do update
      set registration_opens_at = case
            when excluded.registration_closes_at is null then
              public.bonus_competitions.registration_opens_at
            else least(
              coalesce(
                public.bonus_competitions.registration_opens_at,
                excluded.registration_closes_at - interval '1 second'
              ),
              excluded.registration_closes_at - interval '1 second'
            )
          end,
          registration_closes_at = excluded.registration_closes_at,
          availability_status = 'active',
          updated_at = now()
      where public.bonus_competitions.game_key = 'original_predictor'
        and not public.bonus_competitions.published;
  end if;

  return new;
end;
$function$;

commit;
