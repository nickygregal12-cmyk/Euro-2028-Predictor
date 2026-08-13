-- Contract 186: a season Predictor Championship records where its group stage
-- ends.
--
-- This is `CUP-002`'s prerequisite and nothing else. It creates no driver, it
-- qualifies nobody, it touches no gate, and it leaves
-- `admin_finalise_predictor_cup_groups` byte-for-byte as contract 184 left it.
--
-- ---------------------------------------------------------------------------
-- THE MEASUREMENT THE REGISTER GOT SLIGHTLY WRONG, AND WHY IT MATTERS
-- ---------------------------------------------------------------------------
--
-- `docs/quality/accepted-requirements.md` and `docs/roadmap.md` both say the
-- group-stage span is "stored NOWHERE" and that `launch_season_cup` "computes
-- leagueRounds and discards it". Measured against the installed catalogue on
-- 12 August 2026, that is not quite true, and the difference decides what this
-- migration has to do:
--
--   * `launch_season_cup` writes it to `public.bonus_competition_audit`, under
--     action `championship_launched`, as `detail->>'leagueRounds'`;
--   * `launch_season_cup_groups` writes it to the same table, under action
--     `championship_group_stage_drawn`, as `detail->>'roundsNeeded'`.
--
-- So the span is RECORDED. What it is not is an AUTHORITY. It lives in an
-- untyped `jsonb` column, on an append-only log that also carries every other
-- competition action, under two different spellings, with no constraint of any
-- kind on either. A qualification gate reading that would be a gate whose
-- correctness depends on a log entry nothing checks — and the two spellings are
-- exactly the shape that produces a driver correct for one launcher and silently
-- wrong for the other.
--
-- The correction cuts both ways, and the second half is the useful one: because
-- the plan really was recorded, the BACKFILL below is an exact read of what each
-- competition was launched with, not a reconstruction. Had the register been
-- right, every already-launched competition would have needed a guess.
--
-- ---------------------------------------------------------------------------
-- WHY THE DERIVATION IS NOT AVAILABLE
-- ---------------------------------------------------------------------------
--
-- Restated because it is the reason this contract exists at all. Neither
-- counting windows nor counting fixtures answers "where does the group stage
-- end" once a competition has moved on:
--
--   * contract 124's split appends further windows and further `stage = 'group'`
--     fixtures beyond the initial phase, so both counts keep growing;
--   * `CUP-002` will itself append knockout windows past the group stage, so
--     after it exists `max(sequence)` is the end of the KNOCKOUT.
--
-- The span therefore has to be captured at launch, when it is unambiguous, and
-- it has to be immutable afterwards, because fixtures get played against it.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS IS NOT
-- ---------------------------------------------------------------------------
--
-- It is not a second format authority. `select_season_cup_format` remains the
-- only function that decides a competition's shape; this records what that
-- decision WAS for one competition, in one place, once. Nothing here computes a
-- format, a draw, a schedule or a table.
--
-- It grants nothing to any browser role, adds no browser-reachable read, and
-- schedules no job.

begin;

-- ===========================================================================
-- 1. The launch record
-- ===========================================================================
--
-- A table rather than a column, for two reasons.
--
-- There is no correct column. The span is per COMPETITION: `bonus_cup_groups`
-- holds one row per group per phase, so a multi-group Championship would carry
-- the same number on five rows with nothing keeping them equal, and
-- `bonus_competitions` is the game-neutral container that Last Man Standing and
-- the Match Predictor share, where a Championship-only span does not belong.
--
-- And the register names the absence of a launch-record table as the defect, in
-- those words. This is that table, kept to the one question it exists to answer.

create table if not exists public.bonus_cup_launches (
  competition_id uuid primary key
    references public.bonus_competitions(id) on delete cascade,

  -- Which shape `select_season_cup_format` chose. `CUP-002` needs this and not
  -- only the span: a `single_group` competition finishes with contract 124's
  -- SPLIT and must never be qualified into a knockout, and a `groups`
  -- competition is the one that brackets. Deriving it later from the group count
  -- would be an inference from data the split is allowed to change.
  format_kind text not null,

  -- The last `bonus_competition_windows.sequence` belonging to the group stage.
  -- A sequence rather than a round count, because that is the form the three
  -- hard-coded expressions in `admin_finalise_predictor_cup_groups` compare
  -- against. At launch the two are equal — the group stage is the first thing
  -- scheduled, so its windows are 1..N — and the pgTAP suite asserts that rather
  -- than leaving it as a comment.
  group_stage_last_sequence integer not null,

  launched_at timestamptz not null default now(),

  constraint bonus_cup_launches_format_allowed
    check (format_kind in ('single_group', 'groups')),

  -- Twenty groups of twenty is ADR 0014's ceiling and a double round-robin of
  -- twenty is thirty-eight matchdays; a league season supplies at most that many
  -- matchweeks anyway. The bound is loose on purpose: it refuses nonsense
  -- without pretending to know the format's own arithmetic, which
  -- `select_season_cup_format` owns.
  constraint bonus_cup_launches_sequence_range
    check (group_stage_last_sequence between 1 and 200)
);

alter table public.bonus_cup_launches enable row level security;
revoke all on table public.bonus_cup_launches from public, anon, authenticated;

comment on table public.bonus_cup_launches is
  'Contract 186. Where one season Predictor Championship''s group stage ends, '
  'captured at launch because no derivation survives contract 124''s split or '
  'CUP-002''s knockout windows. Written by the two launchers, read by the '
  'qualification gate, never by a browser.';

comment on column public.bonus_cup_launches.group_stage_last_sequence is
  'The last bonus_competition_windows.sequence of the group stage. Measured '
  'from the windows that exist after generation rather than assumed from the '
  'planned round count, so a competition whose calendar did not start at one '
  'records what it actually has.';

-- ---------------------------------------------------------------------------
-- Immutable once written
-- ---------------------------------------------------------------------------
--
-- The same reasoning `block_bonus_audit_mutation` uses, and a stronger case:
-- predictions are made against fixtures placed inside this span, so a span that
-- can be edited afterwards can retrospectively move a fixture from the group
-- stage into the knockout. A relaunch is already refused, so nothing legitimate
-- ever needs to update this row.
--
-- DELETE is deliberately NOT blocked. The competition's own deletion cascades
-- here, and a trigger refusing that would make a competition undeletable while
-- protecting a record whose subject has gone.

create or replace function predictor_internal.block_cup_launch_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $block$
begin
  raise exception
    'A Championship launch record is immutable; the draw it describes cannot be redrawn'
    using errcode = '23514';
end;
$block$;

revoke all on function predictor_internal.block_cup_launch_update()
  from public, anon, authenticated, service_role;

drop trigger if exists bonus_cup_launches_immutable on public.bonus_cup_launches;
create trigger bonus_cup_launches_immutable
  before update on public.bonus_cup_launches
  for each row execute function predictor_internal.block_cup_launch_update();

-- ===========================================================================
-- 2. The one place anything asks the question
-- ===========================================================================
--
-- `CUP-002` replaces three hard-coded tournament expressions. Three call sites
-- reading the table directly would be three chances to spell the question
-- differently, which is the drift contract 169 was written to correct. One
-- function, and a null answer that a caller must handle rather than a zero it
-- can accidentally arithmetic with.

create or replace function predictor_internal.cup_group_stage_last_sequence(
  p_competition_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $span$
  select launch.group_stage_last_sequence
    from public.bonus_cup_launches launch
   where launch.competition_id = p_competition_id;
$span$;

comment on function predictor_internal.cup_group_stage_last_sequence(uuid) is
  'Contract 186. The last window sequence of a season Championship''s group '
  'stage, or null when the competition has no launch record — which a caller '
  'must refuse on rather than treat as zero.';

revoke all on function predictor_internal.cup_group_stage_last_sequence(uuid)
  from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. Both launchers write it
-- ===========================================================================
--
-- Patched from the INSTALLED definition rather than restated from the committed
-- text, in contract 60's idiom and for contract 184's reason. Restating a
-- function from its original migration is how contract 184's first draft
-- reverted contract 60 entirely; these two happen to have their text on disk,
-- but a patch that proves its own round trip is correct whether or not that is
-- true, and it bounds the change without enumerating what did not move.
--
-- The proof is the reverse replacement: strip the added block back out and the
-- result must equal the original byte for byte. That is what makes "this changed
-- nothing else" a measurement rather than a claim.

do $patch$
declare
  v_target text;
  v_original text;
  v_patched text;
  v_anchor text;
  v_addition text;
begin
  foreach v_target in array array[
    'predictor_internal.launch_season_cup(uuid)',
    'predictor_internal.launch_season_cup_groups(uuid)'
  ] loop
    v_original := pg_catalog.pg_get_functiondef(v_target::regprocedure);

    if v_target like '%_groups(uuid)' then
      v_anchor :=
        '  insert into public.bonus_competition_audit (competition_id, action, detail)' || chr(10) ||
        '  values (' || chr(10) ||
        '    p_competition_id,' || chr(10) ||
        '    ''championship_group_stage_drawn'',';
    else
      v_anchor :=
        '  insert into public.bonus_competition_audit (competition_id, action, detail)' || chr(10) ||
        '  values (' || chr(10) ||
        '    p_competition_id,' || chr(10) ||
        '    ''championship_launched'',';
    end if;

    -- Fail closed. An anchor that is not there means the function has moved
    -- since this was written, and patching a function you cannot find your place
    -- in is how a migration silently half-applies.
    if pg_catalog.strpos(v_original, v_anchor) = 0 then
      raise exception
        'Contract 186 cannot find its anchor in %; the function has changed and the patch must be rewritten',
        v_target
        using errcode = '23514';
    end if;

    if pg_catalog.strpos(v_original, 'bonus_cup_launches') > 0 then
      raise exception 'Contract 186 is already applied to %', v_target
        using errcode = '23505';
    end if;

    -- The span is MEASURED from the windows that now exist rather than taken
    -- from the planned round count, so the record describes the calendar the
    -- competition actually got. The two agree on every ordinary launch, which
    -- `234_cup_group_stage_span.sql` asserts rather than assumes.
    v_addition :=
      '  -- Contract 186 begin' || chr(10) ||
      '  insert into public.bonus_cup_launches (' || chr(10) ||
      '    competition_id, format_kind, group_stage_last_sequence' || chr(10) ||
      '  )' || chr(10) ||
      '  select' || chr(10) ||
      '    p_competition_id,' || chr(10) ||
      '    ' || case when v_target like '%_groups(uuid)'
                     then '''groups'''
                     else '''single_group''' end || ',' || chr(10) ||
      '    pg_catalog.max(window_row.sequence)' || chr(10) ||
      '  from public.bonus_competition_windows window_row' || chr(10) ||
      '  where window_row.competition_id = p_competition_id' || chr(10) ||
      '  on conflict (competition_id) do nothing;' || chr(10) ||
      '  -- Contract 186 end' || chr(10) ||
      chr(10);

    v_patched := pg_catalog.replace(v_original, v_anchor, v_addition || v_anchor);

    -- The round trip. Reversing the replacement must reproduce the original
    -- exactly; if it does not, something other than the addition moved.
    if pg_catalog.replace(v_patched, v_addition, '') is distinct from v_original then
      raise exception
        'Contract 186''s patch of % does not reverse cleanly and will not be applied',
        v_target
        using errcode = '23514';
    end if;

    execute v_patched;
  end loop;
end;
$patch$;

-- The grants the two launchers carry are set by their own migrations and
-- `create or replace` does not disturb them. Restated as an assertion rather
-- than trusted, because a launcher that quietly became executable by a browser
-- role would be indistinguishable from a successful patch.
do $grants$
declare
  v_target text;
  v_leak text;
begin
  foreach v_target in array array[
    'launch_season_cup', 'launch_season_cup_groups'
  ] loop
    select pg_catalog.string_agg(grantee.privilege_type || ' to ' || grantee.grantee, ', ')
      into v_leak
      from information_schema.routine_privileges grantee
      join pg_catalog.pg_proc proc on proc.proname = grantee.routine_name
      join pg_catalog.pg_namespace space on space.oid = proc.pronamespace
     where space.nspname = 'predictor_internal'
       and grantee.routine_name = v_target
       and grantee.grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role');

    if v_leak is not null then
      raise exception 'Contract 186 left % executable: %', v_target, v_leak
        using errcode = '42501';
    end if;
  end loop;
end;
$grants$;

-- ===========================================================================
-- 4. Backfill
-- ===========================================================================
--
-- Exact, for the reason the header gives: both launchers already recorded their
-- plan, so this reads it rather than reconstructing it. The two spellings are
-- handled explicitly — `leagueRounds` from the single-group launcher and
-- `roundsNeeded` from the multi-group one — because coalescing them would hide
-- the case where a future launcher records neither.
--
-- The sequence is taken from the WINDOWS rather than from the recorded round
-- count wherever windows exist, so a backfilled competition records the same
-- measured quantity a freshly launched one does. Where the two disagree, the
-- windows are what the gate will read.
--
-- A competition with no launch audit row gets NO record. That is deliberate:
-- `CUP-002` refuses a competition it cannot place rather than guessing at one,
-- and a wrong span silently qualifies the wrong entrants.

with launched as (
  select distinct on (audit.competition_id)
    audit.competition_id,
    case audit.action
      when 'championship_launched' then 'single_group'
      when 'championship_group_stage_drawn' then 'groups'
    end as format_kind,
    coalesce(
      (audit.detail ->> 'leagueRounds')::integer,
      (audit.detail ->> 'roundsNeeded')::integer
    ) as recorded_rounds,
    audit.recorded_at
  from public.bonus_competition_audit audit
  where audit.action in ('championship_launched', 'championship_group_stage_drawn')
  order by audit.competition_id, audit.recorded_at desc
), measured as (
  select
    launched.competition_id,
    launched.format_kind,
    coalesce(
      (select max(window_row.sequence)
         from public.bonus_competition_windows window_row
        where window_row.competition_id = launched.competition_id),
      launched.recorded_rounds
    ) as group_stage_last_sequence,
    launched.recorded_at
  from launched
  where launched.format_kind is not null
)
insert into public.bonus_cup_launches (
  competition_id, format_kind, group_stage_last_sequence, launched_at
)
select
  measured.competition_id,
  measured.format_kind,
  measured.group_stage_last_sequence,
  measured.recorded_at
from measured
where measured.group_stage_last_sequence is not null
  and measured.group_stage_last_sequence between 1 and 200
on conflict (competition_id) do nothing;

-- ---------------------------------------------------------------------------
-- What the backfill could not place
-- ---------------------------------------------------------------------------
--
-- Reported rather than silently accepted. A Championship holding groups and no
-- launch record is a competition `CUP-002` will refuse, and the operator running
-- the rollout should learn that from the apply rather than from the refusal
-- months later.

do $report$
declare
  v_unplaced integer;
  v_placed integer;
begin
  select count(*)::integer into v_placed from public.bonus_cup_launches;

  select count(*)::integer into v_unplaced
    from public.bonus_competitions competition
   where competition.game_key = 'predictor_cup'
     and exists (
       select 1 from public.bonus_cup_groups grp
        where grp.competition_id = competition.id)
     and not exists (
       select 1 from public.bonus_cup_launches launch
        where launch.competition_id = competition.id);

  raise notice
    'Contract 186: % launch record(s) written; % drawn Championship(s) could not be placed and will be refused by the qualification gate',
    v_placed, v_unplaced;
end;
$report$;

-- ===========================================================================
-- 5. The tournament path is untouched
-- ===========================================================================
--
-- Asserted rather than stated. Contract 184 patched
-- `admin_finalise_predictor_cup_groups` in place and is the most recent thing
-- that could have been disturbed by another in-place patch running in the same
-- range, so its two generalised expressions are re-measured here.

do $untouched$
declare
  v_finalise text;
begin
  v_finalise := pg_catalog.pg_get_functiondef(
    'public.admin_finalise_predictor_cup_groups(uuid)'::regprocedure);

  if v_finalise !~ 'sequence between 1 and 3' then
    raise exception
      'Contract 186 expected the tournament settle gate to be unchanged and it is not'
      using errcode = '23514';
  end if;

  if v_finalise ~ 'bonus_cup_launches' then
    raise exception
      'Contract 186 must not reach the qualification gate; that is CUP-002'
      using errcode = '23514';
  end if;
end;
$untouched$;

commit;
