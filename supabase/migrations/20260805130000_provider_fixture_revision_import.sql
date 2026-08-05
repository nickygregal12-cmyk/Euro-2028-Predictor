-- Contract 117: a provider kickoff change reaches the fixture.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS THE FIRST OF, AND WHAT IT IS NOT
-- ---------------------------------------------------------------------------
--
-- Contract 115 made the database able to call a provider. Contract 112 made a
-- provider identifier resolvable to our rows, and on 5 August 2026 both league
-- seasons were mapped for the first time, so `provider_mapping_gaps` finally
-- answers `ready: true`. Nothing has ever written `season_fixtures` from a
-- provider payload — the real fixture lists were put there by a one-off
-- operation over an archived response, which is not a path anything can take
-- again.
--
-- This is the repeatable path, and it is deliberately the narrowest slice of it:
-- **an existing fixture's kickoff moves.** It creates no fixture, deletes no
-- fixture, and moves no fixture between rounds.
--
-- ADR 0020 §Ingestion decides that "fixture changes import automatically and
-- notify an administrator for review". Automatic revision of a kickoff is that
-- sentence. Automatic CREATION is not: a fixture appearing that this platform
-- did not know about is a change to what a competition IS, and the season
-- surfaces, Last Man Standing eligibility and the Championship calendar all
-- derive from the fixture set. That belongs to an administrative act with its
-- own authority, and inventing it here as a side effect of a kickoff importer
-- would be the same mistake contract 112 stopped short of.
--
-- ---------------------------------------------------------------------------
-- THE OWNER AMENDMENT, MADE EXECUTABLE
-- ---------------------------------------------------------------------------
--
-- ADR 0020 §79 used to reassign a rescheduled fixture to "the round its new
-- kickoff falls in". The owner amendment of 5 August 2026 reverses that: the
-- fixture STAYS in the matchweek it was scheduled in, its prediction stays
-- editable until its own kickoff, and a single moved match never creates a
-- round. The round is a label, not a position.
--
-- So this function never writes `competition_round_id`. That is not an omission
-- to be filled in later — it is the rule, and the test suite asserts a moved
-- kickoff leaves the round alone even when the new instant sits inside a
-- different matchweek entirely. Contract 113's round play window is therefore
-- genuinely not consulted here, which settles the question that contract's
-- header left open.
--
-- ---------------------------------------------------------------------------
-- WHY IT FAILS CLOSED ON THE WHOLE PAYLOAD
-- ---------------------------------------------------------------------------
--
-- If any team or round in the payload is unmapped, NOTHING is applied. Not the
-- mapped subset — nothing.
--
-- A partially applied fixture list is the worst of the available outcomes. It
-- leaves a season where some kickoffs are current and some are stale, with no
-- record of which is which, and every derived lock computed from the mixture.
-- Refusing whole is recoverable by mapping the missing identifier and running
-- again; a half-applied list is recoverable only by someone reconstructing what
-- the provider said at the time.

begin;

-- ---------------------------------------------------------------------------
-- The record an administrator reviews.
--
-- Append-only, and separate from the fixture: the fixture carries the current
-- kickoff, this carries the fact that it moved and what it moved from. ADR 0020
-- asks for notification and review, and neither is possible against a column
-- that has been overwritten.
-- ---------------------------------------------------------------------------

create table predictor_internal.season_fixture_revisions (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  season_fixture_id uuid not null
    references public.season_fixtures(id) on delete cascade,

  provider text not null,
  provider_fixture_id text,

  previous_kickoff_at timestamptz,
  new_kickoff_at timestamptz not null,

  raw_response_id uuid
    references predictor_internal.provider_raw_responses(id) on delete set null,

  applied_at timestamptz not null default now(),

  -- Null until an administrator has looked. This is the whole notification
  -- surface: unreviewed rows are the queue.
  reviewed_at timestamptz,

  constraint season_fixture_revisions_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  -- A revision that did not move anything is not a revision. Recording one
  -- would put noise in the queue an administrator is meant to read.
  constraint season_fixture_revisions_moved
    check (previous_kickoff_at is distinct from new_kickoff_at)
);

comment on table predictor_internal.season_fixture_revisions is
  'Contract 117. Append-only record of every kickoff a provider moved, with the '
  'instant it moved from. Unreviewed rows are the administrator''s queue.';

alter table predictor_internal.season_fixture_revisions enable row level security;

revoke all on table predictor_internal.season_fixture_revisions
  from anon, authenticated, service_role;

create index season_fixture_revisions_unreviewed_idx
  on predictor_internal.season_fixture_revisions (tournament_id, applied_at desc)
  where reviewed_at is null;

-- The history is evidence, so it may be marked reviewed and nothing else. An
-- update that rewrote what a kickoff moved from would make the queue a record
-- of what somebody decided rather than of what a provider said.
create or replace function predictor_internal.block_season_fixture_revision_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $immutable$
begin
  if tg_op = 'DELETE' then
    raise exception 'A fixture revision may not be deleted'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.tournament_id is distinct from old.tournament_id
     or new.season_fixture_id is distinct from old.season_fixture_id
     or new.provider is distinct from old.provider
     or new.provider_fixture_id is distinct from old.provider_fixture_id
     or new.previous_kickoff_at is distinct from old.previous_kickoff_at
     or new.new_kickoff_at is distinct from old.new_kickoff_at
     or new.raw_response_id is distinct from old.raw_response_id
     or new.applied_at is distinct from old.applied_at
  then
    raise exception 'A fixture revision may only be marked reviewed'
      using errcode = '42501';
  end if;

  return new;
end;
$immutable$;

revoke all on function predictor_internal.block_season_fixture_revision_rewrite()
  from public, anon, authenticated, service_role;

create trigger block_season_fixture_revision_rewrite
before update or delete on predictor_internal.season_fixture_revisions
for each row
execute function predictor_internal.block_season_fixture_revision_rewrite();

-- ---------------------------------------------------------------------------
-- The import.
--
-- Takes the normalized payload contract 96's decoder produces — the same shape
-- `provider_mapping_gaps` reads — so the thing that reports readiness and the
-- thing that acts on it consume one representation rather than two.
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

    v_revised := v_revised + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'considered', v_considered,
    'revised', v_revised,
    'unchanged', v_unchanged,
    'unmatched', v_unmatched,
    'refused', v_refused
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
       and relation.relname = 'season_fixture_revisions'
       and relation.relrowsecurity
  ) then
    raise exception 'season_fixture_revisions must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_name = 'season_fixture_revisions'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can reach the revision record';
  end if;

  -- This migration adds an importer; it must not import anything.
  if exists (select 1 from predictor_internal.season_fixture_revisions) then
    raise exception 'this migration must record no fixture revision';
  end if;
end;
$$;

commit;
