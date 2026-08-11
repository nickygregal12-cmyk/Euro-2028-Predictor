-- Contract 174 — a provider calendar CHANGE gets staged instead of discarded.
--
-- Closes `INGEST-002`, `INGEST-003` and `INGEST-005`.
--
-- ---------------------------------------------------------------------------
-- WHAT WAS MEASURED, IN THE DELIVERED IMPORTER'S OWN TEXT
-- ---------------------------------------------------------------------------
--
-- `predictor_internal.import_provider_fixture_revisions` (contract 117) walks a
-- decoded payload and, for anything that is not a kickoff move on a fixture we
-- already hold, does this:
--
--     if not found then
--       -- A fixture this platform does not hold is NOT created.
--       v_unmatched := v_unmatched + 1;
--       continue;
--     ...
--     if v_fixture.status <> 'scheduled' or v_row.kickoff <= p_now then
--       v_refused := v_refused + 1;
--       continue;
--
-- Refusing to create a fixture is right — `INGEST-002` says so, and contract
-- 117's header says so. **But the counter is the only trace.** `v_unmatched`
-- and `v_refused` are returned in a jsonb report, written into
-- `provider_response_consumption.report`, and read by nothing. So a provider
-- announcing a fixture this platform has never heard of, or reporting one
-- cancelled, produces a number in a log and no administrator ever sees it.
--
-- A third case is worse because it is not even counted: a fixture WE hold that
-- the provider has **stopped sending**. The importer iterates the payload, so a
-- withdrawal is invisible by construction.
--
-- `INGEST-002`, `INGEST-003` and `INGEST-005` are exactly these three, and all
-- three have stood "Accepted — unimplemented" since the register was created.
--
-- ---------------------------------------------------------------------------
-- IT STAGES. IT DOES NOT PUBLISH.
-- ---------------------------------------------------------------------------
--
-- Detection writes a PROPOSAL and never touches `season_fixtures`. The only
-- function in this migration that can change a fixture is
-- `admin_decide_provider_change_proposal`, which requires
-- `require_competition_admin()` and an explicit decision per proposal. That is
-- contract 132's shape — archive, stage, decide — reused rather than reinvented,
-- because what a competition CONSISTS of is not something an importer decides.
--
-- ---------------------------------------------------------------------------
-- WITHDRAWAL NEEDS A DECLARED COVERAGE WINDOW, AND THE JOB SUPPLIES NONE
-- ---------------------------------------------------------------------------
--
-- This is the decision most likely to be undone by someone who has not thought
-- about it, so it is stated here rather than left in the code.
--
-- "The provider stopped sending this fixture" is only evidence of withdrawal if
-- the payload was a COMPLETE view of some span. A provider poll is not: contract
-- 146 made the stored path carry `{{date:+N}}` placeholders, so an ordinary poll
-- asks for a few days. Detecting withdrawal from such a payload would propose
-- voiding every fixture outside the window — and bounding it "by round" is no
-- better, because a Saturday-only payload for matchweek 5 would propose voiding
-- matchweek 5's Sunday fixtures.
--
-- So `p_covers_from` / `p_covers_to` are REQUIRED for withdrawal detection, they
-- mean "this payload is a complete view of this span", and when they are null
-- withdrawal detection does not run and the report says
-- `withdrawalChecked: false`. **The automatic consumer passes null**, because a
-- response's own completeness is not something the consumer can know. Staging a
-- withdrawal is therefore an operator action with an explicit claim attached,
-- and the mechanism exists for `INGEST-003` rather than being asserted from a
-- silence nobody promised.
--
-- ---------------------------------------------------------------------------
-- WHAT IT DELIBERATELY DOES NOT CLAIM TO TELL APART
-- ---------------------------------------------------------------------------
--
-- `INGEST-003` names "material team identity change or material round change".
-- Contract 117 matches a fixture on `(season, round, home, away)` — the natural
-- key — and `season_fixtures` holds no provider fixture id. So a fixture whose
-- teams or round the provider has changed does not match, and is
-- **indistinguishable from a newly discovered one** using only what this
-- repository stores.
--
-- Rather than guess, a `discovered` proposal carries the provider's fixture id
-- and, when a prior kickoff revision has recorded that same id against one of
-- our fixtures, a `possible_change_of` warning naming it. The administrator is
-- told what is known and what is not. Inventing a classifier here would put a
-- confident label on a coin flip, and the label is what someone would approve.
--
-- ---------------------------------------------------------------------------
-- WHAT APPROVAL MAY NEVER DO
-- ---------------------------------------------------------------------------
--
-- It may never touch a fixture that has been PLAYED or that carries a score.
-- `season_fixtures.home_score` is what predictions were settled against, so
-- voiding a played fixture would silently rescore a settled matchweek — the
-- exact reasoning contract 160 used when it put an awarded outcome BESIDE a
-- fixture rather than in it. `season_fixtures_scores_match_status` would refuse
-- the write anyway; the refusal here is explicit so it reads as a rule and
-- reaches the administrator as a sentence rather than as a constraint name.
--
-- ---------------------------------------------------------------------------
-- IT SHIPS WITH ITS CALLER
-- ---------------------------------------------------------------------------
--
-- `predictor_internal.consume_provider_responses` is redefined from its
-- committed text with ONE added call, verified by diff at the foot of this
-- migration rather than by reading — the control contract 124 established after
-- a hand-copied tail drifted. Eleven contracts in this repository have shipped
-- an authority nothing could call; this is not the twelfth.

begin;

-- ===========================================================================
-- 1. The queue
-- ===========================================================================

create table if not exists predictor_internal.provider_calendar_change_proposals (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  provider text not null,
  raw_response_id uuid,

  proposal_kind text not null,

  -- Null for `discovered`: there is no fixture of ours to point at yet. That is
  -- the whole reason the proposal exists.
  season_fixture_id uuid references public.season_fixtures(id) on delete cascade,

  -- The natural key the provider is describing, resolved to OUR identifiers.
  -- Stored rather than re-resolved at decision time, because the entity map can
  -- move between detection and approval and an administrator must approve what
  -- they were shown.
  competition_round_id uuid references public.competition_rounds(id) on delete cascade,
  home_team_id uuid references public.teams(id) on delete cascade,
  away_team_id uuid references public.teams(id) on delete cascade,
  provider_fixture_id text,

  -- The decoded proposal and what we hold, so a reviewer sees a diff rather
  -- than a claim. NEVER the raw provider response: contract 168 established
  -- that a raw payload does not leave the server, and the read below returns
  -- neither of these columns verbatim in any case.
  proposed jsonb not null default '{}'::jsonb,
  observed jsonb not null default '{}'::jsonb,

  -- Named per row rather than counted, which is contract 168's rule: a count of
  -- blockers tells an administrator that something is wrong and not what.
  warnings text[] not null default '{}'::text[],
  blockers text[] not null default '{}'::text[],

  detected_at timestamptz not null,

  -- NOT part of the immutable evidence. A provider that keeps announcing an
  -- already-rejected fixture must not refill the queue, and an administrator
  -- who rejected it once is entitled to know it has been said two hundred times
  -- since.
  seen_count integer not null default 1,
  last_seen_at timestamptz not null,

  state text not null default 'pending',
  decided_at timestamptz,
  -- `on delete set null`, matching contract 138's `provider_review_
  -- acknowledgements.actor_id`, and the CHECK below is written around it: WHO
  -- decided may become unknown if that account is ever erased, but THAT it was
  -- decided, when, why and what it changed must survive — the calendar mutation
  -- happened and the record of it is not the administrator's to take away.
  decided_by uuid references auth.users(id) on delete set null,
  decision_reason text,
  resulting_action jsonb,

  constraint provider_change_proposals_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  constraint provider_change_proposals_kind_allowed
    check (proposal_kind in (
      -- The provider names a fixture whose (round, home, away) we do not hold.
      -- See the header: this necessarily also covers a changed team or round.
      'discovered',
      -- The provider reports a fixture we hold as no longer going ahead.
      'postponed', 'abandoned', 'cancelled',
      -- We hold a scheduled fixture inside a span the caller declared complete
      -- and the provider did not name it.
      'withdrawn')),

  constraint provider_change_proposals_state_allowed
    check (state in ('pending', 'approved', 'rejected')),

  -- A decision is all-or-nothing. Written with num_nonnulls so it is decidable
  -- for every combination rather than evaluating to unknown when one side is
  -- null, which is the three-valued-logic hole the repository's other CHECKs
  -- are written to avoid.
  -- Keyed on `decided_at` alone, deliberately. Requiring `decided_by` as well
  -- would make the row un-erasable: the foreign key above sets it null when the
  -- account goes, and a CHECK demanding it would refuse that deletion instead —
  -- turning an audit record into a reason an account cannot be closed, which is
  -- precisely the shape Stage C2 exists to avoid.
  constraint provider_change_proposals_decision_complete
    check (
      (state = 'pending' and decided_at is null)
      or (state <> 'pending' and decided_at is not null)),

  -- A discovered fixture has no fixture of ours; every other kind must name one.
  constraint provider_change_proposals_fixture_presence
    check (
      (proposal_kind = 'discovered' and season_fixture_id is null)
      or (proposal_kind <> 'discovered' and season_fixture_id is not null)),

  -- A discovered fixture must carry the natural key it would be created from,
  -- or approval would have nothing to build.
  constraint provider_change_proposals_discovered_shape
    check (
      proposal_kind <> 'discovered'
      or num_nonnulls(competition_round_id, home_team_id, away_team_id) = 3),

  constraint provider_change_proposals_seen_positive
    check (seen_count >= 1),

  constraint provider_change_proposals_reason_bound
    check (decision_reason is null
           or char_length(btrim(decision_reason)) between 3 and 400)
);

-- THE IDEMPOTENCY KEY, and it is deliberately not scoped to `state`.
--
-- Scoping it to pending rows would let a rejected proposal be re-staged on the
-- next poll, five minutes later, for ever. The row is unique on what the
-- proposal IS, and re-detection touches `seen_count`/`last_seen_at` only.
create unique index if not exists provider_change_proposals_identity
  on predictor_internal.provider_calendar_change_proposals (
    tournament_id, provider, proposal_kind,
    coalesce(season_fixture_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(provider_fixture_id, ''));

create index if not exists provider_change_proposals_pending
  on predictor_internal.provider_calendar_change_proposals (tournament_id, detected_at desc)
  where state = 'pending';

alter table predictor_internal.provider_calendar_change_proposals
  enable row level security;
revoke all on table predictor_internal.provider_calendar_change_proposals
  from public, anon, authenticated, service_role;

comment on table predictor_internal.provider_calendar_change_proposals is
  'Contract 174. Staged provider calendar changes awaiting an administrator: a '
  'discovered fixture, a postponement, abandonment or cancellation, or a '
  'withdrawal detected inside a caller-declared complete span. Evidence columns '
  'are append-only; nothing here changes a fixture.';

-- ---------------------------------------------------------------------------
-- Append-only over the evidence, and one-way over the decision.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.block_provider_change_proposal_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $block$
begin
  if tg_op = 'DELETE' then
    raise exception 'A staged provider change proposal may not be deleted'
      using errcode = '42501';
  end if;

  -- The evidence an administrator decided on cannot move afterwards.
  if new.tournament_id is distinct from old.tournament_id
     or new.provider is distinct from old.provider
     or new.raw_response_id is distinct from old.raw_response_id
     or new.proposal_kind is distinct from old.proposal_kind
     or new.season_fixture_id is distinct from old.season_fixture_id
     or new.competition_round_id is distinct from old.competition_round_id
     or new.home_team_id is distinct from old.home_team_id
     or new.away_team_id is distinct from old.away_team_id
     or new.provider_fixture_id is distinct from old.provider_fixture_id
     or new.proposed is distinct from old.proposed
     or new.detected_at is distinct from old.detected_at then
    raise exception 'A staged provider change proposal is append-only evidence'
      using errcode = '42501';
  end if;

  -- A decision is taken once. Re-deciding would leave the calendar mutation of
  -- the first decision in place with the second decision's reason attached.
  if old.state <> 'pending' and new.state is distinct from old.state then
    raise exception 'This proposal was already %', old.state
      using errcode = '55000';
  end if;

  return new;
end;
$block$;

revoke all on function predictor_internal.block_provider_change_proposal_rewrite()
  from public, anon, authenticated, service_role;

drop trigger if exists block_provider_change_proposal_rewrite
  on predictor_internal.provider_calendar_change_proposals;
create trigger block_provider_change_proposal_rewrite
before update or delete on predictor_internal.provider_calendar_change_proposals
for each row
execute function predictor_internal.block_provider_change_proposal_rewrite();

-- ===========================================================================
-- 2. Detection
-- ===========================================================================

create or replace function predictor_internal.detect_provider_calendar_changes(
  p_provider text,
  p_tournament_id uuid,
  p_payload jsonb,
  p_raw_response_id uuid default null,
  p_now timestamptz default now(),
  p_covers_from timestamptz default null,
  p_covers_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $detect$
declare
  v_gaps jsonb;
  v_row record;
  v_fixture record;
  v_kind text;
  v_proposal text;
  v_warnings text[];
  v_blockers text[];
  v_named uuid[] := array[]::uuid[];
  v_considered integer := 0;
  v_staged integer := 0;
  v_reseen integer := 0;
  v_withdrawn integer := 0;
  v_unknown_status integer := 0;
  v_withdrawal_checked boolean := false;
  v_inserted boolean;
begin
  if p_now is null then
    raise exception 'Detection time is required' using errcode = '22023';
  end if;

  if not exists (select 1 from public.tournaments t where t.id = p_tournament_id) then
    raise exception 'Competition season % does not exist', p_tournament_id
      using errcode = '23503';
  end if;

  -- The same fail-closed boundary contract 117 takes, and for the same reason:
  -- a half-understood payload staged as proposals is worse than none, because
  -- an administrator would approve a fixture built from an identifier nothing
  -- could resolve.
  v_gaps := predictor_internal.provider_mapping_gaps(p_provider, p_tournament_id, p_payload);
  if coalesce((v_gaps->>'ready')::boolean, false) is not true then
    return pg_catalog.jsonb_build_object(
      'detected', false,
      'reason', 'unmapped_identifiers',
      'gaps', v_gaps);
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
      entry->>'providerFixtureId' as provider_fixture_id,
      entry->>'status' as provider_status,
      entry->>'homeTeamName' as home_name,
      entry->>'awayTeamName' as away_name
    from pg_catalog.jsonb_array_elements(p_payload) as entry
  loop
    v_considered := v_considered + 1;
    v_warnings := array[]::text[];
    v_blockers := array[]::text[];
    v_proposal := null;

    select fixture.id, fixture.kickoff_at, fixture.status,
           fixture.home_score, fixture.away_score
      into v_fixture
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.competition_round_id = v_row.round_id
       and fixture.home_team_id = v_row.home_id
       and fixture.away_team_id = v_row.away_id;

    if found then
      v_named := v_named || v_fixture.id;
    end if;

    -- The provider's own word for what is happening, through contract 135's
    -- vocabulary. A token absent from that table is UNKNOWN and stages nothing:
    -- fail closed, exactly as contract 135 decided for results.
    select kinds.kind into v_kind
      from predictor_internal.provider_status_kinds kinds
     where kinds.provider = p_provider
       and kinds.provider_status = v_row.provider_status;

    if not found then
      v_unknown_status := v_unknown_status + 1;
      v_kind := null;
    end if;

    if v_fixture.id is null then
      -- INGEST-002. Not created; staged.
      v_proposal := 'discovered';

      -- See the header: a changed team or round is indistinguishable from a new
      -- fixture with what this repository stores. Say so, with the one piece of
      -- evidence that exists — a prior kickoff revision carrying this provider
      -- fixture id against one of our fixtures.
      if exists (
        select 1 from predictor_internal.season_fixture_revisions revision
         where revision.tournament_id = p_tournament_id
           and revision.provider = p_provider
           and revision.provider_fixture_id = v_row.provider_fixture_id)
      then
        v_warnings := v_warnings
          || 'possible_change_of_an_existing_fixture: this provider fixture id '
             'has previously been recorded against a fixture of ours';
      end if;

      if v_row.kickoff <= p_now then
        v_warnings := v_warnings || 'kickoff_is_in_the_past';
      end if;

      if v_kind is not null and v_kind <> 'scheduled' then
        v_warnings := v_warnings
          || ('provider_reports_it_as_' || v_kind);
      end if;

    elsif v_kind in ('postponed', 'abandoned', 'cancelled') then
      -- INGEST-003.
      v_proposal := v_kind;

      if v_fixture.status = 'played'
         or v_fixture.home_score is not null
         or v_fixture.away_score is not null then
        v_blockers := v_blockers
          || 'fixture_already_has_a_result: approving would rescore a settled '
             'matchweek, so this proposal cannot be approved';
      end if;

      if v_fixture.status <> 'scheduled' then
        v_warnings := v_warnings || ('we_already_hold_it_as_' || v_fixture.status);
      end if;
    end if;

    if v_proposal is null then
      continue;
    end if;

    insert into predictor_internal.provider_calendar_change_proposals as proposal (
      tournament_id, provider, raw_response_id, proposal_kind,
      season_fixture_id, competition_round_id, home_team_id, away_team_id,
      provider_fixture_id, proposed, observed, warnings, blockers,
      detected_at, last_seen_at)
    values (
      p_tournament_id, p_provider, p_raw_response_id, v_proposal,
      v_fixture.id, v_row.round_id, v_row.home_id, v_row.away_id,
      v_row.provider_fixture_id,
      pg_catalog.jsonb_build_object(
        'kickoffAt', v_row.kickoff,
        'providerStatus', v_row.provider_status,
        'statusKind', v_kind,
        'homeTeamName', v_row.home_name,
        'awayTeamName', v_row.away_name),
      case when v_fixture.id is null then '{}'::jsonb
        else pg_catalog.jsonb_build_object(
          'kickoffAt', v_fixture.kickoff_at,
          'status', v_fixture.status,
          'hasResult', v_fixture.home_score is not null) end,
      v_warnings, v_blockers, p_now, p_now)
    -- Inferred from the unique INDEX rather than named as a constraint, because
    -- that is what it is: a partial-expression index cannot be an `on conflict
    -- on constraint` target, and the inference has to repeat the expressions
    -- exactly for PostgreSQL to match it.
    on conflict (tournament_id, provider, proposal_kind,
                 coalesce(season_fixture_id, '00000000-0000-0000-0000-000000000000'::uuid),
                 coalesce(provider_fixture_id, ''))
    do update
      -- Re-detection is not new evidence. It updates only what is honestly a
      -- fact about repetition, and leaves the decision and the evidence alone.
      set seen_count = proposal.seen_count + 1,
          last_seen_at = p_now
    -- `xmax = 0` is true only on a genuine insert, so the two counters separate
    -- "this is new" from "the provider has said it again" without a second
    -- query that could disagree with the write it is describing.
    returning (xmax = 0) into v_inserted;

    if v_inserted then
      v_staged := v_staged + 1;
    else
      v_reseen := v_reseen + 1;
    end if;
  end loop;

  -- ---- WITHDRAWAL, only against a declared complete span -------------------
  if p_covers_from is not null and p_covers_to is not null then
    v_withdrawal_checked := true;

    insert into predictor_internal.provider_calendar_change_proposals as proposal (
      tournament_id, provider, raw_response_id, proposal_kind,
      season_fixture_id, competition_round_id, home_team_id, away_team_id,
      provider_fixture_id, proposed, observed, warnings, blockers,
      detected_at, last_seen_at)
    select
      p_tournament_id, p_provider, p_raw_response_id, 'withdrawn',
      fixture.id, fixture.competition_round_id, fixture.home_team_id,
      fixture.away_team_id, null,
      pg_catalog.jsonb_build_object(
        'coversFrom', p_covers_from, 'coversTo', p_covers_to,
        'absentFromPayload', true),
      pg_catalog.jsonb_build_object(
        'kickoffAt', fixture.kickoff_at,
        'status', fixture.status,
        'hasResult', fixture.home_score is not null),
      array[]::text[], array[]::text[],
      p_now, p_now
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.status = 'scheduled'
       and fixture.home_score is null
       and fixture.kickoff_at is not null
       and fixture.kickoff_at >= p_covers_from
       and fixture.kickoff_at <= p_covers_to
       and not (fixture.id = any (v_named))
    on conflict (tournament_id, provider, proposal_kind,
                 coalesce(season_fixture_id, '00000000-0000-0000-0000-000000000000'::uuid),
                 coalesce(provider_fixture_id, ''))
    do update
      set seen_count = proposal.seen_count + 1,
          last_seen_at = p_now;

    -- Rows TOUCHED, not rows newly staged: a set-returning insert reports both
    -- together, and claiming otherwise would overstate what changed.
    get diagnostics v_withdrawn = row_count;
  end if;

  return pg_catalog.jsonb_build_object(
    'detected', true,
    'considered', v_considered,
    'staged', v_staged,
    'reseen', v_reseen,
    'withdrawalChecked', v_withdrawal_checked,
    'withdrawalRowsTouched', v_withdrawn,
    'unknownStatusTokens', v_unknown_status);
end;
$detect$;

revoke all on function predictor_internal.detect_provider_calendar_changes(
  text, uuid, jsonb, uuid, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated, service_role;

comment on function predictor_internal.detect_provider_calendar_changes(
  text, uuid, jsonb, uuid, timestamptz, timestamptz, timestamptz) is
  'Contract 174. Stages a discovered fixture, a postponement, abandonment or '
  'cancellation, and — only against a caller-declared complete span — a '
  'withdrawal. Writes no fixture. Fails closed on unmapped identifiers and on '
  'an unknown provider status token.';

-- ===========================================================================
-- 3. The administrator's read
-- ===========================================================================

create or replace function public.admin_provider_change_proposals(
  p_tournament_id uuid,
  p_state text default 'pending',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $read$
declare
  v_limit integer;
  v_offset integer;
  v_total integer;
  v_rows jsonb;
begin
  perform predictor_internal.require_competition_admin();

  if p_state is not null and p_state not in ('pending', 'approved', 'rejected') then
    raise exception 'Unknown proposal state %', p_state using errcode = '22023';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*)::integer into v_total
    from predictor_internal.provider_calendar_change_proposals proposal
   where proposal.tournament_id = p_tournament_id
     and (p_state is null or proposal.state = p_state);

  select coalesce(pg_catalog.jsonb_agg(entry order by entry.detected_at desc, entry.id), '[]'::jsonb)
    into v_rows
    from (
      select
        proposal.id,
        proposal.detected_at,
        pg_catalog.jsonb_build_object(
          'id', proposal.id,
          'kind', proposal.proposal_kind,
          'state', proposal.state,
          'provider', proposal.provider,
          'providerFixtureId', proposal.provider_fixture_id,
          'detectedAt', proposal.detected_at,
          'seenCount', proposal.seen_count,
          'lastSeenAt', proposal.last_seen_at,
          'round', round.label,
          'roundOrdinal', round.ordinal,
          'homeTeam', home.name,
          'awayTeam', away.name,
          -- The decoded proposal and what we hold, field by field. NOT the raw
          -- provider response, which contract 168 keeps on the server.
          'proposed', proposal.proposed,
          'observed', proposal.observed,
          -- Named, not counted.
          'warnings', pg_catalog.to_jsonb(proposal.warnings),
          'blockers', pg_catalog.to_jsonb(proposal.blockers),
          'decidable', proposal.state = 'pending'
                       and pg_catalog.cardinality(proposal.blockers) = 0,
          'decidedAt', proposal.decided_at,
          'decisionReason', proposal.decision_reason,
          'resultingAction', proposal.resulting_action) as entry
        from predictor_internal.provider_calendar_change_proposals proposal
        left join public.competition_rounds round on round.id = proposal.competition_round_id
        left join public.teams home on home.id = proposal.home_team_id
        left join public.teams away on away.id = proposal.away_team_id
       where proposal.tournament_id = p_tournament_id
         and (p_state is null or proposal.state = p_state)
       order by proposal.detected_at desc, proposal.id
       limit v_limit offset v_offset
    ) entry;

  return pg_catalog.jsonb_build_object(
    'tournament_id', p_tournament_id,
    'state', p_state,
    'total', v_total,
    -- Contract 171's rule: a capped list beside a real total is
    -- indistinguishable from a short one, so say which this is.
    'returned', pg_catalog.jsonb_array_length(v_rows),
    'truncated', v_offset + pg_catalog.jsonb_array_length(v_rows) < v_total,
    'proposals', v_rows);
end;
$read$;

revoke all on function public.admin_provider_change_proposals(uuid, text, integer, integer)
  from public, anon;
grant execute on function public.admin_provider_change_proposals(uuid, text, integer, integer)
  to authenticated;

comment on function public.admin_provider_change_proposals(uuid, text, integer, integer) is
  'Contract 174. Competition-administrator read of staged provider calendar '
  'changes, bounded and self-declaring about truncation. Returns the decoded '
  'proposal and what we hold, never the raw provider response.';

-- ===========================================================================
-- 4. The decision
-- ===========================================================================

create or replace function public.admin_decide_provider_change_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $decide$
declare
  v_admin uuid := (select auth.uid());
  v_proposal record;
  v_now timestamptz := now();
  v_action jsonb := '{}'::jsonb;
  v_new_fixture uuid;
  v_status text;
begin
  perform predictor_internal.require_competition_admin();

  if v_admin is null then
    raise exception 'Not authenticated' using errcode = 'insufficient_privilege';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;

  -- A rejection needs a reason and an approval does not, which is the asymmetry
  -- contract 125 established for results: by the time you are refusing
  -- something a provider measured, why is the only useful record.
  if p_decision = 'reject'
     and coalesce(char_length(btrim(p_reason)), 0) < 3 then
    raise exception 'A rejection requires a reason' using errcode = '22023';
  end if;

  select * into v_proposal
    from predictor_internal.provider_calendar_change_proposals
   where id = p_proposal_id
   for update;

  if not found then
    raise exception 'Proposal not found' using errcode = 'no_data_found';
  end if;

  -- IDEMPOTENT ON THE DECISION ALREADY TAKEN. Repeating the same decision is
  -- answered rather than refused, so a retried request cannot look like a
  -- failure; a DIFFERENT decision is refused by the trigger, because the first
  -- one's calendar mutation has already happened.
  if v_proposal.state <> 'pending' then
    if (p_decision = 'approve' and v_proposal.state = 'approved')
       or (p_decision = 'reject' and v_proposal.state = 'rejected') then
      return pg_catalog.jsonb_build_object(
        'proposal_id', p_proposal_id,
        'state', v_proposal.state,
        'repeated', true,
        'resulting_action', v_proposal.resulting_action);
    end if;

    raise exception 'This proposal was already %', v_proposal.state
      using errcode = '55000';
  end if;

  if p_decision = 'approve' and pg_catalog.cardinality(v_proposal.blockers) > 0 then
    raise exception 'This proposal cannot be approved: %',
      pg_catalog.array_to_string(v_proposal.blockers, '; ')
      using errcode = '55000';
  end if;

  if p_decision = 'approve' then
    if v_proposal.proposal_kind = 'discovered' then
      -- The one creation this contract permits, and only by hand. The fixture's
      -- shape is left to `assert_season_fixture_shape`, which already refuses a
      -- club playing twice in one matchweek — the trigger that owns the rule
      -- keeps owning it.
      insert into public.season_fixtures (
        tournament_id, competition_round_id, home_team_id, away_team_id,
        kickoff_at, status)
      values (
        v_proposal.tournament_id, v_proposal.competition_round_id,
        v_proposal.home_team_id, v_proposal.away_team_id,
        (v_proposal.proposed->>'kickoffAt')::timestamptz, 'scheduled')
      returning id into v_new_fixture;

      v_action := pg_catalog.jsonb_build_object(
        'created_season_fixture_id', v_new_fixture);
    else
      v_status := case v_proposal.proposal_kind
        when 'postponed' then 'postponed'
        when 'abandoned' then 'abandoned'
        -- A cancelled or withdrawn fixture is one that will not be played at
        -- all. `void` is the vocabulary `season_fixtures_status_allowed`
        -- already holds for that; no new status is invented here.
        when 'cancelled' then 'void'
        when 'withdrawn' then 'void'
      end;

      -- Re-read under the row lock rather than trusting the snapshot taken at
      -- detection: a result may have been confirmed in between, and that is
      -- exactly the case that must not be approved.
      if exists (
        select 1 from public.season_fixtures fixture
         where fixture.id = v_proposal.season_fixture_id
           and (fixture.status = 'played'
                or fixture.home_score is not null
                or fixture.away_score is not null))
      then
        raise exception
          'That fixture now has a result; approving would rescore a settled matchweek'
          using errcode = '55000';
      end if;

      update public.season_fixtures
         set status = v_status,
             updated_at = v_now
       where id = v_proposal.season_fixture_id;

      v_action := pg_catalog.jsonb_build_object(
        'season_fixture_id', v_proposal.season_fixture_id,
        'status', v_status);
    end if;
  else
    -- A rejection mutates no calendar. Saying so in the record matters: an
    -- empty `resulting_action` and an absent one read the same otherwise.
    v_action := pg_catalog.jsonb_build_object('calendar_unchanged', true);
  end if;

  update predictor_internal.provider_calendar_change_proposals
     set state = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         decided_at = v_now,
         decided_by = v_admin,
         decision_reason = nullif(btrim(p_reason), ''),
         resulting_action = v_action
   where id = p_proposal_id;

  return pg_catalog.jsonb_build_object(
    'proposal_id', p_proposal_id,
    'state', case when p_decision = 'approve' then 'approved' else 'rejected' end,
    'repeated', false,
    'resulting_action', v_action);
end;
$decide$;

revoke all on function public.admin_decide_provider_change_proposal(uuid, text, text)
  from public, anon;
grant execute on function public.admin_decide_provider_change_proposal(uuid, text, text)
  to authenticated;

comment on function public.admin_decide_provider_change_proposal(uuid, text, text) is
  'Contract 174. The only function here that may change a fixture. Approving a '
  'discovered proposal creates it; approving a postponement, abandonment, '
  'cancellation or withdrawal sets the fixture status. It refuses any fixture '
  'that already carries a result, re-checked under the row lock.';

-- ===========================================================================
-- 5. The caller
--
-- Redefined from the committed text of
-- `20260809050000_provider_result_authority.sql` with ONE added key in the
-- report. Verified by diff below rather than by reading.
-- ===========================================================================

create or replace function predictor_internal.consume_provider_responses(
  p_limit integer default 20,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $consume$
declare
  v_row record;
  v_tournament_id uuid;
  v_report jsonb;
  v_outcome text;
  v_holds_fixtures boolean;
  v_considered integer := 0;
  v_applied integer := 0;
  v_staged integer := 0;
  v_unresolved integer := 0;
  v_unmapped integer := 0;
  v_failed integer := 0;
begin
  for v_row in
    select processing.id as processing_id,
           processing.normalized_payload,
           raw.id as raw_response_id,
           raw.provider,
           raw.request_url
      from predictor_internal.provider_response_processing processing
      join predictor_internal.provider_raw_responses raw
        on raw.id = processing.raw_response_id
     where processing.succeeded
       and processing.normalized_payload is not null
       and not exists (
         select 1
           from predictor_internal.provider_response_consumption consumed
          where consumed.processing_id = processing.id)
     order by processing.processed_at, processing.id
     limit greatest(coalesce(p_limit, 20), 1)
  loop
    v_considered := v_considered + 1;
    v_report := '{}'::jsonb;

    v_tournament_id := predictor_internal.resolve_provider_response_season(
      v_row.provider, v_row.request_url, v_row.normalized_payload);

    if v_tournament_id is null then
      v_outcome := 'unresolved_season';
      v_unresolved := v_unresolved + 1;
    elsif not exists (
      select 1 from public.tournaments season
       where season.id = v_tournament_id
         and season.kind = 'league_season'
    ) then
      -- Both callees refuse a tournament, and correctly. Recording the refusal
      -- here means the response is consumed once rather than retried for ever.
      v_outcome := 'not_a_league_season';
      v_unresolved := v_unresolved + 1;
    elsif jsonb_array_length(v_row.normalized_payload) = 0 then
      v_outcome := 'nothing_to_do';
    else
      select exists (
        select 1 from public.season_fixtures fixture
         where fixture.tournament_id = v_tournament_id)
        into v_holds_fixtures;

      -- One awkward response must not stop the batch. A raise inside a callee
      -- rolls back that response's work only — the block is a subtransaction —
      -- and the failure is recorded where an operator will find it.
      begin
        if not v_holds_fixtures then
          -- Contract 132. An empty season's first calendar stays an explicit
          -- administrator decision; this only stages the proposal.
          v_report := predictor_internal.stage_provider_fixture_proposals(
            v_row.raw_response_id, v_tournament_id);
          v_outcome := 'staged_proposals';
          v_staged := v_staged + 1;
        else
          v_report := pg_catalog.jsonb_build_object(
            'kickoffs', predictor_internal.import_provider_fixture_revisions(
              v_row.provider, v_tournament_id, v_row.normalized_payload,
              v_row.raw_response_id, p_now),
            'results', predictor_internal.apply_provider_fixture_facts(
              v_row.provider, v_tournament_id, v_row.normalized_payload,
              v_row.raw_response_id, p_now),
            -- CONTRACT 174. The changes contract 117 counted and discarded.
            -- No coverage window is passed, deliberately: a response's own
            -- completeness is not something this function can know, so
            -- withdrawal detection does not run here. See that migration's
            -- header.
            'changes', predictor_internal.detect_provider_calendar_changes(
              v_row.provider, v_tournament_id, v_row.normalized_payload,
              v_row.raw_response_id, p_now, null, null));

          if coalesce((v_report->'results'->>'applied')::boolean, false) then
            v_outcome := 'applied';
            v_applied := v_applied + 1;
          else
            v_outcome := 'unmapped_identifiers';
            v_unmapped := v_unmapped + 1;
          end if;
        end if;
      exception
        when others then
          v_outcome := 'failed';
          v_failed := v_failed + 1;
          v_report := pg_catalog.jsonb_build_object(
            'sqlstate', pg_catalog.left(sqlstate, 40),
            'message', pg_catalog.left(sqlerrm, 400));
      end;
    end if;

    insert into predictor_internal.provider_response_consumption (
      processing_id, tournament_id, outcome, report)
    values (
      v_row.processing_id, v_tournament_id, v_outcome, v_report);
  end loop;

  return pg_catalog.jsonb_build_object(
    'considered', v_considered,
    'applied', v_applied,
    'stagedProposals', v_staged,
    'unresolvedSeason', v_unresolved,
    'unmappedIdentifiers', v_unmapped,
    'failed', v_failed);
end;
$consume$;

revoke all on function predictor_internal.consume_provider_responses(integer, timestamptz)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 6. Prove the shape, in the same transaction.
-- ===========================================================================

do $assertions$
declare
  v_detect text := pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(
    to_regprocedure('predictor_internal.detect_provider_calendar_changes(text, uuid, jsonb, uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone)')),
    '--[^\n]*', '', 'g');
  v_consume text := pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(
    to_regprocedure('predictor_internal.consume_provider_responses(integer, timestamp with time zone)')),
    '--[^\n]*', '', 'g');
  v_decide text := pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(
    to_regprocedure('public.admin_decide_provider_change_proposal(uuid, text, text)')),
    '--[^\n]*', '', 'g');
  v_read text := pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(
    to_regprocedure('public.admin_provider_change_proposals(uuid, text, integer, integer)')),
    '--[^\n]*', '', 'g');
begin
  -- ---- DETECTION WRITES NO FIXTURE ------------------------------------
  --
  -- The whole boundary of this contract in one assertion. Detection runs
  -- automatically, every five minutes, with nobody watching.
  if v_detect ~* 'insert\s+into\s+public\.season_fixtures'
     or v_detect ~* 'update\s+public\.season_fixtures'
     or v_detect ~* 'delete\s+from\s+public\.season_fixtures' then
    raise exception 'Detection writes to season_fixtures; it may only stage';
  end if;

  -- Nor anything else a provider must never reach automatically.
  if v_detect ~* '(insert|update|delete)[^;]*\m(match_predictions|season_predictions|score_events|season_matchweek_scores|entries)\M' then
    raise exception 'Detection writes to a prediction or scoring relation';
  end if;

  -- ---- THE CONSUMER CALLS IT, AND STILL DOES EVERYTHING IT DID --------
  if v_consume !~ 'detect_provider_calendar_changes' then
    raise exception 'The consumer does not call the change detector';
  end if;

  if v_consume !~ 'stage_provider_fixture_proposals'
     or v_consume !~ 'import_provider_fixture_revisions'
     or v_consume !~ 'apply_provider_fixture_facts'
     or v_consume !~ 'resolve_provider_response_season'
     or v_consume !~ 'provider_response_consumption' then
    raise exception 'The redefined consumer dropped one of its existing calls';
  end if;

  -- The automatic path passes NO coverage window. If it ever does, withdrawal
  -- detection starts running against a payload nobody promised was complete.
  if v_consume ~ 'detect_provider_calendar_changes\s*\([^;]*p_covers' then
    raise exception 'The consumer names a coverage window; withdrawal must stay an operator claim';
  end if;

  -- ---- ONLY THE DECISION MAY TOUCH A FIXTURE --------------------------
  if v_decide !~ 'require_competition_admin' then
    raise exception 'The decision writer is not gated on competition administration';
  end if;

  if v_read !~ 'require_competition_admin' then
    raise exception 'The proposal read is not gated on competition administration';
  end if;

  -- A result is the thing approval may never overwrite, re-checked under lock.
  if v_decide !~ 'home_score is not null' then
    raise exception 'The decision writer does not re-check for a result before mutating';
  end if;

  -- ---- NO BROWSER MAY DETECT, AND NO ANONYMOUS ROLE MAY DECIDE --------
  if exists (
    select 1
      from pg_catalog.pg_proc proc
      cross join pg_catalog.aclexplode(proc.proacl) entry
      left join pg_catalog.pg_roles grantee on grantee.oid = entry.grantee
     where proc.oid in (
             to_regprocedure('predictor_internal.detect_provider_calendar_changes(text, uuid, jsonb, uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone)'),
             to_regprocedure('predictor_internal.consume_provider_responses(integer, timestamp with time zone)'))
       and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC', 'service_role')
  ) then
    raise exception 'A provider ingestion function became reachable outside the server';
  end if;

  if exists (
    select 1
      from pg_catalog.pg_proc proc
      cross join pg_catalog.aclexplode(proc.proacl) entry
      left join pg_catalog.pg_roles grantee on grantee.oid = entry.grantee
     where proc.oid in (
             to_regprocedure('public.admin_provider_change_proposals(uuid, text, integer, integer)'),
             to_regprocedure('public.admin_decide_provider_change_proposal(uuid, text, text)'))
       and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'PUBLIC')
  ) then
    raise exception 'An administrator entry point is reachable anonymously';
  end if;

  -- ---- THE QUEUE IS NOT A BROWSER RELATION ----------------------------
  if exists (
    select 1
      from pg_catalog.pg_class relation
      cross join pg_catalog.aclexplode(relation.relacl) entry
      left join pg_catalog.pg_roles grantee on grantee.oid = entry.grantee
     where relation.oid = 'predictor_internal.provider_calendar_change_proposals'::regclass
       and coalesce(grantee.rolname, 'PUBLIC') in ('anon', 'authenticated', 'PUBLIC')
  ) then
    raise exception 'The proposal queue carries a browser grant';
  end if;

  if not (select relrowsecurity from pg_catalog.pg_class
           where oid = 'predictor_internal.provider_calendar_change_proposals'::regclass) then
    raise exception 'The proposal queue does not have row-level security enabled';
  end if;

  -- ---- CONTRACT 117 IS UNTOUCHED --------------------------------------
  --
  -- This contract adds a second reader of the same payload; it must not have
  -- quietly become a fixture creator on the way.
  if pg_catalog.regexp_replace(pg_catalog.pg_get_functiondef(
       to_regprocedure('predictor_internal.import_provider_fixture_revisions(text, uuid, jsonb, uuid, timestamp with time zone)')),
       '--[^\n]*', '', 'g') ~* 'insert\s+into\s+public\.season_fixtures' then
    raise exception 'The kickoff importer now creates fixtures';
  end if;
end;
$assertions$;

commit;
