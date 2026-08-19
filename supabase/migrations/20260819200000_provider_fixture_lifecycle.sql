-- Contract 206 — a postponement reaches the fixture, and a reschedule reaches
-- it back.
--
-- ===========================================================================
-- WHAT WAS MEASURED, ON HOSTED DEVELOPMENT, ON 19 AUGUST 2026
-- ===========================================================================
--
-- Two Scottish Premiership fixtures were known to have been postponed. The
-- application showed both as ordinary scheduled matches at their original
-- kickoff. The archived provider responses say why, and the answer is four
-- independent faults stacked on top of each other. Each one alone is enough to
-- lose the status; all four are present.
--
--   1. NOTHING HAS BEEN INGESTED SINCE 10 AUGUST. Every decoded response since
--      `2026-08-10T15:27Z` was consumed with outcome `unresolved_season` — 13
--      of them, one per daily poll.
--      `predictor_internal.resolve_provider_response_season` has two ways to
--      name a season and both had stopped working:
--
--        * the payload's own season identifier. The SportMonks decoder sends
--          `seasonProviderId = "28275"`; the season is mapped in
--          `provider_entity_map` under the composite key `"501/28275"`
--          (league/season, which is how the operator recorded it and how the
--          provider addresses a season). An exact-equality lookup can never
--          match those, so this arm has ALWAYS returned null and nothing
--          noticed, because the second arm was carrying it;
--
--        * the poll target's stored path. Contract 146 (10 August) made a
--          stored path carry `{{date:+N}}` placeholders so the fixture window
--          rolls forward on its own. The resolver still compares the request
--          URL against the RAW stored path, so from the moment that contract
--          landed the comparison was
--          `'.../fixtures/between/2026-08-19/2026-08-27?...' like
--           '%/fixtures/between/{{date:+0}}/{{date:+8}}?...'`
--          which is false for every URL the dispatcher will ever build.
--
--      The two failures are unrelated and landed years apart in contract terms.
--      Together they are the whole outage: no kickoff revision, no result, no
--      live projection, no calendar proposal and no status observation has been
--      recorded for nine days.
--
--   2. THE PROVIDER'S WORD FOR IT IS NOT IN THE VOCABULARY. SportMonks state
--      `10` is absent from `provider_status_kinds`, so contract 135 resolves it
--      `unknown` and contract 174 stages nothing. Measured from the retained
--      payloads rather than looked up: four 22 August fixtures carried state
--      `1` on 14 August and state `10` from 15 August onward, unchanged for
--      five consecutive daily polls, with no score and with the kickoff
--      instant untouched. A fixture that stops being "not started" a week out,
--      stays that way, and never acquires a score has been taken out of its
--      slot. That is `postponed`, and it is seeded below with that evidence.
--
--      The tokens contract 135 seeded for SportMonks `14`–`21` are NOT touched
--      here. They were seeded from the provider's published vocabulary rather
--      than from a payload, this contract has measured none of them, and
--      replacing one guess with another is not an improvement. They are named
--      in `docs/quality/risk-register.md` instead.
--
--   3. NOTHING AUTOMATIC MAY WRITE THE STATUS. `apply_provider_fixture_facts`
--      writes every kind into `season_fixture_live_state`, a projection whose
--      own comment says it is "never an input to a lock, score, standing or
--      settlement", and writes `season_fixtures.status` only for a `final`. The
--      only path from a provider postponement to the fixture's own status is
--      contract 174's proposal queue, which requires an administrator to press
--      approve. So the honest description of the delivered platform is: a
--      postponement is never shown until a human notices it, and the vNext
--      mapper is right to refuse a provider's `postponed` because nothing
--      upstream had earned the right to hand it one.
--
--   4. AND IF IT HAD BEEN APPROVED, IT COULD NEVER COME BACK.
--      `import_provider_fixture_revisions` refuses a kickoff move on any
--      fixture whose status is not `scheduled`. A fixture marked `postponed`
--      therefore keeps its stale kickoff for ever: the new date can never
--      import, contract 119's per-fixture lock reads the old instant, and the
--      prediction is permanently locked by a kickoff that will not happen.
--      This is exactly the failure `FINDING G §D` says must be impossible, and
--      it was reachable through the only path that could set the status at all.
--
-- ===========================================================================
-- THE RULE THIS CONTRACT ADDS, AND THE ONE IT REFUSES TO ADD
-- ===========================================================================
--
-- A PROVIDER MAY POSTPONE AND UN-POSTPONE. It may not cancel, abandon or void.
--
-- The asymmetry is the whole decision, and it is not a compromise between the
-- two — it is what the two states actually do:
--
--   * `postponed` REMOVES NOTHING. Contract 87 maps it to `scheduled` in the
--     settlement card, so the matchweek simply does not settle; contract 85
--     treats it as a non-result, so Last Man Standing survives and consumes
--     nothing; `season_fixtures_scores_match_status` guarantees it carries no
--     score. Applying it wrongly delays a settlement and is undone by the next
--     poll. It cannot award a point, eliminate an entrant, settle a tie or
--     consume a Joker;
--
--   * `void` and `abandoned` are TERMINAL. They say a fixture will not be
--     played at all, they change what the competition consists of, and contract
--     174's header is right that this is an administrator's decision. Nothing
--     here weakens that: a `cancelled` or `abandoned` provider kind still
--     stages a proposal and still waits for a human.
--
-- The reversal is what makes the postponement safe rather than merely cheap. A
-- feed that reports a postponement for a delayed kickoff — the failure
-- `buildMatchesModel.ts` names by hand as its reason for refusing a provider's
-- word — is corrected by the next poll that says otherwise, automatically, in
-- the same function, and the correction is recorded beside the original. That
-- is a strictly better answer than never showing the state at all, which is
-- what the platform does today.
--
-- ===========================================================================
-- WHAT A POSTPONED FIXTURE DOES TO A DEADLINE
-- ===========================================================================
--
-- `FINDING G §D` requires both directions to be tested, so both are decided
-- here rather than left to arithmetic:
--
--   * A FIXTURE HELD `postponed` WHOSE KICKOFF HAS PASSED IS OPEN. The instant
--     on the row is where it WAS due, not a plan, and a lock derived from it is
--     the permanent lock described above. The authority returns `infinity`.
--
--   * A FIXTURE HELD `postponed` WHOSE KICKOFF IS STILL AHEAD LOCKS AT IT,
--     normally, `kickoff - buffer`. This is the half that stops the first rule
--     becoming a hole. A provider that assigns a new date while still reporting
--     the fixture postponed — SportMonks does — would otherwise leave a
--     prediction open into a match that is actually being played. The rule
--     needs no reinstatement to be safe: the moment a real kickoff is in the
--     future, it is the deadline.
--
--   * A FIXTURE THAT WILL NOT BE PLAYED IS ALWAYS LOCKED. `void` and
--     `abandoned` return `-infinity`. There is nothing to predict, and a
--     fixture voided before its kickoff would otherwise stay editable.
--
--   * A RESCHEDULED FIXTURE LOCKS AT ITS NEW KICKOFF, which is contract 119
--     unchanged: the reschedule writes a `season_fixture_revisions` row, and
--     that row is what contract 119 already reads to give a moved fixture its
--     own lock instead of its matchweek's.
--
-- The middle rule is the one that could take a window away, so it is stated as
-- what it is rather than buried: `void` and `abandoned` are set only by an
-- administrator approving a proposal, which is a human deciding that the match
-- is gone. It is not reachable from a provider payload.
--
-- KNOWN AND NOT CLOSED HERE. `get_season_matchweek_card` publishes the
-- MATCHWEEK lock instant, which is what contract 119 left in place when it made
-- ENFORCEMENT per-fixture. A postponed or rescheduled fixture therefore still
-- reads as locked on the Match Predictor while the trigger would accept the
-- write. That divergence predates this contract, is not made worse by it, and
-- is recorded in `docs/quality/risk-register.md` rather than fixed by a
-- surface-by-surface patch.
--
-- ===========================================================================
-- WHAT THIS CONTRACT DOES NOT DO
-- ===========================================================================
--
-- It moves no scoring, settlement, progression, membership or reveal rule. It
-- creates no fixture and deletes none. It grants nothing new to any browser
-- role beyond two additional read-only fields on two existing fixture reads. It
-- writes no result: `final` still goes through contract 125's writer and
-- contract 135's authorship rule, both untouched.
-- ===========================================================================

begin;

-- ===========================================================================
-- 1. Season resolution, fixed in both arms
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A season identifier, matched the way operators actually record one.
--
-- Exact first, always. A composite `league/season` key is accepted only as a
-- fallback and only when exactly ONE mapped season ends in `/<id>`: two
-- competitions sharing a season number is precisely the case where guessing
-- would apply one league's results to another, and the count is what refuses
-- it. Strictly widening — every identifier that resolved before resolves to the
-- same season now.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.resolve_provider_season(
  p_provider text,
  p_provider_id text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $resolve$
declare
  v_tournament_id uuid;
  v_matches integer;
begin
  if p_provider is null or p_provider_id is null or btrim(p_provider_id) = '' then
    return null;
  end if;

  select entry.tournament_id
    into v_tournament_id
    from public.provider_entity_map entry
   where entry.provider = p_provider
     and entry.entity_kind = 'season'
     and entry.provider_id = p_provider_id;

  if v_tournament_id is not null then
    return v_tournament_id;
  end if;

  select count(*), (pg_catalog.array_agg(entry.tournament_id))[1]
    into v_matches, v_tournament_id
    from public.provider_entity_map entry
   where entry.provider = p_provider
     and entry.entity_kind = 'season'
     and entry.provider_id like '%/' || p_provider_id;

  if v_matches = 1 then
    return v_tournament_id;
  end if;

  return null;
end;
$resolve$;

revoke all on function predictor_internal.resolve_provider_season(text, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- A stored poll path, as a pattern the URL it produced can match.
--
-- Contract 146's placeholders become `%`; everything else is escaped, so a
-- literal `_` in a provider path stays a literal `_` rather than becoming a
-- single-character wildcard. Escaping runs FIRST and backslash first within it,
-- or the escape character introduced by one step would be re-escaped by the
-- next.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.provider_poll_path_pattern(
  p_path text
)
returns text
language sql
immutable
security definer
set search_path = ''
as $pattern$
  select pg_catalog.regexp_replace(
           pg_catalog.replace(
             pg_catalog.replace(
               pg_catalog.replace(
                 pg_catalog.replace(p_path, '\', '\\'),
                 '%', '\%'),
               '_', '\_'),
             '{{date}}', '%'),
           '\{\{date:[+-][0-9]{1,3}\}\}', '%', 'g');
$pattern$;

revoke all on function predictor_internal.provider_poll_path_pattern(text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Which season a decoded response is about.
--
-- Redefined from the committed text of contract 135 with two changes and no
-- others: the season arm now goes through the resolver above, and the poll
-- target arm compares against the RESOLVED shape of the stored path rather than
-- against a path still carrying `{{date:+N}}`.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.resolve_provider_response_season(
  p_provider text,
  p_request_url text,
  p_payload jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $season$
declare
  v_tournament_id uuid;
  v_season_ids text[];
  v_matches integer;
begin
  select pg_catalog.array_agg(distinct entry->>'seasonProviderId')
    into v_season_ids
    from pg_catalog.jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) as entry
   where entry->>'seasonProviderId' is not null;

  -- One payload naming two seasons is not something to resolve by picking one.
  if v_season_ids is not null and pg_catalog.array_length(v_season_ids, 1) = 1 then
    v_tournament_id := predictor_internal.resolve_provider_season(
      p_provider, v_season_ids[1]);
    if v_tournament_id is not null then
      return v_tournament_id;
    end if;
  end if;

  -- `array_agg(...)[1]` rather than `min(...)`: there is no `min(uuid)` in
  -- PostgreSQL, and the count beside it is what decides anyway — a single match
  -- is the only one this accepts.
  select count(*), (pg_catalog.array_agg(target.tournament_id))[1]
    into v_matches, v_tournament_id
    from public.provider_poll_targets target
   where target.provider = p_provider
     and target.enabled
     and p_request_url like
         '%' || predictor_internal.provider_poll_path_pattern(target.path) escape '\';

  if v_matches = 1 then
    return v_tournament_id;
  end if;

  return null;
end;
$season$;

revoke all on function predictor_internal.resolve_provider_response_season(
  text, text, jsonb)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. The token, measured
-- ===========================================================================

insert into predictor_internal.provider_status_kinds
  (provider, provider_status, kind, note)
values
  ('sportmonks', '10', 'postponed',
   'measured from retained payloads: four 22 August 2026 fixtures moved from '
   'token 1 to token 10 on 15 August and held it across five consecutive '
   'daily polls with no score and an unchanged kickoff')
on conflict (provider, provider_status) do nothing;

-- ===========================================================================
-- 3. The transitions this platform made on a provider's word
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Append-only, and separate from `season_fixture_live_state`.
--
-- That table is a PROJECTION — one row per fixture, replaced on every
-- observation — so it can say what the provider currently thinks and cannot say
-- that the platform acted. This says the platform acted, which status it moved
-- from and to, and on which archived response. A postponement a player noticed
-- and a reinstatement they noticed afterwards are two facts, and a projection
-- holds neither of them.
-- ---------------------------------------------------------------------------
create table predictor_internal.season_fixture_lifecycle_transitions (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  season_fixture_id uuid not null
    references public.season_fixtures(id) on delete cascade,

  provider text not null,
  provider_status text not null,
  provider_kind text not null,

  previous_status text not null,
  new_status text not null,

  raw_response_id uuid
    references predictor_internal.provider_raw_responses(id) on delete set null,

  applied_at timestamptz not null default clock_timestamp(),

  constraint season_fixture_lifecycle_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  -- The two transitions this contract permits, named rather than implied. A row
  -- that is not one of them is a bug in the applier, and the constraint is
  -- where that stops rather than where it starts.
  constraint season_fixture_lifecycle_transition_allowed
    check (
      (previous_status = 'scheduled' and new_status = 'postponed')
      or (previous_status = 'postponed' and new_status = 'scheduled')
    ),

  -- Only the four kinds that can drive a transition. `cancelled` and
  -- `abandoned` are absent because a provider may not cause one: they stay
  -- with contract 174's administrator queue.
  constraint season_fixture_lifecycle_kind_allowed
    check (provider_kind in ('scheduled', 'in_play', 'final', 'postponed'))
);

comment on table predictor_internal.season_fixture_lifecycle_transitions is
  'Contract 206. Append-only record of every fixture status this platform moved '
  'on a provider''s word, and the response it moved it on.';

alter table predictor_internal.season_fixture_lifecycle_transitions
  enable row level security;

revoke all on table predictor_internal.season_fixture_lifecycle_transitions
  from public, anon, authenticated, service_role;

create index season_fixture_lifecycle_transitions_fixture_idx
  on predictor_internal.season_fixture_lifecycle_transitions
     (season_fixture_id, applied_at desc);

create index season_fixture_lifecycle_transitions_season_idx
  on predictor_internal.season_fixture_lifecycle_transitions
     (tournament_id, applied_at desc);

-- Evidence, so it may not be rewritten. Same shape as contract 117's guard on
-- `season_fixture_revisions`, minus the review column that record has and this
-- one does not need: nothing here is a queue.
create or replace function predictor_internal.block_lifecycle_transition_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $immutable$
begin
  raise exception 'A fixture lifecycle transition may not be changed or deleted'
    using errcode = '42501';
end;
$immutable$;

revoke all on function predictor_internal.block_lifecycle_transition_rewrite()
  from public, anon, authenticated, service_role;

create trigger block_lifecycle_transition_rewrite
before update or delete on predictor_internal.season_fixture_lifecycle_transitions
for each row
execute function predictor_internal.block_lifecycle_transition_rewrite();

-- ---------------------------------------------------------------------------
-- Apply the two reversible transitions.
--
-- Fails closed on the whole payload exactly as contracts 117, 135 and 174 do,
-- and for the same reason: a half-applied lifecycle leaves some fixtures
-- current and some stale with nothing recording which.
--
-- A FIXTURE CARRYING A SCORE IS NEVER TOUCHED, in either direction and whatever
-- the provider says. `season_fixtures_scores_match_status` ties a score to
-- `played`, so a scored fixture is a settled one, and moving it would rescore a
-- matchweek from a feed.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.apply_provider_fixture_lifecycle(
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
as $lifecycle$
declare
  v_gaps jsonb;
  v_row record;
  v_fixture record;
  v_kind text;
  v_new_status text;
  v_considered integer := 0;
  v_postponed integer := 0;
  v_reinstated integer := 0;
  v_unmatched integer := 0;
  v_unchanged integer := 0;
begin
  if p_now is null then
    raise exception 'Application time is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tournaments season
     where season.id = p_tournament_id
       and season.kind = 'league_season'
  ) then
    raise exception 'The fixture lifecycle applies only to a league season'
      using errcode = '23514';
  end if;

  v_gaps := predictor_internal.provider_mapping_gaps(
    p_provider, p_tournament_id, p_payload);

  if coalesce((v_gaps->>'ready')::boolean, false) is not true then
    return pg_catalog.jsonb_build_object(
      'applied', false,
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
      btrim(coalesce(entry->>'status', '')) as provider_status
    from pg_catalog.jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) as entry
  loop
    v_considered := v_considered + 1;
    v_new_status := null;

    -- The natural key contracts 117, 135 and 174 all match on, and for the
    -- reason they all state: a rescheduled fixture keeps its round, so
    -- (season, round, home, away) still names the same match after it moves.
    select fixture.id, fixture.status, fixture.home_score, fixture.away_score
      into v_fixture
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.competition_round_id = v_row.round_id
       and fixture.home_team_id = v_row.home_id
       and fixture.away_team_id = v_row.away_id;

    if not found then
      v_unmatched := v_unmatched + 1;
      continue;
    end if;

    if v_fixture.home_score is not null or v_fixture.away_score is not null then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    v_kind := predictor_internal.provider_status_kind(
      p_provider, v_row.provider_status);

    if v_kind = 'postponed' and v_fixture.status = 'scheduled' then
      v_new_status := 'postponed';
    elsif v_kind in ('scheduled', 'in_play', 'final')
          and v_fixture.status = 'postponed' then
      -- The provider has taken it back. `final` is here because a fixture that
      -- has been PLAYED is self-evidently no longer postponed; the result
      -- itself is still contract 135's to write, under its own authorship rule,
      -- and is not written here.
      v_new_status := 'scheduled';
    else
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    insert into predictor_internal.season_fixture_lifecycle_transitions (
      tournament_id, season_fixture_id, provider, provider_status, provider_kind,
      previous_status, new_status, raw_response_id, applied_at)
    values (
      p_tournament_id, v_fixture.id, p_provider, v_row.provider_status, v_kind,
      v_fixture.status, v_new_status, p_raw_response_id, p_now);

    update public.season_fixtures
       set status = v_new_status,
           updated_at = p_now
     where id = v_fixture.id;

    if v_new_status = 'postponed' then
      v_postponed := v_postponed + 1;
    else
      v_reinstated := v_reinstated + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'applied', true,
    'considered', v_considered,
    'postponed', v_postponed,
    'reinstated', v_reinstated,
    'unchanged', v_unchanged,
    'unmatched', v_unmatched);
end;
$lifecycle$;

revoke all on function predictor_internal.apply_provider_fixture_lifecycle(
  text, uuid, jsonb, uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 4. A postponed fixture can be given a new date
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Redefined from the committed text of contract 117 as amended by contract 123,
-- with ONE change: the refusal now admits a `postponed` fixture.
--
-- The refusal's own comment explains why every other status is still refused —
-- "a fixture that is no longer scheduled has been played, abandoned or voided,
-- and its kickoff is now a historical fact rather than a plan". A POSTPONED
-- fixture is the exception the sentence never considered: its kickoff is not a
-- historical fact, it is a plan that fell through, and the new plan is exactly
-- what a provider is about to send. Refusing it is what made a postponement
-- permanent.
--
-- THE STATUS IS NOT TOUCHED HERE, deliberately. One function owns the kickoff
-- and one owns the status, so a payload that moves a date while still reporting
-- the fixture postponed cannot make the two disagree inside one transaction.
-- The fixture reads it back out as "postponed, now due <new instant>", which is
-- what the provider actually said, and
-- `predictor_internal.apply_provider_fixture_lifecycle` reinstates it the
-- moment the provider stops calling it postponed.
--
-- The move-into-the-past refusal is unchanged and still applies to both: a
-- kickoff moved behind `p_now` would retroactively close a lock that was open.
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
    -- CONTRACT 206: `postponed` is admitted. A played, abandoned or voided
    -- fixture's kickoff is a historical fact; a postponed one's is a plan that
    -- fell through, and the replacement plan is the thing being imported.
    -- A kickoff moved into the past would retroactively close a lock that was
    -- open, which is the one direction that can invalidate a prediction
    -- somebody was entitled to make.
    if v_fixture.status not in ('scheduled', 'postponed')
       or v_row.kickoff <= p_now then
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
    -- amendment: the fixture stays in the matchweek it was scheduled in. So is
    -- `status`: see the header.
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

-- ===========================================================================
-- 5. The deadline, made to depend on the fixture's state and not only on a date
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Redefined from the committed text of contract 119 with ONE branch added
-- ahead of its rule. Contract 119's own two answers — a rescheduled fixture
-- locks at its own kickoff, everything else at its matchweek's — are unchanged
-- and still reached for every fixture the branch does not claim.
--
-- `infinity` and `-infinity` rather than a boolean: every caller already
-- compares this against `now()`, so an instant that is always ahead and one
-- that is always behind express "open" and "closed" without any caller learning
-- a new shape. The trigger's `v_lock_at is null` fail-closed branch is
-- untouched and still catches a matchweek with unconfirmed kickoffs.
-- ---------------------------------------------------------------------------
create or replace function predictor_internal.season_prediction_lock_at(
  p_season_fixture_id uuid,
  p_buffer_minutes integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $lock$
declare
  v_fixture record;
  v_rescheduled boolean;
begin
  if p_buffer_minutes is null or p_buffer_minutes < 0 then
    return null;
  end if;

  select fixture.id, fixture.tournament_id, fixture.competition_round_id,
         fixture.kickoff_at, fixture.status
    into v_fixture
    from public.season_fixtures fixture
   where fixture.id = p_season_fixture_id;

  if not found then
    return null;
  end if;

  -- CONTRACT 206. A fixture that will not be played has nothing to predict, and
  -- one voided before its kickoff would otherwise stay editable.
  if v_fixture.status in ('void', 'abandoned') then
    return '-infinity'::timestamptz;
  end if;

  -- CONTRACT 206. A postponed fixture's kickoff is where it WAS due. While that
  -- instant is behind us it is not a deadline — locking on it is the permanent
  -- lock a postponement must never create. While it is ahead of us it IS the
  -- deadline, whatever the provider is still calling the fixture, because that
  -- is when the football may start.
  if v_fixture.status = 'postponed' then
    if v_fixture.kickoff_at is null or v_fixture.kickoff_at <= now() then
      return 'infinity'::timestamptz;
    end if;
    return v_fixture.kickoff_at - pg_catalog.make_interval(mins => p_buffer_minutes);
  end if;

  select exists (
    select 1 from predictor_internal.season_fixture_revisions revision
     where revision.season_fixture_id = p_season_fixture_id
  ) into v_rescheduled;

  -- A rescheduled fixture with a known kickoff answers for itself. A
  -- rescheduled fixture whose kickoff has since been cleared falls back to the
  -- matchweek rule rather than to "no lock": absence of a kickoff is the one
  -- state that must fail closed, and contract 83's derivation already does.
  if v_rescheduled and v_fixture.kickoff_at is not null then
    return v_fixture.kickoff_at - pg_catalog.make_interval(mins => p_buffer_minutes);
  end if;

  return predictor_internal.season_matchweek_lock_at(
    v_fixture.tournament_id, v_fixture.competition_round_id, p_buffer_minutes
  );
end;
$lock$;

revoke all on function predictor_internal.season_prediction_lock_at(uuid, integer)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 6. A proposal that has nothing to propose
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

    elsif v_kind in ('postponed', 'abandoned', 'cancelled')
          and v_fixture.status is distinct from
              (case v_kind
                 when 'postponed' then 'postponed'
                 when 'abandoned' then 'abandoned'
                 when 'cancelled' then 'void'
               end) then
      -- INGEST-003.
      --
      -- CONTRACT 206 added the guard above, and it is the ONLY change to this
      -- function. A proposal asks an administrator to decide something; a
      -- fixture the platform already holds in the state the proposal would set
      -- has nothing left to decide, and contract 206's applier now reaches
      -- `postponed` on its own. Without the guard every automatically applied
      -- postponement would also queue a pending proposal reading
      -- "we_already_hold_it_as_postponed" — a request for a decision that has
      -- already been taken, which is worse than no queue at all.
      --
      -- It is written as a mismatch rather than as a `postponed`-only special
      -- case on purpose: an administrator who has already voided a fixture
      -- should not be asked again either.
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

-- ===========================================================================
-- 7. What a fixture read says about its own schedule
-- ===========================================================================
--
-- Two reads, one added object, and it is deliberately NOT a new status.
--
-- `status` already carries the platform's vocabulary and every surface already
-- branches on it. What no surface could answer was the two questions a reader
-- actually asks about an abnormal fixture — "is this time still real?" and "has
-- this already been moved?" — and both were being inferred from a date, which
-- is the inference `FINDING G §B` refuses.
--
--   * `kickoff_confirmed` is false exactly while the platform holds the fixture
--     postponed. It is what tells a surface not to draw a countdown to an
--     instant that will not happen, without that surface reading a clock;
--
--   * `rescheduled` is contract 117's stored fact, not a guess from the shape
--     of a date: a fixture is rescheduled because a revision recorded that it
--     was. It is the same fact contract 119's lock reads, so the deadline and
--     the wording cannot disagree;
--
--   * `original_kickoff_at` is the instant of the FIRST recorded move, so a
--     fixture moved twice still says where it started. Null when it has never
--     moved.
--
-- No lock instant is added. This read is football and not entry — its own
-- header says so — and a per-fixture deadline is entry.
-- ===========================================================================

create or replace function public.get_season_fixtures(
  p_tournament_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fixtures$
declare
  v_uid uuid := (select auth.uid());
  v_season record;
  v_from timestamptz;
  v_to timestamptz;
  v_fixtures jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_tournament_id is null then
    raise exception 'A competition season is required' using errcode = '22023';
  end if;

  select season.id, competition.name as competition_name, competition.slug,
         season.season_key, season.display_timezone, season.kind
    into v_season
    from public.tournaments season
    join public.competitions competition on competition.id = season.competition_id
   where season.id = p_tournament_id;

  if not found then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  -- The tournament shape has its own fixture surfaces and a different lock and
  -- reveal model. Refusing names the mistake; returning an empty array would
  -- read as "no fixtures", which is the sixth instance of a defect this
  -- repository has now fixed five times.
  if v_season.kind <> 'league_season' then
    raise exception 'That competition is not a league season; use the tournament fixture reads'
      using errcode = '22023';
  end if;

  -- A default window rather than the whole season: 380 fixtures is a real
  -- answer to a question nobody asked, and it is the payload every list surface
  -- would then have to trim on the client.
  v_from := coalesce(p_from, now() - interval '7 days');
  v_to := coalesce(p_to, now() + interval '14 days');

  if v_to <= v_from then
    raise exception 'The window must end after it starts' using errcode = '22023';
  end if;

  if v_to - v_from > interval '120 days' then
    raise exception 'A fixture window may not exceed 120 days' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(entry order by sort_kickoff, entry->>'id'), '[]'::jsonb)
    into v_fixtures
    from (
      select
        -- Ordered by when it is actually played. A fixture with no kickoff yet
        -- sorts last rather than first, because an unscheduled match is not the
        -- next thing to happen.
        coalesce(fixture.kickoff_at, 'infinity'::timestamptz) as sort_kickoff,
        jsonb_build_object(
          'id', fixture.id,
          'kickoff_at', fixture.kickoff_at,
          'status', fixture.status,

          -- The round is a LABEL, not the grouping key. This is the owner's
          -- amendment stated in the payload: a fixture moved to November still
          -- says "Matchweek 5", and still sorts into November.
          'round', jsonb_build_object(
            'id', round.id,
            'ordinal', round.ordinal,
            'label', round.label),

          -- CONTRACT 206. See this migration's section 7.
          'schedule', jsonb_build_object(
            'kickoff_confirmed', fixture.status <> 'postponed',
            'rescheduled', exists (
              select 1 from predictor_internal.season_fixture_revisions revision
               where revision.season_fixture_id = fixture.id),
            'original_kickoff_at', (
              select revision.previous_kickoff_at
                from predictor_internal.season_fixture_revisions revision
               where revision.season_fixture_id = fixture.id
               order by revision.applied_at, revision.id
               limit 1)),

          'home', jsonb_build_object(
            'name', home.name,
            'short_code', home_identity.short_code,
            'club_colours', home_identity.club_colours),
          'away', jsonb_build_object(
            'name', away.name,
            'short_code', away_identity.short_code,
            'club_colours', away_identity.club_colours),

          -- What settled. Null until it did.
          'result', case when fixture.status = 'played' then jsonb_build_object(
            'home', fixture.home_score,
            'away', fixture.away_score) end,

          -- What a provider currently says, which is a different thing and is
          -- kept in a different field on purpose.
          'live', case when live.season_fixture_id is not null then jsonb_build_object(
            'kind', live.kind,
            'home', live.home_score,
            'away', live.away_score,
            'observed_at', live.observed_at) end
        ) as entry
        from public.season_fixtures fixture
        join public.competition_rounds round on round.id = fixture.competition_round_id
        join public.teams home on home.id = fixture.home_team_id
        join public.teams away on away.id = fixture.away_team_id
        left join predictor_internal.club_identity_reference home_identity
          on home_identity.normalised_name
           = predictor_internal.normalised_club_name(home.name)
        left join predictor_internal.club_identity_reference away_identity
          on away_identity.normalised_name
           = predictor_internal.normalised_club_name(away.name)
        left join predictor_internal.season_fixture_live_state live
          on live.season_fixture_id = fixture.id
       where fixture.tournament_id = p_tournament_id
         and fixture.kickoff_at >= v_from
         and fixture.kickoff_at < v_to
       order by coalesce(fixture.kickoff_at, 'infinity'::timestamptz), fixture.id
       limit 500) windowed;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.competition_name,
      'slug', v_season.slug,
      'season_key', v_season.season_key,
      'time_zone', v_season.display_timezone),
    'window', jsonb_build_object('from', v_from, 'to', v_to),
    'server_now', now(),
    'fixtures', v_fixtures);
end;
$fixtures$;

revoke all on function public.get_season_fixtures(uuid, timestamptz, timestamptz)
  from public, anon, service_role;
grant execute on function public.get_season_fixtures(uuid, timestamptz, timestamptz)
  to authenticated;

create or replace function public.get_season_fixture(
  p_season_fixture_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fixture$
declare
  v_uid uuid := (select auth.uid());
  v_season record;
  v_fixture jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_season_fixture_id is null then
    raise exception 'A fixture is required' using errcode = '22023';
  end if;

  select season.id, competition.name as competition_name, competition.slug,
         season.season_key, season.display_timezone, season.kind
    into v_season
    from public.season_fixtures fixture
    join public.tournaments season on season.id = fixture.tournament_id
    join public.competitions competition on competition.id = season.competition_id
   where fixture.id = p_season_fixture_id;

  if not found then
    raise exception 'That fixture does not exist' using errcode = '22023';
  end if;

  -- The same refusal contract 139 makes, for the same reason: the tournament
  -- shape has its own fixture surfaces and a different lock and reveal model,
  -- and returning nothing would read as "no such fixture".
  if v_season.kind <> 'league_season' then
    raise exception 'That fixture is not in a league season; use the tournament fixture reads'
      using errcode = '22023';
  end if;

  select jsonb_build_object(
           'id', fixture.id,
           'kickoff_at', fixture.kickoff_at,
           'status', fixture.status,

           -- A label, not the grouping key: a fixture moved to November still
           -- says "Matchweek 5". Contract 139's amendment, restated here
           -- because this payload has to agree with it exactly.
           'round', jsonb_build_object(
             'id', round.id,
             'ordinal', round.ordinal,
             'label', round.label),

           -- CONTRACT 206. Field for field with contract 139's list entry, for
           -- the reason contract 148 gives: a fixture must look identical
           -- whether it arrived from the calendar or from a link.
           'schedule', jsonb_build_object(
             'kickoff_confirmed', fixture.status <> 'postponed',
             'rescheduled', exists (
               select 1 from predictor_internal.season_fixture_revisions revision
                where revision.season_fixture_id = fixture.id),
             'original_kickoff_at', (
               select revision.previous_kickoff_at
                 from predictor_internal.season_fixture_revisions revision
                where revision.season_fixture_id = fixture.id
                order by revision.applied_at, revision.id
                limit 1)),

           'home', jsonb_build_object(
             'name', home.name,
             'short_code', home_identity.short_code,
             'club_colours', home_identity.club_colours),
           'away', jsonb_build_object(
             'name', away.name,
             'short_code', away_identity.short_code,
             'club_colours', away_identity.club_colours),

           'result', case when fixture.status = 'played' then jsonb_build_object(
             'home', fixture.home_score,
             'away', fixture.away_score) end,

           'live', case when live.season_fixture_id is not null then jsonb_build_object(
             'kind', live.kind,
             'home', live.home_score,
             'away', live.away_score,
             'observed_at', live.observed_at) end)
    into v_fixture
    from public.season_fixtures fixture
    join public.competition_rounds round on round.id = fixture.competition_round_id
    join public.teams home on home.id = fixture.home_team_id
    join public.teams away on away.id = fixture.away_team_id
    left join predictor_internal.club_identity_reference home_identity
      on home_identity.normalised_name = predictor_internal.normalised_club_name(home.name)
    left join predictor_internal.club_identity_reference away_identity
      on away_identity.normalised_name = predictor_internal.normalised_club_name(away.name)
    left join predictor_internal.season_fixture_live_state live
      on live.season_fixture_id = fixture.id
   where fixture.id = p_season_fixture_id;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.competition_name,
      'slug', v_season.slug,
      'season_key', v_season.season_key,
      'time_zone', v_season.display_timezone),
    'server_now', now(),
    'fixture', v_fixture);
end;
$fixture$;

revoke all on function public.get_season_fixture(uuid) from public, anon, service_role;
grant execute on function public.get_season_fixture(uuid) to authenticated;

-- ===========================================================================
-- 8. The driver, with the lifecycle in it
-- ===========================================================================
--
-- Redefined from the committed text of contract 174 with ONE added call and no
-- other change. Verified by the diff below rather than by reading.
--
-- IT RUNS SECOND, between the kickoff import and the result applier, and the
-- order is the rule rather than an accident:
--
--   * AFTER the kickoff import, so a fixture that was given a new date in this
--     same response is judged on the date it now holds;
--   * BEFORE the result applier, because that applier writes a result for a
--     fixture whose status is `scheduled` or `postponed` and must see whichever
--     of the two this response actually established;
--   * BEFORE detection, so contract 174 stages a proposal only for the
--     decisions a human still has to take — which, with section 6's guard, is
--     cancellation, abandonment, discovery and withdrawal.
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
            -- CONTRACT 206. The two reversible status transitions a provider
            -- may cause. See this migration's section 8 for why it sits here.
            'lifecycle', predictor_internal.apply_provider_fixture_lifecycle(
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

revoke all on function predictor_internal.consume_provider_responses(
  integer, timestamptz)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 9. Prove the shape, in the same transaction
-- ===========================================================================

do $$
declare
  v_consume text;
  v_detect text;
begin
  -- The record is evidence, so it is unreachable and unrewritable.
  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'predictor_internal'
       and relation.relname = 'season_fixture_lifecycle_transitions'
       and relation.relrowsecurity
  ) then
    raise exception 'season_fixture_lifecycle_transitions must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'predictor_internal'
       and table_name = 'season_fixture_lifecycle_transitions'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can reach the lifecycle record';
  end if;

  -- This migration adds an applier; it must not apply anything.
  if exists (select 1 from predictor_internal.season_fixture_lifecycle_transitions) then
    raise exception 'this migration must record no lifecycle transition';
  end if;

  -- The token this contract measured, and the guard that it changed nothing
  -- about what may become a result.
  if predictor_internal.provider_status_kind('sportmonks', '10') <> 'postponed' then
    raise exception 'SportMonks state 10 must resolve as postponed';
  end if;

  if (select count(*) from predictor_internal.provider_status_kinds
       where provider = 'sportmonks' and kind = 'final') <> 1 then
    raise exception 'SportMonks must still have exactly one measured final status';
  end if;

  -- The defect this contract exists to fix, asserted against the real shape of
  -- a stored path rather than against a copy of it.
  if not (
    'https://api.sportmonks.com/v3/football/fixtures/between/2026-08-19/2026-08-27?x=1'
    like '%' || predictor_internal.provider_poll_path_pattern(
      '/fixtures/between/{{date:+0}}/{{date:+8}}?x=1') escape '\'
  ) then
    raise exception 'a resolved poll URL must match the pattern of the path that produced it';
  end if;

  -- And the direction that must NOT be widened: a different path is still a
  -- different path.
  if 'https://api.sportmonks.com/v3/football/fixtures/between/2026-08-19/2026-08-27?x=1'
     like '%' || predictor_internal.provider_poll_path_pattern(
       '/standings/season/{{date:+0}}?x=1') escape '\'
  then
    raise exception 'the poll path pattern matched a path it does not describe';
  end if;

  -- The driver must reach every authority, including the one added here. A
  -- redefinition that copied an older body would pass every other check.
  v_consume := pg_catalog.pg_get_functiondef(
    'predictor_internal.consume_provider_responses(integer, timestamptz)'::regprocedure);

  if v_consume !~ 'apply_provider_fixture_lifecycle'
     or v_consume !~ 'import_provider_fixture_revisions'
     or v_consume !~ 'apply_provider_fixture_facts'
     or v_consume !~ 'detect_provider_calendar_changes'
     or v_consume !~ 'stage_provider_fixture_proposals'
  then
    raise exception 'the driver no longer reaches every ingestion authority';
  end if;

  -- Section 6's guard, pinned: a future redefinition of detection that drops it
  -- would silently restore the queue of decisions already taken.
  v_detect := pg_catalog.pg_get_functiondef(
    'predictor_internal.detect_provider_calendar_changes(text, uuid, jsonb, uuid, timestamptz, timestamptz, timestamptz)'::regprocedure);

  if v_detect !~ 'is distinct from' then
    raise exception 'detection no longer skips a proposal the platform already holds';
  end if;
end;
$$;

commit;
