-- Contract 81: where each matchweek card stands, and what the lock did to it.
--
-- Second of three slices toward the recurring matchweek scheduler ADR 0012
-- asks for. Contract 80 added the resolution law; this adds the two things it
-- needs to read and write. The recurrence itself is contract 82.
--
-- ABSENCE IS THE DEFAULT, AND THAT IS THE WHOLE DESIGN. `status` permits only
-- 'provisional' and 'confirmed'. There is deliberately no 'no_submission'
-- value, because a player who never engaged a matchweek has NO ROW — rolling
-- entry means absence, and `resolveCardAtLock` returns `unbanked` for exactly
-- that case.
--
-- Storing an explicit 'no_submission' row would be the same rule written a
-- weaker way: some future writer creates one per registered player per
-- matchweek "for completeness", and from then on every player is a candidate
-- for auto-completion. The lock would enter people who never opened the app,
-- with default predictions, and the totals would look entirely plausible. The
-- CHECK makes that unrepresentable rather than merely discouraged.
--
-- ONE ROW PER ENTRY PER MATCHWEEK. `unique (tournament_id, entry_id,
-- competition_round_id)` — a card is the player's state for that matchweek, not
-- an event log. Their edits move the row; the outcome ledger below records what
-- happened to it.
--
-- THE LEDGER MAKES THE LOCK IDEMPOTENT, mirroring
-- `entry_automatic_submission_outcomes` from the tournament path. Its
-- `unique (entry_id, competition_round_id, locks_at)` is what lets contract 82
-- ask "which matchweeks have I not processed at this lock instant?" and get a
-- truthful answer after a retry, a crash or a redeploy. `locks_at` is part of
-- the key on purpose: a matchweek whose lock MOVED is a different lock, and its
-- cards deserve reprocessing rather than being skipped because an older
-- instant was already handled.
--
-- The three outcomes are exactly the three shapes `resolve_season_card_at_lock`
-- returns — submitted, unbanked, refused — so nothing is lost in translation
-- and a refusal is recorded rather than retried forever.

create table if not exists public.season_matchweek_cards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  entry_id uuid not null,
  competition_round_id uuid not null,

  -- No 'no_submission'. Absence is that state; see the header.
  status text not null check (status in ('provisional', 'confirmed')),
  confirmed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint season_matchweek_cards_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_cards_round_fkey
    foreign key (tournament_id, competition_round_id)
    references public.competition_rounds(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_cards_one_per_matchweek
    unique (tournament_id, entry_id, competition_round_id),

  -- A confirmed card knows when it was confirmed, and an unconfirmed one
  -- cannot claim to. Without this, `confirmed_at` drifts into decoration.
  constraint season_matchweek_cards_confirmed_at_matches_status
    check ((status = 'confirmed') = (confirmed_at is not null))
);

create index if not exists season_matchweek_cards_round_idx
  on public.season_matchweek_cards (tournament_id, competition_round_id);

alter table public.season_matchweek_cards enable row level security;

revoke all on table public.season_matchweek_cards from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the lock did, once per card per lock instant.
-- ---------------------------------------------------------------------------

create table if not exists public.season_matchweek_submission_outcomes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null,
  entry_id uuid not null,
  competition_round_id uuid not null,

  -- Part of the key: a rescheduled matchweek is a different lock.
  locks_at timestamptz not null,

  -- The three shapes `resolve_season_card_at_lock` returns.
  outcome text not null check (outcome in ('submitted', 'unbanked', 'refused')),
  attempted_at timestamptz not null,
  submitted_at timestamptz,
  auto_completed boolean,
  refusal_reason text,

  constraint season_matchweek_outcomes_entry_fkey
    foreign key (tournament_id, entry_id)
    references public.entries(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_outcomes_round_fkey
    foreign key (tournament_id, competition_round_id)
    references public.competition_rounds(tournament_id, id)
    on delete cascade,

  constraint season_matchweek_outcomes_once_per_lock
    unique (entry_id, competition_round_id, locks_at),

  -- Each outcome carries exactly its own evidence and nothing else. A
  -- 'submitted' row without a timestamp cannot be reconciled against the
  -- predictions it claims to have written; an 'unbanked' row carrying one
  -- would assert a submission that never happened.
  --
  -- The refusal branch tests `refusal_reason is not null` BEFORE bounding its
  -- length, and that ordering is load-bearing rather than tidiness. A CHECK
  -- treats NULL as satisfied, so a branch whose last conjunct is
  -- `char_length(btrim(<null>)) between 1 and 500` evaluates to NULL, the whole
  -- OR evaluates to NULL, and the row is admitted. The tournament ledger this
  -- mirrors has exactly that shape, and a scratch PostgreSQL 16 confirmed it
  -- accepts an 'invalid' outcome carrying no failure message at all — a
  -- refusal that does not say why, which is the one thing the column exists
  -- for. That table is production-hosted and is not this contract's to change;
  -- this one does not inherit the hole.
  constraint season_matchweek_outcomes_shape check (
    (
      outcome = 'submitted'
      and submitted_at is not null
      and auto_completed is not null
      and refusal_reason is null
    )
    or (
      outcome = 'unbanked'
      and submitted_at is null
      and auto_completed is null
      and refusal_reason is null
    )
    or (
      outcome = 'refused'
      and submitted_at is null
      and auto_completed is null
      and refusal_reason is not null
      and char_length(btrim(refusal_reason)) between 1 and 500
    )
  )
);

create index if not exists season_matchweek_outcomes_round_idx
  on public.season_matchweek_submission_outcomes (tournament_id, competition_round_id, locks_at);

alter table public.season_matchweek_submission_outcomes enable row level security;

revoke all on table public.season_matchweek_submission_outcomes
  from public, anon, authenticated;

-- The ledger is append-only, as the tournament's is. Without this the record
-- of what the lock did is editable after the fact: a 'refused' row becomes
-- 'submitted' with no trace, and contract 82's "have I processed this?" reads
-- the rewrite as truth. An unbanked player would then be indistinguishable
-- from a submitted one, which is the whole question the ledger answers.
create or replace function predictor_internal.block_season_matchweek_outcome_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Season matchweek submission outcomes are immutable'
    using errcode = '42501';
end;
$$;

-- No `drop trigger if exists` guard: this migration creates the table it binds
-- to, so there is nothing to drop, and `scripts/check-migration-additive.mjs`
-- reads any `drop trigger` as destructive and routes the migration away from
-- the fast lane. The defensive line bought nothing and cost the rollout path.
create trigger block_season_matchweek_outcome_mutation
before update or delete on public.season_matchweek_submission_outcomes
for each row
execute function predictor_internal.block_season_matchweek_outcome_mutation();

-- ---------------------------------------------------------------------------
-- Prove the rolling-entry invariant at apply time rather than trusting it.
--
-- The header explains why 'no_submission' must not be storable. This checks
-- that the constraint as written actually refuses it, so the explanation and
-- the schema cannot drift apart.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class t on t.oid = c.conrelid
     where t.relname = 'season_matchweek_cards'
       and c.contype = 'c'
       and pg_catalog.pg_get_constraintdef(c.oid) like '%no_submission%'
  ) then
    raise exception
      'season_matchweek_cards permits a no_submission status; absence must be that state';
  end if;
end;
$$;
