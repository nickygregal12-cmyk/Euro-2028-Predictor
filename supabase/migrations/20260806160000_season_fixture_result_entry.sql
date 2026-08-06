-- Contract 125: a season fixture can be given a result.
--
-- ---------------------------------------------------------------------------
-- THE BLOCKER THIS IS
-- ---------------------------------------------------------------------------
--
-- Development holds real Premier League and Scottish Premiership data — 38
-- matchweeks and 380/198 fixtures per season, correctly linked and stored in
-- UTC. All 578 `season_fixtures` rows are `status = 'scheduled'` and not one
-- has a score, because **nothing in this repository can give one to them.**
--
-- Measured rather than assumed: no migration anywhere writes
-- `season_fixtures.home_score` or `away_score`. The only statement that writes
-- that table at all is contract 117's importer, and it sets `kickoff_at` and
-- nothing else. The three admin result RPCs — `admin_confirm_match_result`,
-- `admin_correct_match_result`, `admin_clear_match_result` — operate on
-- `public.matches`, which is the tournament shape; a season's points live in
-- `season_matchweek_scores` and never reach `matches`.
--
-- So every season surface downstream of a result is honest and empty: no
-- matchweek settles, the season leaderboard has nothing to rank, contract 122's
-- monthly and rolling-form tables have no settled matchweek to place, the
-- Championship's windows never settle, and the Matches surface shows every
-- fixture blank. One missing write holds all of it.
--
-- ---------------------------------------------------------------------------
-- SETTLEMENT IS ALREADY BUILT, AND THIS DELIBERATELY DOES NOT TOUCH IT
-- ---------------------------------------------------------------------------
--
-- `process_due_season_matchweek_scores` runs on `pg_cron` and re-derives every
-- league season on every run. Its own header says why there is no
-- "already scored" filter: "Full rederivation is what makes corrections work at
-- all." `settle_season_matchweek_scores` deletes a round's stored scores and
-- rewrites them from the card each time.
--
-- That is the whole reason this contract is small. It writes a result and
-- records that it did. It settles nothing, scores nothing, and rederives
-- nothing — a corrected result is picked up by the job that already exists, on
-- its next run, without this migration knowing anything about scoring.
--
-- ---------------------------------------------------------------------------
-- THE PROTECTED CONFIRMATION GATE, WHICH IS KEPT BY CONSTRUCTION
-- ---------------------------------------------------------------------------
--
-- ADR 0020 and this repository's boundaries are explicit: live and provider
-- data is provisional, and protected confirmation/correction remains the
-- official scoring and progression gate.
--
-- That holds here without a new mechanism, because of what contract 117 chose
-- not to do. The provider importer revises a KICKOFF and nothing else — it
-- creates no fixture, writes no `competition_round_id`, and has never had a
-- score column in its update. So after this contract there are exactly two
-- writers of a season fixture: the provider importer for the kickoff, and these
-- three functions for the result. The parity guard asserts that, and asserts it
-- against every migration rather than against this one.
--
-- The gate itself is `predictor_internal.require_result_admin()` — the SAME
-- authority the tournament path uses, reused rather than reimplemented. A
-- second admin model for the same act is how two answers to "who may confirm a
-- result" get created.
--
-- ---------------------------------------------------------------------------
-- WHAT A LEAGUE RESULT IS, AND WHY THE SIGNATURE IS SHORTER
-- ---------------------------------------------------------------------------
--
-- The tournament RPCs take a method, ninety-minute scores, extra-time scores
-- and penalties, because a knockout tie must produce a winner. A league fixture
-- cannot: it is ninety minutes and it may be drawn. So this takes one pair of
-- scores and no method, and the shorter signature is the rule rather than an
-- omission — ADR 0012 scores a season matchweek from the result of a league
-- match, and there is nothing else to record.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DOES NOT OWN
-- ---------------------------------------------------------------------------
--
-- The fixture LIFECYCLE. Marking a fixture postponed, abandoned or void is a
-- statement about whether it is being played, not about how it finished, and it
-- has its own consequences for the matchweek card. `confirm` accepts a fixture
-- that is scheduled or postponed — a postponed fixture eventually being played
-- is the ordinary case — and nothing here moves a fixture INTO those states.
--
-- A READ of the revision record. It is deliberately internal and unexposed:
-- contract 117's revision queue and contract 123's refresh-conflict queue are
-- both unread by any browser too, and one administrator surface should read all
-- three rather than this contract inventing a third shape for its own.

begin;

-- ---------------------------------------------------------------------------
-- The record.
--
-- Mirrors `public.match_result_revisions` — a per-fixture revision number, the
-- action, the result before and after, a reason and an actor. Internal rather
-- than public for the reason above; append-only in the strongest sense, since
-- unlike the two review queues there is nothing here to mark reviewed.
-- ---------------------------------------------------------------------------

create table predictor_internal.season_fixture_result_revisions (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id) on delete cascade,

  season_fixture_id uuid not null
    references public.season_fixtures(id) on delete cascade,

  revision integer not null check (revision > 0),

  action text not null
    check (action in ('confirm', 'correct', 'clear')),

  -- The whole result, not the columns: `{"status": ..., "home": ..., "away": ...}`.
  -- A column-per-field record would have to grow every time a fixture learns a
  -- new fact, and the point of this row is to say what the fixture looked like
  -- before and after, in one comparable shape.
  previous_result jsonb not null,
  new_result jsonb not null,

  reason text,

  actor_id uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),

  constraint season_fixture_result_revisions_fixture_revision_key
    unique (season_fixture_id, revision),

  -- A revision that changed nothing is not a revision.
  constraint season_fixture_result_revisions_changed
    check (previous_result is distinct from new_result)
);

comment on table predictor_internal.season_fixture_result_revisions is
  'Contract 125. Append-only record of every official season fixture result '
  'confirmed, corrected or cleared, with the result it replaced and who did it.';

alter table predictor_internal.season_fixture_result_revisions enable row level security;

revoke all on table predictor_internal.season_fixture_result_revisions
  from anon, authenticated, service_role;

create index season_fixture_result_revisions_fixture_idx
  on predictor_internal.season_fixture_result_revisions
     (season_fixture_id, revision desc);

create index season_fixture_result_revisions_season_idx
  on predictor_internal.season_fixture_result_revisions
     (tournament_id, recorded_at desc);

-- Evidence, and therefore immutable. Unlike contracts 117 and 123 there is no
-- reviewed flag, so no update is legitimate at all: a mistake is corrected by
-- recording another revision, which is the point of numbering them.
create or replace function predictor_internal.block_season_result_revision_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $immutable$
begin
  raise exception 'A season fixture result revision may not be % — record another revision instead',
    lower(tg_op)
    using errcode = '42501';
end;
$immutable$;

revoke all on function predictor_internal.block_season_result_revision_rewrite()
  from public, anon, authenticated, service_role;

create trigger block_season_result_revision_rewrite
before update or delete on predictor_internal.season_fixture_result_revisions
for each row
execute function predictor_internal.block_season_result_revision_rewrite();

-- ---------------------------------------------------------------------------
-- The one writer.
--
-- All three public entry points delegate here, so the state machine, the
-- revision numbering and the record exist once. The gate is NOT here — it is on
-- each public function, which is the tournament path's arrangement and keeps
-- this callable by a future scheduled correction path that authorises
-- differently.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.record_season_fixture_result(
  p_season_fixture_id uuid,
  p_action text,
  p_home smallint,
  p_away smallint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $record$
declare
  v_fixture record;
  v_kind text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_previous jsonb;
  v_new jsonb;
  v_revision integer;
  v_status text;
  v_home smallint;
  v_away smallint;
begin
  if p_action not in ('confirm', 'correct', 'clear') then
    raise exception 'Unknown season result action %', p_action
      using errcode = '22023';
  end if;

  select fixture.id, fixture.tournament_id, fixture.competition_round_id,
         fixture.status, fixture.home_score, fixture.away_score
    into v_fixture
    from public.season_fixtures fixture
    where fixture.id = p_season_fixture_id
    for update;

  if not found then
    raise exception 'Season fixture % does not exist', p_season_fixture_id
      using errcode = '23503';
  end if;

  select season.kind into v_kind
    from public.tournaments season
    where season.id = v_fixture.tournament_id;

  -- Belt and braces: `assert_season_fixture_shape` already refuses a season
  -- fixture outside a league season, so this is unreachable from stored data
  -- and is still checked, because the whole point of this function is that it
  -- is the only thing that may write an official season score.
  if v_kind is distinct from 'league_season' then
    raise exception 'Season fixture % is not in a league season', p_season_fixture_id
      using errcode = '23514';
  end if;

  v_previous := pg_catalog.jsonb_build_object(
    'status', v_fixture.status,
    'home', v_fixture.home_score,
    'away', v_fixture.away_score);

  if p_action = 'clear' then
    if v_fixture.status <> 'played' then
      raise exception
        'Season fixture % holds no result to clear; it is %',
        p_season_fixture_id, v_fixture.status
        using errcode = '23514';
    end if;

    v_status := 'scheduled';
    v_home := null;
    v_away := null;
  else
    if p_home is null or p_away is null then
      raise exception 'A season result needs both scores'
        using errcode = '22023';
    end if;

    if p_home < 0 or p_away < 0 then
      raise exception 'A season result cannot be negative'
        using errcode = '22023';
    end if;

    if p_action = 'confirm' then
      -- A postponed fixture that is eventually played is the ordinary case and
      -- is accepted. A fixture that already holds a result is not: replacing it
      -- silently would lose the correction's own audit trail, which is the one
      -- thing this record exists for.
      if v_fixture.status not in ('scheduled', 'postponed') then
        raise exception
          'Season fixture % is % and already holds a result; correct it rather than confirming again',
          p_season_fixture_id, v_fixture.status
          using errcode = '23514';
      end if;
    else
      if v_fixture.status <> 'played' then
        raise exception
          'Season fixture % holds no confirmed result to correct; it is %',
          p_season_fixture_id, v_fixture.status
          using errcode = '23514';
      end if;

      if v_fixture.home_score = p_home and v_fixture.away_score = p_away then
        raise exception 'That correction changes nothing'
          using errcode = '23514';
      end if;
    end if;

    v_status := 'played';
    v_home := p_home;
    v_away := p_away;
  end if;

  -- A first confirmation needs no justification; changing or removing a result
  -- that has already been scored does. Deliberately stricter than the
  -- tournament path, which takes an optional reason everywhere: by the time a
  -- season result is corrected, points have been banked against it and someone
  -- will ask why they moved.
  if p_action in ('correct', 'clear') and v_reason is null then
    raise exception 'A reason is required to % a season result', p_action
      using errcode = '22023';
  end if;

  v_new := pg_catalog.jsonb_build_object(
    'status', v_status, 'home', v_home, 'away', v_away);

  update public.season_fixtures
     set status = v_status,
         home_score = v_home,
         away_score = v_away
   where id = p_season_fixture_id;

  select coalesce(max(existing.revision), 0) + 1
    into v_revision
    from predictor_internal.season_fixture_result_revisions existing
    where existing.season_fixture_id = p_season_fixture_id;

  insert into predictor_internal.season_fixture_result_revisions (
    tournament_id, season_fixture_id, revision, action,
    previous_result, new_result, reason, actor_id
  ) values (
    v_fixture.tournament_id, p_season_fixture_id, v_revision, p_action,
    v_previous, v_new, v_reason, (select auth.uid())
  );

  -- No settlement call. `process_due_season_matchweek_scores` rederives every
  -- league season on every run precisely so a correction is picked up without
  -- its writer knowing anything about scoring.
  return pg_catalog.jsonb_build_object(
    'fixtureId', p_season_fixture_id,
    'roundId', v_fixture.competition_round_id,
    'action', p_action,
    'revision', v_revision,
    'previous', v_previous,
    'result', v_new);
end;
$record$;

revoke all on function predictor_internal.record_season_fixture_result(
  uuid, text, smallint, smallint, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The three administrator entry points.
--
-- Same arrangement as the tournament's: revoked from everything, granted to
-- `authenticated`, and gated inside on the shared result-admin capability. The
-- grant is not the boundary; `require_result_admin()` is.
-- ---------------------------------------------------------------------------

create or replace function public.admin_confirm_season_fixture_result(
  p_season_fixture_id uuid,
  p_home smallint,
  p_away smallint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();
  return predictor_internal.record_season_fixture_result(
    p_season_fixture_id, 'confirm', p_home, p_away, p_reason);
end;
$$;

create or replace function public.admin_correct_season_fixture_result(
  p_season_fixture_id uuid,
  p_home smallint,
  p_away smallint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();
  return predictor_internal.record_season_fixture_result(
    p_season_fixture_id, 'correct', p_home, p_away, p_reason);
end;
$$;

create or replace function public.admin_clear_season_fixture_result(
  p_season_fixture_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform predictor_internal.require_result_admin();
  return predictor_internal.record_season_fixture_result(
    p_season_fixture_id, 'clear', null, null, p_reason);
end;
$$;

revoke all on function public.admin_confirm_season_fixture_result(uuid, smallint, smallint, text)
  from public, anon, authenticated;
revoke all on function public.admin_correct_season_fixture_result(uuid, smallint, smallint, text)
  from public, anon, authenticated;
revoke all on function public.admin_clear_season_fixture_result(uuid, text)
  from public, anon, authenticated;

grant execute on function public.admin_confirm_season_fixture_result(uuid, smallint, smallint, text)
  to authenticated;
grant execute on function public.admin_correct_season_fixture_result(uuid, smallint, smallint, text)
  to authenticated;
grant execute on function public.admin_clear_season_fixture_result(uuid, text)
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
       and relation.relname = 'season_fixture_result_revisions'
       and relation.relrowsecurity
  ) then
    raise exception 'season_fixture_result_revisions must have row level security enabled';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'predictor_internal'
       and table_name = 'season_fixture_result_revisions'
       and grantee in ('anon', 'authenticated', 'service_role')
  ) then
    raise exception 'a browser or service role can reach the season result record';
  end if;

  -- This migration adds the ability to record a result; it must record none.
  if exists (select 1 from predictor_internal.season_fixture_result_revisions) then
    raise exception 'this migration must record no season result';
  end if;

  -- The gate, asserted rather than assumed. All three entry points must call
  -- the shared authority; one that forgot would be granted to `authenticated`
  -- and open to every signed-in player.
  if exists (
    select 1
      from unnest(array[
        'public.admin_confirm_season_fixture_result(uuid,smallint,smallint,text)',
        'public.admin_correct_season_fixture_result(uuid,smallint,smallint,text)',
        'public.admin_clear_season_fixture_result(uuid,text)'
      ]) as entry(signature)
     where pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(entry.signature)::oid)
             not like '%require_result_admin%'
  ) then
    raise exception 'a season result entry point does not call require_result_admin';
  end if;
end;
$$;

commit;
