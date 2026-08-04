-- Contract 91: what a matchweek card means for scoring, in SQL.
--
-- Counterpart to `resolveMatchweekSettlement` in
-- `src/domain/season/matchweekSettlement.ts`, authority ADR 0012 as amended by
-- ADR 0020, held in step by `tests/database-parity/matchweekSettlementParity.test.ts`.
--
-- WHY THIS COMES BEFORE THE SCORING JOB, and not after. Contract 90 added the
-- season score store and deliberately did not define when a matchweek has
-- SETTLED. This does. A job that settled a matchweek on "every fixture has a
-- score" would be wrong in a way that never looks wrong: it would count a VOID
-- fixture as played, and `src/domain/season/standings.ts` shows matches played
-- beside points precisely so that "two players on 84 points from 22 and 23
-- matchweeks are not tied in meaning". Every points total would be right and
-- every table subtly false.
--
-- ---------------------------------------------------------------------------
-- THREE STATES, NEVER COLLAPSED INTO ONE FLAG
-- ---------------------------------------------------------------------------
--
-- ADR 0012 keeps the reschedule/exception model as three distinct things, and
-- the whole value of this module is refusing to merge them:
--
--   postponed/rescheduled — movement BETWEEN rounds, decided by
--                           `fixtureReassignment.ts`. A fixture that moved away
--                           is simply absent from this card, so it is not a
--                           state here at all;
--   abandoned             — started and not completed. The partial score does
--                           NOT stand, and the prediction carries to the replay
--                           in full;
--   void                  — never to be played. No points to anyone, and the
--                           fixture LEAVES the matches-played denominator.
--
-- ---------------------------------------------------------------------------
-- THE DENOMINATOR RULE THAT IS EASY TO GET WRONG
-- ---------------------------------------------------------------------------
--
-- Matches played excludes void AND carried-to-replay. Void is the obvious one.
-- The second is not: an abandoned fixture whose replay is known has handed its
-- slot to the replay, and the replay counts wherever it is played — so counting
-- both would count one match twice and inflate every affected player's
-- denominator. An implementation that only remembered the void rule would pass
-- every test that has no abandoned fixture in it.
--
-- ---------------------------------------------------------------------------
-- A CONTRADICTORY CARD REFUSES WHOLE
-- ---------------------------------------------------------------------------
--
-- The TypeScript refuses the entire card rather than settling around a bad
-- fixture, on the reasoning that a card which can misreport one fixture can
-- misreport the total. The refusal REASONS and their order are part of the
-- contract, not diagnostics: the first offending fixture in caller order
-- decides, and within one fixture the checks run in the order below. Two
-- different faults on one card must produce the same answer in both languages,
-- or the parity is only skin deep.

begin;

-- ---------------------------------------------------------------------------
-- What counts as a score, mirroring `isValidScore`.
--
-- Split out because it is applied twice with DIFFERENT consequences — a
-- `completed` fixture without one is `completed_without_result`, an
-- `abandoned` fixture carrying a malformed one is `invalid_input` — and
-- because a shared predicate cannot drift between the two the way two inline
-- copies can.
--
-- `jsonb_typeof(...) = 'number'` is not enough on its own: JSON has one number
-- type, so 2.5 arrives as a number and would pass. TypeScript uses
-- `Number.isInteger`, so the floor comparison below is what matches it.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.is_settlement_score(p_score jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- THE COALESCE IS LOAD-BEARING, and its absence is why the first version of
  -- this function was wrong. `'{}'::jsonb->'home'` is SQL NULL, so
  -- `jsonb_typeof(...) = 'number'` is NULL, so the whole conjunction is NULL —
  -- and the caller's `if not is_settlement_score(...)` then tests NULL, which
  -- is not true, so the guard does not fire and a scoreless `completed`
  -- fixture settles as scoreable with a null final score.
  --
  -- A differential sweep against the TypeScript caught it on seven cases. It is
  -- the same three-valued-logic shape as the tournament's
  -- `entry_automatic_submission_outcomes` CHECK, which accepts an `invalid`
  -- outcome with a null failure message for exactly this reason. A predicate
  -- used inside a NOT must return a boolean, never a null.
  select coalesce(
    jsonb_typeof(p_score) = 'object'
      and jsonb_typeof(p_score->'home') = 'number'
      and jsonb_typeof(p_score->'away') = 'number'
      and (p_score->>'home')::numeric = floor((p_score->>'home')::numeric)
      and (p_score->>'away')::numeric = floor((p_score->>'away')::numeric)
      and (p_score->>'home')::numeric >= 0
      and (p_score->>'away')::numeric >= 0,
    false);
$$;

revoke all on function predictor_internal.is_settlement_score(jsonb)
  from public, anon, authenticated;

create or replace function predictor_internal.resolve_matchweek_settlement(
  p_fixtures jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_fixture jsonb;
  v_id text;
  v_state text;
  v_score jsonb;
  v_replay text;
  v_seen text[] := array[]::text[];
  v_dispositions jsonb := '[]'::jsonb;
  v_kind text;
  v_denominator integer := 0;
  v_carries jsonb := '[]'::jsonb;
  v_settled boolean := true;
begin
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  -- Validation first, over the WHOLE card, before any disposition is decided.
  -- The TypeScript does the same, and it matters: a card that refuses must
  -- refuse before it has computed a denominator anyone might read.
  for v_fixture in
    select value from jsonb_array_elements(p_fixtures) with ordinality as t(value, position)
    order by t.position
  loop
    v_id := v_fixture->>'id';
    v_state := v_fixture->>'state';
    v_score := v_fixture->'score';
    v_replay := v_fixture->>'replayFixtureId';

    if coalesce(btrim(v_id), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
    if v_id = any (v_seen) then
      return jsonb_build_object('ok', false, 'reason', 'duplicate_fixture');
    end if;
    v_seen := v_seen || v_id;

    if v_state is null or v_state not in ('scheduled', 'completed', 'abandoned', 'void') then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;

    if v_state = 'completed'
       and not predictor_internal.is_settlement_score(v_score) then
      return jsonb_build_object('ok', false, 'reason', 'completed_without_result');
    end if;

    -- A score on a fixture that has not started, or will never be played, is
    -- contradictory data rather than a harmless extra.
    if v_state in ('scheduled', 'void')
       and v_score is not null and jsonb_typeof(v_score) <> 'null' then
      return jsonb_build_object('ok', false, 'reason', 'score_on_unplayed_fixture');
    end if;

    -- An abandoned fixture MAY carry its partial score, which never stands. If
    -- it carries one, it must still be a score.
    if v_state = 'abandoned'
       and v_score is not null and jsonb_typeof(v_score) <> 'null'
       and not predictor_internal.is_settlement_score(v_score) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;

    if v_replay is not null then
      if v_state <> 'abandoned' then
        return jsonb_build_object('ok', false, 'reason', 'replay_on_non_abandoned_fixture');
      end if;
      if btrim(v_replay) = '' then
        return jsonb_build_object('ok', false, 'reason', 'invalid_input');
      end if;
      if v_replay = v_id then
        return jsonb_build_object('ok', false, 'reason', 'replay_self_reference');
      end if;
    end if;
  end loop;

  -- Dispositions, in caller order.
  for v_fixture in
    select value from jsonb_array_elements(p_fixtures) with ordinality as t(value, position)
    order by t.position
  loop
    v_id := v_fixture->>'id';
    v_state := v_fixture->>'state';
    v_score := v_fixture->'score';
    v_replay := v_fixture->>'replayFixtureId';

    if v_state = 'completed' then
      v_kind := 'scoreable';
      v_dispositions := v_dispositions || jsonb_build_object(
        'fixtureId', v_id,
        'disposition', jsonb_build_object(
          'kind', 'scoreable',
          'finalScore', jsonb_build_object(
            'home', (v_score->>'home')::integer,
            'away', (v_score->>'away')::integer)));
    elsif v_state = 'scheduled' then
      v_kind := 'awaiting_result';
      v_dispositions := v_dispositions || jsonb_build_object(
        'fixtureId', v_id,
        'disposition', jsonb_build_object('kind', 'awaiting_result'));
    elsif v_state = 'abandoned' and v_replay is null then
      v_kind := 'awaiting_replay';
      v_dispositions := v_dispositions || jsonb_build_object(
        'fixtureId', v_id,
        'disposition', jsonb_build_object('kind', 'awaiting_replay'));
    elsif v_state = 'abandoned' then
      v_kind := 'carried_to_replay';
      v_dispositions := v_dispositions || jsonb_build_object(
        'fixtureId', v_id,
        'disposition', jsonb_build_object(
          'kind', 'carried_to_replay', 'replayFixtureId', v_replay));
      v_carries := v_carries || jsonb_build_object(
        'fromFixtureId', v_id, 'toFixtureId', v_replay);
    else
      v_kind := 'void_no_points';
      v_dispositions := v_dispositions || jsonb_build_object(
        'fixtureId', v_id,
        'disposition', jsonb_build_object('kind', 'void_no_points'));
    end if;

    -- Void leaves the denominator, and so does a fixture already carried to a
    -- known replay: its slot belongs to the replay now. See the header.
    if v_kind not in ('void_no_points', 'carried_to_replay') then
      v_denominator := v_denominator + 1;
    end if;

    -- Nothing may still be waiting for a settled card.
    if v_kind in ('awaiting_result', 'awaiting_replay') then
      v_settled := false;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'settlement', jsonb_build_object(
      'fixtures', v_dispositions,
      'matchesPlayedDenominator', v_denominator,
      'predictionCarries', v_carries,
      'settled', v_settled));
end;
$$;

revoke all on function predictor_internal.resolve_matchweek_settlement(jsonb)
  from public, anon, authenticated;

commit;
