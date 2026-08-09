-- Contract 138: an administrator can see what the provider path refused, and
-- clear it.
--
-- ---------------------------------------------------------------------------
-- THE DEFECT, MEASURED ON THIS COMMIT
-- ---------------------------------------------------------------------------
--
-- There are now SEVEN append-only review queues in this database and no browser
-- read for any of them:
--
--   contract 117  season_fixture_revisions          kickoffs a provider moved
--   contract 123  round_window_refresh_conflicts    window refreshes refused
--   contract 125  season_fixture_result_revisions   every official result change
--   contract 132  provider_fixture_proposals        calendars awaiting approval
--   contract 135  provider_result_refusals          results the platform declined
--   contract 135  provider_status_observations      status tokens we cannot read
--   contract 135  provider_response_consumption     what the driver did with each response
--
-- Measured rather than assumed: of the 75 contracted browser RPCs, the only
-- functions that name any of these relations are contract 132's two DECISION
-- functions, which write. So an administrator can approve a calendar they
-- cannot see, and cannot see the other six at all.
--
-- Contract 135 made this worse in a specific way, and that is the reason this
-- contract comes next rather than later. It refuses SILENTLY by design: when a
-- provider result is declined because an administrator owns the fixture, or
-- because a status token has never been measured, the refusal is recorded and
-- nothing else happens. Until this read exists, the answer to "why did that
-- match never settle?" requires database access.
--
-- ---------------------------------------------------------------------------
-- WHY IT ALSO WRITES
-- ---------------------------------------------------------------------------
--
-- Contracts 117 and 123 both carry `reviewed_at` with the same comment: "Null
-- until an administrator has looked. Unreviewed rows are the queue." Nothing
-- has ever set it.
--
-- So a read alone would ship the same half-thing this contract exists to fix —
-- a queue nobody can clear grows until it is ignored, and an unreviewed count
-- that only ever rises is indistinguishable from a broken counter. The
-- acknowledgement is therefore in the same contract as the read.
--
-- Who acknowledged what is recorded ONCE, uniformly, in its own append-only
-- relation rather than as columns on five different queues. That also gives
-- contracts 117 and 123 an actor they never had, without altering either table.
--
-- ---------------------------------------------------------------------------
-- WHAT IT IS NOT
-- ---------------------------------------------------------------------------
--
-- It is not a second decision authority. Acknowledging a refusal does not apply
-- the result the provider was refused; acknowledging a proposal does not
-- approve a calendar. Those remain contract 132's approve/reject and the
-- administrator's own result RPCs. This says "a human has read this", and
-- nothing more — which is exactly why it is safe to grant more widely than a
-- decision would be.
--
-- `season_fixture_result_revisions` and `provider_fixture_proposals` are
-- readable here and NOT acknowledgeable. The first is an audit trail rather
-- than a queue — it has no end state to reach. The second already has a
-- lifecycle that contract 132 owns, and a second way to mark it handled is how
-- two answers to "is this decided?" get created.

begin;

-- ---------------------------------------------------------------------------
-- The three contract 135 queues gain the marker its two predecessors already
-- carry. Additive, and null on every existing row, which is correct: nothing
-- has been reviewed.
-- ---------------------------------------------------------------------------

alter table predictor_internal.provider_result_refusals
  add column reviewed_at timestamptz;

alter table predictor_internal.provider_status_observations
  add column reviewed_at timestamptz;

alter table predictor_internal.provider_response_consumption
  add column reviewed_at timestamptz;

comment on column predictor_internal.provider_result_refusals.reviewed_at is
  'Contract 138. Null until an administrator has looked. Unreviewed rows are the queue.';

-- ---------------------------------------------------------------------------
-- Who looked, at what, and why.
--
-- One relation for every queue kind, so contracts 117 and 123 gain an actor
-- without either table being altered. Append-only: acknowledging twice records
-- twice, because that is a true account of what happened.
-- ---------------------------------------------------------------------------

create table predictor_internal.provider_review_acknowledgements (
  id uuid primary key default gen_random_uuid(),

  kind text not null,
  item_id uuid not null,

  tournament_id uuid references public.tournaments(id) on delete cascade,

  actor_id uuid references auth.users(id) on delete set null,
  note text,

  acknowledged_at timestamptz not null default clock_timestamp(),

  constraint provider_review_acknowledgements_kind_allowed
    check (kind in (
      'result_refusal',
      'status_observation',
      'consumption',
      'kickoff_revision',
      'window_conflict')),

  constraint provider_review_acknowledgements_note_bound
    check (note is null or char_length(btrim(note)) between 1 and 500)
);

comment on table predictor_internal.provider_review_acknowledgements is
  'Contract 138. Append-only record of an administrator marking a provider '
  'review item as seen. Never a decision about the item itself.';

alter table predictor_internal.provider_review_acknowledgements enable row level security;

revoke all on table predictor_internal.provider_review_acknowledgements
  from public, anon, authenticated, service_role;

create index provider_review_acknowledgements_item_idx
  on predictor_internal.provider_review_acknowledgements (kind, item_id);

-- ---------------------------------------------------------------------------
-- The read.
--
-- Bounded three ways, because an operator surface that can ask for everything
-- becomes the slowest query in the database on the day it is most needed: a
-- season is required, each section is capped, and the caps are applied per
-- section rather than to a union so one noisy queue cannot crowd out the
-- others.
--
-- Every section carries an `unreviewed` count alongside its rows, so the
-- surface can show "3 of altogether 240" honestly rather than implying the
-- capped list is the whole queue.
-- ---------------------------------------------------------------------------

create or replace function public.get_provider_review_queues(
  p_tournament_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $review$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_season record;
begin
  perform predictor_internal.require_competition_admin();

  if p_tournament_id is null then
    raise exception 'A competition season is required' using errcode = '22023';
  end if;

  select season.id, competition.name as competition_name,
         season.season_key, season.kind
    into v_season
    from public.tournaments season
    join public.competitions competition on competition.id = season.competition_id
   where season.id = p_tournament_id;

  if not found then
    raise exception 'That competition season does not exist' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'competition', jsonb_build_object(
      'id', v_season.id,
      'name', v_season.competition_name,
      'season_key', v_season.season_key,
      'kind', v_season.kind),
    'server_now', now(),
    'limit', v_limit,

    -- Contract 135. Results the platform declined to apply. The
    -- administrator-owned reason is the expected one and is not a problem;
    -- the others are.
    'result_refusals', jsonb_build_object(
      'unreviewed', (
        select count(*)::integer from predictor_internal.provider_result_refusals r
         where r.tournament_id = p_tournament_id and r.reviewed_at is null),
      'items', coalesce((
        select jsonb_agg(item order by item->>'refused_at' desc)
          from (
            select jsonb_build_object(
                     'id', r.id,
                     'reason', r.reason,
                     'provider', r.provider,
                     'provider_status', r.provider_status,
                     'detail', r.detail,
                     'refused_at', r.refused_at,
                     'fixture', case when r.season_fixture_id is not null then jsonb_build_object(
                       'id', r.season_fixture_id,
                       'home', home.name,
                       'away', away.name,
                       'kickoff_at', fixture.kickoff_at) end) as item
              from predictor_internal.provider_result_refusals r
              left join public.season_fixtures fixture on fixture.id = r.season_fixture_id
              left join public.teams home on home.id = fixture.home_team_id
              left join public.teams away on away.id = fixture.away_team_id
             where r.tournament_id = p_tournament_id
               and r.reviewed_at is null
             order by r.refused_at desc
             limit v_limit) capped), '[]'::jsonb)),

    -- Contract 135. Status tokens with no mapping. A season that never settles
    -- while these accumulate is the same fact told twice.
    'status_observations', jsonb_build_object(
      'unreviewed', (
        select count(*)::integer from predictor_internal.provider_status_observations o
         where o.tournament_id = p_tournament_id and o.reviewed_at is null),
      'items', coalesce((
        select jsonb_agg(item order by item->>'observed_at' desc)
          from (
            select jsonb_build_object(
                     'id', o.id,
                     'provider', o.provider,
                     'provider_status', o.provider_status,
                     'fixtures', o.fixtures,
                     'observed_at', o.observed_at) as item
              from predictor_internal.provider_status_observations o
             where o.tournament_id = p_tournament_id
               and o.reviewed_at is null
             order by o.observed_at desc
             limit v_limit) capped), '[]'::jsonb)),

    -- Contract 135. Only the outcomes worth a human's attention. An applied
    -- response is not a queue item.
    'consumption_problems', jsonb_build_object(
      'unreviewed', (
        select count(*)::integer from predictor_internal.provider_response_consumption c
         where c.tournament_id is not distinct from p_tournament_id
           and c.reviewed_at is null
           and c.outcome in ('failed', 'unresolved_season', 'not_a_league_season',
                             'unmapped_identifiers')),
      'items', coalesce((
        select jsonb_agg(item order by item->>'consumed_at' desc)
          from (
            select jsonb_build_object(
                     'id', c.processing_id,
                     'outcome', c.outcome,
                     'report', c.report,
                     'consumed_at', c.consumed_at) as item
              from predictor_internal.provider_response_consumption c
             where c.tournament_id is not distinct from p_tournament_id
               and c.reviewed_at is null
               and c.outcome in ('failed', 'unresolved_season', 'not_a_league_season',
                                 'unmapped_identifiers')
             order by c.consumed_at desc
             limit v_limit) capped), '[]'::jsonb)),

    -- Contract 117. Kickoffs a provider moved automatically.
    'kickoff_revisions', jsonb_build_object(
      'unreviewed', (
        select count(*)::integer from predictor_internal.season_fixture_revisions v
         where v.tournament_id = p_tournament_id and v.reviewed_at is null),
      'items', coalesce((
        select jsonb_agg(item order by item->>'applied_at' desc)
          from (
            select jsonb_build_object(
                     'id', v.id,
                     'provider', v.provider,
                     'previous_kickoff_at', v.previous_kickoff_at,
                     'new_kickoff_at', v.new_kickoff_at,
                     'applied_at', v.applied_at,
                     'fixture', jsonb_build_object(
                       'id', v.season_fixture_id,
                       'home', home.name,
                       'away', away.name)) as item
              from predictor_internal.season_fixture_revisions v
              left join public.season_fixtures fixture on fixture.id = v.season_fixture_id
              left join public.teams home on home.id = fixture.home_team_id
              left join public.teams away on away.id = fixture.away_team_id
             where v.tournament_id = p_tournament_id
               and v.reviewed_at is null
             order by v.applied_at desc
             limit v_limit) capped), '[]'::jsonb)),

    -- Contract 123. Window refreshes that were refused rather than applied.
    'window_conflicts', jsonb_build_object(
      'unreviewed', (
        select count(*)::integer from predictor_internal.round_window_refresh_conflicts w
         where w.tournament_id = p_tournament_id and w.reviewed_at is null),
      'items', coalesce((
        select jsonb_agg(item order by item->>'detected_at' desc)
          from (
            select jsonb_build_object(
                     'id', w.id,
                     'round', round.label,
                     'retained_opens_at', w.retained_opens_at,
                     'retained_closes_at', w.retained_closes_at,
                     'proposed_opens_at', w.proposed_opens_at,
                     'proposed_closes_at', w.proposed_closes_at,
                     'blocked_by', blocker.label,
                     'detected_at', w.detected_at) as item
              from predictor_internal.round_window_refresh_conflicts w
              left join public.competition_rounds round on round.id = w.competition_round_id
              left join public.competition_rounds blocker on blocker.id = w.blocking_round_id
             where w.tournament_id = p_tournament_id
               and w.reviewed_at is null
             order by w.detected_at desc
             limit v_limit) capped), '[]'::jsonb)),

    -- Contract 132. Read only: its decision lifecycle is approve/reject and
    -- stays there.
    'pending_calendar_proposals', (
      select count(*)::integer from predictor_internal.provider_fixture_proposals p
       where p.tournament_id = p_tournament_id and p.state = 'pending'),

    -- Contract 125. An audit trail rather than a queue, so it is shown as
    -- recent history with no unreviewed count and no acknowledgement.
    'recent_result_changes', coalesce((
      select jsonb_agg(item order by item->>'recorded_at' desc)
        from (
          select jsonb_build_object(
                   'id', rev.id,
                   'action', rev.action,
                   'revision', rev.revision,
                   'previous', rev.previous_result,
                   'result', rev.new_result,
                   'reason', rev.reason,
                   'by', case when source.provider is not null
                              then source.provider else 'administrator' end,
                   'recorded_at', rev.recorded_at,
                   'fixture', jsonb_build_object(
                     'id', rev.season_fixture_id,
                     'home', home.name,
                     'away', away.name)) as item
            from predictor_internal.season_fixture_result_revisions rev
            left join predictor_internal.season_fixture_result_sources source
              on source.season_fixture_id = rev.season_fixture_id
             and source.revision = rev.revision
            left join public.season_fixtures fixture on fixture.id = rev.season_fixture_id
            left join public.teams home on home.id = fixture.home_team_id
            left join public.teams away on away.id = fixture.away_team_id
           where rev.tournament_id = p_tournament_id
           order by rev.recorded_at desc
           limit v_limit) capped), '[]'::jsonb)
  );
end;
$review$;

revoke all on function public.get_provider_review_queues(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_provider_review_queues(uuid, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- The acknowledgement.
--
-- One kind at a time and an explicit list of identifiers, rather than a
-- "clear everything" button: an operator who marks a queue read without seeing
-- what was in it has not reviewed anything, and the next real refusal arrives
-- into a queue that is already trusted to be empty.
--
-- Idempotent in the way that matters — acknowledging an already-reviewed item
-- leaves `reviewed_at` at its first value, so the record of when a human first
-- looked cannot be moved by looking again.
-- ---------------------------------------------------------------------------

create or replace function public.acknowledge_provider_review_items(
  p_kind text,
  p_ids uuid[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $ack$
declare
  v_actor uuid := (select auth.uid());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_ids uuid[] := coalesce(p_ids, array[]::uuid[]);
  v_marked integer := 0;
  v_tournament_id uuid;
begin
  perform predictor_internal.require_competition_admin();

  if p_kind not in ('result_refusal', 'status_observation', 'consumption',
                    'kickoff_revision', 'window_conflict') then
    raise exception 'Unknown review queue %', p_kind using errcode = '22023';
  end if;

  if array_length(v_ids, 1) is null then
    raise exception 'At least one item is required' using errcode = '22023';
  end if;

  if array_length(v_ids, 1) > 200 then
    raise exception 'At most 200 items may be acknowledged at once'
      using errcode = '22023';
  end if;

  if p_kind = 'result_refusal' then
    update predictor_internal.provider_result_refusals r
       set reviewed_at = now()
     where r.id = any (v_ids) and r.reviewed_at is null;
    get diagnostics v_marked = row_count;

    insert into predictor_internal.provider_review_acknowledgements
      (kind, item_id, tournament_id, actor_id, note)
    select p_kind, r.id, r.tournament_id, v_actor, v_note
      from predictor_internal.provider_result_refusals r
     where r.id = any (v_ids);

  elsif p_kind = 'status_observation' then
    update predictor_internal.provider_status_observations o
       set reviewed_at = now()
     where o.id = any (v_ids) and o.reviewed_at is null;
    get diagnostics v_marked = row_count;

    insert into predictor_internal.provider_review_acknowledgements
      (kind, item_id, tournament_id, actor_id, note)
    select p_kind, o.id, o.tournament_id, v_actor, v_note
      from predictor_internal.provider_status_observations o
     where o.id = any (v_ids);

  elsif p_kind = 'consumption' then
    update predictor_internal.provider_response_consumption c
       set reviewed_at = now()
     where c.processing_id = any (v_ids) and c.reviewed_at is null;
    get diagnostics v_marked = row_count;

    insert into predictor_internal.provider_review_acknowledgements
      (kind, item_id, tournament_id, actor_id, note)
    select p_kind, c.processing_id, c.tournament_id, v_actor, v_note
      from predictor_internal.provider_response_consumption c
     where c.processing_id = any (v_ids);

  elsif p_kind = 'kickoff_revision' then
    update predictor_internal.season_fixture_revisions v
       set reviewed_at = now()
     where v.id = any (v_ids) and v.reviewed_at is null;
    get diagnostics v_marked = row_count;

    insert into predictor_internal.provider_review_acknowledgements
      (kind, item_id, tournament_id, actor_id, note)
    select p_kind, v.id, v.tournament_id, v_actor, v_note
      from predictor_internal.season_fixture_revisions v
     where v.id = any (v_ids);

  else
    update predictor_internal.round_window_refresh_conflicts w
       set reviewed_at = now()
     where w.id = any (v_ids) and w.reviewed_at is null;
    get diagnostics v_marked = row_count;

    insert into predictor_internal.provider_review_acknowledgements
      (kind, item_id, tournament_id, actor_id, note)
    select p_kind, w.id, w.tournament_id, v_actor, v_note
      from predictor_internal.round_window_refresh_conflicts w
     where w.id = any (v_ids);
  end if;

  return jsonb_build_object(
    'kind', p_kind,
    'requested', array_length(v_ids, 1),
    'marked', v_marked);
end;
$ack$;

revoke all on function public.acknowledge_provider_review_items(text, uuid[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.acknowledge_provider_review_items(text, uuid[], text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace ns on ns.oid = relation.relnamespace
     where ns.nspname = 'predictor_internal'
       and relation.relname = 'provider_review_acknowledgements'
       and relation.relrowsecurity
  ) then
    raise exception 'provider_review_acknowledgements must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'predictor_internal'
       and table_name = 'provider_review_acknowledgements'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'provider_review_acknowledgements must not be browser reachable';
  end if;

  -- The gate is the boundary, not the grant. Both entry points are granted to
  -- `authenticated` exactly as every other admin RPC here is, and refuse inside.
  if not exists (
    select 1 from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('get_provider_review_queues', 'acknowledge_provider_review_items')
       and pg_catalog.pg_get_functiondef(p.oid) like '%require_competition_admin%'
     having count(*) = 2
  ) then
    raise exception 'both review entry points must call require_competition_admin';
  end if;
end;
$$;

commit;
