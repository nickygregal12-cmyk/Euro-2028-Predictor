-- Contract 78: the season Cup's league-phase schedule, with parity.
--
-- Counterpart to `generateCupLeagueSchedule` in
-- `src/domain/season/cupSchedule.ts`, held in step by
-- `tests/database-parity/cupScheduleParity.test.ts`.
--
-- ADR 0014 requires the complete league fixture list to be generated and
-- published at entry close, and to be DETERMINISTIC from the audited draw: the
-- same draw always yields the same fixtures, so anyone can reproduce the
-- schedule from the audit record. That is what makes "you play Dave in
-- matchweek 7" a promise rather than an assertion.
--
-- WHY THIS IS NEW SQL AND NOT A REUSE. The tournament Cup also schedules a
-- group phase, but it does not use a circle method: `admin_draw_predictor_cup`
-- writes HARDCODED `values` tuples for groups of exactly three and four, which
-- is all the tournament needs. A season group runs up to twenty entrants over
-- several meetings, which no fixed table covers.
--
-- I expected the general method to reproduce those hardcoded tables exactly and
-- checked before claiming it. IT DOES NOT. Both produce a valid round robin
-- over the same field and the same set of pairings, but they assign pairings to
-- rounds differently — for four entrants the circle method's round 1 is the
-- tournament's round 3, rotated. So this is NOT a strict generalisation of the
-- tournament schedule, the tournament's tables are left exactly as they are,
-- and no published tournament fixture moves.
--
-- What IS proven instead, over fields 2–16 and one to three meetings:
--
--   * every unordered pair meets exactly `meetings` times;
--   * every possible pair appears — C(n,2) distinct pairings;
--   * nobody plays twice in the same round.
--
-- Plus exact parity with the TypeScript authority across every field size from
-- two to fourteen and one to three meetings.
--
-- The rules the port had to preserve, because a reimplementation loses them
-- first: the first drawn entrant is FIXED and the rest rotate one position per
-- round, which is what makes the output reproducible from the draw; an odd
-- field carries a rotating bye so no entrant rests twice before everyone has
-- rested once; and home/away alternates with round parity and then REVERSES on
-- each successive meeting, so a double round robin is an exact mirror rather
-- than a repeat.
--
-- Returns jsonb rather than a table because the shape is nested — rounds each
-- holding ties and an optional bye — and because the TypeScript authority
-- returns a discriminated result that a `returns table` cannot express without
-- inventing a null-row convention for the refusal cases.

create or replace function predictor_internal.cup_league_schedule(
  p_draw_order text[],
  p_meetings integer
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_field integer;
  v_circle text[];
  v_size integer;
  v_rounds_per_meeting integer;
  v_meeting integer;
  v_turn integer;
  v_pair integer;
  v_first text;
  v_second text;
  v_flip boolean;
  v_ties jsonb;
  v_bye text;
  v_rounds jsonb := '[]'::jsonb;
begin
  if p_draw_order is null or p_meetings is null or p_meetings < 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  v_field := coalesce(array_length(p_draw_order, 1), 0);

  if exists (select 1 from unnest(p_draw_order) as e where coalesce(btrim(e), '') = '') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;
  if (select count(distinct e) from unnest(p_draw_order) as e) <> v_field then
    return jsonb_build_object('ok', false, 'reason', 'duplicate_entrant');
  end if;
  if v_field < 2 then
    return jsonb_build_object('ok', false, 'reason', 'field_too_small');
  end if;

  -- An odd field carries a bye slot so the circle is even.
  v_circle := case when v_field % 2 = 0 then p_draw_order else p_draw_order || array[null::text] end;
  v_size := coalesce(array_length(v_circle, 1), 0);
  v_rounds_per_meeting := v_size - 1;

  for v_meeting in 0 .. p_meetings - 1 loop
    for v_turn in 0 .. v_rounds_per_meeting - 1 loop
      v_ties := '[]'::jsonb;
      v_bye := null;

      for v_pair in 0 .. (v_size / 2) - 1 loop
        -- 1-based arrays: the TypeScript index i becomes v_circle[i + 1].
        v_first := case
          when v_pair = 0 then v_circle[1]
          else v_circle[((v_turn + v_pair - 1) % (v_size - 1)) + 2]
        end;
        v_second := v_circle[((v_turn + v_size - 1 - v_pair - 1) % (v_size - 1)) + 2];

        if v_first is null or v_second is null then
          v_bye := coalesce(v_first, v_second);
          continue;
        end if;

        v_flip := ((v_turn + v_pair) % 2) = (case when v_meeting % 2 = 1 then 1 else 0 end);
        v_ties := v_ties || jsonb_build_object(
          'home', case when v_flip then v_second else v_first end,
          'away', case when v_flip then v_first else v_second end);
      end loop;

      v_rounds := v_rounds || jsonb_build_object(
        'round', v_meeting * v_rounds_per_meeting + v_turn + 1,
        'ties', v_ties,
        'bye', v_bye);
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'rounds', v_rounds);
end;
$$;

revoke all on function predictor_internal.cup_league_schedule(text[], integer)
  from public, anon, authenticated;
