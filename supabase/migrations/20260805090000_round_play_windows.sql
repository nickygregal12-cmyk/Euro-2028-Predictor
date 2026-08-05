-- Contract 113: the round play window, and the resolver reassignment needs.
--
-- ---------------------------------------------------------------------------
-- THE GAP THIS CLOSES
-- ---------------------------------------------------------------------------
--
-- `src/domain/season/fixtureReassignment.ts` is the authority for a fixture
-- whose kickoff moves. It resolves the destination BY ROUND WINDOW: it takes a
-- `windowStartsAt` and `windowEndsAt` per round, refuses when no round contains
-- the new kickoff, and refuses again when more than one does.
--
-- `competition_rounds` has never had windows. So the authority has been
-- unreachable from the database since it was written, and contract 112 stopped
-- deliberately short of the fixture import for exactly this reason: deciding
-- how a round bounds time is not something to settle as a side effect of
-- ingestion plumbing.
--
-- ADR 0020 is explicit that this is lock-critical — "moving a fixture between
-- rounds changes two derived locks at once" — which is why the boundary gets a
-- contract, a guard and a test rather than an inline expression.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DECIDES, AND WHAT IT DELIBERATELY LEAVES OPEN
-- ---------------------------------------------------------------------------
--
-- ADR 0020 says a rescheduled fixture "is reassigned to the round its new
-- kickoff falls in". It does not define what falls in means, and there are two
-- readings that behave differently:
--
--   PLAY SPAN   a round bounds the time it is actually played — its own first
--               to its own last kickoff. Rounds do not tile the calendar, so a
--               midweek date between two matchweeks belongs to neither and
--               reassignment REFUSES.
--
--   TILED       rounds partition the season with no gaps, boundaries placed
--               somewhere between consecutive rounds, so every instant belongs
--               to exactly one round and reassignment always resolves.
--
-- This contract implements PLAY SPAN and stores the result, because it is the
-- reading that invents nothing: a round's window is a statement of when that
-- round is played, derived from its own fixtures. TILED requires choosing where
-- a boundary sits between rounds — a rule nobody has written down, which would
-- move a fixture into a round it was never played in.
--
-- The consequence is stated rather than buried: **a fixture rescheduled into
-- the gap between matchweeks resolves to no round, and the caller refuses**. A
-- refusal an operator can act on is the right failure for a lock-critical path;
-- silently attaching a Wednesday replay to whichever matchweek is nearer is
-- not. Widening the windows to tile the calendar remains available and is an
-- owner decision, not a migration's.
--
-- ---------------------------------------------------------------------------
-- WHY THE WINDOW IS STORED RATHER THAN COMPUTED AT READ TIME
-- ---------------------------------------------------------------------------
--
-- The derivation reads fixtures, and reassignment MOVES a fixture. Computing
-- the window from fixtures at the moment of resolving a move makes the answer
-- depend on the question: the fixture being moved is one of the rows defining
-- the window it is being tested against. Storing the window breaks the loop —
-- resolution reads a fact recorded before the move, and re-deriving afterwards
-- is a separate, deliberate act.
--
-- Storing it also lets the database enforce the property the domain module can
-- only report on. `ambiguous_destination_round` exists in the TypeScript
-- because it accepts arbitrary input. Here, overlapping windows are refused at
-- write time, so a stored calendar cannot produce that answer at all.

begin;

alter table public.competition_rounds
  add column if not exists window_opens_at timestamptz,
  add column if not exists window_closes_at timestamptz;

comment on column public.competition_rounds.window_opens_at is
  'Contract 113. Inclusive start of the span this round is played over. Null '
  'until derived; a round with no fixtures has no window and cannot be a '
  'reassignment destination.';

comment on column public.competition_rounds.window_closes_at is
  'Contract 113. Inclusive end of the span this round is played over.';

-- Both or neither. A half-set window is not a narrower window, it is a window
-- whose containment test cannot be evaluated — and the caller would read the
-- null as "no destination" for a round that has one.
alter table public.competition_rounds
  add constraint competition_rounds_window_paired
  check (
    (window_opens_at is null and window_closes_at is null)
    or (window_opens_at is not null and window_closes_at is not null)
  );

alter table public.competition_rounds
  add constraint competition_rounds_window_ordered
  check (
    window_opens_at is null
    or window_opens_at <= window_closes_at
  );

-- ---------------------------------------------------------------------------
-- Disjointness
--
-- Two rounds in one competition season may not claim the same instant. This is
-- what makes `ambiguous_destination_round` unreachable from stored data, and it
-- has to be a trigger rather than a CHECK because the rule spans rows.
--
-- Bounds are INCLUSIVE at both ends, matching the domain module's containment
-- test (`>= starts and <= ends`). So windows that merely touch — one closing at
-- the exact instant the next opens — overlap, and are refused. That is not
-- pedantry: a kickoff at that instant would satisfy both, which is precisely
-- the ambiguity being excluded.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.assert_round_window_disjoint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $guard$
declare
  v_clash record;
begin
  if new.window_opens_at is null then
    return new;
  end if;

  select other.id, other.round_key, other.window_opens_at, other.window_closes_at
    into v_clash
    from public.competition_rounds other
   where other.tournament_id = new.tournament_id
     and other.id <> new.id
     and other.window_opens_at is not null
     and other.window_opens_at <= new.window_closes_at
     and other.window_closes_at >= new.window_opens_at
   limit 1;

  if found then
    raise exception
      'Round % would claim time already claimed by round %, which runs % to %',
      new.round_key, v_clash.round_key, v_clash.window_opens_at, v_clash.window_closes_at
      using errcode = '23505';
  end if;

  return new;
end;
$guard$;

revoke all on function predictor_internal.assert_round_window_disjoint()
  from public, anon, authenticated, service_role;

create trigger assert_round_window_disjoint
before insert or update of tournament_id, window_opens_at, window_closes_at
on public.competition_rounds
for each row
execute function predictor_internal.assert_round_window_disjoint();

-- ---------------------------------------------------------------------------
-- Derivation
--
-- A round's window is when it is played: its own earliest kickoff to its own
-- latest. Rounds with no fixtures are left NULL rather than given an invented
-- span — the Scottish post-split matchweeks are exactly that case, and a
-- competition cannot say when a round will be played before it knows who is in
-- it.
--
-- Idempotent and safe to re-run: it recomputes every league matchweek in the
-- season from current fixtures. It writes in ordinal order so that a season
-- being derived for the first time never transiently overlaps itself.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.derive_round_play_windows(
  p_tournament_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $derive$
declare
  v_kind text;
  v_set integer := 0;
  v_round record;
begin
  select tournament.kind into v_kind
    from public.tournaments tournament
   where tournament.id = p_tournament_id;

  if v_kind is null then
    raise exception 'Competition season % does not exist', p_tournament_id
      using errcode = '23503';
  end if;

  -- Clear first, then set. Without this a round whose fixtures all moved away
  -- would keep a window it no longer plays over, and the disjointness guard
  -- would refuse the round that legitimately took that time.
  update public.competition_rounds
     set window_opens_at = null, window_closes_at = null
   where tournament_id = p_tournament_id;

  for v_round in
    select round.id, span.first_kickoff, span.last_kickoff
      from public.competition_rounds round
      join lateral (
        select min(fixture.kickoff_at) as first_kickoff,
               max(fixture.kickoff_at) as last_kickoff
          from public.season_fixtures fixture
         where fixture.competition_round_id = round.id
           and fixture.kickoff_at is not null
      ) span on true
     where round.tournament_id = p_tournament_id
       and span.first_kickoff is not null
     order by round.ordinal
  loop
    update public.competition_rounds
       set window_opens_at = v_round.first_kickoff,
           window_closes_at = v_round.last_kickoff
     where id = v_round.id;
    v_set := v_set + 1;
  end loop;

  return v_set;
end;
$derive$;

revoke all on function predictor_internal.derive_round_play_windows(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Resolution
--
-- Null when no round claims the instant, which is an ordinary answer rather
-- than an error: a fixture rescheduled into the gap between matchweeks has no
-- destination, and the caller's job is to refuse the move and say so.
--
-- It cannot return an ambiguous answer, because the disjointness trigger makes
-- two claimants impossible — but it is still written to fail loudly rather than
-- pick one, so that a future migration weakening the trigger is caught here
-- instead of silently choosing a round.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.resolve_round_for_kickoff(
  p_tournament_id uuid,
  p_kickoff timestamptz
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $resolve$
declare
  v_ids uuid[];
begin
  if p_kickoff is null then
    return null;
  end if;

  select array_agg(round.id order by round.ordinal)
    into v_ids
    from public.competition_rounds round
   where round.tournament_id = p_tournament_id
     and round.window_opens_at is not null
     and p_kickoff >= round.window_opens_at
     and p_kickoff <= round.window_closes_at;

  if v_ids is null or array_length(v_ids, 1) = 0 then
    return null;
  end if;

  if array_length(v_ids, 1) > 1 then
    raise exception
      'Instant % falls in % rounds of competition season %, which the disjointness guard should have made impossible',
      p_kickoff, array_length(v_ids, 1), p_tournament_id
      using errcode = '23505';
  end if;

  return v_ids[1];
end;
$resolve$;

revoke all on function predictor_internal.resolve_round_for_kickoff(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prove the shape, in the same transaction.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from public.competition_rounds
     where window_opens_at is not null or window_closes_at is not null
  ) then
    raise exception 'competition_rounds windows must start unset; this migration derives nothing';
  end if;

  -- Adding columns to a table a browser can read would widen what a browser
  -- can see. Measured rather than assumed: this table is granted to
  -- service_role only, so the new columns reach no browser session.
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'competition_rounds'
       and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'competition_rounds is browser-readable; the new window columns would widen the surface';
  end if;
end;
$$;

commit;
