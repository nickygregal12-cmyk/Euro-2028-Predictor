-- Contract 123: a stale round play window is refreshed, and a conflicting
-- refresh queues rather than fails.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- Contract 113 derives a round's play window from its own fixtures' kickoffs
-- and STORES it. Contract 117 moves a kickoff automatically whenever a provider
-- says it moved. Nothing has ever run between the two, so from the moment the
-- first provider revision lands, `competition_rounds.window_opens_at` is a
-- statement about a kickoff that no longer exists.
--
-- Contract 122 found this and said so in its own header rather than fixing it,
-- because the fix carried a decision: "Automatic re-derivation could therefore
-- make an ordinary provider import start failing, which is a behaviour change
-- to the ingestion path, not to a standings view." That is exactly right, and
-- it is the reason this contract exists as its own thing — the refresh had to
-- be built so that it CANNOT do that.
--
-- The exposure while it was open is small and worth naming, because it bounds
-- what this contract is allowed to be worth: the only live consumer of the
-- stored window is contract 122's month calendar, which reads `window_opens_at`
-- alone. So a stale window misfiles a matchweek into the wrong monthly table
-- when a round's FIRST fixture moves across a month boundary, and does nothing
-- else. (`resolve_round_for_kickoff` also reads it and still has no caller: the
-- ADR 0020 owner amendment of 5 August 2026 means a rescheduled fixture keeps
-- its matchweek, so nothing asks which round an instant falls in.)
--
-- A derived view being quietly wrong is not an emergency. Making the fixture
-- importer fail because a derived view could not be recomputed would be.
--
-- ---------------------------------------------------------------------------
-- THE CONFLICT PATH, WHICH IS THE WHOLE DECISION
-- ---------------------------------------------------------------------------
--
-- A postponed fixture EXTENDS its round's play span. Extend it far enough and
-- the round's proposed window reaches into the next round's, and contract 113's
-- disjointness trigger refuses two rounds claiming the same instant — correctly,
-- because an instant claimed twice is the ambiguity that contract deliberately
-- made unreachable from stored data.
--
-- Four things could happen at that point. Three of them are wrong:
--
--   RAISE. The refresh propagates the trigger's error, the import transaction
--   rolls back, and a single postponed Wednesday fixture stops an entire
--   season's kickoffs importing. This is contract 122's stated objection and it
--   is decisive on its own.
--
--   APPLY ANYWAY. Not available, and would not be taken if it were. Two rounds
--   claiming one instant is the state contract 113 exists to exclude.
--
--   MOVE THE OTHER ROUND'S BOUNDARY. This is contract 113's TILED reading —
--   choosing where a boundary sits between two rounds — which that contract
--   recorded as an owner decision precisely because nobody has written the rule
--   down. A migration inventing it here would be the same mistake in a worse
--   place: inside an automatic ingestion path, where nobody is watching.
--
-- So the fourth: **the old window stays exactly as it is, and the proposal is
-- recorded for an administrator.** The stored fact keeps whatever correctness
-- it had, the new fact is not lost, and the queue says what would have been
-- written and which round stood in the way.
--
-- This is the same shape contract 117 already chose for a fixture revision —
-- append-only, unreviewed rows are the queue — for the same reason. ADR 0020's
-- ingestion rule is "import automatically and notify an administrator for
-- review", and a refresh that cannot be applied automatically is exactly the
-- case that sentence is about.
--
-- A stale window is wrong in one bounded way that this contract can state in a
-- sentence. An invented window is wrong in ways nobody has enumerated, because
-- the rule that produced it was never agreed.
--
-- ---------------------------------------------------------------------------
-- ONE ROUND AT A TIME, IN ORDINAL ORDER, AGAINST THE STORED CALENDAR
-- ---------------------------------------------------------------------------
--
-- Contract 113's whole-season deriver clears every window and rebuilds it. That
-- is right for a first derivation and wrong for a refresh: clearing a window
-- destroys the stored fact this contract exists to preserve, and it would clear
-- rounds no provider payload mentioned.
--
-- So this walks the target rounds in ordinal order and decides each against the
-- calendar as it stands at that moment — accepted proposals already written,
-- everything else still holding its old window. The final calendar is disjoint,
-- and the reason is worth writing down rather than trusting:
--
--   take any two rounds A and B, A decided first. When B was decided, A was
--   already at its final value, so B's acceptance was tested against it. And if
--   B was refused, B keeps the old window that A's own acceptance test had
--   already been checked against. Either way the pair does not overlap.
--
-- Order matters to the OUTCOME, not to the correctness: two rounds that both
-- shift later can leave the earlier one queued against a window the later one
-- is about to vacate. That is a real limitation and it resolves the way every
-- other one here does — the operator reads the queue, and the next refresh
-- after the blocking round moves accepts the proposal without anyone doing
-- anything. It is not silently wrong; it is visibly deferred.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It does not move a fixture between rounds — the owner amendment, unchanged
-- and untouched. It writes no lock, score, prediction, standing or settlement.
-- It adds no browser-reachable function and no table grant. It does not
-- re-derive a season wholesale: contract 117 supplies the rounds whose fixtures
-- actually moved, and nothing else is recomputed.

begin;

-- ---------------------------------------------------------------------------
-- The queue.
--
-- Append-only and separate from the round, for contract 117's reason: the round
-- carries the window in force, this carries a window that was proposed and
-- refused, and what it would have replaced. Neither fact can be reviewed from a
-- column that has been overwritten.
--
-- `blocking_*` is copied rather than joined. The blocking round's window is the
-- reason this proposal was refused, and by the time an administrator reads the
-- row that window may itself have been refreshed — a queue that re-derives its
-- own explanation on read cannot say what actually happened.
-- ---------------------------------------------------------------------------

create table predictor_internal.round_window_refresh_conflicts (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  competition_round_id uuid not null
    references public.competition_rounds(id) on delete cascade,

  -- Null when the round had no window at all. That is a real case: a round
  -- whose fixtures were never scheduled has none, and its first derivation can
  -- still collide with a neighbour that has already spread.
  retained_opens_at timestamptz,
  retained_closes_at timestamptz,

  proposed_opens_at timestamptz not null,
  proposed_closes_at timestamptz not null,

  blocking_round_id uuid not null
    references public.competition_rounds(id) on delete cascade,
  blocking_opens_at timestamptz not null,
  blocking_closes_at timestamptz not null,

  detected_at timestamptz not null default now(),

  -- Null until an administrator has looked. Unreviewed rows are the queue.
  reviewed_at timestamptz,

  constraint round_window_refresh_conflicts_retained_paired
    check ((retained_opens_at is null) = (retained_closes_at is null)),

  constraint round_window_refresh_conflicts_retained_ordered
    check (retained_opens_at is null or retained_opens_at <= retained_closes_at),

  constraint round_window_refresh_conflicts_proposed_ordered
    check (proposed_opens_at <= proposed_closes_at),

  constraint round_window_refresh_conflicts_blocking_ordered
    check (blocking_opens_at <= blocking_closes_at),

  -- A round cannot block itself. The refusal is always about another round's
  -- claim on the same instant.
  constraint round_window_refresh_conflicts_blocking_is_other
    check (blocking_round_id <> competition_round_id),

  -- A proposal identical to what is already stored is not a conflict — it is
  -- not even a write. Recording one would put noise in a queue somebody has to
  -- read, which is contract 117's `season_fixture_revisions_moved` rule applied
  -- to the same kind of surface.
  constraint round_window_refresh_conflicts_proposal_differs
    check (
      retained_opens_at is distinct from proposed_opens_at
      or retained_closes_at is distinct from proposed_closes_at
    )
);

comment on table predictor_internal.round_window_refresh_conflicts is
  'Contract 123. Append-only record of a round play window refresh that was '
  'refused because the proposed span overlapped another round''s. The old '
  'window stayed in force; unreviewed rows are the administrator''s queue.';

alter table predictor_internal.round_window_refresh_conflicts enable row level security;

revoke all on table predictor_internal.round_window_refresh_conflicts
  from anon, authenticated, service_role;

create index round_window_refresh_conflicts_unreviewed_idx
  on predictor_internal.round_window_refresh_conflicts (tournament_id, detected_at desc)
  where reviewed_at is null;

-- One open row per round per proposal.
--
-- Contract 115 drives the provider poll from pg_cron, so an unresolved conflict
-- is re-proposed on every cadence — hourly, for as long as nobody acts. Without
-- this the queue grows by one identical row an hour and stops being readable,
-- which is the failure that makes an administrator ignore it.
--
-- Keyed on the PROPOSAL and not on the round alone, because a further
-- reschedule proposes a different span and that is genuinely new information.
-- The row is immutable, so a changed proposal cannot be an update.
create unique index round_window_refresh_conflicts_open_proposal_idx
  on predictor_internal.round_window_refresh_conflicts
     (competition_round_id, proposed_opens_at, proposed_closes_at)
  where reviewed_at is null;

-- The history is evidence, so it may be marked reviewed and nothing else.
create or replace function predictor_internal.block_round_window_conflict_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $immutable$
begin
  if tg_op = 'DELETE' then
    raise exception 'A round window refresh conflict may not be deleted'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.tournament_id is distinct from old.tournament_id
     or new.competition_round_id is distinct from old.competition_round_id
     or new.retained_opens_at is distinct from old.retained_opens_at
     or new.retained_closes_at is distinct from old.retained_closes_at
     or new.proposed_opens_at is distinct from old.proposed_opens_at
     or new.proposed_closes_at is distinct from old.proposed_closes_at
     or new.blocking_round_id is distinct from old.blocking_round_id
     or new.blocking_opens_at is distinct from old.blocking_opens_at
     or new.blocking_closes_at is distinct from old.blocking_closes_at
     or new.detected_at is distinct from old.detected_at
  then
    raise exception 'A round window refresh conflict may only be marked reviewed'
      using errcode = '42501';
  end if;

  return new;
end;
$immutable$;

revoke all on function predictor_internal.block_round_window_conflict_rewrite()
  from public, anon, authenticated, service_role;

create trigger block_round_window_conflict_rewrite
before update or delete on predictor_internal.round_window_refresh_conflicts
for each row
execute function predictor_internal.block_round_window_conflict_rewrite();

-- ---------------------------------------------------------------------------
-- The refresh.
--
-- `p_round_ids` null means every round in the season, which is the operator's
-- form. Contract 117 passes the rounds whose fixtures it actually moved, so an
-- import recomputes what it changed and nothing else.
--
-- No `kind` filter, matching contract 113's deriver exactly. A window is a
-- statement about when a round is played and that is true of a knockout round
-- and a group matchday as much as of a matchweek; filtering here would make the
-- refresh disagree with the derivation it refreshes.
--
-- IT NEVER RAISES ON A CONFLICT. That is the property the ingestion path
-- depends on, so it is stated as a property rather than left to be inferred
-- from the absence of a `raise`. The overlap is detected BEFORE the update, not
-- caught from the trigger afterwards: catching would work, but it would make
-- the trigger the authority for the queue's contents and leave no way to record
-- WHICH round blocked the proposal.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.refresh_round_play_windows(
  p_tournament_id uuid,
  p_round_ids uuid[] default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $refresh$
declare
  v_exists boolean;
  v_round record;
  v_clash record;
  v_refreshed integer := 0;
  v_unchanged integer := 0;
  v_cleared integer := 0;
  v_conflicted integer := 0;
  v_queued integer := 0;
  v_inserted integer := 0;
begin
  if p_now is null then
    raise exception 'Refresh time is required' using errcode = '22023';
  end if;

  select true into v_exists
    from public.tournaments season
   where season.id = p_tournament_id;

  if v_exists is not true then
    raise exception 'Competition season % does not exist', p_tournament_id
      using errcode = '23503';
  end if;

  for v_round in
    select round.id,
           round.window_opens_at,
           round.window_closes_at,
           span.first_kickoff,
           span.last_kickoff
      from public.competition_rounds round
      join lateral (
        select min(fixture.kickoff_at) as first_kickoff,
               max(fixture.kickoff_at) as last_kickoff
          from public.season_fixtures fixture
         where fixture.competition_round_id = round.id
           and fixture.kickoff_at is not null
      ) span on true
     where round.tournament_id = p_tournament_id
       and (p_round_ids is null or round.id = any (p_round_ids))
     order by round.ordinal
  loop
    -- Already current. Counted rather than skipped silently, so a scheduled
    -- caller can see that it ran and found nothing to do.
    if v_round.first_kickoff is not distinct from v_round.window_opens_at
       and v_round.last_kickoff is not distinct from v_round.window_closes_at
    then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    -- The round plays over no instant any more: every fixture left it, or none
    -- has a kickoff. Clearing can never overlap anything, so it is applied
    -- without a conflict test. Contract 113 is explicit that this must happen —
    -- a round holding a window it no longer plays over makes the disjointness
    -- guard refuse the round that legitimately took that time.
    if v_round.first_kickoff is null then
      update public.competition_rounds
         set window_opens_at = null,
             window_closes_at = null
       where id = v_round.id;

      v_cleared := v_cleared + 1;
      continue;
    end if;

    -- The calendar as it stands: accepted proposals from earlier ordinals are
    -- already written here, later rounds still hold their old windows.
    select other.id, other.window_opens_at, other.window_closes_at
      into v_clash
      from public.competition_rounds other
     where other.tournament_id = p_tournament_id
       and other.id <> v_round.id
       and other.window_opens_at is not null
       and other.window_opens_at <= v_round.last_kickoff
       and other.window_closes_at >= v_round.first_kickoff
     order by other.ordinal
     limit 1;

    if found then
      -- The old window is NOT touched on this path. Everything below records
      -- what would have replaced it.
      insert into predictor_internal.round_window_refresh_conflicts (
        tournament_id, competition_round_id,
        retained_opens_at, retained_closes_at,
        proposed_opens_at, proposed_closes_at,
        blocking_round_id, blocking_opens_at, blocking_closes_at,
        detected_at
      ) values (
        p_tournament_id, v_round.id,
        v_round.window_opens_at, v_round.window_closes_at,
        v_round.first_kickoff, v_round.last_kickoff,
        v_clash.id, v_clash.window_opens_at, v_clash.window_closes_at,
        p_now
      )
      on conflict do nothing;

      get diagnostics v_inserted = row_count;
      v_queued := v_queued + v_inserted;
      v_conflicted := v_conflicted + 1;
      continue;
    end if;

    update public.competition_rounds
       set window_opens_at = v_round.first_kickoff,
           window_closes_at = v_round.last_kickoff
     where id = v_round.id;

    v_refreshed := v_refreshed + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'refreshed', v_refreshed,
    'unchanged', v_unchanged,
    'cleared', v_cleared,
    'conflicted', v_conflicted,
    'queued', v_queued
  );
end;
$refresh$;

revoke all on function predictor_internal.refresh_round_play_windows(uuid, uuid[], timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The driver.
--
-- Contract 117's importer, redefined from its own committed text with ONE
-- change: it collects the rounds whose fixtures it moved and refreshes those
-- windows before it returns. `tests/database-parity/roundWindowStaleRefreshParity.test.ts`
-- holds the two texts against each other so the redefinition is verified by
-- diff rather than by reading, which is contract 118's method for exactly this.
--
-- The refresh runs INSIDE the import transaction on purpose. A window derived
-- from kickoffs that have already been committed elsewhere would be a second
-- answer to when a round is played, briefly and undetectably.
--
-- Nothing else in this repository moves a season kickoff, which contract 122
-- established by measurement. When that stops being true, the new writer needs
-- this call too, and the parity guard is where that gets noticed.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.import_provider_fixture_revisions(
  p_provider text,
  p_tournament_id uuid,
  p_payload jsonb,
  p_raw_response_id uuid default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $import$
declare
  v_gaps jsonb;
  v_row record;
  v_fixture record;
  v_considered integer := 0;
  v_revised integer := 0;
  v_unchanged integer := 0;
  v_unmatched integer := 0;
  v_refused integer := 0;
  v_touched_rounds uuid[] := array[]::uuid[];
  v_windows jsonb := null;
begin
  if p_now is null then
    raise exception 'Import time is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tournaments t where t.id = p_tournament_id
  ) then
    raise exception 'Competition season % does not exist', p_tournament_id
      using errcode = '23503';
  end if;

  -- Fail closed on the whole payload. A partly applied fixture list leaves some
  -- kickoffs current and some stale with no record of which, and every derived
  -- lock computed from the mixture.
  v_gaps := predictor_internal.provider_mapping_gaps(p_provider, p_tournament_id, p_payload);
  if coalesce((v_gaps->>'ready')::boolean, false) is not true then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'reason', 'unmapped_identifiers',
      'gaps', v_gaps
    );
  end if;

  for v_row in
    select
      predictor_internal.resolve_provider_round(
        p_provider, p_tournament_id, entry->>'roundProviderId') as round_id,
      predictor_internal.resolve_provider_team(
        p_provider, p_tournament_id, entry->>'homeTeamProviderId') as home_id,
      predictor_internal.resolve_provider_team(
        p_provider, p_tournament_id, entry->>'awayTeamProviderId') as away_id,
      (entry->>'kickoffAt')::timestamptz as kickoff,
      entry->>'providerFixtureId' as provider_fixture_id
    from pg_catalog.jsonb_array_elements(p_payload) as entry
  loop
    v_considered := v_considered + 1;

    -- Matched on the natural key rather than on a provider fixture id, and the
    -- amendment is what makes that sound: a rescheduled fixture keeps its
    -- round, so (season, round, home, away) still names the same match after it
    -- moves. `assert_season_fixture_shape` already refuses a club playing twice
    -- in one matchweek, so the key cannot match two rows.
    select fixture.id, fixture.kickoff_at, fixture.status
      into v_fixture
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.competition_round_id = v_row.round_id
       and fixture.home_team_id = v_row.home_id
       and fixture.away_team_id = v_row.away_id;

    if not found then
      -- A fixture this platform does not hold is NOT created. What a
      -- competition consists of is not something a kickoff importer decides.
      v_unmatched := v_unmatched + 1;
      continue;
    end if;

    if v_fixture.kickoff_at is not distinct from v_row.kickoff then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    -- Two refusals, both fail-closed and both counted rather than raised, so
    -- one awkward fixture cannot stop the rest of a season importing.
    --
    -- A fixture that is no longer scheduled has been played, abandoned or
    -- voided, and its kickoff is now a historical fact rather than a plan.
    -- A kickoff moved into the past would retroactively close a lock that was
    -- open, which is the one direction that can invalidate a prediction
    -- somebody was entitled to make.
    if v_fixture.status <> 'scheduled' or v_row.kickoff <= p_now then
      v_refused := v_refused + 1;
      continue;
    end if;

    insert into predictor_internal.season_fixture_revisions (
      tournament_id, season_fixture_id, provider, provider_fixture_id,
      previous_kickoff_at, new_kickoff_at, raw_response_id, applied_at
    ) values (
      p_tournament_id, v_fixture.id, p_provider, v_row.provider_fixture_id,
      v_fixture.kickoff_at, v_row.kickoff, p_raw_response_id, p_now
    );

    -- competition_round_id is deliberately absent from this update. The owner
    -- amendment: the fixture stays in the matchweek it was scheduled in.
    update public.season_fixtures
       set kickoff_at = v_row.kickoff
     where id = v_fixture.id;

    -- Contract 123: the round this fixture stayed in now plays over a different
    -- span, so its stored window is stale.
    if not (v_row.round_id = any (v_touched_rounds)) then
      v_touched_rounds := v_touched_rounds || v_row.round_id;
    end if;

    v_revised := v_revised + 1;
  end loop;

  -- Contract 123. Only the rounds this import actually moved, and only when it
  -- moved one — an import that revised nothing has nothing to refresh, and
  -- recomputing the whole season would rewrite windows no payload mentioned.
  if v_revised > 0 then
    v_windows := predictor_internal.refresh_round_play_windows(
      p_tournament_id, v_touched_rounds, p_now);
  end if;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'considered', v_considered,
    'revised', v_revised,
    'unchanged', v_unchanged,
    'unmatched', v_unmatched,
    'refused', v_refused,
    'windows', v_windows
  );
end;
$import$;

revoke all on function predictor_internal.import_provider_fixture_revisions(
  text, uuid, jsonb, uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'predictor_internal'
       and relation.relname = 'round_window_refresh_conflicts'
       and relation.relrowsecurity
  ) then
    raise exception 'round_window_refresh_conflicts must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'predictor_internal'
       and table_name = 'round_window_refresh_conflicts'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can reach the refresh conflict queue';
  end if;

  -- This migration adds a refresh; it must not refresh anything. Contract 122
  -- derived every league season's windows from the fixtures as they stood, and
  -- re-running here would hide whether the driver works behind a backfill.
  if exists (select 1 from predictor_internal.round_window_refresh_conflicts) then
    raise exception 'this migration must record no refresh conflict';
  end if;

  -- The importer keeps the rule the owner amendment made. A redefinition that
  -- reintroduced round reassignment would pass every assertion above.
  if pg_catalog.pg_get_functiondef(
       pg_catalog.to_regprocedure(
         'predictor_internal.import_provider_fixture_revisions(text,uuid,jsonb,uuid,timestamptz)')::oid
     ) like '%set competition_round_id%' then
    raise exception 'the importer writes competition_round_id; the owner amendment forbids it';
  end if;
end;
$$;

commit;
