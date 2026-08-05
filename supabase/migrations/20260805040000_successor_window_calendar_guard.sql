-- Contract 108: a restarted competition cannot inherit its predecessor's past.
--
-- Contract 107 created the Last Man Standing restart and deliberately left
-- window generation out, because "the next eligible league round" has no
-- calendar authority to read yet. The successor is therefore inert: it has
-- entrants and no rounds.
--
-- Inert is the correct resting state. What this contract adds is the guard that
-- keeps it there, because the one committed path that creates windows would
-- take the successor out of it in exactly the wrong direction.
--
-- ---------------------------------------------------------------------------
-- THE FAILURE THIS PREVENTS, TRACED END TO END
-- ---------------------------------------------------------------------------
--
-- `scripts/bonus-games/publish-catalogue.sql` is the only committed writer of
-- `bonus_competition_windows`. It is documented as safe to rerun, it runs in CI
-- on every Browser E2E job, and it selects its target with
--
--     visibility_kind = 'public' and completed_at is null
--
-- which after a restart is the SUCCESSOR. A rerun would write the original
-- seven-round Euro calendar onto the fresh competition, with a full set of
-- fixture links.
--
-- A wipeout happens DURING a tournament, so at that moment some of those rounds
-- have already locked and been played. Those are the dangerous ones: a round
-- the re-entered field can never pick in, on a competition that has only just
-- started.
--
-- `recompute_lms_for_tournament` then reads exactly those rows. Its round
-- filter is "locked, fixtured, and every fixture confirmed", which all seven
-- would satisfy at once. No entrant on a fresh competition has a selection, so
-- `v_survivors` comes back empty for every round, which trips the ADR 0013
-- whole-round wipeout rule — `v_survivors := v_alive`, everybody carries. That
-- rule is right: when a real round eliminates the entire field, the round is
-- void. It simply cannot tell "nobody survived" from "nobody played".
--
-- The loop then reaches the last sequence, sets `v_final_settled`, and the
-- final update writes `'champion'` to every entrant.
--
-- So the restarted competition crowns its ENTIRE FIELD without a single pick
-- being made — from rerunning a script whose own header calls it safe to rerun.
--
-- None of the components is wrong. The rederive follows the ADR, the publisher
-- targets the live competition as contract 103 requires, and contract 107 was
-- right to defer the calendar. The defect lives in the join between them, which
-- is why the fix belongs here rather than in any one of them.
--
-- ---------------------------------------------------------------------------
-- THE RULE
-- ---------------------------------------------------------------------------
--
-- A window on a competition that names a predecessor may not open or lock
-- before that predecessor finished.
--
-- It is deliberately narrow. It says nothing about first instances, so the Euro
-- catalogue — whose rounds are all in the past relative to nothing at all — is
-- untouched. It says nothing about a competition whose predecessor has not
-- completed, which contract 103's lineage rules govern rather than this one.
-- And it is not a rule about registration: a season competition may legitimately
-- open registration after several rounds have already been played, which is why
-- the restart driver stamps `joined_at = now()` and lets the rolling-entry rules
-- compare against kickoff. Tying the guard to registration would have refused
-- that legitimate case while still permitting this one.
--
-- What it does say is the thing that is never legitimate: a competition that
-- exists because another one ended cannot contain a round that happened before
-- that ending.
--
-- ---------------------------------------------------------------------------
-- WHAT THIS DELIBERATELY DOES NOT DO
-- ---------------------------------------------------------------------------
--
-- It does not schedule anything, and it does not decide where a successor's
-- calendar starts. Rounds still ahead of the restart pass this guard, and that
-- is correct — the re-entered field can play them. So publishing the original
-- calendar mid-tournament is refused for the rounds already gone and permitted
-- for the rounds remaining, which is a partial answer rather than a plan.
--
-- The scheduler still owes the real one: which round is the NEXT ELIGIBLE one,
-- what the successor's rounds are numbered, and what their instants should be.
-- Nothing here relieves it of that. What it removes is the outcome where a
-- competition settles rounds nobody could have played in.
--
-- ---------------------------------------------------------------------------
-- WHY A TRIGGER RATHER THAN A FIX IN THE SCRIPT
-- ---------------------------------------------------------------------------
--
-- The script is fixed too, in the same change, and it refuses earlier and with
-- a better message. But a script guard protects one writer. This protects the
-- table. The window scheduler that eventually lands — the one that has to
-- decide where the successor's calendar starts — is precisely the code most
-- able to make this mistake, and it will be written against a database that
-- already refuses it.

begin;

create or replace function predictor_internal.assert_successor_window_after_predecessor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $guard$
declare
  v_predecessor_id uuid;
  v_predecessor_completed_at timestamptz;
begin
  select competition.predecessor_competition_id
    into v_predecessor_id
    from public.bonus_competitions competition
    where competition.id = new.competition_id;

  -- A first instance has no earlier competition to be inconsistent with.
  if v_predecessor_id is null then
    return new;
  end if;

  select predecessor.completed_at
    into v_predecessor_completed_at
    from public.bonus_competitions predecessor
    where predecessor.id = v_predecessor_id;

  -- A predecessor that has not finished supplies no boundary. Whether that
  -- state should exist at all is contract 103's question, not this one's.
  if v_predecessor_completed_at is null then
    return new;
  end if;

  if new.opens_at is not null and new.opens_at < v_predecessor_completed_at then
    raise exception
      'A restarted competition cannot open a round before its predecessor finished: round % opens at %, and the predecessor completed at %.',
      new.sequence, new.opens_at, v_predecessor_completed_at
      using errcode = '23514';
  end if;

  if new.locks_at is not null and new.locks_at < v_predecessor_completed_at then
    raise exception
      'A restarted competition cannot lock a round before its predecessor finished: round % locks at %, and the predecessor completed at %.',
      new.sequence, new.locks_at, v_predecessor_completed_at
      using errcode = '23514';
  end if;

  return new;
end;
$guard$;

revoke all on function predictor_internal.assert_successor_window_after_predecessor()
  from public, anon, authenticated, service_role;

-- Named after `a_prepare_competition_season_scope`, which must still run first:
-- BEFORE triggers fire in name order, and `a_` sorts before `assert_`.
drop trigger if exists assert_successor_window_after_predecessor
  on public.bonus_competition_windows;

create trigger assert_successor_window_after_predecessor
before insert or update of competition_id, opens_at, locks_at
on public.bonus_competition_windows
for each row execute function predictor_internal.assert_successor_window_after_predecessor();

commit;
