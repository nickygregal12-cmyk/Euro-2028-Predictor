-- Contract 96: which fault a contradictory Cup tie reports.
--
-- A DEFECT FOUND BY A DIFFERENTIAL SWEEP, not by reading either implementation.
-- `settleCupTie` and `settle_season_cup_tie` have existed side by side since
-- contract 74 with no parity suite between them. Building one found that they
-- disagree on 40 of 1200 randomised ties — never about whether to refuse, always
-- about WHY.
--
-- Two independent causes, and the second is the more interesting:
--
--   1. THE SQL INTERLEAVED THE TWO ENTRANTS. It walked the confirmed fixtures
--      once, checking home and then away within each iteration, so a tie where
--      home is wrong at a later fixture and away at an earlier one reported
--      away's fault. The TypeScript evaluates home COMPLETELY, then away.
--
--   2. THE TYPESCRIPT DEPENDED ON JAVASCRIPT KEY ORDER. Within one entrant it
--      checked "not on the card" and "not confirmed" per key, so a point map
--      carrying one of each returned whichever came first in insertion order.
--      `jsonb` does not preserve key order — it normalises to (length, then
--      bytes) — so no SQL counterpart could ever have matched that rule.
--      Confirmed directly: `{"zz":3,"b":3,"a":3}` returns `invalid_input` in
--      TypeScript and `points_for_unconfirmed_fixture` in PostgreSQL for the
--      same card.
--
-- The second is a fault in the authority on its own terms, independent of any
-- database. Two callers building the same logical tie with keys written in a
-- different order got different reasons, and ADR 0014 specifies no such order.
-- `src/domain/season/cupTieSettlement.ts` is corrected in the same commit to
-- check all keys for one condition before any key for the next, which makes the
-- reason order-independent. This function is rewritten to match it.
--
-- WHAT DOES NOT CHANGE is whether a tie settles, or the points and match points
-- when it does. Every case that settled before still settles to the same
-- result; every case that refused before still refuses. Only the reason
-- attached to a refusal moves, and only for a tie that is wrong in more than one
-- way at once.
--
-- SAFE TO REDEFINE IN PLACE: this function has no caller. Contracts 74 to 79
-- built the season Cup's rules and stores and nothing has ever driven them, so
-- there is no stored outcome and no audit row carrying the old reason. That is
-- also why the drift survived two contracts unnoticed — an unused pair cannot
-- fail loudly.

begin;

-- ---------------------------------------------------------------------------
-- One entrant's total, or the reason their points are unusable.
--
-- Split out for the same reason the TypeScript has an `entrantTotal`: the four
-- checks have to run identically for home and for away, and two inline copies
-- are two things that can drift. That is not a hypothetical here — inline
-- copies interleaved by fixture are exactly the bug this contract fixes.
--
-- Returns `{"total": n}` or `{"ok": false, "reason": ...}`. The caller
-- distinguishes them by the presence of `reason`, so a total of zero — which is
-- a perfectly ordinary Cup score — is never mistaken for a refusal.
-- ---------------------------------------------------------------------------

create or replace function predictor_internal.cup_tie_entrant_total(
  p_entrant jsonb,
  p_confirmed text[],
  p_card text[]
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_points integer;
  v_total integer := 0;
begin
  -- PASS ONE: every key must name a fixture on the card.
  -- PASS TWO: every key must name a fixture the cutoff confirmed.
  --
  -- Two passes rather than both checks per key, so the reason does not depend
  -- on the order the keys happen to be stored in. `jsonb` normalises key order
  -- to (length, then bytes) and JavaScript preserves insertion order; a rule
  -- that reads one key at a time can never agree across the two.
  for v_key in select jsonb_object_keys(p_entrant->'fixturePoints') loop
    if not (v_key = any (p_card)) then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
  end loop;

  for v_key in select jsonb_object_keys(p_entrant->'fixturePoints') loop
    if not (v_key = any (p_confirmed)) then
      return jsonb_build_object('ok', false, 'reason', 'points_for_unconfirmed_fixture');
    end if;
  end loop;

  -- The confirmed fixtures in CARD order, which both languages share, so these
  -- two checks need no such treatment.
  foreach v_key in array p_confirmed loop
    v_points := (p_entrant->'fixturePoints'->>v_key)::integer;
    if v_points is null then
      return jsonb_build_object('ok', false, 'reason', 'points_missing_for_confirmed_fixture');
    end if;
    if v_points not in (0, 3, 5) then
      return jsonb_build_object('ok', false, 'reason', 'points_off_raw_scale');
    end if;
    v_total := v_total + v_points;
  end loop;

  return jsonb_build_object('total', v_total);
end;
$$;

revoke all on function predictor_internal.cup_tie_entrant_total(jsonb, text[], text[])
  from public, anon, authenticated;

create or replace function predictor_internal.settle_season_cup_tie(
  p_fixtures jsonb,
  p_home jsonb,
  p_away jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_confirmed text[];
  v_card text[];
  v_fixture text;
  v_home_total integer := 0;
  v_away_total integer := 0;
  v_result text;
  v_home_match integer;
  v_away_match integer;
  v_settled integer;
  v_card_size integer;
  v_outcome jsonb;
begin
  if p_fixtures is null or jsonb_typeof(p_fixtures) <> 'array'
     or p_home is null or p_away is null
     or coalesce(btrim(p_home->>'entryId'), '') = ''
     or coalesce(btrim(p_away->>'entryId'), '') = ''
     or jsonb_array_length(p_fixtures) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  if p_home->>'entryId' = p_away->>'entryId' then
    return jsonb_build_object('ok', false, 'reason', 'same_entrant_twice');
  end if;

  -- The card, in caller order, refusing a blank or repeated fixture id.
  v_card := array[]::text[];
  for v_fixture in
    select fixture->>'fixtureId'
      from jsonb_array_elements(p_fixtures) with ordinality as t(fixture, position)
     order by t.position
  loop
    if coalesce(btrim(v_fixture), '') = '' then
      return jsonb_build_object('ok', false, 'reason', 'invalid_input');
    end if;
    if v_fixture = any (v_card) then
      return jsonb_build_object('ok', false, 'reason', 'duplicate_fixture');
    end if;
    v_card := v_card || v_fixture;
  end loop;

  select array_agg(fixture->>'fixtureId' order by t.position)
    into v_confirmed
    from jsonb_array_elements(p_fixtures) with ordinality as t(fixture, position)
   where (fixture->>'confirmedByCutoff')::boolean;

  if v_confirmed is null or cardinality(v_confirmed) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_settled_fixtures');
  end if;

  -- HOME COMPLETELY, THEN AWAY. See the header: interleaving them reported the
  -- wrong entrant's fault whenever both were wrong.
  v_outcome := predictor_internal.cup_tie_entrant_total(p_home, v_confirmed, v_card);
  if v_outcome ? 'reason' then
    return v_outcome;
  end if;
  v_home_total := (v_outcome->>'total')::integer;

  v_outcome := predictor_internal.cup_tie_entrant_total(p_away, v_confirmed, v_card);
  if v_outcome ? 'reason' then
    return v_outcome;
  end if;
  v_away_total := (v_outcome->>'total')::integer;

  if v_home_total > v_away_total then
    v_result := 'home_win'; v_home_match := 3; v_away_match := 0;
  elsif v_away_total > v_home_total then
    v_result := 'away_win'; v_home_match := 0; v_away_match := 3;
  else
    v_result := 'draw'; v_home_match := 1; v_away_match := 1;
  end if;

  v_settled := cardinality(v_confirmed);
  v_card_size := cardinality(v_card);

  return jsonb_build_object(
    'ok', true,
    'settlement', jsonb_build_object(
      'result', v_result,
      'home', jsonb_build_object('entryId', p_home->>'entryId',
                                 'points', v_home_total, 'matchPoints', v_home_match),
      'away', jsonb_build_object('entryId', p_away->>'entryId',
                                 'points', v_away_total, 'matchPoints', v_away_match),
      'settledOnFixtures', v_settled,
      'fixtureCardSize', v_card_size,
      'reducedSet', v_settled < v_card_size));
end;
$$;

revoke all on function predictor_internal.settle_season_cup_tie(jsonb, jsonb, jsonb)
  from public, anon, authenticated;

commit;
