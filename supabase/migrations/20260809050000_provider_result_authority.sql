-- Contract 135: a provider result becomes the official season result, and the
-- driver that applies it.
--
-- ---------------------------------------------------------------------------
-- THE OWNER DECISION THIS IMPLEMENTS, AND WHAT IT REVERSES
-- ---------------------------------------------------------------------------
--
-- ADR 0020 and `INGEST-006` said that provider data is provisional and that
-- protected confirmation remains the official scoring and progression gate. On
-- 9 August 2026 the owner decided otherwise, in these words: the provider IS
-- final truth for awarding points, and it must stay auditable and correctable
-- from the admin panel in the unlikely event a correction is needed.
--
-- That is a rule change, not a plumbing change, so it is recorded as an
-- amendment in ADR 0020 rather than arriving as a side effect of an importer.
-- What it changes is exactly one thing: who may write a league fixture's score
-- without a human typing it. What it deliberately does NOT change:
--
--   * the tournament path. `public.matches`, `admin_confirm_match_result` and
--     `match_result_revisions` are untouched. Euro 2028 keeps the protected
--     confirmation gate in full;
--   * the audit trail. Every provider write goes through contract 125's
--     `record_season_fixture_result`, which numbers the revision, records the
--     result it replaced and refuses to be rewritten. There is still exactly
--     one writer of an official season score;
--   * the administrator's authority. `admin_correct_season_fixture_result` and
--     `admin_clear_season_fixture_result` work exactly as before, and a human
--     correction WINS: once an administrator has touched a fixture, the
--     provider stops writing it and says so in a queue. See below;
--   * scoring. Nothing here settles anything. The hourly rederivation job picks
--     the result up on its next run, which is also how a correction reaches the
--     table today.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS ALSO CLOSES, WHICH IS THE REASON IT IS ONE CONTRACT
-- ---------------------------------------------------------------------------
--
-- Measured on this commit rather than assumed: `pg_cron` dispatches
-- `provider-poll` every five minutes, the Edge Function archives the verbatim
-- response and decodes it, and `record_provider_response_processing` stores the
-- decoded array in `provider_response_processing.normalized_payload`.
--
-- And then nothing happens. `predictor_internal.import_provider_fixture_revisions`
-- (contract 117) has no caller anywhere in `supabase/`, `src/` or the Edge
-- Function. `predictor_internal.stage_provider_fixture_proposals` (contract 132)
-- has no caller either. Nothing else reads `normalized_payload` at all. Two
-- reviewed authorities, both unreachable, both waiting for a driver nobody
-- wrote.
--
-- Shipping the result applier alone would have made that three. So this
-- contract is the whole path: what a provider status MEANS, what the provider
-- currently says about a fixture, when that becomes the official result, and
-- the scheduled driver that walks the decoded responses and routes each one to
-- the authority that owns it.
--
-- ---------------------------------------------------------------------------
-- FAIL-CLOSED, IN THE THREE PLACES IT MATTERS
-- ---------------------------------------------------------------------------
--
-- 1. STATUS. A provider status is a raw token — football-data says 'FINISHED',
--    API-Football says 'FT', SportMonks sends a numeric state id. A result is
--    written only when the token maps to `final` in a seeded vocabulary. An
--    unrecognised token is NOT final, and it is recorded so an operator can see
--    that the provider said something we do not understand rather than having
--    it silently ignored.
--
-- 2. IDENTITY. An unmapped team or round fails the WHOLE payload, exactly as
--    contract 117 does. A partly applied result set is worse than none: some
--    matchweeks would settle and some would not, with nothing saying which.
--
-- 3. AUTHORSHIP. A fixture whose most recent revision was made by a signed-in
--    administrator is owned by that administrator. The provider does not
--    overwrite it, and the refusal is queued rather than dropped. This is the
--    "correctable in the admin panel" half of the owner's decision: a human
--    decision stands until a human changes it.
--
-- ---------------------------------------------------------------------------
-- WHAT PROVENANCE LOOKS LIKE, AND WHY IT IS A SECOND TABLE
-- ---------------------------------------------------------------------------
--
-- `season_fixture_result_revisions` already records the revision. It cannot
-- record WHO in the sense that now matters, because `actor_id` is `auth.uid()`
-- and a `pg_cron` job has none — it would be null, which is indistinguishable
-- from an unauthenticated write.
--
-- Adding columns to that table would mean changing contract 125's writer
-- signature, and a function's argument list cannot be changed by
-- `create or replace`. Dropping and recreating it is refused by the additive
-- fast lane, correctly. So provenance is recorded ALONGSIDE the revision, keyed
-- by the revision number that writer already returns:
--
--   * a revision with a `season_fixture_result_sources` row was written by the
--     provider, and the row names which provider and which archived response;
--   * a revision without one was written by an administrator, and its
--     `actor_id` names them.
--
-- Both facts are present for every revision, which is what makes the authorship
-- rule above decidable rather than inferred.

begin;

-- ---------------------------------------------------------------------------
-- What a provider status means.
--
-- Data rather than code, so an operator can teach the platform a token without
-- a migration. Seeded only with tokens taken from the committed decoders and
-- the providers' own published vocabularies; anything else is `unknown` by
-- absence, which is the safe direction.
--
-- SportMonks is the awkward one and is treated as such. Its decoder sends
-- `state_id ?? result_info`, so a token here may be a numeric state id or a
-- sentence. Only the two numeric ids that unambiguously mean a finished league
-- match are mapped final; every other SportMonks token stays unknown until
-- somebody measures it against a real payload.
-- ---------------------------------------------------------------------------

create table predictor_internal.provider_status_kinds (
  provider text not null,
  provider_status text not null,
  kind text not null,
  note text,
  created_at timestamptz not null default now(),

  constraint provider_status_kinds_pkey
    primary key (provider, provider_status),

  constraint provider_status_kinds_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  constraint provider_status_kinds_status_bound
    check (char_length(btrim(provider_status)) between 1 and 80),

  -- `final` is the only kind that may become an official result. The rest exist
  -- so a fixture's live state can say something honest without implying one.
  constraint provider_status_kinds_kind_allowed
    check (kind in (
      'scheduled', 'in_play', 'final', 'postponed', 'abandoned', 'cancelled'))
);

comment on table predictor_internal.provider_status_kinds is
  'Contract 135. Provider status token to neutral kind. A token absent here is '
  'unknown and can never become an official result.';

alter table predictor_internal.provider_status_kinds enable row level security;

revoke all on table predictor_internal.provider_status_kinds
  from public, anon, authenticated, service_role;

insert into predictor_internal.provider_status_kinds
  (provider, provider_status, kind, note)
values
  -- football-data.org publishes this vocabulary directly on the match resource.
  ('football-data', 'SCHEDULED',   'scheduled', 'published match status'),
  ('football-data', 'TIMED',       'scheduled', 'kickoff time confirmed'),
  ('football-data', 'IN_PLAY',     'in_play',   'published match status'),
  ('football-data', 'PAUSED',      'in_play',   'half time'),
  ('football-data', 'FINISHED',    'final',     'published match status'),
  ('football-data', 'POSTPONED',   'postponed', 'published match status'),
  ('football-data', 'SUSPENDED',   'abandoned', 'published match status'),
  ('football-data', 'CANCELLED',   'cancelled', 'published match status'),

  -- API-Football short codes. 'AET' and 'PEN' cannot occur in a league fixture
  -- and are deliberately absent rather than mapped to final: if one ever
  -- arrives it means the fixture is not the league match we think it is.
  ('api-football', 'TBD',  'scheduled', 'time to be defined'),
  ('api-football', 'NS',   'scheduled', 'not started'),
  ('api-football', '1H',   'in_play',   'first half'),
  ('api-football', 'HT',   'in_play',   'half time'),
  ('api-football', '2H',   'in_play',   'second half'),
  ('api-football', 'LIVE', 'in_play',   'in progress'),
  ('api-football', 'FT',   'final',     'match finished'),
  ('api-football', 'PST',  'postponed', 'postponed'),
  ('api-football', 'SUSP', 'abandoned', 'suspended'),
  ('api-football', 'INT',  'abandoned', 'interrupted'),
  ('api-football', 'ABD',  'abandoned', 'abandoned'),
  ('api-football', 'CANC', 'cancelled', 'cancelled'),
  ('api-football', 'AWD',  'abandoned', 'technical loss -- needs a human'),
  ('api-football', 'WO',   'abandoned', 'walkover -- needs a human'),

  -- SportMonks numeric state ids. 5 is FT; 7 is FT after extra time and cannot
  -- occur in a league fixture, so it is absent. Nothing else is claimed here.
  ('sportmonks', '1',  'scheduled', 'NS'),
  ('sportmonks', '2',  'in_play',   'first half'),
  ('sportmonks', '3',  'in_play',   'half time'),
  ('sportmonks', '4',  'in_play',   'break'),
  ('sportmonks', '5',  'final',     'full time'),
  ('sportmonks', '14', 'postponed', 'postponed'),
  ('sportmonks', '15', 'cancelled', 'cancelled'),
  ('sportmonks', '16', 'abandoned', 'abandoned'),
  ('sportmonks', '17', 'abandoned', 'interrupted'),
  ('sportmonks', '18', 'abandoned', 'suspended'),
  ('sportmonks', '20', 'scheduled', 'delayed'),
  ('sportmonks', '21', 'scheduled', 'to be announced');

-- ---------------------------------------------------------------------------
-- Tokens we did not recognise.
--
-- Append-only, because it is evidence: the provider said this on this response
-- and we could not act on it. Without this a fail-closed vocabulary is
-- indistinguishable from a provider that never sends a final status, and the
-- symptom of both is a season that quietly never settles.
-- ---------------------------------------------------------------------------

create table predictor_internal.provider_status_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_status text not null,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  raw_response_id uuid
    references predictor_internal.provider_raw_responses(id) on delete restrict,
  fixtures integer not null check (fixtures > 0),
  observed_at timestamptz not null default clock_timestamp(),

  constraint provider_status_observations_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),
  constraint provider_status_observations_status_bound
    check (char_length(btrim(provider_status)) between 1 and 80)
);

comment on table predictor_internal.provider_status_observations is
  'Contract 135. Append-only record of provider status tokens with no mapping, '
  'so a fail-closed vocabulary is visible rather than silent.';

alter table predictor_internal.provider_status_observations enable row level security;

revoke all on table predictor_internal.provider_status_observations
  from public, anon, authenticated, service_role;

create index provider_status_observations_provider_idx
  on predictor_internal.provider_status_observations
     (provider, provider_status, observed_at desc);

-- ---------------------------------------------------------------------------
-- What the provider currently says about a fixture.
--
-- One row per fixture, replaced on each observation, because this is a
-- PROJECTION and not evidence — the evidence is the archived response, which is
-- immutable and keeps every version. A live score is only interesting while it
-- is current.
--
-- Nothing derived from this may decide anything. It carries `observed_at` so a
-- surface can say how old it is, and `kind` so a surface never has to interpret
-- a provider token itself.
-- ---------------------------------------------------------------------------

create table predictor_internal.season_fixture_live_state (
  season_fixture_id uuid primary key
    references public.season_fixtures(id) on delete cascade,

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  provider text not null,
  provider_status text not null,
  kind text not null,

  home_score smallint,
  away_score smallint,

  raw_response_id uuid
    references predictor_internal.provider_raw_responses(id) on delete set null,

  observed_at timestamptz not null default clock_timestamp(),

  constraint season_fixture_live_state_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  constraint season_fixture_live_state_kind_allowed
    check (kind in (
      'scheduled', 'in_play', 'final', 'postponed', 'abandoned', 'cancelled',
      'unknown')),

  constraint season_fixture_live_state_scores_non_negative
    check (
      (home_score is null or home_score >= 0)
      and (away_score is null or away_score >= 0)
    )
);

comment on table predictor_internal.season_fixture_live_state is
  'Contract 135. Provisional provider view of a season fixture: latest status, '
  'score and observation time. Never an input to a lock, score, standing or '
  'settlement.';

alter table predictor_internal.season_fixture_live_state enable row level security;

revoke all on table predictor_internal.season_fixture_live_state
  from public, anon, authenticated, service_role;

create index season_fixture_live_state_season_idx
  on predictor_internal.season_fixture_live_state (tournament_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- Which revisions the provider wrote.
--
-- Keyed by the revision, which contract 125's writer returns. Append-only for
-- the same reason the revision is: it explains a number a player can see.
-- ---------------------------------------------------------------------------

create table predictor_internal.season_fixture_result_sources (
  season_fixture_id uuid not null
    references public.season_fixtures(id) on delete cascade,

  revision integer not null check (revision > 0),

  provider text not null,

  raw_response_id uuid
    references predictor_internal.provider_raw_responses(id) on delete set null,

  provider_status text not null,
  recorded_at timestamptz not null default clock_timestamp(),

  constraint season_fixture_result_sources_pkey
    primary key (season_fixture_id, revision),

  constraint season_fixture_result_sources_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data'))
);

comment on table predictor_internal.season_fixture_result_sources is
  'Contract 135. Names the provider behind a season result revision. A revision '
  'with no row here was written by an administrator.';

alter table predictor_internal.season_fixture_result_sources enable row level security;

revoke all on table predictor_internal.season_fixture_result_sources
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- What the provider was refused, and why.
--
-- Append-only. The administrator-owned case is the one that matters: a provider
-- that silently stops writing a fixture is indistinguishable from a provider
-- that agrees with it.
-- ---------------------------------------------------------------------------

create table predictor_internal.provider_result_refusals (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  season_fixture_id uuid
    references public.season_fixtures(id) on delete cascade,

  provider text not null,
  provider_status text,
  reason text not null,
  detail jsonb not null default '{}'::jsonb,

  raw_response_id uuid
    references predictor_internal.provider_raw_responses(id) on delete set null,

  refused_at timestamptz not null default clock_timestamp(),

  constraint provider_result_refusals_provider_allowed
    check (provider in ('sportmonks', 'api-football', 'football-data')),

  constraint provider_result_refusals_reason_allowed
    check (reason in (
      'administrator_owns_result',
      'unknown_status',
      'incomplete_score',
      'fixture_not_held',
      'fixture_not_writable'))
);

comment on table predictor_internal.provider_result_refusals is
  'Contract 135. Append-only record of every provider result this platform '
  'declined to apply, with the reason.';

alter table predictor_internal.provider_result_refusals enable row level security;

revoke all on table predictor_internal.provider_result_refusals
  from public, anon, authenticated, service_role;

create index provider_result_refusals_season_idx
  on predictor_internal.provider_result_refusals
     (tournament_id, refused_at desc);

-- ---------------------------------------------------------------------------
-- Which decoded responses have been consumed.
--
-- `provider_response_processing` is append-only and guarded by a trigger, so it
-- cannot be stamped. Idempotency lives in its own table instead: a processing
-- row with a row here has been through the driver, whatever the outcome was.
-- ---------------------------------------------------------------------------

create table predictor_internal.provider_response_consumption (
  processing_id uuid primary key
    references predictor_internal.provider_response_processing(id) on delete cascade,

  tournament_id uuid references public.tournaments(id) on delete set null,

  outcome text not null,
  report jsonb not null default '{}'::jsonb,
  consumed_at timestamptz not null default clock_timestamp(),

  constraint provider_response_consumption_outcome_allowed
    check (outcome in (
      'applied',
      'staged_proposals',
      'unmapped_identifiers',
      'unresolved_season',
      'not_a_league_season',
      'failed',
      'nothing_to_do'))
);

comment on table predictor_internal.provider_response_consumption is
  'Contract 135. One row per decoded provider response the driver has handled, '
  'which is what makes the driver idempotent.';

alter table predictor_internal.provider_response_consumption enable row level security;

revoke all on table predictor_internal.provider_response_consumption
  from public, anon, authenticated, service_role;

create index provider_response_consumption_consumed_idx
  on predictor_internal.provider_response_consumption (consumed_at desc);

-- ---------------------------------------------------------------------------
-- The vocabulary lookup.
--
-- Returns 'unknown' rather than null so every caller has one value to branch
-- on, and so a null token cannot accidentally compare equal to anything.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.provider_status_kind(
  p_provider text,
  p_provider_status text
)
returns text
language sql
stable
security definer
set search_path = ''
as $kind$
  select coalesce(
    (select known.kind
       from predictor_internal.provider_status_kinds known
      where known.provider = p_provider
        and known.provider_status = btrim(coalesce(p_provider_status, ''))),
    'unknown');
$kind$;

revoke all on function predictor_internal.provider_status_kind(text, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Apply what a provider says about a season's fixtures.
--
-- Two things happen per fixture, and only the second is a rule:
--
--   * the live projection is replaced, whatever the status. A postponed or
--     in-play fixture is worth showing;
--   * a `final` status with both scores becomes the official result, through
--     contract 125's writer, unless an administrator owns the fixture.
--
-- The whole payload is refused when any identifier is unmapped, matching
-- contract 117. Everything else is counted and reported rather than raised, so
-- one awkward fixture cannot stop a matchweek.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.apply_provider_fixture_facts(
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
as $apply$
declare
  v_gaps jsonb;
  v_row record;
  v_fixture record;
  v_kind text;
  v_considered integer := 0;
  v_live integer := 0;
  v_confirmed integer := 0;
  v_corrected integer := 0;
  v_unchanged integer := 0;
  v_unmatched integer := 0;
  v_refused integer := 0;
  v_admin_owned integer := 0;
  v_unknown_status integer := 0;
  v_result jsonb;
  v_action text;
  v_last_actor uuid;
  v_last_revision integer;
  v_provider_owned boolean;
begin
  if p_now is null then
    raise exception 'Application time is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.tournaments season
     where season.id = p_tournament_id
       and season.kind = 'league_season'
  ) then
    raise exception 'Provider results apply only to a league season'
      using errcode = '23514';
  end if;

  -- Fail closed on the whole payload, exactly as contract 117 does. A partly
  -- applied result set settles some matchweeks and not others, with nothing
  -- recording which.
  v_gaps := predictor_internal.provider_mapping_gaps(
    p_provider, p_tournament_id, p_payload);

  if coalesce((v_gaps->>'ready')::boolean, false) is not true then
    return pg_catalog.jsonb_build_object(
      'applied', false,
      'reason', 'unmapped_identifiers',
      'gaps', v_gaps);
  end if;

  -- Unrecognised status tokens are recorded once per response with the number
  -- of fixtures each blocked, rather than one row per fixture.
  insert into predictor_internal.provider_status_observations (
    provider, provider_status, tournament_id, raw_response_id, fixtures)
  select p_provider,
         token.provider_status,
         p_tournament_id,
         p_raw_response_id,
         token.fixtures
    from (
      select btrim(coalesce(entry->>'status', '')) as provider_status,
             count(*)::integer as fixtures
        from pg_catalog.jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) as entry
       group by 1
    ) token
   where token.provider_status <> ''
     and predictor_internal.provider_status_kind(
           p_provider, token.provider_status) = 'unknown';

  for v_row in
    select
      predictor_internal.resolve_provider_round(
        p_provider, p_tournament_id, entry->>'roundProviderId') as round_id,
      predictor_internal.resolve_provider_team(
        p_provider, p_tournament_id, entry->>'homeTeamProviderId') as home_id,
      predictor_internal.resolve_provider_team(
        p_provider, p_tournament_id, entry->>'awayTeamProviderId') as away_id,
      btrim(coalesce(entry->>'status', '')) as provider_status,
      (entry->>'homeScore') as home_score_text,
      (entry->>'awayScore') as away_score_text
    from pg_catalog.jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) as entry
  loop
    v_considered := v_considered + 1;

    -- The same natural key contract 117 matches on. A rescheduled fixture keeps
    -- its round, so (season, round, home, away) still names the same match, and
    -- `assert_season_fixture_shape` refuses a club playing twice in a matchweek
    -- so the key cannot match two rows.
    select fixture.id, fixture.status, fixture.home_score, fixture.away_score
      into v_fixture
      from public.season_fixtures fixture
     where fixture.tournament_id = p_tournament_id
       and fixture.competition_round_id = v_row.round_id
       and fixture.home_team_id = v_row.home_id
       and fixture.away_team_id = v_row.away_id;

    if not found then
      -- Contract 117's rule, and for the same reason: a fixture this platform
      -- does not hold is not created here. Contract 132's proposal path is
      -- where a new fixture is decided.
      v_unmatched := v_unmatched + 1;
      continue;
    end if;

    v_kind := predictor_internal.provider_status_kind(
      p_provider, v_row.provider_status);

    -- The projection is replaced whatever the status, including 'unknown'. A
    -- surface showing "we do not know" is more honest than one showing the
    -- previous observation for ever.
    insert into predictor_internal.season_fixture_live_state (
      season_fixture_id, tournament_id, provider, provider_status, kind,
      home_score, away_score, raw_response_id, observed_at)
    values (
      v_fixture.id, p_tournament_id, p_provider, v_row.provider_status, v_kind,
      nullif(v_row.home_score_text, '')::smallint,
      nullif(v_row.away_score_text, '')::smallint,
      p_raw_response_id, p_now)
    on conflict (season_fixture_id) do update
       set tournament_id   = excluded.tournament_id,
           provider        = excluded.provider,
           provider_status = excluded.provider_status,
           kind            = excluded.kind,
           home_score      = excluded.home_score,
           away_score      = excluded.away_score,
           raw_response_id = excluded.raw_response_id,
           observed_at     = excluded.observed_at;

    v_live := v_live + 1;

    if v_kind = 'unknown' then
      v_unknown_status := v_unknown_status + 1;
      continue;
    end if;

    if v_kind <> 'final' then
      continue;
    end if;

    if v_row.home_score_text is null or v_row.away_score_text is null
       or v_row.home_score_text = '' or v_row.away_score_text = '' then
      -- A final status with no score is a provider defect, not a nil-nil draw.
      insert into predictor_internal.provider_result_refusals (
        tournament_id, season_fixture_id, provider, provider_status, reason,
        detail, raw_response_id)
      values (
        p_tournament_id, v_fixture.id, p_provider, v_row.provider_status,
        'incomplete_score',
        pg_catalog.jsonb_build_object(
          'home', v_row.home_score_text, 'away', v_row.away_score_text),
        p_raw_response_id);
      v_refused := v_refused + 1;
      continue;
    end if;

    -- Who owns this fixture's result. An administrator's revision is one with
    -- no provider provenance row; `actor_id` alone is not enough, because a
    -- provider revision also has none.
    select revisions.revision, revisions.actor_id,
           exists (
             select 1
               from predictor_internal.season_fixture_result_sources source
              where source.season_fixture_id = revisions.season_fixture_id
                and source.revision = revisions.revision)
      into v_last_revision, v_last_actor, v_provider_owned
      from predictor_internal.season_fixture_result_revisions revisions
     where revisions.season_fixture_id = v_fixture.id
     order by revisions.revision desc
     limit 1;

    if v_last_revision is not null and not v_provider_owned then
      -- The owner's decision, in the one place it is visible: a human
      -- correction stands until a human changes it.
      insert into predictor_internal.provider_result_refusals (
        tournament_id, season_fixture_id, provider, provider_status, reason,
        detail, raw_response_id)
      values (
        p_tournament_id, v_fixture.id, p_provider, v_row.provider_status,
        'administrator_owns_result',
        pg_catalog.jsonb_build_object(
          'revision', v_last_revision,
          'actorId', v_last_actor,
          'providerHome', v_row.home_score_text,
          'providerAway', v_row.away_score_text),
        p_raw_response_id);
      v_admin_owned := v_admin_owned + 1;
      continue;
    end if;

    if v_fixture.status = 'played' then
      if v_fixture.home_score = v_row.home_score_text::smallint
         and v_fixture.away_score = v_row.away_score_text::smallint then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;
      v_action := 'correct';
    elsif v_fixture.status in ('scheduled', 'postponed') then
      v_action := 'confirm';
    else
      insert into predictor_internal.provider_result_refusals (
        tournament_id, season_fixture_id, provider, provider_status, reason,
        detail, raw_response_id)
      values (
        p_tournament_id, v_fixture.id, p_provider, v_row.provider_status,
        'fixture_not_writable',
        pg_catalog.jsonb_build_object('fixtureStatus', v_fixture.status),
        p_raw_response_id);
      v_refused := v_refused + 1;
      continue;
    end if;

    -- Contract 125's writer, unchanged. It numbers the revision, records the
    -- result it replaced, and refuses to be rewritten. A correction needs a
    -- reason, and the provider gives a real one rather than a placeholder.
    v_result := predictor_internal.record_season_fixture_result(
      v_fixture.id,
      v_action,
      v_row.home_score_text::smallint,
      v_row.away_score_text::smallint,
      case when v_action = 'correct'
        then p_provider || ' revised the result to '
             || v_row.home_score_text || '-' || v_row.away_score_text
        else null
      end);

    insert into predictor_internal.season_fixture_result_sources (
      season_fixture_id, revision, provider, raw_response_id, provider_status)
    values (
      v_fixture.id,
      (v_result->>'revision')::integer,
      p_provider,
      p_raw_response_id,
      v_row.provider_status);

    if v_action = 'confirm' then
      v_confirmed := v_confirmed + 1;
    else
      v_corrected := v_corrected + 1;
    end if;
  end loop;

  -- No settlement call, deliberately. `process_due_season_matchweek_scores`
  -- rederives every league season on every run, which is how a correction
  -- reaches the table today and is exactly what a provider result needs too.
  return pg_catalog.jsonb_build_object(
    'applied', true,
    'considered', v_considered,
    'live', v_live,
    'confirmed', v_confirmed,
    'corrected', v_corrected,
    'unchanged', v_unchanged,
    'unmatched', v_unmatched,
    'refused', v_refused,
    'administratorOwned', v_admin_owned,
    'unknownStatus', v_unknown_status);
end;
$apply$;

revoke all on function predictor_internal.apply_provider_fixture_facts(
  text, uuid, jsonb, uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Which season a decoded response is about.
--
-- The payload's own season identifier first, because that is the fact the
-- identity map exists to answer. A unique enabled poll target for the same
-- request second, because a response this platform fetched on purpose knows
-- which competition it was fetched for. Nothing else: a guess here would apply
-- one league's results to another.
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
  select array_agg(distinct entry->>'seasonProviderId')
    into v_season_ids
    from pg_catalog.jsonb_array_elements(coalesce(p_payload, '[]'::jsonb)) as entry
   where entry->>'seasonProviderId' is not null;

  -- One payload naming two seasons is not something to resolve by picking one.
  if v_season_ids is not null and array_length(v_season_ids, 1) = 1 then
    v_tournament_id := predictor_internal.resolve_provider_season(
      p_provider, v_season_ids[1]);
    if v_tournament_id is not null then
      return v_tournament_id;
    end if;
  end if;

  -- `array_agg(...)[1]` rather than `min(...)`: there is no `min(uuid)` in
  -- PostgreSQL, and the count beside it is what decides anyway — a single match
  -- is the only one this accepts.
  select count(*), (array_agg(target.tournament_id))[1]
    into v_matches, v_tournament_id
    from public.provider_poll_targets target
   where target.provider = p_provider
     and target.enabled
     and p_request_url like '%' || target.path;

  if v_matches = 1 then
    return v_tournament_id;
  end if;

  return null;
end;
$season$;

revoke all on function predictor_internal.resolve_provider_response_season(
  text, text, jsonb)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The driver.
--
-- The caller contracts 117, 132 and the applier above have all been waiting
-- for. It walks decoded responses that have not been consumed, resolves the
-- season, and routes:
--
--   * a season this platform already holds fixtures for gets the kickoff
--     revision import and the result application;
--   * a season holding no fixtures at all gets contract 132's proposal
--     staging, because the first calendar is an administrator's decision and
--     always has been. That refusal is unchanged by the owner's amendment,
--     which is about RESULTS, not about what a competition consists of.
--
-- Bounded per run so one backlog cannot hold a transaction open for minutes,
-- and idempotent because a consumed response is recorded.
-- ---------------------------------------------------------------------------

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
              v_row.raw_response_id, p_now));

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

-- Every five minutes, on the same grid as the poll that produces the work, and
-- offset by two minutes so a dispatch and its consumption are not competing for
-- the same instant. A run with nothing to consume does nothing.
select cron.schedule(
  'provider-consume-decoded-responses',
  '2-59/5 * * * *',
  'select predictor_internal.consume_provider_responses();'
);

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
declare
  v_relation text;
begin
  foreach v_relation in array array[
    'provider_status_kinds',
    'provider_status_observations',
    'season_fixture_live_state',
    'season_fixture_result_sources',
    'provider_result_refusals',
    'provider_response_consumption'
  ]
  loop
    if not exists (
      select 1 from pg_catalog.pg_class relation
        join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
       where ns.nspname = 'predictor_internal'
         and relation.relname = v_relation
         and relation.relrowsecurity
    ) then
      raise exception '% must have row level security enabled', v_relation;
    end if;

    if exists (
      select 1 from information_schema.role_table_grants
       where table_schema = 'predictor_internal'
         and table_name = v_relation
         and grantee in ('anon', 'authenticated', 'service_role')
    ) then
      raise exception '% must not be reachable by a browser or service role', v_relation;
    end if;
  end loop;

  -- The vocabulary is the whole fail-closed argument, so an empty one would
  -- mean no result could ever be written and nothing would say why.
  if (select count(*) from predictor_internal.provider_status_kinds
       where kind = 'final') < 3 then
    raise exception 'every supported provider needs at least one final status token';
  end if;

  if exists (
    select 1 from predictor_internal.provider_status_kinds
     where kind = 'final'
     group by provider
    having count(*) > 2
  ) then
    raise exception 'a provider claiming many final tokens has not been measured';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'provider-consume-decoded-responses'
  ) then
    raise exception 'the provider consumption driver must be scheduled';
  end if;
end;
$$;

commit;
